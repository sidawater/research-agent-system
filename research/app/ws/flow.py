import traceback
import json
import logging
import uuid
import typing
from dataclasses import dataclass

from fastapi import APIRouter, WebSocket
from core.workflow.graph2 import create_research_graph
# from core.workflow.graph import create_research_graph
from app.handler.flow import FlowHandler, Session
from starlette.websockets import WebSocketDisconnect, WebSocketState

router = APIRouter(prefix="/api/v1")
logger = logging.getLogger(__name__)


@dataclass()
class Request:
    session_id: typing.Optional[str] = None
    query: typing.Optional[str] = None
    search_results_satisfactory: typing.Optional[bool] = None
    report_satisfactory: typing.Optional[bool] = None
    mode: typing.Optional[str] = 'semantic'


async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    current_session_id: typing.Optional[str] = None

    try:
        while True:
            data = await websocket.receive_text()
            request = Request(**json.loads(data))
            graph = await create_research_graph(mode=request.mode)

            # Reload session from database on each request to avoid stale data
            if not request.session_id:
                session = await FlowHandler.create_session(str(uuid.uuid4()))
                current_session_id = session.session_id
                session.research_state.query = request.query or ''
                await websocket.send_json({'type': 'content', 'data': "welcome!"})
            else:
                current_session_id = request.session_id
                # Always reload session from database to get the latest state
                session = await FlowHandler.get_or_create_session(current_session_id)
                if not session:
                    await websocket.send_json({'type': 'error', 'data': "Failed to load session"})
                    continue

            if not (session.research_state.query or request.query):
                await websocket.send_json({'type': 'content', 'data': "wait for your query..."})
                continue

            if request.query:
                session.research_state.query = request.query
                if session.research_state.supply_query:
                    session.research_state.supply_query.append(request.query)
                else:
                    session.research_state.supply_query = [request.query]

            session.research_state.search_results_satisfactory = request.search_results_satisfactory
            session.research_state.report_satisfactory = request.report_satisfactory

            logger.info(f"Session: {session}")
            handler = FlowHandler(graph=graph, session=session)
            reply_generator = handler.handle()

            if reply_generator is None:
                continue

            async for chunk in reply_generator:
                await websocket.send_json(chunk)

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected by client")
    except RuntimeError as e:
        if "Event loop is closed" in str(e):
            logger.warning(f"WebSocket connection closed due to closed event loop-{traceback.format_exc()}")
        else:
            logger.error(f"Runtime error in websocket endpoint: {traceback.format_exc()}")
    except Exception:
        logger.error(traceback.format_exc())
    finally:
        try:
            if websocket.application_state != WebSocketState.DISCONNECTED:
                await websocket.close()
        except RuntimeError:
            pass


def register_routes():
    """
    注册路由函数，符合项目路由注册规范
    """

    return router

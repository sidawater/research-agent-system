import traceback
import json
import logging
import uuid
import typing
from dataclasses import dataclass

from fastapi import APIRouter, WebSocket
from core.workflow.graph import create_research_graph
from app.handler.flow import FlowHandler, Session

router = APIRouter(prefix="/api/v1")
logger = logging.getLogger(__name__)


@dataclass()
class Request:
    session_id: typing.Optional[str] = None
    query: typing.Optional[str] = None
    need_export: typing.Optional[bool] = None


async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    graph = await create_research_graph()
    session: typing.Optional[Session] = None

    try:
        while True:
            data = await websocket.receive_text()
            request = Request(**json.loads(data))
            if not request.session_id:
                session = await FlowHandler.create_session(str(uuid.uuid4()))
                session.research_state.query = request.query or ''
                await websocket.send_json({'type': 'content', 'data': "welcome!"})
            elif not session:
                session = await FlowHandler.get_session(request.session_id)
                if not session:
                    session = await FlowHandler.create_session(request.session_id)
                    await websocket.send_json({'type': 'content', 'data': f"welcome!"})

            if not (session.research_state.query or request.query):
                await websocket.send_json({'type': 'content', 'data': "wait for your query..."})
                continue

            if request.query and request.query != session.research_state.query:
                session.research_state.query += request.query
            if request.need_export:
                session.research_state.user_decision_export = request.need_export
                session.research_state.user_decision_download = request.need_export

            logger.info(f"Session: {session}")
            handler = FlowHandler(graph=graph, session=session)
            reply_generator = handler.handle()

            if reply_generator is None:
                break

            async for chunk in reply_generator:
                await websocket.send_json(chunk)

    except Exception as e:
        logger.error(traceback.format_exc())
    finally:
        await websocket.close()


def register_routes():
    """
    注册路由函数，符合项目路由注册规范
    """

    return router

import traceback
import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel
from core.common import get_logger
from core.common.schemas import ResearchState, AcademicSearchResult
from db.mongo import mongodb

logger = get_logger(__name__)


class Session(BaseModel):
    """会话模型，包含研究状态和会话元信息"""
    session_id: Optional[str] = None
    research_state: Optional[ResearchState] = None
    messages: List[Dict] = []
    user_id: str = ""
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None


class FlowHandler:
    """
    :param graph: 工作流图对象，用于执行研究任务
    :param session: Session 类型，表示当前研究状态
    :returns : 无返回值
    """

    def __init__(
            self,
            graph,
            session: Session,
    ):
        self.graph = graph
        self.session: Session = session

    async def handle(self):
        """
        根据session状态进入graph流程处理
        无需额外参数，只需要更新self.session，即可自动根据session内容和状态进入graph
        
        :returns: 异步生成器，产生处理结果的chunks
        """
        old_signal = None

        try:
            async for event in self.graph.astream_events(
                    self.session.research_state,
                    version="v2"
            ):
                # logger.info(f"graph astream_events: {type(event)} {event}")
                event_type = event['event']
                meta = event.get('metadata', {})
                node = meta.get('langgraph_node')
                log_text = f'[{node}]:{event_type}'

                if old_signal != log_text:
                    logger.info(f"graph astream_events: {log_text}")
                    old_signal = log_text
                    # logger.info(f"{event}")

                if event_type == "on_chain_start":
                    yield {"type": "action", "data": f"【{node}】开始..."}
                elif event_type == "on_chat_model_stream":
                    chunk = event["data"].get("chunk")
                    if chunk:
                        tp = "ref" if node == "academic_search" else "content"
                        yield {"type": tp, "data": chunk.content}
                elif event_type == "on_chain_end":
                    await self.save_state(event)
                    # Ensure session is saved to database before notifying client
                    await self.save_session_to_db()
                    yield {'type': 'action', 'data': f"【{node}】完成."}
                    if node == "academic_search" and self.session.research_state.academic_search_result:
                        yield {"type": "references",
                               "data": self.session.research_state.academic_search_result.model_dump()}
                    elif node == "write_report" and self.session.research_state.final_report:
                        yield {"type": "report",
                               "data": self.session.research_state.final_report}
                elif event_type == "on_chain_error":
                    await self.save_session_to_db()
                    yield {'type': 'action', 'data': f"【{node}】失败."}
                elif event_type == "on_chain_interrupt":
                    await self.save_session_to_db()
                    yield {'type': 'action', 'data': f"【{node}】中断."}
                else:
                    yield {'type': 'action', 'data': f"[{node}]:{event_type}"}

        except Exception as e:
            logger.error(f"处理流程时发生错误: {e} {traceback.format_exc()}")
            raise
        finally:
            await self.save_session_to_db()

    async def save_state(self, event: dict):
        node = event.get('metadata', {}).get('langgraph_node')
        output = event.get('data', {}).get('output', {})
        if not isinstance(output, dict):
            logger.warning(f"处理结果: {node} 输出不是dict类型-> {type(output)} \n-> {event}")
            return
        value = output.get('value')
        logger.info(f"处理结果: {node} ")

        if node == "academic_search":
            if isinstance(value, AcademicSearchResult):
                self.session.research_state.academic_search_result = value
        elif node == "write_report":
            if isinstance(value, str):
                self.session.research_state.final_report = value
        await self.save_session_to_db()

    async def save_session_to_db(self):
        """
        将session保存在mongo
        :return:
        """
        # 更新会话的更新时间
        self.session.updated_at = datetime.datetime.now()

        doc = self.session.model_dump()

        if doc.get("created_at"):
            doc["created_at"] = doc["created_at"].isoformat()
        if doc.get("updated_at"):
            doc["updated_at"] = doc["updated_at"].isoformat()

        if mongodb.db is None:
            await mongodb.connect()

        # 使用update_one方法更新或插入会话文档
        res = await mongodb.update_one(
            "sessions",
            {"session_id": self.session.session_id},
            {"$set": doc},
            upsert=True
        )
        logger.info(f"保存会话: {res}")

    @classmethod
    async def get_session(cls, session_id: str) -> Optional['Session']:
        """
        根据session_id从MongoDB中查询会话
        
        :param session_id: str 类型，会话ID
        :returns: Session 类型，查询到的会话对象
        """
        try:
            # 确保MongoDB连接
            if mongodb.db is None:
                await mongodb.connect()

            # 从MongoDB中查找对应session_id的文档
            doc = await mongodb.find_one("sessions", {"session_id": session_id})

            if doc:
                # 移除MongoDB的_id字段
                doc.pop("_id", None)

                # 处理research_state字段
                research_state_data = doc.get("research_state", {})
                if research_state_data:
                    doc["research_state"] = ResearchState(**research_state_data)

                # 处理时间字段
                if doc.get("created_at"):
                    if isinstance(doc["created_at"], str):
                        doc["created_at"] = datetime.datetime.fromisoformat(doc["created_at"])
                if doc.get("updated_at"):
                    if isinstance(doc["updated_at"], str):
                        doc["updated_at"] = datetime.datetime.fromisoformat(doc["updated_at"])

                return Session(**doc)
            return None
        except RuntimeError as e:
            if "Event loop is closed" in str(e):
                logger.warning(f"Event loop is closed when trying to get session {session_id}")
                return None
            raise
        except Exception as e:
            logger.error(f"Error getting session {session_id}: {e}")
            return None

    @classmethod
    async def create_session(cls, session_id: str, user_id: str = "") -> 'Session':
        """
        创建新的会话并保存到MongoDB
        
        :param session_id: str 类型，会话ID
        :param user_id: str 类型，用户ID
        :returns: Session 类型，创建的会话对象
        """
        # 创建默认的ResearchState
        research_state = ResearchState(
            query="",
            research_title='',
            academic_search_result=None,
            report_title=None,
            final_report=None,
            waiting_for_user=False,
            search_results_satisfactory=False,
            supply_query=[],
            coaching_opinion=[],

        )

        # 创建Session对象
        now = datetime.datetime.now()
        session = Session(
            session_id=session_id,
            research_state=research_state,
            messages=[],
            user_id=user_id,
            created_at=now,
            updated_at=now
        )

        # 保存到MongoDB
        doc = session.model_dump()
        # 处理时间字段序列化
        if doc.get("created_at"):
            doc["created_at"] = doc["created_at"].isoformat()
        if doc.get("updated_at"):
            doc["updated_at"] = doc["updated_at"].isoformat()

        if mongodb.db is None:
            await mongodb.connect()

        await mongodb.insert_one("sessions", doc)

        return session

    @classmethod
    async def get_or_create_session(cls, session_id: str, user_id: str = "") -> 'Session':
        """
        查询或创建会话
        
        :param session_id: str 类型，会话ID
        :param user_id: str 类型，用户ID
        :returns: Session 类型，查询到的或新创建的会话对象
        """

        # 先尝试获取现有会话
        session = await cls.get_session(session_id)
        if not session:
            session = await cls.create_session(session_id, user_id)
        return session

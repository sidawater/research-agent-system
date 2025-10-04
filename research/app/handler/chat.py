from typing import List, Dict, Optional
from db.mongo import mongodb


async def update_conversation_history(session_id: str, document: Dict) -> Optional[Dict]:
    """
    更新整个对话历史记录文档
    
    :param session_id: 会话ID
    :param document: 完整的文档内容
    :return: 更新结果
    """
    try:
        result = await mongodb.update_one(
            "sessions",
            {"session_id": session_id},
            {"$set": document},
            upsert=True
        )
        return result
    except Exception as e:
        print(f"Error updating conversation history: {e}")
        return None


async def get_conversation_history(session_id: str) -> Optional[Dict]:
    """
    获取对话历史记录
    
    :param session_id: 会话ID
    :return: 对话历史记录列表
    """
    try:
        doc = await mongodb.find_one("sessions", {"session_id": session_id})
        return doc or {}
    except Exception as e:
        print(f"Error getting conversation history: {e}")
        return {}


async def get_all_conversations() -> Optional[List[Dict]]:
    """
    获取所有对话列表（限制50条）
    
    :return: 对话列表
    """
    try:
        sessions = await mongodb.find_many("sessions", limit=50)
        return sessions or []
    except Exception as e:
        print(f"Error getting all conversations: {e}")
        return []

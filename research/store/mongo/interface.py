from typing import Dict, Any, Optional
from bson import ObjectId
from core.common import get_logger
from .connector import mongo_connector

logger = get_logger(__name__)

class MongoInterface:
    """MongoDB读写接口类，提供对会话信息的增删改查操作"""
    
    def __init__(self):
        """初始化MongoDB接口"""
        self.collection = None
    
    def initialize(self):
        """
        初始化MongoDB接口，建立连接
        
        Returns:
            bool: 初始化是否成功
        """
        try:
            logger.info("正在初始化MongoDB接口...")
            
            # 连接MongoDB
            if not mongo_connector.connected:
                if not mongo_connector.connect():
                    raise ConnectionError("无法连接到MongoDB")
            
            # 获取集合引用
            self.collection = mongo_connector.get_collection()
            
            logger.info("MongoDB接口初始化成功")
            return True
            
        except Exception as e:
            logger.error(f"MongoDB接口初始化失败: {str(e)}")
            return False
    
    def create_session(self, session_data: Dict[str, Any]) -> Optional[str]:
        """
        创建新的会话记录
        
        Args:
            session_data (Dict[str, Any]): 会话数据
            
        Returns:
            Optional[str]: 新创建记录的ID，如果失败则返回None
        """
        try:
            if not self.collection:
                raise RuntimeError("MongoDB接口未初始化")
            
            logger.info("正在创建新的会话记录...")
            
            # 插入数据
            result = self.collection.insert_one(session_data)
            
            session_id = str(result.inserted_id)
            logger.info(f"会话记录创建成功，ID: {session_id}")
            return session_id
            
        except Exception as e:
            logger.error(f"创建会话记录失败: {str(e)}")
            return None
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        根据session_id查询会话
        
        Args:
            session_id (str): 会话ID
            
        Returns:
            Optional[Dict[str, Any]]: 会话数据，如果未找到则返回None
        """
        try:
            if not self.collection:
                raise RuntimeError("MongoDB接口未初始化")
            
            logger.info(f"正在查询会话记录: {session_id}")
            
            # 查询数据
            session_data = self.collection.find_one({"_id": ObjectId(session_id)})
            
            if session_data:
                # 将ObjectId转换为字符串
                session_data["_id"] = str(session_data["_id"])
                logger.info(f"会话记录查询成功: {session_id}")
                return session_data
            else:
                logger.info(f"未找到会话记录: {session_id}")
                return None
                
        except Exception as e:
            logger.error(f"查询会话记录失败: {str(e)}")
            return None
    
    def update_session(self, session_id: str, session_data: Dict[str, Any]) -> bool:
        """
        更新会话记录
        
        Args:
            session_id (str): 会话ID
            session_data (Dict[str, Any]): 更新的会话数据
            
        Returns:
            bool: 更新是否成功
        """
        try:
            if not self.collection:
                raise RuntimeError("MongoDB接口未初始化")
            
            logger.info(f"正在更新会话记录: {session_id}")
            
            # 更新数据（排除_id字段）
            update_data = {k: v for k, v in session_data.items() if k != "_id"}
            result = self.collection.update_one(
                {"_id": ObjectId(session_id)}, 
                {"$set": update_data}
            )
            
            if result.modified_count > 0:
                logger.info(f"会话记录更新成功: {session_id}")
                return True
            else:
                logger.info(f"会话记录无变化或未找到: {session_id}")
                return False
                
        except Exception as e:
            logger.error(f"更新会话记录失败: {str(e)}")
            return False
    
    def delete_session(self, session_id: str) -> bool:
        """
        删除会话记录
        
        Args:
            session_id (str): 会话ID
            
        Returns:
            bool: 删除是否成功
        """
        try:
            if not self.collection:
                raise RuntimeError("MongoDB接口未初始化")
            
            logger.info(f"正在删除会话记录: {session_id}")
            
            # 删除数据
            result = self.collection.delete_one({"_id": ObjectId(session_id)})
            
            if result.deleted_count > 0:
                logger.info(f"会话记录删除成功: {session_id}")
                return True
            else:
                logger.info(f"未找到会话记录: {session_id}")
                return False
                
        except Exception as e:
            logger.error(f"删除会话记录失败: {str(e)}")
            return False

# 全局MongoDB接口实例
mongo_interface = MongoInterface()
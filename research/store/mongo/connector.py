from pymongo import MongoClient
from config import current_config
from core.common import get_logger

logger = get_logger(__name__)

class MongoConnector:
    """MongoDB连接器类，用于初始化和管理MongoDB连接"""
    
    def __init__(self):
        """初始化MongoDB连接器"""
        self.client = None
        self.db = None
        self.collection = None
        self.connected = False
    
    def connect(self):
        """
        建立MongoDB连接
        
        Returns:
            bool: 连接是否成功
        """
        try:
            logger.info("正在连接MongoDB...")
            
            # 从配置中读取MongoDB连接信息
            host = CONFIG.mongo.host
            port = CONFIG.mongo.port
            database = CONFIG.mongo.database
            collection = CONFIG.mongo.collection
            
            # 创建MongoDB客户端
            self.client = MongoClient(host, port)
            
            # 选择数据库和集合
            self.db = self.client[database]
            self.collection = self.db[collection]
            
            # 测试连接
            self.client.admin.command('ping')
            self.connected = True
            
            logger.info(f"成功连接到MongoDB: {host}:{port}/{database}.{collection}")
            return True
            
        except Exception as e:
            logger.error(f"连接MongoDB失败: {str(e)}")
            self.connected = False
            return False
    
    def disconnect(self):
        """关闭MongoDB连接"""
        if self.client:
            self.client.close()
            self.connected = False
            logger.info("MongoDB连接已关闭")
    
    def get_collection(self):
        """
        获取MongoDB集合对象
        
        Returns:
            Collection: MongoDB集合对象
        """
        if not self.connected:
            raise ConnectionError("MongoDB未连接，请先调用connect()方法")
        
        return self.collection

# 全局MongoDB连接器实例
mongo_connector = MongoConnector()
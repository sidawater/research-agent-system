from typing import Dict, List, Optional, AsyncGenerator
from contextlib import asynccontextmanager
import urllib.parse
import logging
import motor.motor_asyncio

logger = logging.getLogger(__name__)


class BaseMongoManager:
    def __init__(self):
        self.client = None
        self.db = None
        self.host = None
        self.port = None
        self.username = None
        self.password = None
        self.database_name = None

    async def connect(self):
        """
        建立 MongoDB 连接
        """
        try:
            if self.username and self.password:
                username = urllib.parse.quote_plus(self.username)
                password = urllib.parse.quote_plus(self.password)
                connection_string = f"mongodb://{username}:{password}@{self.host}:{self.port}/{self.database_name}"
            else:
                connection_string = f"mongodb://{self.host}:{self.port}/{self.database_name}"

            self.client = motor.motor_asyncio.AsyncIOMotorClient(connection_string)
            self.db = self.client[self.database_name]

            # ping
            await self.db.command('ping')
            logger.info("MongoDB connected successfully")
            return True

        except Exception as e:
            logger.error(f"MongoDB connection failed: {e}")
            return False

    async def disconnect(self):
        """
        断开 MongoDB 连接
        """
        if self.client:
            self.client.close()
            self.client = None
            self.db = None
            logger.info("MongoDB disconnected")

    # 上下文管理器语法糖

    @asynccontextmanager
    async def connection_context(self) -> AsyncGenerator[None, None]:
        """
        连接上下文管理器
        确保连接存在，使用后不断开连接（保持长连接）
        """
        try:
            if not self.client:
                await self.connect()
            yield
        except Exception as e:
            logger.error(f"Connection context error: {e}")
            raise

    @asynccontextmanager
    async def session_context(self) -> AsyncGenerator[motor.motor_asyncio.AsyncIOMotorClientSession, None]:
        """
        会话上下文管理器
        创建会话，并在上下文退出时自动结束会话
        """
        if not self.client:
            await self.connect()

        session = None
        try:
            session = await self.client.start_session()
            yield session
        except Exception as e:
            logger.error(f"Session context error: {e}")
            raise
        finally:
            if session:
                session.end_session()

    @asynccontextmanager
    async def transaction_context(self) -> AsyncGenerator[motor.motor_asyncio.AsyncIOMotorClientSession, None]:
        """
        事务上下文管理器
        在会话中开启事务，自动处理提交和回滚
        """
        async with self.session_context() as session:
            try:
                async with session.start_transaction():
                    yield session
                    # 如果没有异常，事务将自动提交
            except Exception as e:
                logger.error(f"Transaction context error: {e}")
                # 发生异常时事务会自动回滚
                raise

    # 使用上下文管理器的数据库操作方法

    async def insert_one(self, collection: str, document: Dict,
                         use_transaction: bool = False) -> str:
        """
        插入单个文档
        """
        context_manager = self.transaction_context() if use_transaction else self.session_context()

        async with context_manager as session:
            try:
                result = await self.db[collection].insert_one(document, session=session)
                return str(result.inserted_id)
            except Exception as e:
                logger.error(f"Insert one error: {e}")
                raise

    async def insert_many(self, collection: str, documents: List[Dict],
                          use_transaction: bool = False) -> List[str]:
        """
        插入多个文档
        """
        context_manager = self.transaction_context() if use_transaction else self.session_context()

        async with context_manager as session:
            try:
                result = await self.db[collection].insert_many(documents, session=session)
                return [str(_id) for _id in result.inserted_ids]
            except Exception as e:
                logger.error(f"Insert many error: {e}")
                raise

    async def find_one(self, collection: str, query: Dict,
                       projection: Dict = None) -> Optional[Dict]:
        """
        查询单个文档
        """
        async with self.session_context() as session:
            try:
                document = await self.db[collection].find_one(
                    query,
                    projection=projection,
                    session=session
                )
                if document and '_id' in document:
                    document['_id'] = str(document['_id'])
                return document
            except Exception as e:
                logger.error(f"Find one error: {e}")
                raise

    async def find_many(self, collection: str, query: Dict = None,
                        projection: Dict = None,
                        limit: int = 0, skip: int = 0,
                        sort: List = None) -> List[Dict]:
        """
        查询多个文档
        """
        if query is None:
            query = {}

        async with self.session_context() as session:
            try:
                cursor = self.db[collection].find(
                    query,
                    projection=projection,
                    session=session
                )

                if sort:
                    cursor = cursor.sort(sort)
                if skip:
                    cursor = cursor.skip(skip)
                if limit:
                    cursor = cursor.limit(limit)

                documents = await cursor.to_list(length=None)

                # 转换 ObjectId 为字符串
                for doc in documents:
                    if '_id' in doc:
                        doc['_id'] = str(doc['_id'])

                return documents
            except Exception as e:
                logger.error(f"Find many error: {e}")
                raise

    async def update_one(self, collection: str, query: Dict, update: Dict,
                         upsert: bool = False, use_transaction: bool = False) -> Dict:
        """
        更新单个文档
        """
        context_manager = self.transaction_context() if use_transaction else self.session_context()

        async with context_manager as session:
            try:
                result = await self.db[collection].update_one(
                    query,
                    update,
                    upsert=upsert,
                    session=session
                )

                return {
                    'matched_count': result.matched_count,
                    'modified_count': result.modified_count,
                    'upserted_id': str(result.upserted_id) if result.upserted_id else None
                }
            except Exception as e:
                logger.error(f"Update one error: {e}")
                raise

    async def update_many(self, collection: str, query: Dict, update: Dict,
                          upsert: bool = False, use_transaction: bool = False) -> Dict:
        """
        更新多个文档
        """
        context_manager = self.transaction_context() if use_transaction else self.session_context()

        async with context_manager as session:
            try:
                result = await self.db[collection].update_many(
                    query,
                    update,
                    upsert=upsert,
                    session=session
                )

                return {
                    'matched_count': result.matched_count,
                    'modified_count': result.modified_count,
                    'upserted_id': str(result.upserted_id) if result.upserted_id else None
                }
            except Exception as e:
                logger.error(f"Update many error: {e}")
                raise

    async def delete_one(self, collection: str, query: Dict,
                         use_transaction: bool = False) -> int:
        """
        删除单个文档
        """
        context_manager = self.transaction_context() if use_transaction else self.session_context()

        async with context_manager as session:
            try:
                result = await self.db[collection].delete_one(query, session=session)
                return result.deleted_count
            except Exception as e:
                logger.error(f"Delete one error: {e}")
                raise

    async def delete_many(self, collection: str, query: Dict,
                          use_transaction: bool = False) -> int:
        """
        删除多个文档
        """
        context_manager = self.transaction_context() if use_transaction else self.session_context()

        async with context_manager as session:
            try:
                result = await self.db[collection].delete_many(query, session=session)
                return result.deleted_count
            except Exception as e:
                logger.error(f"Delete many error: {e}")
                raise

    async def count_documents(self, collection: str, query: Dict = None) -> int:
        """
        统计文档数量
        """
        if query is None:
            query = {}

        async with self.session_context() as session:
            try:
                return await self.db[collection].count_documents(query, session=session)
            except Exception as e:
                logger.error(f"Count documents error: {e}")
                raise

    async def aggregate(self, collection: str, pipeline: List[Dict]) -> List[Dict]:
        """
        聚合查询
        """
        async with self.session_context() as session:
            try:
                cursor = self.db[collection].aggregate(pipeline, session=session)
                documents = await cursor.to_list(length=None)

                # 转换 ObjectId 为字符串
                for doc in documents:
                    if '_id' in doc:
                        doc['_id'] = str(doc['_id'])

                return documents
            except Exception as e:
                logger.error(f"Aggregate error: {e}")
                raise

    # 批量操作示例
    async def bulk_write(self, collection: str, operations: List,
                         use_transaction: bool = False) -> Dict:
        """
        批量写入操作
        """
        context_manager = self.transaction_context() if use_transaction else self.session_context()

        async with context_manager as session:
            try:
                result = await self.db[collection].bulk_write(operations, session=session)
                return {
                    'inserted_count': result.inserted_count,
                    'matched_count': result.matched_count,
                    'modified_count': result.modified_count,
                    'deleted_count': result.deleted_count,
                    'upserted_count': result.upserted_count
                }
            except Exception as e:
                logger.error(f"Bulk write error: {e}")
                raise

try:
    from urllib.parse import quote_plus
    from flask import Flask


    class FlaskMixin:
        def init_flask_app(self, app: Flask):
            """
            初始化 MongoDB 连接配置
            """
            if app and hasattr(app, 'config'):
                self.host = getattr(app.config, 'MONGO_HOST')
                self.port = getattr(app.config, 'MONGO_PORT')
                self.username = getattr(app.config, 'MONGO_USERNAME')
                self.password = getattr(app.config, 'MONGO_PASSWORD')
                self.database_name = getattr(app.config, 'MONGO_DATABASE')

except ImportError:
    FlaskMixin = type('FlaskMixin', (object,), {})


class ObjectMixin:
    def init_from_object(self, obj):
        self.host = getattr(obj, 'MONGO_HOST')
        self.port = getattr(obj, 'MONGO_PORT')
        self.username = getattr(obj, 'MONGO_USERNAME')
        self.password = getattr(obj, 'MONGO_PASSWORD')
        self.database_name = getattr(obj, 'MONGO_DATABASE')


class DictMixin:
    def init_from_dict(self, info):
        self.host = info.get('MONGO_HOST')
        self.port = info.get('MONGO_PORT')
        self.username = info.get('MONGO_USERNAME')
        self.password = info.get('MONGO_PASSWORD')
        self.database_name = info.get('MONGO_DATABASE')


class Mongo(BaseMongoManager, FlaskMixin, ObjectMixin, DictMixin):
    pass


mongodb = Mongo()

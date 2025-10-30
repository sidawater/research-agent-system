"""
Conversation Manager for MongoDB
Handles saving and retrieving conversation messages
"""
import uuid
import datetime
from typing import Dict, List, Optional
from core.common import get_logger
from db.mongo import mongodb

logger = get_logger(__name__)


class ConversationManager:
    """Manages conversation messages in MongoDB"""
    
    def __init__(self):
        """Initialize conversation manager"""
        self.collection_name = "conversations"
    
    async def save_message(
        self,
        session_id: str,
        role: str,
        content: str,
        message_type: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> str:
        """
        Save a single message to database
        
        :param session_id: Session ID linking to sessions collection
        :param role: Message sender role ("user" or "assistant")
        :param content: Message content
        :param message_type: Message type (required for assistant messages)
        :param metadata: Optional metadata (node, event_type, etc.)
        :returns: Message ID
        """
        try:
            message_id = str(uuid.uuid4())
            
            message_doc = {
                "message_id": message_id,
                "session_id": session_id,
                "role": role,
                "content": content,
                "timestamp": datetime.datetime.now().isoformat(),
            }
            
            # Add type for assistant messages
            if role == "assistant" and message_type:
                message_doc["type"] = message_type
            
            # Add metadata if provided
            if metadata:
                message_doc["metadata"] = metadata
            
            # Ensure MongoDB connection
            if mongodb.db is None:
                await mongodb.connect()
            
            # Save to database
            await mongodb.insert_one(self.collection_name, message_doc)
            
            logger.debug(f"Saved {role} message: {message_id} for session: {session_id}")
            return message_id
            
        except Exception as e:
            logger.error(f"Error saving message: {e}")
            raise
    
    async def get_conversation_history(
        self,
        session_id: str,
        limit: int = 100,
        skip: int = 0
    ) -> List[Dict]:
        """
        Retrieve conversation history for a session
        
        :param session_id: Session ID
        :param limit: Maximum number of messages to retrieve
        :param skip: Number of messages to skip
        :returns: List of message documents
        """
        try:
            # Ensure MongoDB connection
            if mongodb.db is None:
                await mongodb.connect()
            
            # Query messages sorted by timestamp
            messages = await mongodb.find_many(
                self.collection_name,
                query={"session_id": session_id},
                sort=[("timestamp", 1)],  # Ascending order (oldest first)
                limit=limit,
                skip=skip
            )
            
            logger.info(f"Retrieved {len(messages)} messages for session: {session_id}")
            return messages
            
        except Exception as e:
            logger.error(f"Error retrieving conversation history: {e}")
            raise
    
    async def clear_conversation(self, session_id: str) -> bool:
        """
        Clear all messages for a session
        
        :param session_id: Session ID
        :returns: True if successful, False otherwise
        """
        try:
            # Ensure MongoDB connection
            if mongodb.db is None:
                await mongodb.connect()
            
            # Delete all messages for this session
            deleted_count = await mongodb.delete_many(
                self.collection_name,
                query={"session_id": session_id}
            )
            
            logger.info(f"Cleared {deleted_count} messages for session: {session_id}")
            return deleted_count > 0
            
        except Exception as e:
            logger.error(f"Error clearing conversation: {e}")
            return False
    
    async def count_messages(self, session_id: str) -> int:
        """
        Count total messages for a session
        
        :param session_id: Session ID
        :returns: Number of messages
        """
        try:
            # Ensure MongoDB connection
            if mongodb.db is None:
                await mongodb.connect()
            
            count = await mongodb.count_documents(
                self.collection_name,
                query={"session_id": session_id}
            )
            
            return count
            
        except Exception as e:
            logger.error(f"Error counting messages: {e}")
            return 0


# Global conversation manager instance
conversation_manager = ConversationManager()

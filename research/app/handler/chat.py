from typing import List, Dict, Optional
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
import zipfile
import io
import os
from datetime import datetime
from db.mongo import mongodb
from store.mongo.conversation import conversation_manager
from core.common import get_logger

logger = get_logger(__name__)


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


async def get_conversation(session_id: str) -> Optional[Dict]:
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


async def get_conversations() -> Optional[List[Dict]]:
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


async def get_conversation_messages(session_id: str, limit: int = 100, skip: int = 0) -> Dict:
    """
    获取指定会话的对话消息记录
    
    :param session_id: 会话ID
    :param limit: 返回消息数量限制，默认100
    :param skip: 跳过消息数量，默认0
    :return: 包含消息列表和元数据的字典
    """
    try:
        # Get messages from conversation manager
        messages = await conversation_manager.get_conversation_history(
            session_id=session_id,
            limit=limit,
            skip=skip
        )
        
        # Get total count
        total_count = await conversation_manager.count_messages(session_id)
        
        logger.info(f"Retrieved {len(messages)} messages for session {session_id}")
        
        return {
            "session_id": session_id,
            "total_count": total_count,
            "limit": limit,
            "skip": skip,
            "messages": messages
        }
    except Exception as e:
        logger.error(f"Error getting conversation messages for session {session_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve conversation messages: {str(e)}"
        )


async def download_references_handler(session_id: str) -> StreamingResponse:
    """
    根据session_id打包下载参考文献PDF文件
    
    :param session_id: 会话ID
    :return: StreamingResponse containing ZIP file with reference PDFs
    :raises HTTPException: 404 if session not found or no valid references
    """
    try:
        # Query session from MongoDB
        if mongodb.db is None:
            await mongodb.connect()
        
        doc = await mongodb.find_one("sessions", {"session_id": session_id})
        if not doc:
            logger.warning(f"Session not found: {session_id}")
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Extract reference file paths from research_state
        research_state = doc.get("research_state", {})
        academic_result = research_state.get("academic_search_result", {})
        results = academic_result.get("results", [])
        
        if not results:
            logger.warning(f"No references found for session: {session_id}")
            raise HTTPException(status_code=404, detail="No references found in this session")
        
        # Create in-memory ZIP file
        zip_buffer = io.BytesIO()
        valid_files = 0
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for idx, ref_item in enumerate(results, 1):
                filepath = ref_item.get("filepath")
                
                # Skip if filepath is empty or None
                if not filepath:
                    logger.debug(f"Reference {idx} has no filepath")
                    continue
                
                # Validate file exists and prevent path traversal
                if not os.path.exists(filepath) or not os.path.isfile(filepath):
                    logger.warning(f"File not found or invalid: {filepath}")
                    continue
                
                # Generate safe filename for ZIP archive
                title = ref_item.get("title", f"paper_{idx}")
                # Sanitize filename: remove invalid characters
                safe_title = "".join(
                    c for c in title 
                    if c.isalnum() or c in (' ', '-', '_', '.', ',')
                ).strip()
                
                # Limit filename length and ensure .pdf extension
                if safe_title:
                    safe_title = safe_title[:200]  # Limit length
                    filename = f"{safe_title}.pdf" if not safe_title.endswith('.pdf') else safe_title
                else:
                    filename = f"paper_{idx}.pdf"
                
                # Add file to ZIP archive
                try:
                    zip_file.write(filepath, filename)
                    valid_files += 1
                    logger.info(f"Added to ZIP: {filename} from {filepath}")
                except Exception as e:
                    logger.error(f"Failed to add file {filepath} to ZIP: {e}")
                    continue
        
        if valid_files == 0:
            logger.warning(f"No valid reference files found for session: {session_id}")
            raise HTTPException(
                status_code=404, 
                detail="No valid reference files found. Files may be missing or inaccessible."
            )
        
        # Prepare ZIP file for download
        zip_buffer.seek(0)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        zip_filename = f"references_{session_id}_{timestamp}.zip"
        
        logger.info(f"Successfully created ZIP with {valid_files} files for session {session_id}")
        
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename={zip_filename}",
                "Content-Type": "application/zip"
            }
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error downloading references for session {session_id}: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Internal server error while preparing reference download: {str(e)}"
        )

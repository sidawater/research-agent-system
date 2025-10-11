from fastapi import APIRouter
from app.handler.chat import (
    get_conversations, 
    get_conversation, 
    update_conversation_history,
    download_references_handler
)

router = APIRouter(prefix="/api/v1")

router.add_api_route("/history", get_conversations, methods=["GET"])
router.add_api_route("/history/{session_id}", get_conversation, methods=["GET"])
router.add_api_route("/history/{session_id}", update_conversation_history, methods=["POST"])
router.add_api_route("/download_references/{session_id}", download_references_handler, methods=["GET"])

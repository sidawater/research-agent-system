from fastapi import APIRouter
from app.handler.chat import get_all_conversations, get_conversation_history, update_conversation_history

router = APIRouter(prefix="/api/v1")

router.add_api_route("/history", get_all_conversations, methods=["GET"])
router.add_api_route("/history/{session_id}", get_conversation_history, methods=["GET"])
router.add_api_route("/history/{session_id}", update_conversation_history, methods=["POST"])
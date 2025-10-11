from fastapi import APIRouter
from app.handler.prompts import get_prompt, set_prompt, get_all_prompts

router = APIRouter(prefix="/api/v1")

router.add_api_route("/prompts", get_all_prompts, methods=["GET"])
router.add_api_route("/prompts/{key}", get_prompt, methods=["GET"])
router.add_api_route("/prompts/{key}", set_prompt, methods=["POST"])
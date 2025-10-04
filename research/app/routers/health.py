from fastapi import APIRouter
from app.health import health_check

router = APIRouter(prefix="/api/v1")


def register_routes():
    router.add_api_route("/health", health_check, methods=["GET"])
    return router

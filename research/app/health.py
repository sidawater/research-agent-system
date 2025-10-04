from fastapi import APIRouter

router = APIRouter(prefix="/api/v1")


async def health_check():
    return {"status": "ok"}



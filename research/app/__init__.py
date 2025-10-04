from fastapi import FastAPI
from db.mongo import mongodb
from config import current_config


def create_app():
    app = FastAPI(
        title="Research Agent API",
        description="Research Agent System API",
        version="0.1.0"
    )

    mongodb.init_from_object(current_config.mongo)

    # registers
    from app.health import router as health_router
    app.include_router(health_router, prefix="/api/v1")

    from app.routers import chat
    app.include_router(chat.router)

    from app.ws.flow import websocket_endpoint
    app.add_api_websocket_route('/chat', websocket_endpoint, name='chat')

    @app.get("/")
    async def root():
        return {"message": "Welcome to Research Agent System"}

    return app
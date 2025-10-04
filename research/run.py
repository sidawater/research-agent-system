from app import create_app
from core import setup_core
from config import Config

Config.load_from_toml(r'/data/config/research-agent.toml')

setup_core()
app = create_app()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

import sys
from app import create_app
from config import Config

if len(sys.argv) < 2:
    config_file = r'/data/config/research-agent.toml'
else:
    config_file = sys.argv[1]

Config.load_from_toml(config_file)
app = create_app()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

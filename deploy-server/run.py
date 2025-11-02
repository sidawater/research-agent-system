"""Standalone run script for deploy-server."""
import sys
import uvicorn
from pathlib import Path

# Add app directory to path
sys.path.insert(0, str(Path(__file__).parent))

from app.config import init_config, get_config

if __name__ == "__main__":
    # Initialize configuration
    try:
        init_config()
        config = get_config()
        print(f"Starting deploy-server on {config.server.host}:{config.server.port}")
        
        uvicorn.run(
            "app.main:app",
            host=config.server.host,
            port=config.server.port,
            reload=config.server.debug
        )
    except Exception as e:
        print(f"Failed to start server: {e}")
        sys.exit(1)

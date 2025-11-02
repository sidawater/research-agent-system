"""Configuration loader for deploy-server."""
import os
import toml
from pathlib import Path
from typing import Optional


class ServerConfig:
    """Server configuration."""
    def __init__(self, config_dict: dict):
        self.host = config_dict.get("host", "0.0.0.0")
        self.port = config_dict.get("port", 8001)
        self.debug = config_dict.get("debug", False)


class DockerRegistryConfig:
    """Docker registry configuration."""
    def __init__(self, config_dict: dict):
        self.url = config_dict.get("url", "")
        self.username = config_dict.get("username", "")
        self.password = config_dict.get("password", "")
        self.verify_ssl = config_dict.get("verify_ssl", False)
        self.timeout = config_dict.get("timeout", 30)


class AppReleaseConfig:
    """App release configuration."""
    def __init__(self, config_dict: dict):
        self.storage_path = config_dict.get("storage_path", "/data/releases")
        self.max_versions = config_dict.get("max_versions", 10)


class Config:
    """Main configuration class."""
    
    def __init__(self, config_path: Optional[str] = None):
        if config_path is None:
            # Default to config/deploy-server.toml relative to project root
            config_path = os.getenv("CONFIG_PATH", "config/deploy-server.toml")
        
        config_file = Path(config_path)
        if not config_file.exists():
            raise FileNotFoundError(f"Configuration file not found: {config_path}")
        
        config_data = toml.load(config_file)
        
        self.server = ServerConfig(config_data.get("server", {}))
        self.docker_registry = DockerRegistryConfig(config_data.get("docker_registry", {}))
        self.app_release = AppReleaseConfig(config_data.get("app_release", {}))


# Global configuration instance
_config: Optional[Config] = None


def get_config() -> Config:
    """Get global configuration instance."""
    global _config
    if _config is None:
        _config = Config()
    return _config


def init_config(config_path: Optional[str] = None):
    """Initialize configuration with custom path."""
    global _config
    _config = Config(config_path)
    return _config

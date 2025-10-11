import os
from pathlib import Path


def setup_core():
    """初始化 core 项目运行环境"""
    # 1. 加载环境变量
    from dotenv import load_dotenv
    load_dotenv()

    # 2. 确保导出目录存在
    export_home = os.getenv("EXPORT_HOME", "./var")
    Path(export_home).mkdir(parents=True, exist_ok=True)

    print(f"✅ Core 项目初始化完成")

import logging
import os
import sys
from functools import wraps
from typing import Optional


class CustomFormatter(logging.Formatter):
    """自定义日志格式化器，添加颜色和更多信息"""

    # 颜色定义
    grey = "\x1b[38;20m"
    yellow = "\x1b[33;20m"
    red = "\x1b[31;20m"
    bold_red = "\x1b[31;1m"
    reset = "\x1b[0m"

    format_str = "%(asctime)s - %(name)s - %(levelname)s - %(filename)s:%(lineno)d - %(message)s"

    FORMATS = {
        logging.DEBUG: grey + format_str + reset,
        logging.INFO: grey + format_str + reset,
        logging.WARNING: yellow + format_str + reset,
        logging.ERROR: red + format_str + reset,
        logging.CRITICAL: bold_red + format_str + reset
    }

    def format(self, record):
        log_fmt = self.FORMATS.get(record.levelno)
        formatter = logging.Formatter(log_fmt, datefmt="%Y-%m-%d %H:%M:%S")
        return formatter.format(record)


def get_logger(name: Optional[str] = None, level: int = logging.INFO) -> logging.Logger:
    """
    创建并配置一个日志记录器
    
    Args:
        name: 日志记录器名称，默认为None（使用根记录器）
        level: 日志级别，默认为INFO
        
    Returns:
        配置好的Logger实例
    """
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    # 如果已经配置过处理器，则直接返回
    if logger.handlers:
        return logger
    
    # 创建控制台处理器
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_handler.setFormatter(CustomFormatter())
    logger.addHandler(console_handler)
    
    # 创建文件处理器（如果指定了日志目录）
    log_dir = os.getenv("LOG_DIR", "./logs")
    if log_dir:
        os.makedirs(log_dir, exist_ok=True)
        file_handler = logging.FileHandler(os.path.join(log_dir, "app.log"), encoding="utf-8")
        file_handler.setLevel(level)
        file_formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(filename)s:%(lineno)d - %(funcName)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        file_handler.setFormatter(file_formatter)
        logger.addHandler(file_handler)
    
    # 避免日志重复输出
    logger.propagate = False
    
    return logger


def log_function_call(logger_name: Optional[str] = None):
    """
    装饰器：记录函数调用
    
    Args:
        logger_name: 日志记录器名称
    """
    def decorator(func):
        logger = get_logger(logger_name or func.__module__)
        
        @wraps(func)
        def wrapper(*args, **kwargs):
            logger.debug(f"调用函数 {func.__name__} with args: {args}, kwargs: {kwargs}")
            try:
                result = func(*args, **kwargs)
                logger.debug(f"函数 {func.__name__} 执行成功")
                return result
            except Exception as e:
                logger.error(f"函数 {func.__name__} 执行出错: {str(e)}", exc_info=True)
                raise
        return wrapper
    return decorator
from typing import Optional, Dict, Any
from core.agents.prompts import SystemPrompts
from core.workflow.graph2 import GraphManager
from db.mongo import mongodb


async def get_prompt(key: str) -> Optional[Dict[str, Any]]:
    """
    从 MongoDB 获取指定的 prompt
    
    :param key: prompt 的标识符
    :return: 包含 prompt 信息的字典
    """
    try:
        # 先尝试从 MongoDB 获取
        doc = await mongodb.find_one("agent_config", {"key": key})
        if doc:
            return {"key": doc["key"], "prompt": doc["prompt"]}
        
        # 如果 MongoDB 中没有，则从内存中获取默认值
        prompt_value = SystemPrompts.get(key)
        if prompt_value:
            return {"key": key, "prompt": prompt_value}
            
        return None
    except Exception as e:
        print(f"Error getting prompt: {e}")
        return None


async def set_prompt(key: str, prompt: str) -> Optional[Dict[str, Any]]:
    """
    将指定的 prompt 保存到 MongoDB
    
    :param key: prompt 的标识符
    :param prompt: prompt 内容
    :return: 更新结果
    """
    try:
        result = await mongodb.update_one(
            "agent_config",
            {"key": key},
            {"$set": {"key": key, "prompt": prompt}},
            upsert=True
        )
        # 同时更新内存中的 prompts
        SystemPrompts.set(key, prompt)

        # 重置agent和graph
        GraphManager.reset()
        return {"key": key, "prompt": prompt}
    except Exception as e:
        print(f"Error setting prompt: {e}")
        return None


async def get_all_prompts() -> Optional[Dict[str, Any]]:
    """
    获取所有 prompts
    
    :return: 包含所有 prompts 的字典
    """
    try:
        # 获取默认的 prompts
        result = SystemPrompts.get_all()
        
        # 从 MongoDB 获取所有自定义的 prompts 并覆盖默认值
        docs = await mongodb.find_many("agent_config")
        for doc in docs:
            result[doc["key"]] = doc["prompt"]
        
        return result
    except Exception as e:
        print(f"Error getting all prompts: {e}")
        return None
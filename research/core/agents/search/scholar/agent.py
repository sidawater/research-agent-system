"""Agent核心逻辑"""
import os
from typing import Dict, Any, Optional, List
from datetime import datetime
from langchain.agents import AgentExecutor, Tool
from langchain.agents.openai_functions_agent.base import OpenAIFunctionsAgent
from langchain.schema import SystemMessage
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.chat_models import ChatOpenAI
from langchain.memory import ConversationBufferMemory
from langchain.tools import BaseTool

from .prompts import format_system_prompt, format_user_query
from .schemas import QueryConfig, AgentConfig, AgentStatus, SearchQuery
from .semantic_scholar import SemanticScholarAPI


class SemanticScholarQueryTool(BaseTool):
    """Semantic Scholar查询工具"""

    name = "semantic_scholar_search"
    description = "Search academic papers on Semantic Scholar with configurable parameters"

    def __init__(self, api_client: SemanticScholarAPI):
        super().__init__()
        self.api_client = api_client
        self.args_schema = SearchQuery

    def _run(self, **kwargs) -> str:
        """执行查询"""
        try:
            search_query = SearchQuery(**kwargs)
            response = self.api_client.search_papers(search_query)
            return self.api_client.format_search_results(response, search_query.limit)
        except Exception as e:
            return f"查询失败: {str(e)}"


class QueryOptimizerAgent:
    """查询优化Agent"""

    def __init__(self, agent_id: str, config: AgentConfig):
        """
        显式创建Agent

        Args:
            agent_id: Agent唯一标识
            config: Agent配置
        """
        self.agent_id = agent_id
        self.config = config
        self.is_active = True
        self.created_at = datetime.now().isoformat()

        # 初始化API客户端
        self.api_client = SemanticScholarAPI()

        # 初始化LangChain组件
        self._initialize_agent()

    def _initialize_agent(self):
        """初始化LangChain Agent"""
        # 初始化LLM
        self.llm = ChatOpenAI(
            model_name=self.config.model_name,
            temperature=self.config.temperature,
            openai_api_key=os.getenv("OPENAI_API_KEY")
        )

        # 创建工具
        self.search_tool = SemanticScholarQueryTool(self.api_client)

        # 准备系统提示词
        system_prompt = self.config.system_prompt or format_system_prompt(
            default_fields=self.config.query_config.default_fields,
            default_year_range=self.config.query_config.default_year_range,
            default_fields_of_study=self.config.query_config.default_fields_of_study
        )

        # 创建Agent提示词
        prompt = OpenAIFunctionsAgent.create_prompt(
            system_message=SystemMessage(content=system_prompt),
            extra_prompt_messages=[MessagesPlaceholder(variable_name="chat_history")]
        )

        # 创建Agent
        tools = [self.search_tool]
        agent = OpenAIFunctionsAgent(llm=self.llm, tools=tools, prompt=prompt)

        # 创建记忆
        self.memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)

        # 创建执行器
        self.agent_executor = AgentExecutor(
            agent=agent,
            tools=tools,
            memory=self.memory,
            verbose=True,
            handle_parsing_errors=True,
            max_iterations=5
        )

    def invoke(self, research_topic: str, custom_params: Dict[str, Any] = None) -> str:
        """
        显式调用Agent

        Args:
            research_topic: 研究课题描述
            custom_params: 自定义参数

        Returns:
            Agent响应结果
        """
        if not self.is_active:
            return "Agent已被销毁，请创建新的Agent实例。"

        # 构建查询消息
        message = format_user_query(
            research_topic=research_topic,
            max_queries=self.config.query_config.max_queries,
            additional_params=custom_params
        )

        try:
            response = self.agent_executor.invoke({"input": message})
            return response["output"]
        except Exception as e:
            return f"Agent执行错误: {str(e)}"

    def get_status(self) -> AgentStatus:
        """获取Agent状态"""
        return AgentStatus(
            agent_id=self.agent_id,
            is_active=self.is_active,
            config=self.config.dict(),
            memory_size=len(self.memory.chat_memory.messages) if hasattr(self, 'memory') else 0,
            created_at=self.created_at
        )

    def destroy(self):
        """销毁Agent"""
        self.is_active = False
        # 清理资源
        if hasattr(self, 'agent_executor'):
            del self.agent_executor
        if hasattr(self, 'memory'):
            del self.memory
        if hasattr(self, 'llm'):
            del self.llm


class SemanticScholarAgentManager:
    """Agent管理器"""

    def __init__(self):
        self.agents: Dict[str, QueryOptimizerAgent] = {}

    def create_agent(self, agent_id: str, config: Optional[AgentConfig] = None) -> str:
        """
        显式创建Agent

        Args:
            agent_id: Agent唯一标识
            config: Agent配置，如为None则使用默认配置

        Returns:
            str: 创建的Agent ID

        Raises:
            ValueError: 如果Agent ID已存在
        """
        if agent_id in self.agents:
            raise ValueError(f"Agent ID '{agent_id}' 已存在")

        if config is None:
            config = AgentConfig()

        agent = QueryOptimizerAgent(agent_id, config)
        self.agents[agent_id] = agent
        return agent_id

    def invoke_agent(self, agent_id: str, research_topic: str,
                     custom_params: Dict[str, Any] = None) -> str:
        """
        显式调用Agent

        Args:
            agent_id: 要调用的Agent ID
            research_topic: 研究课题描述
            custom_params: 自定义参数

        Returns:
            str: 执行结果
        """
        agent = self.get_agent(agent_id)
        if not agent:
            return f"未找到Agent: {agent_id}"
        return agent.invoke(research_topic, custom_params)

    def get_agent(self, agent_id: str) -> Optional[QueryOptimizerAgent]:
        """获取Agent实例"""
        return self.agents.get(agent_id)

    def destroy_agent(self, agent_id: str) -> bool:
        """销毁Agent"""
        if agent_id in self.agents:
            self.agents[agent_id].destroy()
            del self.agents[agent_id]
            return True
        return False

    def list_agents(self) -> List[AgentStatus]:
        """列出所有Agent状态"""
        return [agent.get_status() for agent in self.agents.values()]

    def cleanup_inactive_agents(self) -> List[str]:
        """清理不活跃的Agent"""
        inactive_ids = [aid for aid, agent in self.agents.items() if not agent.is_active]
        for aid in inactive_ids:
            del self.agents[aid]
        return inactive_ids

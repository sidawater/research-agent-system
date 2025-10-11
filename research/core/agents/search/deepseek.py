import os
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.runnables import Runnable, RunnableLambda
import requests
from core.common.schemas import AcademicSearchResult, AcademicSearchQuery
from core.common import get_logger
from config import current_config
from core.agents.prompts import SystemPrompts

logger = get_logger(__name__)


def download_scihub(doi):
    mirror_urls = [
        "https://sci-hub.se",
        "https://sci-hub.st",
        "https://sci-hub.ee",
        "https://sci-hub.io"
    ]

    for url in mirror_urls:
        try:
            scihub_url = f"{url}/{doi}"
            response = requests.get(scihub_url, timeout=30)
            response.raise_for_status()
            return response.content
        except Exception as e:
            print(f"尝试{url}失败: {str(e)}")

    print(f"所有镜像站点均无法下载: {doi}")
    return False


ACADEMIC_SEARCH_PROMPT = ChatPromptTemplate.from_messages([
    ("system", SystemPrompts.get("deepseek")),
    ("human", "{query}"),
    ("ai", "{existing_result}"),
    ("human", "{supply_query}"),
])


def get_deepseek_llm() -> ChatOpenAI:
    """ --- LLM（DeepSeek-Chat）---"""
    logger.debug("初始化 DeepSeek LLM 配置")
    return ChatOpenAI(
        model="deepseek-chat",
        openai_api_key=current_config.agent.search.api_key,
        openai_api_base=current_config.agent.search.base_url,
        temperature=0.3,
        max_tokens=3000,
    )


def create_academic_search_agent() -> Runnable:
    """--- Agent Chain ---"""
    logger.info("创建学术搜索 Agent")
    llm = get_deepseek_llm()
    output_parser = JsonOutputParser(pydantic_object=AcademicSearchResult)

    chain = (
            ACADEMIC_SEARCH_PROMPT
            | llm
            | output_parser
    )

    def _wrapped_run(inputs: AcademicSearchQuery) -> AcademicSearchResult:
        logger.info(f"[AcademicSearchAgent] 开始处理查询: {inputs.query[:20]}...")
        result = chain.invoke(inputs.model_dump())
        academic_result = AcademicSearchResult(**result)
        for _idx, item in enumerate(academic_result.results, 1):
            if not item.doi:
                continue

            filename = f'{_idx + 1:02d}-{item.doi}-{item.title}.pdf'.replace('/', '+')
            filepath = os.path.join(current_config.agent.search.download_dir, filename)
            item.filepath = filepath
            os.makedirs(os.path.dirname(filepath), exist_ok=True)

            content = download_scihub(item.doi)
            if content:
                with open(filepath, 'wb') as f:
                    f.write(content)
        logger.info("[AcademicSearchAgent] 查询处理完成")
        return academic_result

    logger.info("学术搜索 Agent 创建完成")
    return RunnableLambda(_wrapped_run)


# for langGraph
academic_search_agent = create_academic_search_agent()


class DeepseekSearchAgent:
    _agent = None

    @classmethod
    def get(cls):
        if cls._agent is None:
            cls._agent = create_academic_search_agent()
        return cls._agent

    @classmethod
    def reset(cls):
        del cls._agent
        cls._agent = None

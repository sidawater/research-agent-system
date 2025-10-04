from typing import Dict, Any
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.runnables import Runnable, RunnableLambda
from core.common.schemas import AcademicSearchResult
from core.common import get_logger
from config import current_config


# 初始化日志记录器
logger = get_logger(__name__)

ACADEMIC_SEARCH_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """你是一位专业的学术研究助手。请根据用户的问题，模拟一次真实的学术文献检索，并返回高质量、高相关性的研究成果。

你 must严格按照 followingJSON format output, can't add any extra text or explanation:

{{
  "query": "用户原始问题",
  "summary": "基于全部检索结果生成的综合性简要综述（300–500字），涵盖主要研究方向、共识、分歧与趋势",
  "results": [
    {{
      "title": "论文标题",
      "url": "论文链接",
      "authors": ["作者1", "作者2", ...],
      "publication_year": 2023,
      "abstract": "完整摘要文本...",
      "excerpts": [
        "正文段落1...",
        "正文段落2（可选）..."
      ]
    }}
  ]
}}

Please strictly follow following requirements:
1. **返回 5-10 篇参考文献**，每篇必须包含以下三部分：
   - **元信息（Metadata）**：论文标题（Title）、作者（Authors）、发表时间（Publication Year）
   - **摘要（Abstract）**：提供完整且语义连贯的摘要（可适当节选，但不得截断句子或破坏逻辑）
   - **相关正文（Relevant Excerpts）**：从论文正文中选取 1–3 段与用户问题最直接相关的内容，每段不少于 3 句，保持上下文完整，不得断章取义
2. 所有内容必须围绕用户问题高度聚焦，避免泛泛而谈。
3. 优先选择近五年（2020–2025）的高质量期刊或会议论文（如 Nature、Science、IEEE、ACL、NeurIPS 等）。
4. 必须提供一个综合性简要综述（summary），涵盖主要研究方向、共识、分歧与趋势，长度为 300–500 字。
5. 只输出有效的JSON， don't contain any other text、解释 or format.
6. Ensure results array at least contain 8 entries, each entry must contain all required fields.
"""),
    ("human", "{query}"),
])


def get_deepseek_llm() -> ChatOpenAI:
    """ --- 3. 配置 LLM（DeepSeek-Chat）---"""
    logger.debug("初始化 DeepSeek LLM 配置")
    return ChatOpenAI(
        model="deepseek-chat",
        openai_api_key=current_config.agent.search.api_key,
        openai_api_base=current_config.agent.search.base_url,
        temperature=0.3,
        max_tokens=3000,
    )


def create_academic_search_agent() -> Runnable:
    """--- 4. 构建 Agent Chain ---"""
    logger.info("创建学术搜索 Agent")
    llm = get_deepseek_llm()
    output_parser = JsonOutputParser(pydantic_object=AcademicSearchResult)

    # 构建完整链：Prompt → LLM → Parser
    chain = (
            ACADEMIC_SEARCH_PROMPT
            | llm
            | output_parser
    )

    def _wrapped_run(inputs: Dict[str, Any]) -> Dict[str, Any]:
        logger.info(f"[AcademicSearchAgent] 开始处理查询: {inputs['query']}")
        result = chain.invoke(inputs)
        academic_result = AcademicSearchResult(**result)
        logger.info("[AcademicSearchAgent] 查询处理完成")
        return {"academic_search_result": academic_result}

    logger.info("学术搜索 Agent 创建完成")
    return RunnableLambda(_wrapped_run)


# for langGraph
academic_search_agent = create_academic_search_agent()
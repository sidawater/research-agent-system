import os
import time
import traceback
import datetime
from typing import List, Dict, Optional
import requests
from langchain_core.runnables import Runnable, RunnableLambda
from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate
from core.common.schemas import AcademicSearchQuery, AcademicSearchResult, ReferenceItem
from config import current_config
from core.common.logger import get_logger
from core.agents.prompts import SystemPrompts

logger = get_logger(__name__)


class SemanticScholarAPI:
    def __init__(self, api_key: Optional[str] = None):
        self.base_url = "https://api.semanticscholar.org/graph/v1"
        self.headers = {"x-api-key": api_key}

    def search_papers(self, query: str, fields: str = "paperId,title,authors,year,abstract,url",
                      limit: int = 10, year: Optional[str] = None,
                      fields_of_study: Optional[str] = None) -> Dict:
        """基于问题文本搜索论文"""
        params = {
            "query": query,
            "fields": fields,
            "limit": limit
        }

        if year:
            params["year"] = year
        if fields_of_study:
            params["fieldsOfStudy"] = fields_of_study

        response = requests.get(
            f"{self.base_url}/paper/search",
            params=params,
            headers=self.headers
        )
        response.raise_for_status()
        time.sleep(1)

        return response.json()

    def get_paper_details(self, paper_ids: List[str], fields: str = "title,abstract,authors,year,url") -> List[Dict]:
        """根据论文ID列表获取论文详细信息"""
        if len(paper_ids) > 500:
            raise ValueError("最多支持500个论文ID")

        params = {"fields": fields}
        response = requests.post(
            f"{self.base_url}/paper/batch",
            params=params,
            json={"ids": paper_ids},
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()

    @staticmethod
    def download_paper(url: str):
        try:
            resp = requests.get(url)
            resp.raise_for_status()
            return resp.content
        except Exception as e:
            logger.error(f"下载文件失败: {e}")
            return None


class SemanticSeeker(SemanticScholarAPI):
    """Semantic Scholar学术搜索"""

    default_fields: str = "paperId,title,authors,year,abstract,url,externalIds,openAccessPdf"

    def search_relevance(self, query: str, **kwargs) -> List[ReferenceItem]:
        """
        基于问题文本搜索论文
        :param query: 查询问题
        :param kwargs: 其他参数 check SemanticScholarAPI.search_papers
        :return: 论文列表
        """
        if not kwargs.get('year'):
            year = datetime.datetime.now().year
            kwargs['year'] = f'{year - 5}-year'
        if not kwargs.get('limit'):
            kwargs['limit'] = 10
        kwargs['fields'] = self.default_fields

        resp = self.search_papers(query=query, **kwargs)

        paper_list: List[dict] = resp.get('data', [])
        results: List[ReferenceItem] = []
        for _, paper in enumerate(paper_list, 1):
            authors = []
            for author in paper.get('authors', []):
                if isinstance(author, dict) and 'name' in author:
                    authors.append(author['name'])
                elif isinstance(author, str):
                    authors.append(author)

            external_ids = paper.get('externalIds', {})
            doi = external_ids.get('DOI') if external_ids else None
            title = paper.get('title', '无标题')
            open_access_pdf = paper.get('openAccessPdf', {})
            pdf_url = open_access_pdf.get('url')
            item = dict(
                index=0,
                title=title or '无标题',
                doi=doi or '',
                url=pdf_url or paper.get('url', '') or '',
                authors=authors,
                publication_year=paper.get('year') or 0,
                abstract=paper.get('abstract') or '无摘要',
                excerpts=[],
            )
            results.append(ReferenceItem(**item))
        return results


def get_deepseek_llm() -> ChatOpenAI:
    """LLM（DeepSeek-Chat）"""
    logger.debug("初始化 DeepSeek LLM 配置")
    return ChatOpenAI(
        model="deepseek-chat",
        openai_api_key=current_config.agent.search.api_key,
        openai_api_base=current_config.agent.search.base_url,
        temperature=0.3,
        max_tokens=3000,
        model_kwargs={"response_format": {"type": "json_object"}}
    )


# 定义Prompt模板
ACADEMIC_SEARCH_PROMPT = ChatPromptTemplate.from_messages([
    ("system", SystemPrompts.get("semantic_scholar")),
    ("human", "用户研究问题：{query}"),
    ("ai", "已有搜索结果：{existing_result}"),
    ("human", "补充查询参数：{supply_query}"),
])


def create_semantic_scholar_agent_with_llm() -> Runnable:
    """创建带LLM优化的Semantic Scholar学术搜索Agent"""
    logger.info("创建Semantic Scholar学术搜索Agent")

    llm = get_deepseek_llm()
    semantic_scholar_api = SemanticSeeker(api_key=current_config.agent.search.semantic_api_key)
    output_parser = JsonOutputParser(pydantic_object=AcademicSearchResult)

    # 创建处理链
    chain = (
            ACADEMIC_SEARCH_PROMPT
            | llm
            | output_parser
    )

    def _wrapped_run(inputs: AcademicSearchQuery) -> AcademicSearchResult:
        """包装运行函数"""
        logger.info(f"[SemanticScholarAgent] 开始处理查询: {inputs.query[:20]}...")

        try:
            # prepare for query with llm
            logger.info("生成查询和主题...")
            chain_inputs = {
                "query": inputs.query,
                "supply_query": ", ".join(inputs.supply_query) if inputs.supply_query else "无",
                "existing_result": inputs.existing_result if inputs.existing_result else "无"
            }
            result: dict = chain.invoke(chain_inputs)
            academic_result = AcademicSearchResult(
                query=inputs.query,
                theme=result.get('theme'),
                summary=result.get('summary', ''),
                results=[],
            )
        except Exception as e:
            logger.error(f"解析LLM输出失败: {e} {traceback.format_exc()}")
            raise ValueError(f"解析LLM输出失败: {e} {traceback.format_exc()}") from e

        generated_queries: List[str] = result.get('queries')
        for search_query in generated_queries[:5]:
            try:
                logger.info(f"执行搜索: {search_query}")
                results = semantic_scholar_api.search_relevance(query=search_query)
                academic_result.results.extend(results)
            except Exception as e:
                logger.error(f"搜索查询 '{search_query}' 时出错: {e} {traceback.format_exc()}")
                continue

        unique_list = []
        key_set = set()
        for item in academic_result.results:
            key = f"{item.title}_{item.doi}"
            if key not in key_set:
                unique_list.append(item)
                key_set.add(key)

        academic_result.results = unique_list

        logger.info(f"去重后得到 {len(academic_result.results)} 篇唯一论文")
        return academic_result

    logger.info("Semantic Scholar学术搜索Agent创建完成")
    return RunnableLambda(_wrapped_run)


class SemanticAgent:
    _agent = None

    @classmethod
    def get(cls):
        if cls._agent is None:
            cls._agent = create_semantic_scholar_agent_with_llm()
        return cls._agent

    @classmethod
    def reset(cls):
        del cls._agent
        cls._agent = None

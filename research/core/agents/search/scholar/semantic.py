"""Semantic Scholar API接口封装"""
import requests
from typing import List, Dict, Any, Optional
from .schemas import SearchQuery, SearchResponse, Paper


class SemanticScholarAPI:
    """Semantic Scholar API客户端"""

    BASE_URL = "https://api.semanticscholar.org/graph/v1"

    def __init__(self, timeout: int = 30):
        self.timeout = timeout
        self.session = requests.Session()
        # 设置通用请求头
        self.session.headers.update({
            'User-Agent': 'AcademicSearchAgent/1.0'
        })

    def search_papers(self, search_query: SearchQuery) -> SearchResponse:
        """
        搜索论文

        Args:
            search_query: 搜索查询参数

        Returns:
            SearchResponse: 搜索响应
        """
        url = f"{self.BASE_URL}/paper/search"

        # 构建查询参数
        params = {
            "query": search_query.query,
            "fields": search_query.fields,
            "limit": min(search_query.limit, 100)  # API限制最大100
        }

        # 添加可选过滤器
        if search_query.year:
            params["year"] = search_query.year
        if search_query.fields_of_study:
            params["fieldsOfStudy"] = search_query.fields_of_study

        try:
            response = self.session.get(url, params=params, timeout=self.timeout)
            response.raise_for_status()
            data = response.json()

            # 转换为Paper对象列表
            papers = []
            for paper_data in data.get("data", []):
                paper = Paper(**paper_data)
                papers.append(paper)

            return SearchResponse(
                total=data.get("total", 0),
                offset=data.get("offset", 0),
                next=data.get("next"),
                data=papers
            )

        except requests.exceptions.RequestException as e:
            raise Exception(f"Semantic Scholar API请求失败: {str(e)}")

    def format_search_results(self, response: SearchResponse, max_results: int = None) -> str:
        """
        格式化搜索结果

        Args:
            response: 搜索响应
            max_results: 最大显示结果数

        Returns:
            str: 格式化的结果字符串
        """
        if not response.data:
            return "未找到相关论文。"

        papers_to_show = response.data
        if max_results and max_results < len(papers_to_show):
            papers_to_show = papers_to_show[:max_results]

        results = [
            f"找到 {response.total} 篇相关论文，显示前 {len(papers_to_show)} 篇:\n"
        ]

        for i, paper in enumerate(papers_to_show, 1):
            result_str = f"{i}. {paper.title or '无标题'}\n"
            result_str += f"   年份: {paper.year or '未知'}\n"

            if paper.abstract:
                abstract = paper.abstract[:200] + "..." if len(paper.abstract) > 200 else paper.abstract
                result_str += f"   摘要: {abstract}\n"

            if paper.authors:
                author_names = paper.get_author_names()
                result_str += f"   作者: {', '.join(author_names[:3])}\n"

            result_str += f"   PaperID: {paper.paperId}\n"
            results.append(result_str)

        return "\n".join(results)

    def test_connection(self) -> bool:
        """测试API连接"""
        try:
            test_query = SearchQuery(query="test", limit=1)
            self.search_papers(test_query)
            return True
        except Exception:
            return False
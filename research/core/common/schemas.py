from typing import List, Optional
from pydantic import BaseModel, Field
from core.common import get_logger

logger = get_logger(__name__)


class ReferenceItem(BaseModel):
    """单篇参考文献的结构"""
    index: int = Field(default=0, description="参考文献的序号， 默认为0")
    title: str = Field(description="论文标题")
    doi: Optional[str] = Field(None, description="DOI")
    url: Optional[str] = Field(None, description="论文链接")
    filepath: Optional[str] = Field(default='', description="保存的PDF文件路径")
    authors: List[str] = Field(description="作者列表")
    publication_year: int = Field(description="发表年份", ge=1980, le=2030)
    abstract: str = Field(description="完整且语义连贯的摘要")
    excerpts: List[str] = Field(
        default_factory=list,
        description="从正文中选取的1-5段高度相关内容，每段保持上下文完整",
        min_length=0,
    )


class AcademicSearchResult(BaseModel):
    """整体学术搜索结果"""
    query: str = Field(description="用户原始问题")
    theme: str = Field(description="研究方向的主题")
    summary: str = Field(description="基于全部检索结果生成的综合性简要综述（300–500字），"
                                     "涵盖主要研究方向、共识、分歧与趋势")
    results: List[ReferenceItem] = Field(
        description="约10篇高相关性学术文献",
        min_length=0,
    )


class AcademicSearchQuery(BaseModel):
    """
    学术搜索的查询参数
    """
    query: str = Field(description="用户原始问题")
    supply_query: List[str] = Field(description="补充的查询参数")
    existing_result: List[ReferenceItem] = Field(
        description="已有的搜索结果",
        min_length=0,
    )


class MultiQueryGeneration(BaseModel):
    """多查询生成结果"""
    queries: List[str] = Field(description="生成的多个查询关键字")
    theme: str = Field(description="研究方向的主题")
    coaching_opinion: List[str] = Field(description="用户的指导意见")
    search_result: AcademicSearchResult = Field(description="学术查询结果")
    ref_report: str = Field(description="原有报告内容, 作参考")


class ReportGenerationQuery(BaseModel):
    query: str
    theme: Optional[str]
    coaching_opinion: Optional[List[str]]
    academic_search_result: Optional[AcademicSearchResult]
    ref_report: Optional[str]


class ResearchState(BaseModel):
    query: str
    research_title: Optional[str] = None
    academic_search_result: Optional[AcademicSearchResult] = None

    report_title: Optional[str] = None
    final_report: Optional[str] = None

    waiting_for_user: Optional[bool] = False
    search_results_satisfactory: Optional[bool] = False
    report_satisfactory: Optional[bool] = False

    supply_query: Optional[List[str]] = None
    coaching_opinion: Optional[List[str]] = None

    def add_search_results(self, search_result: AcademicSearchResult):
        if self.academic_search_result is None:
            self.academic_search_result = search_result
        else:
            self.academic_search_result.results.extend(search_result.results)

    def academic_search_query(self):
        # existing_result = self.academic_search_result.results if self.academic_search_result else []
        return AcademicSearchQuery(
            query=self.query,
            supply_query=self.supply_query or [],
            existing_result=[],
        )

    def report_generation_query(self):
        return ReportGenerationQuery(
            query=self.query,
            theme=self.academic_search_result.theme if self.academic_search_result else None,
            coaching_opinion=self.coaching_opinion or [],
            academic_search_result=self.academic_search_result,
            ref_report=self.final_report or "",
        )

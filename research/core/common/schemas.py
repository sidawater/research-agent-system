from typing import List, TypedDict, Optional
from pydantic import BaseModel, Field
from core.common import get_logger

# 初始化日志记录器
logger = get_logger(__name__)


class ReferenceItem(BaseModel):
    """单篇参考文献的结构"""
    title: str = Field(description="论文标题")
    url: str = Field(description="论文链接")
    authors: List[str] = Field(description="作者列表")
    publication_year: int = Field(description="发表年份", ge=1900, le=2030)
    abstract: str = Field(description="完整且语义连贯的摘要")
    excerpts: List[str] = Field(
        description="从正文中选取的1-5段高度相关内容，每段保持上下文完整",
        min_length=1,
        max_length=3
    )


class AcademicSearchResult(BaseModel):
    """
    整体学术搜索结果
    """
    query: str = Field(description="用户原始问题")
    summary: str = Field(
        description="基于全部检索结果生成的综合性简要综述（300–500字），"
                    "涵盖主要研究方向、共识、分歧与趋势"
    )
    results: List[ReferenceItem] = Field(
        description="约10篇高相关性学术文献",
        min_length=1,
        max_length=12
    )


class ResearchState(BaseModel):
    query: str
    academic_search_result: Optional[AcademicSearchResult] = None
    final_report: Optional[str] = None
    report_title: Optional[str] = None
    user_decision_export: Optional[bool] = None
    user_decision_download: Optional[bool] = None
    export_path: Optional[str] = None
    downloaded_pdfs: Optional[List[str]] = None
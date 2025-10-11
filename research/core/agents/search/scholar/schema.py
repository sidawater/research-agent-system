"""数据模型定义"""
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
from pydantic import BaseModel, Field


@dataclass
class QueryConfig:
    """查询配置数据模型"""
    default_fields: str = "title,abstract,year,authors"
    max_queries: int = 5
    default_year_range: str = "2020-2025"
    default_fields_of_study: str = "Computer Science"
    include_open_access: bool = True
    max_results_per_query: int = 10

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return asdict(self)


class SearchQuery(BaseModel):
    """搜索查询数据模型"""
    query: str = Field(description="搜索查询字符串")
    fields: str = Field(default="title,abstract,year,authors", description="返回字段")
    year: Optional[str] = Field(default=None, description="年份范围过滤")
    fields_of_study: Optional[str] = Field(default=None, description="研究领域过滤")
    limit: int = Field(default=10, description="返回结果数量")

    class Config:
        schema_extra = {
            "example": {
                "query": "machine learning in healthcare",
                "fields": "title,abstract,year,authors",
                "year": "2020-2024",
                "fields_of_study": "Computer Science,Medicine",
                "limit": 5
            }
        }


class Paper(BaseModel):
    """论文数据模型"""
    paperId: str
    title: Optional[str] = None
    abstract: Optional[str] = None
    year: Optional[int] = None
    authors: Optional[List[Dict]] = None
    url: Optional[str] = None

    def get_author_names(self) -> List[str]:
        """获取作者名称列表"""
        if not self.authors:
            return []
        return [author.get('name', '') for author in self.authors]


class SearchResponse(BaseModel):
    """搜索响应数据模型"""
    total: int
    offset: int
    next: Optional[int] = None
    data: List[Paper]


class AgentConfig(BaseModel):
    """Agent配置数据模型"""
    model_name: str = "gpt-3.5-turbo"
    temperature: float = 0.7
    system_prompt: Optional[str] = None
    query_config: QueryConfig = Field(default_factory=QueryConfig)


class AgentStatus(BaseModel):
    """Agent状态数据模型"""
    agent_id: str
    is_active: bool
    config: Dict[str, Any]
    memory_size: int
    created_at: str
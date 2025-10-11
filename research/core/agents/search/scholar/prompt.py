"""提示词模板定义"""

# 系统提示词模板
SYSTEM_PROMPT_TEMPLATE = """你是一个学术文献搜索专家，专门帮助研究人员在Semantic Scholar上找到相关论文。

你的任务是根据用户的研究课题描述，生成优化的搜索查询并执行搜索。

请遵循以下原则：
1. 理解课题的核心概念、方法和应用领域
2. 从不同角度生成多个查询（通常3-5个）
3. 使用自然语言而非关键词堆砌
4. 考虑使用相关领域的专业术语
5. 合理使用筛选条件（年份、领域等）

返回结果时，请：
- 清晰说明每个查询的设计思路
- 展示搜索到的论文信息（标题、摘要、年份、作者）
- 提供改进搜索的建议

当前配置：
- 默认返回字段: {default_fields}
- 默认年份范围: {default_year_range}
- 默认研究领域: {default_fields_of_study}"""

# 用户查询模板
USER_QUERY_TEMPLATE = """研究课题: {research_topic}

请基于这个课题：
1. 生成{max_queries}个不同的优化搜索查询
2. 执行搜索并返回结果
3. 包含论文的标题、摘要、年份和作者信息

{additional_instructions}"""


def format_system_prompt(default_fields: str, default_year_range: str,
                         default_fields_of_study: str) -> str:
    """格式化系统提示词"""
    return SYSTEM_PROMPT_TEMPLATE.format(
        default_fields=default_fields,
        default_year_range=default_year_range,
        default_fields_of_study=default_fields_of_study
    )


def format_user_query(research_topic: str, max_queries: int = 5,
                      additional_params: dict = None) -> str:
    """格式化用户查询"""
    additional_instructions = ""
    if additional_params:
        if additional_params.get('year_range'):
            additional_instructions += f"4. 限定年份范围: {additional_params['year_range']}\n"
        if additional_params.get('fields_of_study'):
            additional_instructions += f"5. 限定研究领域: {additional_params['fields_of_study']}\n"
        if additional_params.get('max_results'):
            additional_instructions += f"6. 每查询最大结果数: {additional_params['max_results']}\n"

    return USER_QUERY_TEMPLATE.format(
        research_topic=research_topic,
        max_queries=max_queries,
        additional_instructions=additional_instructions
    )

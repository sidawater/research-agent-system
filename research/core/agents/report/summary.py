from typing import Dict, Any, AsyncGenerator
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import Runnable, RunnableLambda
from core.common.schemas import AcademicSearchResult, ResearchState
from core.common import get_logger
from config import current_config


# 初始化日志记录器
logger = get_logger(__name__)

# --- 1. 构建报告生成 Prompt ---
SYSTEM_REPORT_WRITING_PROMPT = """
你是一位资深学术编辑，请根据提供的结构化检索结果，撰写一份专业、清晰、逻辑严谨的中文研究报告。

要求如下：
## 输出要求(报告部分)

**详细分析部分**
- 全面展示研究内容
- 按逻辑顺序组织信息
- 包含研究方法、结果、讨论等学术要素
- 使用表格、图表等辅助说明

### 引用规范
- 所有引用必须采用规范的学术格式
- 在文中用上标数字标注引用位置¹
- 文末提供完整的参考文献列表
- 确保引用信息准确完整

### 质量要求
- 基于可靠的学术来源
- 保持客观中立的学术态度
- 明确标注不确定性和研究局限
- 避免重复用户问题内容
- 确保报告自包含性

references_section 

## 参考文献格式示例(报告部分)
**参考文献**

1. 作者. (年份). 论文标题. *期刊名称*, *卷*(期), 页码. [在线获取](完整URL)
2. 作者. (年份). 论文标题. *期刊名称*, *卷*(期), 页码. [出版社页面](完整URL) - 可通过机构订阅获取
3. 作者. (年份). 书名. 出版社. [在线阅读](完整URL)
4. 作者. (年份). 论文标题. 预印本平台. [预印本链接](完整URL)

**获取渠道说明：**
- 优先提供可直接下载的论文链接
- 如无法直接下载，提供出版社官方页面链接，并注明获取方式（如：机构订阅、开放获取、预印本等）
- 确保所有链接有效且可访问
- 标注论文的访问权限状态

references_section 

text_section

## 特殊说明
- 当前时间: {{current_time}}
- 响应语言: **{{language}}**
- 优先使用近期的权威研究
- 标注研究的证据等级和质量
- 对争议性话题保持审慎态度
"""
RAW_REPORT_WRITING_PROMPT = [
    ("system", SYSTEM_REPORT_WRITING_PROMPT),
    ("human", "检索结果如下：\n\n{academic_data}"),
]
REPORT_WRITING_PROMPT = ChatPromptTemplate.from_messages(RAW_REPORT_WRITING_PROMPT)


def get_deepseek_llm() -> ChatOpenAI:
    logger.debug("初始化 DeepSeek LLM 配置用于报告生成")
    return ChatOpenAI(
        model="deepseek-chat",
        openai_api_key=current_config.agent.summary.api_key,
        openai_api_base=current_config.agent.summary.base_url,
        temperature=0.3,
        # max_tokens=2000,
    )


# --- 3. 构建 Report Writer Agent ---
def create_report_writer_agent() -> Runnable:
    logger.info("创建报告写入 Agent")
    llm = get_deepseek_llm()
    output_parser = StrOutputParser()  # 返回纯文本报告

    # 将 AcademicSearchResult 转为可读字符串（供 LLM 理解）
    def format_academic_data(inputs: Dict[str, Any]) -> Dict[str, str]:
        logger.debug("格式化学术数据")
        data: AcademicSearchResult = inputs["academic_search_result"]

        # 构建文献字符串
        refs_text = []
        for i, ref in enumerate(data.results, 1):
            excerpts = "\n".join(f'  - "{ex}"' for ex in ref.excerpts)
            refs_text.append(
                f"[{i}] 标题: {ref.title}\n"
                f"    作者: {', '.join(ref.authors)} ({ref.publication_year})\n"
                f"    摘要: {ref.abstract}\n"
                f"    正文节选:\n{excerpts}"
            )

        formatted = (
                f"用户问题: {data.query}\n"
                f"综述摘要: {data.summary}\n"
                f"参考文献（共{len(data.results)}篇）:\n" + "\n\n".join(refs_text)
        )
        logger.debug("学术数据格式化完成")
        return {"academic_data": formatted}

    chain = (
            RunnableLambda(format_academic_data)
            | REPORT_WRITING_PROMPT
            | llm
            | output_parser
    )

    # 包装为 LangGraph 兼容节点
    def _run_report_node(state: ResearchState) -> Dict[str, Any]:
        logger.info("[ReportWriterAgent] 正在生成报告...")
        report = chain.invoke({"academic_search_result": state.academic_search_result})
        logger.info(f"[ReportWriterAgent] 报告生成完成（长度: {len(report)} 字）")
        return {"final_report": report}

    # 包装为流式处理节点
    async def _run_report_node_stream(state: ResearchState) -> AsyncGenerator[str, None]:
        logger.info("[ReportWriterAgent] 正在生成报告 (流式)...")
        final_report = ''
        # 使用流式调用
        async for chunk in chain.astream(
                {"academic_search_result": state.academic_search_result}
        ):
            yield chunk
            final_report += chunk
        logger.info("[ReportWriterAgent] 报告生成完成")

    logger.info("报告写入 Agent 创建完成")
    return RunnableLambda(_run_report_node)

# --- 4. 导出可直接用于 LangGraph 的节点 ---
report_writer_agent = create_report_writer_agent()
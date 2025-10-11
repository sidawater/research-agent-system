from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import Runnable, RunnableLambda
from core.common.schemas import ResearchState, ReportGenerationQuery
from core.common import get_logger
from core.agents.prompts import SystemPrompts
from config import current_config


# 初始化日志记录器
logger = get_logger(__name__)

# --- 1. 构建报告生成 Prompt ---
SYSTEM_REPORT_WRITING_PROMPT = SystemPrompts.get("report_writing")
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
    output_parser = StrOutputParser()

    def format_academic_data(inputs: ReportGenerationQuery) -> str:
        logger.debug("格式化学术数据")
        data: ReportGenerationQuery = inputs

        # 构建文献字符串
        refs_text = []
        for i, ref in enumerate(data.academic_search_result.results, 1):
            excerpts = "\n".join(f'  - "{ex}"' for ex in ref.excerpts)
            refs_text.append(
                f"[{i}] 标题: {ref.title}\n"
                f"    作者: {', '.join(ref.authors)} ({ref.publication_year})\n"
                f"    摘要: {ref.abstract}\n"
                f"    正文节选:\n{excerpts}"
            )

        formatted = (
                f"用户问题: {data.query}\n"
                f"综述摘要: {data.theme}\n"
                f"参考文献（共{len(data.academic_search_result.results)}篇）:\n" + "\n\n".join(refs_text) +
                "\n\n"
                f"参考报告: {data.ref_report}\n"
                f"用户指导意见: \n" + "\n".join(data.coaching_opinion or [])
        )
        logger.debug("学术数据格式化完成")
        return formatted

    chain = (
            RunnableLambda(format_academic_data)
            | REPORT_WRITING_PROMPT
            | llm
            | output_parser
    )

    def _run_report_node(query: ResearchState) -> str:
        logger.info("[ReportWriterAgent] 正在生成报告...")
        report = chain.invoke(query)
        logger.info(f"[ReportWriterAgent] 报告生成完成（长度: {len(report)} 字）")
        return report

    logger.info("报告写入 Agent 创建完成")
    return RunnableLambda(_run_report_node)

# --- 4. 导出可直接用于 LangGraph 的节点 ---
report_writer_agent = create_report_writer_agent()

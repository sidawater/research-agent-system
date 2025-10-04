from langgraph.graph import StateGraph, END
from core.common.schemas import ResearchState
from core.agents.search.deepseek import academic_search_agent
from core.agents.report.summary import report_writer_agent
from core.agents.report.export import markdown_exporter_agent
from core.agents.report.reference import reference_downloader_agent
from core.common import get_logger

# 初始化日志记录器
logger = get_logger(__name__)

# --- 节点函数（包装 Agent 以适配 State）---
async def academic_search_node(state: ResearchState):
    logger.info("执行学术搜索节点")
    if not state.query:
        return {"academic_search_result": []}
    if state.academic_search_result:
        logger.info('academic search result is ready!')
        return {"academic_search_result": state.academic_search_result}

    result = await academic_search_agent.ainvoke({"query": state.query})
    logger.debug("学术搜索节点执行完成")
    state.academic_search_result = result["academic_search_result"]
    return {"academic_search_result": result["academic_search_result"]}

async def write_report_node(state: ResearchState):
    logger.info("执行报告写入节点")
    if state.final_report:
        logger.info('final report is ready')
        return state.final_report

    result = await report_writer_agent.ainvoke(state)
    state.final_report = result
    logger.debug("报告写入节点执行完成")
    return result

async def export_markdown_node(state: ResearchState):
    logger.info("执行 Markdown 导出节点")
    result = await markdown_exporter_agent.ainvoke(state)
    logger.debug("Markdown 导出节点执行完成")
    return result

async def download_references_node(state: ResearchState):
    logger.info("执行参考文献下载节点")
    result = await reference_downloader_agent.ainvoke(state)
    logger.debug("参考文献下载节点执行完成")
    return result



# --- 条件路由函数 ---
def route_after_report(state: ResearchState) -> str:
    """报告生成后，判断是否需要询问导出"""
    logger.debug("路由决策: 报告生成后")
    if state.user_decision_export is None:
        logger.info("需要询问用户是否导出")
        return "ask_export"  # 需要人工干预
    logger.info("根据用户决策决定是否导出")
    return "route_export_decision"


def route_export_decision(state: ResearchState) -> str:
    """根据用户决策决定是否导出"""
    logger.debug("决策: 是否导出报告")
    if state.user_decision_export:
        logger.info("用户选择导出报告")
        return "export_markdown"
    else:
        logger.info("用户选择不导出报告，进入下载询问")
        return "route_after_export_or_skip"


def route_after_export_or_skip(state: ResearchState) -> str:
    """导出完成后，进入下载询问"""
    logger.debug("路由决策: 导出完成后")
    if state.user_decision_download is None:
        logger.info("需要询问用户是否下载参考文献")
        return "ask_download"
    logger.info("根据用户决策决定是否下载参考文献")
    return "route_download_decision"


def route_download_decision(state: ResearchState) -> str:
    """根据用户决策决定是否下载"""
    logger.debug("决策: 是否下载参考文献")
    if state.user_decision_download:
        logger.info("用户选择下载参考文献")
        return "download_references"
    else:
        logger.info("用户选择不下载参考文献，流程结束")
        return END


# --- 构建 Graph ---
async def create_research_graph():
    logger.info("创建研究工作流图")
    workflow = StateGraph(ResearchState)

    # 添加节点
    workflow.add_node("academic_search", academic_search_node)
    workflow.add_node("write_report", write_report_node)
    workflow.add_node("export_markdown", export_markdown_node)
    workflow.add_node("download_references", download_references_node)

    # 添加决策节点
    async def ask_export_node(state: ResearchState):
        logger.info("等待用户导出决策")
        return {"user_decision_export": None}

    async def ask_download_node(state: ResearchState):
        logger.info("等待用户下载决策")
        return {"user_decision_download": None}

    workflow.add_node("ask_export", ask_export_node)
    workflow.add_node("ask_download", ask_download_node)

    # 添加路由决策节点
    workflow.add_node("route_export_decision", lambda state: {})
    workflow.add_node("route_after_export_or_skip", lambda state: {})
    workflow.add_node("route_download_decision", lambda state: {})

    # 设置入口
    workflow.set_entry_point("academic_search")
    logger.debug("设置入口节点为 academic_search")

    # 学术搜索 → 写报告
    workflow.add_edge("academic_search", "write_report")
    logger.debug("连接 academic_search -> write_report")

    # 报告后：判断是否需询问导出
    workflow.add_conditional_edges(
        "write_report",
        route_after_report,
        {
            "ask_export": "ask_export",
            "route_export_decision": "route_export_decision"
        }
    )
    logger.debug("添加 write_report 条件边")

    # 从 ask_export 返回后，进入 route_export_decision
    workflow.add_edge("ask_export", "route_export_decision")
    logger.debug("连接 ask_export -> route_export_decision")

    # route_export_decision 分支
    workflow.add_conditional_edges(
        "route_export_decision",
        route_export_decision,
        {
            "export_markdown": "export_markdown",
            "route_after_export_or_skip": "route_after_export_or_skip"
        }
    )
    logger.debug("添加 route_export_decision 条件边")

    # 导出完成后，进入下载询问
    workflow.add_edge("export_markdown", "route_after_export_or_skip")
    logger.debug("连接 export_markdown -> route_after_export_or_skip")

    # route_after_export_or_skip 分支
    workflow.add_conditional_edges(
        "route_after_export_or_skip",
        route_after_export_or_skip,
        {
            "ask_download": "ask_download",
            "route_download_decision": "route_download_decision"
        }
    )
    logger.debug("添加 route_after_export_or_skip 条件边")

    # 从 ask_download 返回后，进入 route_download_decision
    workflow.add_edge("ask_download", "route_download_decision")
    logger.debug("连接 ask_download -> route_download_decision")

    # route_download_decision 分支
    workflow.add_conditional_edges(
        "route_download_decision",
        route_download_decision,
        {
            "download_references": "download_references",
            END: END
        }
    )
    logger.debug("添加 route_download_decision 条件边")

    # 下载完成后结束
    workflow.add_edge("download_references", END)
    logger.debug("连接 download_references -> END")

    compiled_workflow = workflow.compile()
    logger.info("研究工作流图创建完成")
    return compiled_workflow

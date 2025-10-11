from langgraph.graph import StateGraph, END
from core.common.schemas import ResearchState
from core.agents.search.semantic import SemanticAgent
from core.agents.search.deepseek import DeepseekSearchAgent
from core.agents.report.summary import report_writer_agent
from core.common import get_logger

logger = get_logger(__name__)


async def academic_search_node(state: ResearchState):
    logger.info("执行学术搜索节点")
    if not state.query:
        return {}
    if state.academic_search_result and state.search_results_satisfactory:
        logger.info('academic search result is ready!')
        return {"value": state.academic_search_result}

    query_struct = state.academic_search_query()
    result = await SemanticAgent.get().ainvoke(query_struct)
    logger.debug("学术搜索节点执行完成")
    state.add_search_results(result)
    return {'value': state.academic_search_result}


async def academic_search_node_deepseek(state: ResearchState):
    logger.info("执行学术搜索节点")
    if not state.query:
        return {}
    if state.academic_search_result and state.search_results_satisfactory:
        logger.info('academic search result is ready!')
        return {"value": state.academic_search_result}

    query_struct = state.academic_search_query()
    result = await DeepseekSearchAgent.get().ainvoke(query_struct)
    logger.debug("学术搜索节点执行完成")
    state.add_search_results(result)
    return {"value": state.academic_search_result}


async def write_report_node(state: ResearchState):
    logger.info("执行报告写入节点")
    if state.final_report and state.report_satisfactory:
        logger.info('final report is ready')
        return state.final_report

    query_struct = state.report_generation_query()
    result = await report_writer_agent.ainvoke(query_struct)
    state.final_report = result
    logger.debug("报告写入节点执行完成")
    return {"value": result}


async def wait_user_decision_node(state: ResearchState):
    """等待用户决策节点 - 通过WebSocket交互"""
    logger.info("等待用户决策")
    state.waiting_for_user = True
    return {"waiting_for_user": state.waiting_for_user}


def route_based_on_user_decision(state: ResearchState) -> str:
    """基于用户决策的路由"""
    logger.info(
        f"用户决策: "
        f"search_satisfactory={state.search_results_satisfactory}, "
        f"report_satisfactory={state.report_satisfactory}")

    if not state.academic_search_result:
        return "academic_search"
    elif not state.search_results_satisfactory:
        return "academic_search"
    elif state.search_results_satisfactory and not state.final_report:
        return "write_report"
    elif state.final_report and not state.report_satisfactory:
        return "write_report"
    elif state.search_results_satisfactory and state.report_satisfactory:
        return "satisfied"

    return "satisfied"


async def create_research_graph(mode: str):
    logger.info("创建一次对话一个动作的研究工作流图")
    workflow = StateGraph(ResearchState)

    if mode == 'deepseek':
        workflow.add_node("academic_search", academic_search_node_deepseek)
    elif mode == 'semantic':
        workflow.add_node("academic_search", academic_search_node)
    else:
        raise TypeError(f'no search mode named "{mode}"!!!')
    workflow.add_node("write_report", write_report_node)

    workflow.set_entry_point("academic_search")

    workflow.add_conditional_edges(
        "academic_search",
        route_based_on_user_decision,
        {
            "academic_search": END,
            "write_report": "write_report",
            "satisfied": END,
        }
    )
    workflow.add_conditional_edges(
        "write_report",
        route_based_on_user_decision,
        {
            "academic_search": "academic_search",
            "write_report": END,
            "satisfied": END,
        }
    )

    return workflow.compile()


class GraphManager:
    _graph = None

    @classmethod
    def get(cls, mode):
        if cls._graph is None:
            cls._graph = create_research_graph(mode)
        return cls._graph

    @classmethod
    def reset(cls):
        del cls._graph
        DeepseekSearchAgent.reset()
        SemanticAgent.reset()
        cls._graph = None

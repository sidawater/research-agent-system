import sys
import json
from pathlib import Path
from datetime import datetime

# 添加项目根目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent))
from config import load_config

load_config("research-agent.toml")

from core import setup_core
from core.workflow.graph import create_research_graph
from core.common.schemas import ResearchState


def save_state_to_json(state: ResearchState, step_name: str, export_dir: Path):
    """
    将 state 信息保存为 JSON 文件
    
    Args:
        state: 当前状态
        step_name: 步骤名称
        export_dir: 导出目录路径
    """
    # 创建带时间戳的文件名
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{step_name}_{timestamp}.json"
    filepath = export_dir / filename
    
    # 确保导出目录存在
    export_dir.mkdir(parents=True, exist_ok=True)
    
    # 转换 state 中的 Pydantic 模型为可序列化的字典
    serializable_state = {}
    for key, value in state.items():
        if hasattr(value, 'dict'):
            # 如果是 Pydantic 模型，使用 dict() 方法
            serializable_state[key] = value.dict() if value else None
        elif hasattr(value, '__dict__'):
            # 如果是其他对象，尝试使用 __dict__
            serializable_state[key] = value.__dict__ if value else None
        else:
            # 基本类型直接赋值
            serializable_state[key] = value
    
    # 保存到 JSON 文件
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(serializable_state, f, ensure_ascii=False, indent=2)
    
    print(f"💾 状态已保存: {filepath}")


def run_full_research_flow(
        query: str,
        export_decision: bool = True,
        download_decision: bool = True
):
    """
    运行完整的学术研究流程

    Args:
        query: 用户查询问题
        export_decision: 是否导出报告
        download_decision: 是否下载参考文献
    """
    print("🔍 启动学术研究助手...")
    setup_core()
    
    # 设置导出目录
    export_dir = Path("var") / "states"
    print(f"📁 状态文件将保存至: {export_dir.absolute()}")

    # 初始化状态
    initial_state: ResearchState = {
        "query": query,
        "academic_search_result": None,
        "final_report": None,
        "report_title": None,
        "user_decision_export": export_decision,  # 直接注入决策（跳过人工中断）
        "user_decision_download": download_decision,
        "export_path": None,
        "downloaded_pdfs": None
    }
    
    # 保存初始状态
    save_state_to_json(initial_state, "01_initial", export_dir)

    # 创建并运行图
    app = create_research_graph()
    print(f"📝 正在处理查询: '{query}'")
    print(f"📤 导出报告: {'是' if export_decision else '否'}")
    print(f"📥 下载文献: {'是' if download_decision else '否'}\n")

    try:
        # 使用 stream 方法逐个执行节点并保存状态
        current_state = initial_state.copy()
        step_count = 2
        
        # 修复：正确处理 stream 返回值
        for event in app.stream(current_state, stream_mode="updates"):
            # event 是一个字典，包含节点名称和对应的更新
            for step_name, step_state in event.items():
                # 更新当前状态
                current_state.update(step_state if step_state else {})
                
                # 保存当前步骤的状态
                save_state_to_json(current_state, f"{step_count:02d}_{step_name}", export_dir)
                step_count += 1
                
                # 显示当前步骤
                print(f"✅ 执行步骤: {step_name}")

        final_state = current_state

        # 输出结果摘要
        print("\n✅ 流程执行完成！")
        if final_state.get("export_path"):
            print(f"📄 报告已保存: {final_state['export_path']}")
        if final_state.get("downloaded_pdfs"):
            print(f"📚 已下载 {len(final_state['downloaded_pdfs'])} 篇文献")

        # 可选：打印报告预览
        if final_state.get("final_report"):
            preview = "\n".join(final_state["final_report"].split("\n")[:10])
            print(f"\n📊 报告预览:\n{preview}\n...")

    except Exception as e:
        print(f"❌ 流程执行失败: {e}")
        raise


if __name__ == "__main__":
    # 示例查询
    EXAMPLE_QUERY = "大语言模型在临床决策支持系统中的最新进展"

    # 运行全流程（导出+下载）
    run_full_research_flow(
        query=EXAMPLE_QUERY,
        export_decision=True,
        download_decision=True
    )
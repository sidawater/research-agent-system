import os
import re
from pathlib import Path
from typing import Dict, Any
from langchain_core.runnables import Runnable, RunnableLambda
from core.common.schemas import ResearchState
from core.common import get_logger

# 初始化日志记录器
logger = get_logger(__name__)


def extract_title_from_markdown(markdown_text: str) -> str:
    """
    从 Markdown 报告中提取一级标题作为报告标题。
    若无 # 标题，则生成一个默认标题（如 "学术报告_20251004"）。
    """
    logger.debug("从 Markdown 中提取标题")
    # 匹配 # 开头的标题（支持空格）
    match = re.search(r'^#\s+(.+)$', markdown_text, re.MULTILINE)
    if match:
        title = match.group(1).strip()
        # 移除非法文件名字符
        title = re.sub(r'[<>:"/\\|?*]', '_', title)
        logger.debug(f"提取到标题: {title}")
        return title[:100]  # 限制长度

    # 默认标题
    from datetime import datetime
    default_title = f"report-{datetime.now().strftime('%Y%m%d')}"
    logger.debug(f"未找到标题，使用默认标题: {default_title}")
    return default_title


def create_markdown_exporter_agent() -> Runnable:
    def _export_markdown_node(state: ResearchState) -> Dict[str, Any]:
        logger.info("[MarkdownExporter] 开始导出报告")
        report_md: str = state.final_report
        export_home: str = os.getenv("EXPORT_HOME", "./var")  # 默认 ./var

        # 提取或生成标题
        report_title = extract_title_from_markdown(report_md)

        # 构建路径：${export_home}/${report_title}/${report_title}.md
        report_dir = Path(export_home) / report_title
        report_dir.mkdir(parents=True, exist_ok=True)
        md_path = report_dir / f"{report_title}.md"

        # 写入文件
        try:
            with open(md_path, "w", encoding="utf-8") as f:
                f.write(report_md)
            logger.info(f"[MarkdownExporter] 报告已导出至: {md_path}")
        except Exception as e:
            error_msg = f"导出失败: {e}"
            logger.error(f"[MarkdownExporter] {error_msg}", exc_info=True)
            return {"export_error": error_msg}

        # 返回绝对路径（供前端展示或 MCP 后续处理）
        logger.info("[MarkdownExporter] 导出完成")
        return {
            "export_path": str(md_path.resolve()),
            "report_title": report_title,
            "status": "exported"
        }

    logger.info("创建 Markdown 导出 Agent")
    return RunnableLambda(_export_markdown_node)


# 导出可直接用于 LangGraph 的节点
markdown_exporter_agent = create_markdown_exporter_agent()
import os
import re
from pathlib import Path
from typing import Dict, Any, List
from langchain_core.runnables import Runnable, RunnableLambda
from core.common.schemas import ResearchState
from core.common import get_logger

# 初始化日志记录器
logger = get_logger(__name__)


def sanitize_filename(name: str) -> str:
    """清理文件名中的非法字符"""
    logger.debug(f"清理文件名: {name}")
    name = re.sub(r'[<>:"/\\|?*]', '_', name)
    result = name.strip()[:150]  # 限制长度
    logger.debug(f"清理后文件名: {result}")
    return result


def mock_download_pdf(title: str, output_path: Path) -> bool:
    """
    模拟 PDF 下载（实际项目中可替换为：
    - 调用 CrossRef / Semantic Scholar API
    - 使用 Unpaywall / arXiv / PubMed 下载
    - 调用 MCP 的 /download-pdf 服务
    """
    logger.debug(f"开始下载 PDF: {title}")
    try:
        # 创建占位 PDF 内容（实际应替换为真实二进制流）
        placeholder_content = f"%PDF-1.4\n% 模拟文献: {title}\n".encode("utf-8")
        with open(output_path, "wb") as f:
            f.write(placeholder_content)
        logger.debug(f"PDF 下载完成: {output_path}")
        return True
    except Exception as e:
        logger.warning(f"下载失败 [{title}]: {e}")
        return False


def create_reference_downloader_agent() -> Runnable:
    logger.info("创建参考文献下载 Agent")
    def _download_references_node(state: ResearchState) -> Dict[str, Any]:
        logger.info("[ReferenceDownloader] 开始下载参考文献")
        # 从 state 获取必要数据
        academic_result = state.academic_search_result
        report_title = state.report_title

        if not report_title:
            logger.error("[ReferenceDownloader] 无法从 state 中获取报告标题")
            raise ValueError("无法从 state 中获取报告标题")

        export_home = os.getenv("EXPORT_HOME", "./var")
        report_dir = Path(export_home) / sanitize_filename(report_title)
        report_dir.mkdir(parents=True, exist_ok=True)

        downloaded_files: List[str] = []
        failed_titles: List[str] = []

        # 遍历所有参考文献
        logger.debug(f"[ReferenceDownloader] 总共需要下载 {len(academic_result.results)} 篇文献")
        for ref in academic_result.results:
            ref_title_clean = sanitize_filename(ref.title)
            pdf_path = report_dir / f"{ref_title_clean}.pdf"

            if mock_download_pdf(ref.title, pdf_path):
                downloaded_files.append(str(pdf_path.resolve()))
                logger.debug(f"[ReferenceDownloader] 已下载: {pdf_path.name}")
            else:
                failed_titles.append(ref.title)

        result = {
            "downloaded_pdfs": downloaded_files,
            "download_status": "completed"
        }
        if failed_titles:
            result["download_errors"] = failed_titles
            logger.warning(f"[ReferenceDownloader] {len(failed_titles)} 篇文献下载失败")

        logger.info("[ReferenceDownloader] 下载任务完成")
        return result

    return RunnableLambda(_download_references_node)


# 导出 LangGraph 节点
reference_downloader_agent = create_reference_downloader_agent()
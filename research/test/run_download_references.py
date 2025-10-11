"""
Minimal script for download_references API endpoint
Only keeps the core functionality: API request and file writing
"""

import requests
import os
from datetime import datetime


def run_download_references(session_id: str, base_url: str = "http://localhost:8000"):
    """
    Minimal implementation for testing the download_references endpoint
    
    Args:
        session_id: Session ID to download references for
        base_url: Base URL of the API server (default: http://localhost:8000)
    """
    endpoint = f"{base_url}/api/v1/download_references/{session_id}"
    response = requests.get(endpoint, stream=True)
    response.raise_for_status()
    
    # Extract filename from Content-Disposition header
    content_disposition = response.headers.get('Content-Disposition', '')
    if 'filename=' in content_disposition:
        filename = content_disposition.split('filename=')[1].strip()
    else:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"references_{session_id}_{timestamp}.zip"
    
    # Save the file
    output_dir = os.path.join(os.path.dirname(__file__), "downloads")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, filename)
    
    with open(output_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    
    return output_path


if __name__ == "__main__":
    BASE_URL = "http://localhost:18000"
    SESSION_ID = "dd48a70a-8377-4c68-9f1b-114a2797f4dd"
    filepath = run_download_references(SESSION_ID, BASE_URL)
    print(f"File downloaded to: {filepath}")

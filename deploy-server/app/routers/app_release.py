"""App Release API Router."""
import logging
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from app.schemas.response import AppVersionsResponse, DownloadRequest, ErrorResponse
from app.services.release_service import AppReleaseService
from app.config import get_config


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/release", tags=["app-release"])


def get_release_service() -> AppReleaseService:
    """Dependency to get release service instance."""
    config = get_config()
    return AppReleaseService(
        storage_path=config.app_release.storage_path,
        max_versions=config.app_release.max_versions
    )


@router.get(
    "/versions/{app_name}",
    response_model=AppVersionsResponse,
    responses={
        200: {"description": "Successfully retrieved app versions"},
        404: {"model": ErrorResponse, "description": "Application not found"},
        500: {"model": ErrorResponse, "description": "Server error"}
    },
    summary="Get application package versions",
    description="Query available versions for a specified application"
)
async def get_app_versions(
    app_name: str,
    service: AppReleaseService = Depends(get_release_service)
):
    """
    Get available versions for an application.
    
    Args:
        app_name: Application name (folder name)
        service: Release service instance (injected)
        
    Returns:
        AppVersionsResponse with list of versions
    """
    try:
        versions = service.get_app_versions(app_name)
        
        return AppVersionsResponse(
            app=app_name,
            versions=versions,
            total=len(versions)
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions from service
        raise
    except Exception as e:
        logger.error(f"Error getting app versions: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve app versions: {str(e)}"
        )


@router.post(
    "/download",
    response_class=FileResponse,
    responses={
        200: {"description": "Successfully downloaded package file"},
        404: {"model": ErrorResponse, "description": "Package not found"},
        500: {"model": ErrorResponse, "description": "Server error"}
    },
    summary="Download application package",
    description="Download a specific version of an application package"
)
async def download_app_package(
    request: DownloadRequest,
    service: AppReleaseService = Depends(get_release_service)
):
    """
    Download an application package file.
    
    Args:
        request: Download request with app_name, version, and optional platform
        service: Release service instance (injected)
        
    Returns:
        FileResponse with the package file
    """
    try:
        package_file = service.find_package_file(
            app_name=request.app_name,
            version_num=request.version,
            platform=request.platform
        )
        
        if not package_file.exists():
            raise HTTPException(status_code=404, detail="Package file not found")
        
        # Return file as download
        return FileResponse(
            path=str(package_file),
            filename=package_file.name,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f'attachment; filename="{package_file.name}"'
            }
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions from service
        raise
    except Exception as e:
        logger.error(f"Error downloading package: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to download package: {str(e)}"
        )

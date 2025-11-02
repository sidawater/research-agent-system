"""Docker Registry API Router."""
import logging
from fastapi import APIRouter, HTTPException, Depends
from app.schemas.response import ImageVersionsResponse, ErrorResponse
from app.services.registry_service import DockerRegistryService
from app.config import get_config


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/docker", tags=["docker-registry"])


def get_registry_service() -> DockerRegistryService:
    """Dependency to get registry service instance."""
    config = get_config()
    return DockerRegistryService(
        registry_url=config.docker_registry.url,
        username=config.docker_registry.username,
        password=config.docker_registry.password,
        verify_ssl=config.docker_registry.verify_ssl,
        timeout=config.docker_registry.timeout
    )


@router.get(
    "/versions/{image_name:path}",
    response_model=ImageVersionsResponse,
    responses={
        200: {"description": "Successfully retrieved image versions"},
        404: {"model": ErrorResponse, "description": "Image not found"},
        500: {"model": ErrorResponse, "description": "Server error"}
    },
    summary="Get Docker image versions",
    description="Query Docker registry for available versions of a specified image"
)
async def get_image_versions(
    image_name: str,
    service: DockerRegistryService = Depends(get_registry_service)
):
    """
    Get available versions for a Docker image.
    
    Args:
        image_name: Name of the Docker image (supports namespace/name format)
        service: Registry service instance (injected)
        
    Returns:
        ImageVersionsResponse with list of versions
    """
    try:
        versions = await service.get_image_versions(image_name)
        
        return ImageVersionsResponse(
            image=image_name,
            versions=versions,
            total=len(versions)
        )
        
    except Exception as e:
        logger.error(f"Error getting image versions: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve image versions: {str(e)}"
        )

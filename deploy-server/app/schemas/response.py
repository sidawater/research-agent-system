"""Response schemas for deploy-server API."""
from typing import List, Optional
from pydantic import BaseModel, Field


class ImageVersionsResponse(BaseModel):
    """Response model for docker image versions."""
    image: str = Field(..., description="Image name")
    versions: List[str] = Field(..., description="List of versions from newest to oldest")
    total: int = Field(..., description="Total number of versions returned")


class AppVersionsResponse(BaseModel):
    """Response model for app package versions."""
    app: str = Field(..., description="Application name")
    versions: List[str] = Field(..., description="List of versions from newest to oldest")
    total: int = Field(..., description="Total number of versions returned")


class DownloadRequest(BaseModel):
    """Request model for app package download."""
    app_name: str = Field(..., description="Application name")
    version: str = Field(..., description="Version number")
    platform: Optional[str] = Field(None, description="Platform identifier (e.g., win-x64, linux-x64)")


class ErrorResponse(BaseModel):
    """Error response model."""
    error: str = Field(..., description="Error message")
    detail: Optional[str] = Field(None, description="Detailed error information")


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = Field(..., description="Service status")
    version: str = Field(..., description="Service version")

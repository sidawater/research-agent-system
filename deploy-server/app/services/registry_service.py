"""Docker Registry Service for querying image versions."""
import httpx
import logging
from typing import List, Optional
from packaging import version


logger = logging.getLogger(__name__)


class DockerRegistryService:
    """Service for interacting with Docker Registry API v2."""
    
    def __init__(self, registry_url: str, username: str, password: str, 
                 verify_ssl: bool = False, timeout: int = 30):
        """
        Initialize Docker Registry Service.
        
        Args:
            registry_url: Docker registry URL (e.g., https://docker-registry.example.com)
            username: Registry username
            password: Registry password
            verify_ssl: Whether to verify SSL certificates
            timeout: Request timeout in seconds
        """
        self.registry_url = registry_url.rstrip('/')
        self.username = username
        self.password = password
        self.verify_ssl = verify_ssl
        self.timeout = timeout
        self.auth = (username, password)
        
    async def get_image_versions(self, image_name: str, limit: int = 10) -> List[str]:
        """
        Get image versions from Docker registry.
        
        Args:
            image_name: Name of the Docker image
            limit: Maximum number of versions to return (default: 10)
            
        Returns:
            List of version tags sorted from newest to oldest
            
        Raises:
            httpx.HTTPStatusError: If the request fails
            ValueError: If image name is invalid
        """
        if not image_name or '/' in image_name and image_name.count('/') > 1:
            # Basic validation - allow simple names and namespace/name format
            pass
            
        url = f"{self.registry_url}/v2/{image_name}/tags/list"
        
        try:
            async with httpx.AsyncClient(verify=self.verify_ssl, timeout=self.timeout) as client:
                logger.info(f"Querying Docker registry for image: {image_name}")
                response = await client.get(url, auth=self.auth)
                response.raise_for_status()
                
                data = response.json()
                tags = data.get("tags", [])
                
                if not tags:
                    logger.warning(f"No tags found for image: {image_name}")
                    return []
                
                # Sort tags by semantic version
                sorted_tags = self._sort_versions(tags)
                
                # Return up to 'limit' latest versions
                result = sorted_tags[:limit]
                logger.info(f"Found {len(result)} versions for image: {image_name}")
                
                return result
                
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error querying registry: {e.response.status_code} - {e.response.text}")
            raise
        except httpx.RequestError as e:
            logger.error(f"Request error querying registry: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error querying registry: {str(e)}")
            raise
    
    def _sort_versions(self, tags: List[str]) -> List[str]:
        """
        Sort version tags from newest to oldest.
        
        Uses packaging.version for semantic version parsing.
        Falls back to string comparison for non-semantic versions.
        
        Args:
            tags: List of version tag strings
            
        Returns:
            Sorted list of tags from newest to oldest
        """
        def parse_version(tag: str):
            try:
                # Try to parse as semantic version
                # Remove common prefixes like 'v' or 'version-'
                clean_tag = tag.lstrip('v').lstrip('version-')
                return version.parse(clean_tag)
            except Exception:
                # Fall back to string comparison for non-standard versions
                return tag
        
        try:
            # Sort in reverse order (newest first)
            sorted_tags = sorted(tags, key=parse_version, reverse=True)
            return sorted_tags
        except Exception as e:
            logger.warning(f"Error sorting versions, using original order: {str(e)}")
            # If sorting fails, return tags in reverse order (assuming latest is last)
            return list(reversed(tags))

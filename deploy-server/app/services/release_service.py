"""App Release Service for managing application package versions and downloads."""
import os
import logging
from pathlib import Path
from typing import List, Optional, Tuple
from packaging import version
from fastapi import HTTPException


logger = logging.getLogger(__name__)


class AppReleaseService:
    """Service for managing application release packages."""
    
    def __init__(self, storage_path: str, max_versions: int = 10):
        """
        Initialize App Release Service.
        
        Args:
            storage_path: Base directory path for release packages
            max_versions: Maximum number of versions to return
        """
        self.storage_path = Path(storage_path)
        self.max_versions = max_versions
        
        if not self.storage_path.exists():
            logger.warning(f"Storage path does not exist: {storage_path}")
    
    def get_app_versions(self, app_name: str) -> List[str]:
        """
        Get available versions for an application.
        
        Directory structure expected: {storage_path}/{app_name}/{version}/
        
        Args:
            app_name: Application name (folder name)
            
        Returns:
            List of version numbers sorted from newest to oldest
            
        Raises:
            HTTPException: If app directory not found or invalid
        """
        # Validate app_name to prevent path traversal
        if not self._is_safe_path(app_name):
            logger.error(f"Invalid app name (potential path traversal): {app_name}")
            raise HTTPException(status_code=400, detail="Invalid application name")
        
        app_path = self.storage_path / app_name
        
        if not app_path.exists():
            logger.error(f"App directory not found: {app_path}")
            raise HTTPException(status_code=404, detail=f"Application '{app_name}' not found")
        
        if not app_path.is_dir():
            logger.error(f"App path is not a directory: {app_path}")
            raise HTTPException(status_code=400, detail=f"Invalid application path")
        
        try:
            # List all subdirectories as versions
            versions = []
            for item in app_path.iterdir():
                if item.is_dir():
                    versions.append(item.name)
            
            if not versions:
                logger.warning(f"No versions found for app: {app_name}")
                return []
            
            # Sort versions from newest to oldest
            sorted_versions = self._sort_versions(versions)
            
            # Return up to max_versions
            result = sorted_versions[:self.max_versions]
            logger.info(f"Found {len(result)} versions for app: {app_name}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error reading app versions: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error reading versions: {str(e)}")
    
    def find_package_file(self, app_name: str, version_num: str, 
                         platform: Optional[str] = None) -> Path:
        """
        Find package file for download.
        
        Args:
            app_name: Application name
            version_num: Version number
            platform: Platform identifier (optional)
            
        Returns:
            Path to the package file
            
        Raises:
            HTTPException: If file not found or invalid
        """
        # Validate inputs
        if not self._is_safe_path(app_name) or not self._is_safe_path(version_num):
            raise HTTPException(status_code=400, detail="Invalid app name or version")
        
        if platform and not self._is_safe_path(platform):
            raise HTTPException(status_code=400, detail="Invalid platform")
        
        # Build path
        version_path = self.storage_path / app_name / version_num
        
        if not version_path.exists():
            raise HTTPException(
                status_code=404, 
                detail=f"Version '{version_num}' not found for app '{app_name}'"
            )
        
        # Search for package file
        search_path = version_path / platform if platform else version_path
        
        if not search_path.exists():
            if platform:
                raise HTTPException(
                    status_code=404,
                    detail=f"Platform '{platform}' not found for {app_name} v{version_num}"
                )
            else:
                raise HTTPException(status_code=404, detail="Package path not found")
        
        # Find compressed package files
        package_files = self._find_package_files(search_path)
        
        if not package_files:
            raise HTTPException(
                status_code=404,
                detail=f"No package files found in {search_path.relative_to(self.storage_path)}"
            )
        
        # Return the first package file found (or you could implement selection logic)
        selected_file = package_files[0]
        logger.info(f"Found package file: {selected_file}")
        
        return selected_file
    
    def _find_package_files(self, directory: Path) -> List[Path]:
        """
        Find compressed package files in directory.
        
        Searches for common archive formats: .zip, .tar.gz, .tgz, .tar.bz2, .7z
        
        Args:
            directory: Directory to search
            
        Returns:
            List of package file paths
        """
        extensions = ['.zip', '.tar.gz', '.tgz', '.tar.bz2', '.7z', '.rar']
        package_files = []
        
        try:
            for item in directory.iterdir():
                if item.is_file():
                    # Check if file has a package extension
                    if any(item.name.endswith(ext) for ext in extensions):
                        package_files.append(item)
                elif item.is_dir():
                    # Recursively search subdirectories
                    package_files.extend(self._find_package_files(item))
        except Exception as e:
            logger.warning(f"Error searching directory {directory}: {str(e)}")
        
        return package_files
    
    def _sort_versions(self, versions: List[str]) -> List[str]:
        """
        Sort version strings from newest to oldest.
        
        Args:
            versions: List of version strings
            
        Returns:
            Sorted list from newest to oldest
        """
        def parse_version(ver: str):
            try:
                # Try semantic version parsing
                clean_ver = ver.lstrip('v').lstrip('version-')
                return version.parse(clean_ver)
            except Exception:
                # Fall back to string comparison
                return ver
        
        try:
            sorted_versions = sorted(versions, key=parse_version, reverse=True)
            return sorted_versions
        except Exception as e:
            logger.warning(f"Error sorting versions: {str(e)}")
            return list(reversed(versions))
    
    def _is_safe_path(self, path_component: str) -> bool:
        """
        Check if path component is safe (no path traversal).
        
        Args:
            path_component: Path component to validate
            
        Returns:
            True if safe, False otherwise
        """
        if not path_component:
            return False
        
        # Disallow path traversal patterns
        dangerous_patterns = ['..', '/', '\\', '\x00']
        
        for pattern in dangerous_patterns:
            if pattern in path_component:
                return False
        
        # Disallow absolute paths
        if os.path.isabs(path_component):
            return False
        
        return True

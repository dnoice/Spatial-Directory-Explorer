#!/usr/bin/env python3
"""
smart_tree.py - Advanced Directory Scanner for Spatial Directory Explorer

This script recursively scans a directory and generates optimized JSON representations
of the directory structure, saving both human-readable and minified versions.

Features:
- Metadata extraction for common file types
- File grouping by type and usage patterns
- Size calculations for directories
- Both human-readable and minified JSON output
- Support for file tags and custom attributes
- Detection of related files
"""

import os
import json
import time
import datetime
import hashlib
import mimetypes
import argparse
import shutil
from pathlib import Path
from collections import defaultdict

# Initialize mimetypes
mimetypes.init()

# File type groupings for smarter organization
FILE_TYPE_GROUPS = {
    "images": ["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp", "tiff", "ico"],
    "documents": ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp", "txt", "rtf", "md"],
    "audio": ["mp3", "wav", "ogg", "flac", "aac", "m4a", "wma"],
    "video": ["mp4", "avi", "mov", "mkv", "webm", "flv", "wmv", "m4v"],
    "archives": ["zip", "rar", "tar", "gz", "7z", "bz2", "xz"],
    "code": ["html", "css", "js", "ts", "jsx", "tsx", "php", "py", "java", "c", "cpp", "cs", "go", "rb", "swift", "kt"],
    "data": ["json", "xml", "csv", "sql", "db", "sqlite", "yml", "yaml"],
    "executable": ["exe", "app", "bat", "sh", "cmd", "com", "gadget"],
}

# Reverse mapping for quick lookup
FILE_TYPE_LOOKUP = {}
for group, extensions in FILE_TYPE_GROUPS.items():
    for ext in extensions:
        FILE_TYPE_LOOKUP[ext] = group

# Related file patterns (files that are often used together)
RELATED_FILE_PATTERNS = [
    # Web development
    [".html", ".css", ".js"],
    [".jsx", ".css", ".js"],
    # Programming
    [".c", ".h"],
    [".cpp", ".h"],
    [".py", "__init__.py"],
    # Documents
    [".docx", ".pdf"],
    [".md", ".pdf"],
    # Media
    [".mp4", ".srt"],
    [".jpg", ".jpg.bak"],
]


class DirectoryScanner:
    """Scans directories and generates structured data for the spatial explorer."""
    
    def __init__(self, root_dir, output_dir="data", max_depth=None, exclude_patterns=None):
        """
        Initialize the scanner with the root directory.
        
        Args:
            root_dir (str): The root directory to scan
            output_dir (str): Directory to save output files
            max_depth (int, optional): Maximum depth to scan (None for unlimited)
            exclude_patterns (list, optional): Patterns to exclude from scanning
        """
        self.root_dir = os.path.abspath(root_dir)
        self.output_dir = output_dir
        self.max_depth = max_depth
        self.exclude_patterns = exclude_patterns or []
        
        # Ensure output directory exists
        os.makedirs(output_dir, exist_ok=True)
        
        # Stats and metadata for the scan
        self.scan_stats = {
            "total_files": 0,
            "total_dirs": 0,
            "total_size": 0,
            "type_counts": defaultdict(int),
            "start_time": None,
            "end_time": None,
            "duration": None,
        }
        
        # Cache for directory sizes to avoid recalculation
        self.dir_size_cache = {}
        
        # Track scanning progress
        self.progress_count = 0
        self.progress_total = 0

    def should_exclude(self, path):
        """Check if a path should be excluded based on patterns."""
        name = os.path.basename(path)
        
        # Skip hidden files and directories
        if name.startswith('.'):
            return True
            
        # Check against exclude patterns
        for pattern in self.exclude_patterns:
            if pattern in path:
                return True
                
        return False
    
    def get_file_type_group(self, extension):
        """Get the file type group for a given extension."""
        if not extension:
            return "other"
        
        # Remove the dot if present
        ext = extension.lower().lstrip('.')
        return FILE_TYPE_LOOKUP.get(ext, "other")
    
    def calculate_dir_size(self, dir_path):
        """Recursively calculate directory size."""
        # Check cache first
        if dir_path in self.dir_size_cache:
            return self.dir_size_cache[dir_path]
            
        total_size = 0
        
        try:
            for dirpath, dirnames, filenames in os.walk(dir_path):
                for f in filenames:
                    try:
                        fp = os.path.join(dirpath, f)
                        total_size += os.path.getsize(fp)
                    except (FileNotFoundError, PermissionError):
                        continue
        except (PermissionError, OSError):
            pass
            
        # Cache the result
        self.dir_size_cache[dir_path] = total_size
        return total_size
    
    def find_related_files(self, file_path, all_files_in_dir):
        """Find files that are related to this file based on patterns."""
        related = []
        filename = os.path.basename(file_path)
        name, ext = os.path.splitext(filename)
        
        # Check for common related file patterns
        for pattern_group in RELATED_FILE_PATTERNS:
            if ext in pattern_group:
                # This file matches a pattern group, check for other files in the same group
                for other_ext in pattern_group:
                    if other_ext == ext:
                        continue  # Skip self
                    
                    # Look for files with same name but different extension
                    potential_related = name + other_ext
                    if potential_related in all_files_in_dir:
                        related.append(os.path.join(os.path.dirname(file_path), potential_related))
        
        # Check for numbered sequences (e.g., image1.jpg, image2.jpg)
        base_name = name.rstrip('0123456789')
        if base_name and base_name != name:
            # This file appears to be part of a numbered sequence
            for other_file in all_files_in_dir:
                other_name, other_ext = os.path.splitext(other_file)
                if other_ext == ext and other_name != name and other_name.startswith(base_name):
                    # Check if the remaining part is numeric
                    if other_name[len(base_name):].isdigit():
                        related.append(os.path.join(os.path.dirname(file_path), other_file))
        
        return related
        
    def extract_metadata(self, file_path):
        """Extract metadata for a file based on its type."""
        metadata = {}
        try:
            mime_type, _ = mimetypes.guess_type(file_path)
            if mime_type:
                metadata["mime_type"] = mime_type
                
            # Extract specific metadata based on file type
            ext = os.path.splitext(file_path)[1].lower().lstrip('.')
            
            # For future extension: add more detailed metadata extraction based on file type
            # This could include image dimensions, document pages, audio length, etc.
            # For now, we'll just record the mimetype
        
        except Exception as e:
            metadata["error"] = str(e)
            
        return metadata
    
    def generate_file_hash(self, file_path, chunk_size=8192):
        """Generate a hash of the file's first chunk for duplicate detection."""
        try:
            with open(file_path, 'rb') as f:
                chunk = f.read(chunk_size)
                return hashlib.md5(chunk).hexdigest()
        except Exception:
            return None
    
    def scan_directory(self, dir_path, current_depth=0):
        """
        Recursively scan a directory and return a structured representation.
        
        This is the main scanning function that builds the directory tree
        with enhanced metadata for our spatial explorer.
        """
        # Check depth limit
        if self.max_depth is not None and current_depth > self.max_depth:
            return None
            
        # Check exclusion
        if self.should_exclude(dir_path):
            return None
            
        # Update progress
        self.progress_count += 1
        if self.progress_count % 100 == 0:
            progress_pct = (self.progress_count / max(self.progress_total, 1)) * 100
            print(f"Scanning... {progress_pct:.1f}% complete ({self.progress_count} items)")
            
        # Get base information for the directory
        dir_name = os.path.basename(dir_path)
        relative_path = os.path.relpath(dir_path, self.root_dir)
        if relative_path == '.':
            relative_path = ''
            
        result = {
            "name": dir_name,
            "path": relative_path,
            "type": "directory",
            "children": [],
            "depth": current_depth,
            "metadata": {
                "size": 0,  # Will be updated later
                "item_count": 0,
                "last_modified": None,
            }
        }
        
        try:
            # List all items in the directory
            all_items = os.listdir(dir_path)
            
            # Separate files and directories
            files = []
            directories = []
            all_files_by_name = {}  # For related file detection
            
            for item in all_items:
                item_path = os.path.join(dir_path, item)
                
                if self.should_exclude(item_path):
                    continue
                    
                if os.path.isdir(item_path):
                    directories.append(item)
                else:
                    files.append(item)
                    all_files_by_name[item] = item_path
            
            # Process directories first (depth-first approach)
            for subdir in sorted(directories):
                subdir_path = os.path.join(dir_path, subdir)
                subdir_result = self.scan_directory(subdir_path, current_depth + 1)
                
                if subdir_result:
                    result["children"].append(subdir_result)
                    self.scan_stats["total_dirs"] += 1
                    
                    # Update the directory's size total
                    result["metadata"]["size"] += subdir_result["metadata"]["size"]
                    result["metadata"]["item_count"] += 1 + subdir_result["metadata"]["item_count"]
            
            # Then process files
            for file in sorted(files):
                file_path = os.path.join(dir_path, file)
                file_stat = os.stat(file_path)
                file_size = file_stat.st_size
                file_rel_path = os.path.join(relative_path, file)
                
                # Get file extension
                _, ext = os.path.splitext(file)
                extension = ext[1:].lower() if ext else ""
                
                # Determine file type group
                file_type_group = self.get_file_type_group(extension)
                
                # Find related files
                related_files = self.find_related_files(file_path, all_files_by_name)
                
                # Extract metadata
                metadata = self.extract_metadata(file_path)
                
                # Create file entry
                file_info = {
                    "name": file,
                    "path": file_rel_path,
                    "type": "file",
                    "extension": extension,
                    "file_type_group": file_type_group,
                    "size": file_size,
                    "modified": file_stat.st_mtime,
                    "metadata": metadata,
                }
                
                # Add hash for larger files (useful for duplicate detection)
                if file_size > 1024:  # Only for files > 1KB
                    file_hash = self.generate_file_hash(file_path)
                    if file_hash:
                        file_info["hash"] = file_hash
                
                # Add related files if any
                if related_files:
                    file_info["related_files"] = [
                        os.path.relpath(rf, self.root_dir) for rf in related_files
                    ]
                
                result["children"].append(file_info)
                
                # Update stats
                self.scan_stats["total_files"] += 1
                self.scan_stats["total_size"] += file_size
                self.scan_stats["type_counts"][file_type_group] += 1
                
                # Update directory size
                result["metadata"]["size"] += file_size
                result["metadata"]["item_count"] += 1
                
                # Update last modified time if newer
                mod_time = file_stat.st_mtime
                if result["metadata"]["last_modified"] is None or mod_time > result["metadata"]["last_modified"]:
                    result["metadata"]["last_modified"] = mod_time
            
            # Sort children by type (directories first) and then by name
            result["children"].sort(key=lambda x: (0 if x["type"] == "directory" else 1, x["name"].lower()))
            
        except PermissionError:
            result["error"] = "Permission denied"
        except Exception as e:
            result["error"] = str(e)
        
        return result
    
    def count_items_in_directory(self, dir_path):
        """Count total items (recursively) for progress reporting."""
        count = 1  # Count the directory itself
        
        try:
            with os.scandir(dir_path) as entries:
                for entry in entries:
                    name = entry.name
                    
                    # Skip hidden and excluded
                    if name.startswith('.') or any(pattern in entry.path for pattern in self.exclude_patterns):
                        continue
                        
                    if entry.is_dir():
                        count += self.count_items_in_directory(entry.path)
                    else:
                        count += 1
        except (PermissionError, OSError):
            pass
            
        return count
    
    def generate_structure(self):
        """Generate the directory structure and scan statistics."""
        print(f"Preparing to scan directory: {self.root_dir}")
        
        # Estimate total items for progress reporting
        print("Counting items for progress estimation...")
        self.progress_total = self.count_items_in_directory(self.root_dir)
        print(f"Found approximately {self.progress_total} items to process")
        
        # Reset progress counter
        self.progress_count = 0
        
        # Start scanning
        self.scan_stats["start_time"] = time.time()
        print(f"Starting directory scan of {self.root_dir}...")
        
        # Perform the scan
        directory_structure = self.scan_directory(self.root_dir)
        
        # Finish scanning
        self.scan_stats["end_time"] = time.time()
        self.scan_stats["duration"] = self.scan_stats["end_time"] - self.scan_stats["start_time"]
        
        # Add scan metadata
        directory_structure["scan_metadata"] = {
            "timestamp": datetime.datetime.now().isoformat(),
            "duration_seconds": self.scan_stats["duration"],
            "total_files": self.scan_stats["total_files"],
            "total_directories": self.scan_stats["total_dirs"],
            "total_size_bytes": self.scan_stats["total_size"],
            "file_type_distribution": dict(self.scan_stats["type_counts"])
        }
        
        return directory_structure
    
    def save_output(self, structure):
        """Save the directory structure to JSON files (both readable and minified)."""
        # Human-readable output (formatted JSON)
        readable_output = os.path.join(self.output_dir, "dir_tree.json")
        with open(readable_output, 'w', encoding='utf-8') as f:
            json.dump(structure, f, indent=2, ensure_ascii=False)
        
        # Minified output
        minified_output = os.path.join(self.output_dir, "dir_tree.json.min")
        with open(minified_output, 'w', encoding='utf-8') as f:
            json.dump(structure, f, separators=(',', ':'), ensure_ascii=False)
        
        # Calculate file sizes
        readable_size = os.path.getsize(readable_output)
        minified_size = os.path.getsize(minified_output)
        savings = readable_size - minified_size
        savings_percent = (savings / readable_size) * 100 if readable_size > 0 else 0
        
        print(f"\nDirectory structure saved to:")
        print(f"  - Human-readable: {readable_output} ({readable_size:,} bytes)")
        print(f"  - Minified: {minified_output} ({minified_size:,} bytes)")
        print(f"  - Space saved: {savings:,} bytes ({savings_percent:.1f}%)")
        
        return {
            "readable_path": readable_output,
            "minified_path": minified_output,
            "readable_size": readable_size,
            "minified_size": minified_size,
            "savings": savings,
            "savings_percent": savings_percent
        }
    
    def print_summary(self):
        """Print a summary of the scan results."""
        print("\n" + "="*50)
        print("Directory Scan Summary")
        print("="*50)
        print(f"Scanned directory: {self.root_dir}")
        print(f"Scan duration: {self.scan_stats['duration']:.2f} seconds")
        print(f"Total files: {self.scan_stats['total_files']:,}")
        print(f"Total directories: {self.scan_stats['total_dirs']:,}")
        print(f"Total size: {self.scan_stats['total_size']:,} bytes ({self.scan_stats['total_size'] / (1024*1024):.2f} MB)")
        
        print("\nFile type distribution:")
        for file_type, count in sorted(self.scan_stats["type_counts"].items(), key=lambda x: x[1], reverse=True):
            print(f"  - {file_type}: {count:,} files")
            
        print("="*50)
    
    def run(self):
        """Run the complete directory scanning process."""
        try:
            # Generate the directory structure
            directory_structure = self.generate_structure()
            
            # Save output files
            output_info = self.save_output(directory_structure)
            
            # Print summary
            self.print_summary()
            
            return directory_structure, output_info
            
        except Exception as e:
            print(f"Error scanning directory: {e}")
            raise


def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(description='Scan a directory and generate optimized JSON structure.')
    parser.add_argument('root_dir', nargs='?', default='/sdcard/1dd1', 
                        help='The root directory to scan (default: /sdcard/1dd1)')
    parser.add_argument('--output-dir', '-o', default='data',
                        help='Directory to save output files (default: data)')
    parser.add_argument('--max-depth', '-d', type=int, default=None,
                        help='Maximum depth to scan (default: unlimited)')
    parser.add_argument('--exclude', '-e', action='append', default=[],
                        help='Patterns to exclude from scanning (can be used multiple times)')
    
    args = parser.parse_args()
    
    # Ensure output directory exists
    os.makedirs(args.output_dir, exist_ok=True)
    
    # Create scanner and run it
    scanner = DirectoryScanner(
        args.root_dir,
        output_dir=args.output_dir,
        max_depth=args.max_depth,
        exclude_patterns=args.exclude
    )
    
    scanner.run()


if __name__ == "__main__":
    main()

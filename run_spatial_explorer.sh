#!/bin/bash

# Spatial Directory Explorer - Runner Script
# This script generates the directory structure and serves the spatial explorer

# Define colors for better output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Print banner
echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}     Spatial Directory Explorer      ${NC}"
echo -e "${BLUE}======================================${NC}"

# Default directory to scan
DEFAULT_DIR="/sdcard/1dd1"
TARGET_DIR=${1:-$DEFAULT_DIR}

# Ensure required directories exist
mkdir -p data
mkdir -p css
mkdir -p js

# Check if Python is installed
check_python() {
    if command -v python3 &>/dev/null; then
        echo -e "${GREEN}✓ Python is installed${NC}"
        return 0
    else
        echo -e "${RED}✗ Python is not installed. Please install Python 3.${NC}"
        return 1
    fi
}

# Check if Python HTTP server module is available
check_http_server() {
    if python3 -c "import http.server" &>/dev/null; then
        echo -e "${GREEN}✓ Python HTTP server module is available${NC}"
        return 0
    else
        echo -e "${RED}✗ Python HTTP server module is not available.${NC}"
        return 1
    fi
}

# Scan directory and generate JSON files
generate_directory_data() {
    echo -e "\n${YELLOW}Scanning directory: ${TARGET_DIR}${NC}"
    
    if [ ! -d "$TARGET_DIR" ]; then
        echo -e "${RED}Error: Directory '$TARGET_DIR' does not exist.${NC}"
        return 1
    fi
    
    # Run the smart_tree.py script
    python3 smart_tree.py "$TARGET_DIR" --output-dir data
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}✗ Failed to generate directory structure.${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✓ Directory structure generated successfully${NC}"
    return 0
}

# Check file sizes and compression ratio
check_file_sizes() {
    echo -e "\n${YELLOW}Checking file sizes:${NC}"
    
    if [ ! -f "data/dir_tree.json" ] || [ ! -f "data/dir_tree.json.min" ]; then
        echo -e "${RED}✗ JSON files not found.${NC}"
        return 1
    fi
    
    # Calculate file sizes
    ORIGINAL_SIZE=$(stat -c%s "data/dir_tree.json" 2>/dev/null || stat -f%z "data/dir_tree.json")
    MINIFIED_SIZE=$(stat -c%s "data/dir_tree.json.min" 2>/dev/null || stat -f%z "data/dir_tree.json.min")
    
    # Calculate compression ratio and savings
    SAVINGS=$((ORIGINAL_SIZE - MINIFIED_SIZE))
    RATIO=$(awk "BEGIN {printf \"%.2f\", ($SAVINGS / $ORIGINAL_SIZE) * 100}")
    
    echo -e "Original JSON: ${BLUE}$(numfmt --to=iec-i --suffix=B --format="%.2f" $ORIGINAL_SIZE 2>/dev/null || echo "$ORIGINAL_SIZE bytes")${NC}"
    echo -e "Minified JSON: ${BLUE}$(numfmt --to=iec-i --suffix=B --format="%.2f" $MINIFIED_SIZE 2>/dev/null || echo "$MINIFIED_SIZE bytes")${NC}"
    echo -e "Space saved: ${GREEN}$(numfmt --to=iec-i --suffix=B --format="%.2f" $SAVINGS 2>/dev/null || echo "$SAVINGS bytes")${NC} (${GREEN}${RATIO}%${NC})"
    
    return 0
}

# Start the HTTP server
start_server() {
    echo -e "\n${YELLOW}Starting HTTP server...${NC}"
    
    # Create a custom handler with directory listing disabled
    echo "Starting server at http://localhost:8000"
    echo "Press Ctrl+C to stop the server"
    echo -e "${BLUE}======================================${NC}"
    
    python3 -m http.server 8000
}

# Main execution flow
main() {
    # Check requirements
    check_python || exit 1
    check_http_server || exit 1
    
    # Generate directory data
    generate_directory_data || exit 1
    
    # Check file sizes
    check_file_sizes
    
    # Start server
    start_server
}

# Run the main function
main

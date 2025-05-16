# Spatial Directory Explorer

A modern, spatial-based file explorer that visualizes your directory structure as a zoomable space rather than a traditional tree view. The application uses hardware-accelerated animations, efficient data management, and virtualized rendering for smooth performance even with large directory structures.

![Spatial Directory Explorer](https://example.com/preview.jpg)

## Features

- **Spatial Navigation**: Navigate your files and folders as interconnected spaces
- **Zoomable Interface**: Zoom in/out to see more or less detail
- **Smart Grouping**: Files are automatically grouped by type and relationships
- **Breadcrumb Navigation**: Always know where you are in the file hierarchy
- **Dark/Light Themes**: Automatic and manual theme switching
- **Bookmarks**: Save frequently accessed locations
- **Performance Optimized**: 
  - Virtualized rendering for large directories
  - JSON minification for faster loading
  - Hardware-accelerated animations
  - Lazy loading of directory contents

## Requirements

- Python 3.6+
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Local file system access

## Getting Started

1. Clone or download this repository
2. Make the runner script executable:
   ```bash
   chmod +x run_spatial_explorer.sh
   ```
3. Run the application:
   ```bash
   ./run_spatial_explorer.sh [optional-directory-path]
   ```
   If no directory path is provided, it will default to `/sdcard/1dd1`

4. Open your browser and navigate to:
   ```
   http://localhost:8000
   ```

## Project Structure

```
.
├── index.html              # Main HTML file
├── smart_tree.py           # Python script to scan directories
├── run_spatial_explorer.sh # Runner script
├── css/
│   └── styles.css          # CSS styles
├── js/
│   ├── main.js             # Main application logic
│   ├── virtualizer.js      # Virtualized rendering module
│   └── performance.js      # Performance optimization utilities
└── data/
    ├── dir_tree.json       # Human-readable directory structure
    └── dir_tree.json.min   # Minified version for production
```

## How to Use

### Navigation

- **Zoom**: Use mouse wheel with Ctrl key or the zoom buttons in the toolbar
- **Browse**: Click on directories to open them
- **Breadcrumbs**: Click on any segment of the breadcrumb path to jump to that location
- **Back**: Press Backspace or use Alt+Left Arrow to go back
- **Home**: Click the home icon to return to root directory

### Search

1. Use the search box in the top toolbar
2. Results will show all matching files and directories
3. Click on any result to navigate to it

### File Operations

- **Preview**: Select a file and go to the Preview tab
- **Copy Path**: Use the context menu (right-click) or the detail panel
- **Bookmarks**: Add bookmarks via the context menu or detail panel

### Settings

- **Theme**: Toggle between light/dark with the theme button or set in settings
- **Animation Speed**: Adjust animation speed in settings
- **Detail Level**: Control the level of visual detail

## Advanced Features

### Customizing File Type Icons

File types are automatically detected based on extension, but you can customize how they're displayed by modifying the `fileExtensionTypes` object in `main.js`.

### Directory Data Format

The directory data is stored in a hierarchical JSON format:

```json
{
  "name": "root",
  "path": "/path/to/root",
  "type": "directory",
  "children": [
    {
      "name": "subdirectory",
      "path": "/path/to/root/subdirectory",
      "type": "directory",
      "children": [...]
    },
    {
      "name": "file.txt",
      "path": "/path/to/root/file.txt",
      "type": "file",
      "extension": "txt",
      "size": 1024,
      "modified": 1619712000
    }
  ]
}
```

### Performance Tuning

For very large directories, you can adjust performance settings in the Settings panel:

- Enable lazy loading
- Reduce animation speed or turn animations off
- Lower the detail level

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- Font Awesome for icons
- Chart.js for data visualization

---

# 🌌 Spatial Directory Explorer

**Welcome to the future of file navigation!** 

Gone are the days of boring, endless tree views that make your eyes glaze over. Say hello to a spatial journey through your files where directories become galaxies waiting to be explored!

![Spatial Directory Explorer in Action](assets/banner-image.png)

## ✨ What Makes This Special?

We've completely reimagined how you interact with your files. Instead of the traditional folder tree that we've been stuck with since the 90s, we've created an **immersive, spatial experience** that helps you visualize your directory structure in a whole new dimension.

- **🚀 Zoom through your filesystem** like you're exploring the universe
- **🧠 Smart grouping** that actually makes sense of your digital mess
- **⚡ Lightning-fast performance** even with massive directories
- **🌓 Gorgeous light & dark themes** that are easy on the eyes
- **🧙‍♂️ Magic file relationship detection** finds connections you never knew existed

## 🛠️ Under the Hood

This isn't just a pretty face. We've packed some serious tech into this explorer:

- **Hardware-accelerated animations** that butter-smooth
- **JSON minification** for blazing fast loading times
- **Virtualized rendering** so even folders with thousands of files won't slow you down
- **Level-of-detail** rendering that gets smarter as you zoom
- **Smart detection algorithms** that find related files automatically

## 🚦 Getting Started

Super easy to get up and running:

1. Clone this repo (or download it, we don't judge)
2. Make the runner script executable with a quick:
   ```bash
   chmod +x run_spatial_explorer.sh
   ```
3. Fire it up!
   ```bash
   ./run_spatial_explorer.sh [your-directory-of-choice]
   ```
   *No directory specified? No problem! We'll default to `/sdcard/1dd1`*

4. Point your browser to `http://localhost:8000` and prepare to have your mind blown!

## 🧭 Navigation Tips & Tricks

### The Basics
- **Zoom in/out**: Ctrl + mouse wheel (or use the zoom buttons if you're old school)
- **Enter directories**: Just click on them and whoosh - you're inside!
- **Go back**: Backspace key or Alt+Left Arrow (just like your browser)
- **Go home**: Click the home icon to teleport back to base

### Pro Moves
- **Rapid travel**: Use the breadcrumb trail at the top to jump between levels
- **Quick search**: Type in the search box and watch as we find your files instantly
- **Smart preview**: The preview tab shows what's inside files without opening them
- **Bookmark favorite spots**: Never lose track of important locations
- **Context menu magic**: Right-click for quick actions

## 🎛️ Project Control Center

```
.
├── index.html              # The face of the operation
├── smart_tree.py           # The brains that scans your directories
├── run_spatial_explorer.sh # The one-click launch button
├── css/
│   └── styles.css          # The fashion designer making everything pretty
├── js/
│   ├── main.js             # The conductor orchestrating the show
│   ├── virtualizer.js      # The efficiency expert
│   └── performance.js      # The speed demon
└── data/
    ├── dir_tree.json       # Your directories in human-readable form
    └── dir_tree.json.min   # Same data but on a diet for speed
```

## 🎮 Mastering the Controls

### Find What You Need
Our search is crazy powerful. Just start typing and we'll find files by name, type, or even content!

### File Operations Made Easy
- **Preview files**: Select a file and hit the Preview tab
- **Copy paths**: Right-click → Copy Path (or use the detail panel)
- **Save locations**: Bookmark any spot you want to revisit

### Customization Station
- **Theme swapping**: Toggle between light/dark with a click
- **Animation speed**: Crank it up or slow it down
- **Detail control**: Adjust how much info you see at once

## 🧪 Advanced Tinkering

### Custom File Icons
Want to make Python files show up as snakes? You can do that! Just modify the `fileExtensionTypes` object in `main.js`.

### Performance Tuning for Monster Directories
If you're diving into directories with tens of thousands of files:
- Enable lazy loading in Settings
- Dial back the animations
- Lower the detail level

### The Secret Data Format
For the curious minds, here's what our directory data structure looks like:

```json
{
  "name": "root",
  "path": "/path/to/root",
  "type": "directory",
  "children": [
    {
      "name": "photos",
      "path": "/path/to/root/photos",
      "type": "directory",
      "children": [...]
    },
    {
      "name": "notes.txt",
      "path": "/path/to/root/notes.txt",
      "type": "file",
      "extension": "txt",
      "size": 1024,
      "modified": 1619712000
    }
  ]
}
```

## 🤝 Join the Adventure

Found a bug? Have an idea? Want to contribute? We're all ears! Feel free to submit a Pull Request.

## 📜 The Fine Print

This project is licensed under the MIT License - which basically means you can do whatever you want with it!

## 🙏 Hat Tips

- The icons come from the wonderful Font Awesome
- Chart visualizations powered by Chart.js
- All code has been refined with Claude 3.7 Sonnet
---

**Remember:** File systems don't have to be boring. Hapy exploring! 🚀

---

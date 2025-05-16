/**
 * Spatial Directory Explorer - main.js
 * 
 * This script implements a zoomable, spatial interface for navigating
 * directory structures as virtual spaces rather than traditional trees.
 * It uses hardware-accelerated animations, virtualized rendering for 
 * performance, and progressive loading of directory contents.
 */

// Core application state
let state = {
    directoryData: null,             // The full directory structure
    currentDirectory: null,          // The currently visible directory
    currentPath: [],                 // Path to current directory as array of segments
    zoomLevel: 1,                    // Current zoom level
    animationSpeed: 'normal',        // Animation speed preference
    lazyLoading: true,               // Whether to use lazy loading
    theme: 'auto',                   // Theme preference
    detailLevel: 'medium',           // Visual detail level
    viewportCenter: { x: 0, y: 0 },  // Current center position of viewport
    selectedItem: null,              // Currently selected item
    navigationHistory: [],           // History of visited directories
    bookmarks: [],                   // User bookmarks
    contextMenuState: {              // State for context menu
        visible: false,
        x: 0,
        y: 0,
        targetItem: null
    }
};

// DOM Elements
const spatialView = document.getElementById('spatial-view');
const contextPanel = document.getElementById('context-panel');
const miniMap = document.getElementById('mini-map');
const breadcrumbContainer = document.getElementById('breadcrumb-container');
const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');
const themeToggle = document.getElementById('theme-toggle');
const settingsModal = document.getElementById('settings-modal');
const toastContainer = document.getElementById('toast-container');
const dirCountElement = document.getElementById('dir-count');
const fileCountElement = document.getElementById('file-count');
const totalSizeElement = document.getElementById('total-size');
const loadingContainer = document.querySelector('.loading-container');

// Animation timing values based on user preference
const animationTiming = {
    fast: 150,
    normal: 250,
    slow: 350,
    off: 0
};

// File type icon mappings
const fileTypeIcons = {
    directory: 'fa-folder',
    file: 'fa-file',
    // Grouped by type
    image: 'fa-file-image',
    video: 'fa-file-video',
    audio: 'fa-file-audio',
    document: 'fa-file-alt',
    code: 'fa-file-code',
    archive: 'fa-file-archive',
    pdf: 'fa-file-pdf',
    spreadsheet: 'fa-file-excel',
    presentation: 'fa-file-powerpoint',
    text: 'fa-file-alt'
};

// File extension to type mapping
const fileExtensionTypes = {
    // Images
    jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', 
    webp: 'image', svg: 'image', bmp: 'image', ico: 'image',
    
    // Documents
    pdf: 'pdf', doc: 'document', docx: 'document', txt: 'text',
    md: 'text', rtf: 'document', odt: 'document',
    
    // Spreadsheets
    xls: 'spreadsheet', xlsx: 'spreadsheet', csv: 'spreadsheet',
    ods: 'spreadsheet',
    
    // Presentations
    ppt: 'presentation', pptx: 'presentation', odp: 'presentation',
    
    // Audio
    mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio',
    m4a: 'audio', aac: 'audio',
    
    // Video
    mp4: 'video', avi: 'video', mov: 'video', wmv: 'video',
    mkv: 'video', webm: 'video',
    
    // Archives
    zip: 'archive', rar: 'archive', tar: 'archive', gz: 'archive',
    '7z': 'archive', bz2: 'archive',
    
    // Code
    html: 'code', css: 'code', js: 'code', ts: 'code', 
    jsx: 'code', tsx: 'code', php: 'code', py: 'code',
    java: 'code', c: 'code', cpp: 'code', cs: 'code',
    go: 'code', rb: 'code', swift: 'code', kt: 'code',
    json: 'code', xml: 'code'
};

/**
 * Initialize the application
 */
async function init() {
    console.log('Initializing Spatial Directory Explorer...');
    
    // Load user preferences
    loadUserPreferences();
    
    // Apply theme
    applyTheme();
    
    // Load bookmarks
    loadBookmarks();
    
    // Set up event listeners
    setupEventListeners();
    
    // Load directory data
    try {
        await loadDirectoryData();
    } catch (error) {
        showToast('Error', 'Failed to load directory data: ' + error.message, 'error');
        console.error('Failed to load directory data:', error);
        return;
    }
    
    // Initialize the view
    renderSpatialView(state.directoryData);
    updateBreadcrumbs();
    updateStatusBar();
    
    // Set up the window resize handler
    window.addEventListener('resize', handleWindowResize);
    
    // Hide loading screen
    hideLoading();
}

/**
 * Load user preferences from localStorage
 */
function loadUserPreferences() {
    try {
        const savedPreferences = localStorage.getItem('spatial_explorer_preferences');
        if (savedPreferences) {
            const preferences = JSON.parse(savedPreferences);
            state.animationSpeed = preferences.animationSpeed || 'normal';
            state.lazyLoading = preferences.lazyLoading !== undefined ? preferences.lazyLoading : true;
            state.theme = preferences.theme || 'auto';
            state.detailLevel = preferences.detailLevel || 'medium';
            
            // Update UI to reflect the loaded preferences
            document.getElementById('animation-speed').value = state.animationSpeed;
            document.getElementById('enable-lazy-loading').checked = state.lazyLoading;
            document.getElementById('theme-select').value = state.theme;
            document.getElementById('detail-level').value = state.detailLevel;
        }
    } catch (error) {
        console.error('Error loading user preferences:', error);
    }
}

/**
 * Save user preferences to localStorage
 */
function saveUserPreferences() {
    try {
        const preferences = {
            animationSpeed: state.animationSpeed,
            lazyLoading: state.lazyLoading,
            theme: state.theme,
            detailLevel: state.detailLevel
        };
        
        localStorage.setItem('spatial_explorer_preferences', JSON.stringify(preferences));
        showToast('Success', 'Your preferences have been saved', 'success');
    } catch (error) {
        console.error('Error saving user preferences:', error);
        showToast('Error', 'Failed to save preferences', 'error');
    }
}

/**
 * Load bookmarks from localStorage
 */
function loadBookmarks() {
    try {
        const savedBookmarks = localStorage.getItem('spatial_explorer_bookmarks');
        if (savedBookmarks) {
            state.bookmarks = JSON.parse(savedBookmarks);
        }
    } catch (error) {
        console.error('Error loading bookmarks:', error);
    }
}

/**
 * Save bookmarks to localStorage
 */
function saveBookmarks() {
    try {
        localStorage.setItem('spatial_explorer_bookmarks', JSON.stringify(state.bookmarks));
    } catch (error) {
        console.error('Error saving bookmarks:', error);
    }
}

/**
 * Apply theme based on user preference
 */
function applyTheme() {
    const theme = state.theme;
    
    if (theme === 'auto') {
        // Use system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.body.classList.toggle('dark-theme', prefersDark);
        
        // Update theme toggle icon
        themeToggle.innerHTML = prefersDark 
            ? '<i class="fas fa-sun"></i>' 
            : '<i class="fas fa-moon"></i>';
    } else {
        // Use explicit preference
        document.body.classList.toggle('dark-theme', theme === 'dark');
        
        // Update theme toggle icon
        themeToggle.innerHTML = theme === 'dark' 
            ? '<i class="fas fa-sun"></i>' 
            : '<i class="fas fa-moon"></i>';
    }
}

/**
 * Toggle between light and dark theme
 */
function toggleTheme() {
    if (state.theme === 'auto') {
        // If auto, switch to explicit based on current
        const isDark = document.body.classList.contains('dark-theme');
        state.theme = isDark ? 'light' : 'dark';
    } else {
        // Otherwise toggle
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
    }
    
    // Apply the new theme
    applyTheme();
    
    // Update the select in settings
    document.getElementById('theme-select').value = state.theme;
    
    // Save preference
    saveUserPreferences();
    
    // Show feedback
    showToast('Theme Updated', `Theme switched to ${state.theme === 'dark' ? 'dark' : 'light'} mode`, 'info');
}

/**
 * Set up event listeners for UI interactions
 */
function setupEventListeners() {
    // Theme toggle
    themeToggle.addEventListener('click', toggleTheme);
    
    // Search functionality
    searchInput.addEventListener('input', handleSearch);
    searchClear.addEventListener('click', clearSearch);
    
    // Navigation controls
    document.getElementById('zoom-in').addEventListener('click', () => zoomIn());
    document.getElementById('zoom-out').addEventListener('click', () => zoomOut());
    document.getElementById('reset-view').addEventListener('click', resetView);
    
    // Handle mouse wheel for zooming
    spatialView.addEventListener('wheel', handleMouseWheel);
    
    // Settings modal
    document.getElementById('show-settings').addEventListener('click', () => showModal('settings-modal'));
    document.querySelector('#settings-modal .modal-close').addEventListener('click', () => hideModal('settings-modal'));
    document.getElementById('save-settings').addEventListener('click', saveSettingsFromForm);
    document.getElementById('reset-settings').addEventListener('click', resetSettings);
    
    // Context panel close
    document.querySelector('.panel-close').addEventListener('click', () => {
        contextPanel.classList.add('hidden');
        
        // Also deselect the current item
        if (state.selectedItem) {
            const element = document.querySelector(`.spatial-item[data-path="${state.selectedItem.path}"]`);
            if (element) element.classList.remove('focused');
            state.selectedItem = null;
        }
    });
    
    // Keyboard navigation
    window.addEventListener('keydown', handleKeyboard);
    
    // Window resize for layout adjustments
    window.addEventListener('resize', debounce(updateLayout, 250));
}

/**
 * Load directory data from JSON file
 */
async function loadDirectoryData() {
    // Show loading state
    showLoading();
    
    try {
        // Determine which file to load based on lazy loading preference
        const fileUrl = state.lazyLoading ? 'data/dir_tree.json.min' : 'data/dir_tree.json';
        
        const response = await fetch(fileUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        state.directoryData = data;
        state.currentDirectory = data;
        
        console.log('Directory data loaded:', data);
        showToast('Success', 'Directory structure loaded successfully', 'success');
        
        return data;
    } catch (error) {
        console.error('Error loading directory data:', error);
        showToast('Error', 'Failed to load directory structure', 'error');
        throw error;
    }
}

/**
 * Render the spatial view of the current directory
 * @param {Object} directory - The directory object to render
 */
function renderSpatialView(directory) {
    if (!directory) return;
    
    // Clear existing content
    spatialView.innerHTML = '';
    
    // Create directory container
    const directoryContainer = document.createElement('div');
    directoryContainer.className = 'directory-container';
    directoryContainer.setAttribute('data-path', directory.path);
    
    // Add directory background
    const backgroundDiv = document.createElement('div');
    backgroundDiv.className = 'directory-background';
    directoryContainer.appendChild(backgroundDiv);
    
    // Add directory name
    const nameDiv = document.createElement('div');
    nameDiv.className = 'directory-name';
    nameDiv.textContent = directory.name || 'Root';
    directoryContainer.appendChild(nameDiv);
    
    // Add container for items
    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'directory-items';
    directoryContainer.appendChild(itemsContainer);
    
    // Add each item
    if (directory.children && directory.children.length > 0) {
        directory.children.forEach((item, index) => {
            const itemElement = createSpatialItem(item, index, directory.children.length);
            itemsContainer.appendChild(itemElement);
        });
    } else {
        // Empty directory
        const emptyMessage = document.createElement('div');
        emptyMessage.style.padding = '2rem';
        emptyMessage.style.textAlign = 'center';
        emptyMessage.style.color = 'var(--text-secondary)';
        emptyMessage.innerHTML = '<i class="fas fa-folder-open" style="font-size: 48px; margin-bottom: 1rem; opacity: 0.5;"></i><p>This directory is empty</p>';
        itemsContainer.appendChild(emptyMessage);
    }
    
    // Add to view
    spatialView.appendChild(directoryContainer);
    
    // Update status bar
    updateStatusBar();
    
    // Apply zoom and center
    updateZoomAndPosition();
}

/**
 * Create a spatial item element (file or directory)
 * @param {Object} item - The item data
 * @param {number} index - The index of the item in its parent
 * @param {number} totalItems - The total number of items in the parent
 * @returns {HTMLElement} The created item element
 */
function createSpatialItem(item, index, totalItems) {
    const isDirectory = item.type === 'directory';
    
    // Create item container
    const itemElement = document.createElement('div');
    itemElement.className = `spatial-item ${isDirectory ? 'directory' : 'file'}`;
    itemElement.setAttribute('data-path', item.path);
    itemElement.setAttribute('data-name', item.name);
    itemElement.setAttribute('data-type', isDirectory ? 'directory' : getFileType(item.extension));
    
    // Create icon
    const iconElement = document.createElement('div');
    iconElement.className = 'spatial-item-icon';
    
    // Add icon based on file type
    const iconType = isDirectory ? 'directory' : getFileType(item.extension);
    const iconClass = fileTypeIcons[iconType] || fileTypeIcons.file;
    
    iconElement.innerHTML = `<i class="fas ${iconClass}"></i>`;
    itemElement.appendChild(iconElement);
    
    // Create name label
    const nameElement = document.createElement('div');
    nameElement.className = 'spatial-item-name';
    nameElement.textContent = item.name;
    nameElement.title = item.name; // Show full name on hover
    itemElement.appendChild(nameElement);
    
    // Add event listeners
    itemElement.addEventListener('click', () => handleItemClick(item));
    itemElement.addEventListener('contextmenu', (e) => handleContextMenu(e, item));
    
    return itemElement;
}

/**
 * Get the file type based on extension
 * @param {string} extension - The file extension
 * @returns {string} The file type
 */
function getFileType(extension) {
    if (!extension) return 'file';
    
    const ext = extension.toLowerCase();
    return fileExtensionTypes[ext] || 'file';
}

/**
 * Handle click on a directory item
 * @param {Object} item - The clicked item
 */
function handleItemClick(item) {
    // If already selected, deselect
    if (state.selectedItem && state.selectedItem.path === item.path) {
        state.selectedItem = null;
        document.querySelector(`.spatial-item[data-path="${item.path}"]`).classList.remove('focused');
        contextPanel.classList.add('hidden');
        return;
    }
    
    // Remove focus from previously selected item
    if (state.selectedItem) {
        const prevElement = document.querySelector(`.spatial-item[data-path="${state.selectedItem.path}"]`);
        if (prevElement) prevElement.classList.remove('focused');
    }
    
    // Set as selected item
    state.selectedItem = item;
    
    // Add focus to newly selected item
    const element = document.querySelector(`.spatial-item[data-path="${item.path}"]`);
    if (element) element.classList.add('focused');
    
    // Update info panel
    updateContextPanel(item);
    contextPanel.classList.remove('hidden');
    
    // If it's a directory, navigate into it on double click
    // This is checked in the event listener through the dblclick event
}

/**
 * Handle double click on a directory item
 * @param {Object} item - The double-clicked item
 */
function handleItemDoubleClick(item) {
    if (item.type === 'directory') {
        navigateToDirectory(item);
    } else {
        // For files, we could implement a preview function here
        showToast('File Selected', `Selected file: ${item.name}`, 'info');
    }
}

/**
 * Navigate to a specific directory
 * @param {Object} directory - The directory to navigate to
 */
function navigateToDirectory(directory) {
    // Update current directory
    state.currentDirectory = directory;
    
    // Update path
    updateCurrentPath(directory.path);
    
    // Add to navigation history
    state.navigationHistory.push(directory.path);
    
    // Render the directory
    renderSpatialView(directory);
    
    // Update breadcrumbs
    updateBreadcrumbs();
    
    // Show transition effect
    showDirectoryTransition();
}

/**
 * Update the current path based on a new path string
 * @param {string} pathString - The new path
 */
function updateCurrentPath(pathString) {
    // Split path into segments, filtering out empty strings
    state.currentPath = pathString.split('/').filter(Boolean);
}

/**
 * Update the breadcrumb navigation
 */
function updateBreadcrumbs() {
    // Clear existing breadcrumbs
    breadcrumbContainer.innerHTML = '';
    
    // Add home breadcrumb
    const homeCrumb = document.createElement('div');
    homeCrumb.className = 'breadcrumb-item home-crumb';
    homeCrumb.innerHTML = '<i class="fas fa-home"></i><span>root</span>';
    homeCrumb.addEventListener('click', () => navigateToRoot());
    breadcrumbContainer.appendChild(homeCrumb);
    
    // Add path segments
    let currentPath = '';
    state.currentPath.forEach((segment, index) => {
        // Add separator
        const separator = document.createElement('span');
        separator.textContent = '/';
        separator.className = 'breadcrumb-separator';
        breadcrumbContainer.appendChild(separator);
        
        // Update current path
        currentPath += '/' + segment;
        
        // Create breadcrumb item
        const item = document.createElement('div');
        item.className = 'breadcrumb-item';
        item.textContent = segment;
        item.setAttribute('data-path', currentPath);
        
        // Make the last item active
        if (index === state.currentPath.length - 1) {
            item.classList.add('active');
        }
        
        // Add click handler for navigation
        item.addEventListener('click', () => navigateToPath(currentPath));
        
        // Add to container
        breadcrumbContainer.appendChild(item);
    });
}

/**
 * Navigate to the root directory
 */
function navigateToRoot() {
    navigateToDirectory(state.directoryData);
}

/**
 * Navigate to a specific path
 * @param {string} path - The path to navigate to
 */
function navigateToPath(path) {
    // Find the directory at the specified path
    const directory = findDirectoryByPath(state.directoryData, path);
    
    if (directory) {
        navigateToDirectory(directory);
    } else {
        showToast('Error', `Directory not found: ${path}`, 'error');
    }
}

/**
 * Find a directory by its path
 * @param {Object} root - The root directory to search in
 * @param {string} path - The path to find
 * @returns {Object|null} The found directory or null
 */
function findDirectoryByPath(root, path) {
    // Normalize the paths for comparison
    const normalizedTargetPath = path.startsWith('/') ? path : '/' + path;
    const normalizedRootPath = root.path.startsWith('/') ? root.path : '/' + root.path;
    
    // If this is the directory we're looking for, return it
    if (normalizedRootPath === normalizedTargetPath) {
        return root;
    }
    
    // If this directory has children, search them
    if (root.children && root.children.length > 0) {
        for (const child of root.children) {
            if (child.type === 'directory') {
                const found = findDirectoryByPath(child, path);
                if (found) return found;
            }
        }
    }
    
    return null;
}

/**
 * Show a transition effect when changing directories
 */
function showDirectoryTransition() {
    // Add a transition effect to the spatial view
    spatialView.classList.add('transitioning');
    
    // Remove the class after the transition
    setTimeout(() => {
        spatialView.classList.remove('transitioning');
    }, animationTiming[state.animationSpeed]);
}

/**
 * Update the context panel with item details
 * @param {Object} item - The item to show details for
 */
function updateContextPanel(item) {
    const panelContent = document.querySelector('.panel-content');
    
    // Clear existing content
    panelContent.innerHTML = '';
    
    // Update header
    document.querySelector('.panel-header h2').textContent = item.name;
    
    // Create info sections
    const basicInfoSection = document.createElement('div');
    basicInfoSection.className = 'panel-section';
    basicInfoSection.innerHTML = `
        <h3>Basic Information</h3>
        <div class="info-item">
            <span class="info-label">Name:</span>
            <span class="info-value">${item.name}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Type:</span>
            <span class="info-value">${item.type === 'directory' ? 'Directory' : 'File'}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Path:</span>
            <span class="info-value">${item.path}</span>
        </div>
    `;
    
    panelContent.appendChild(basicInfoSection);
    
    if (item.type === 'directory') {
        // Directory specific info
        const directoryInfoSection = document.createElement('div');
        directoryInfoSection.className = 'panel-section';
        
        // Calculate directory stats
        const stats = calculateDirectoryStats(item);
        
        directoryInfoSection.innerHTML = `
            <h3>Directory Statistics</h3>
            <div class="info-item">
                <span class="info-label">Files:</span>
                <span class="info-value">${stats.fileCount}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Subdirectories:</span>
                <span class="info-value">${stats.dirCount}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Total Size:</span>
                <span class="info-value">${formatSize(stats.totalSize)}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Last Modified:</span>
                <span class="info-value">${stats.lastModified ? formatDate(stats.lastModified) : 'Unknown'}</span>
            </div>
        `;
        
        panelContent.appendChild(directoryInfoSection);
    } else {
        // File specific info
        const fileInfoSection = document.createElement('div');
        fileInfoSection.className = 'panel-section';
        
        fileInfoSection.innerHTML = `
            <h3>File Details</h3>
            <div class="info-item">
                <span class="info-label">Size:</span>
                <span class="info-value">${formatSize(item.size || 0)}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Extension:</span>
                <span class="info-value">${item.extension ? `.${item.extension}` : 'None'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Type:</span>
                <span class="info-value">${getReadableFileType(item.extension)}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Modified:</span>
                <span class="info-value">${item.modified ? formatDate(item.modified) : 'Unknown'}</span>
            </div>
        `;
        
        panelContent.appendChild(fileInfoSection);
        
        // If there are related files, show them
        if (item.related_files && item.related_files.length > 0) {
            const relatedFilesSection = document.createElement('div');
            relatedFilesSection.className = 'panel-section';
            
            let relatedFilesHtml = `<h3>Related Files</h3><ul class="related-files-list">`;
            
            item.related_files.forEach(file => {
                const fileName = file.split('/').pop();
                relatedFilesHtml += `<li>${fileName}</li>`;
            });
            
            relatedFilesHtml += `</ul>`;
            relatedFilesSection.innerHTML = relatedFilesHtml;
            
            panelContent.appendChild(relatedFilesSection);
        }
    }
    
    // Add actions section
    const actionsSection = document.createElement('div');
    actionsSection.className = 'panel-section';
    actionsSection.innerHTML = `<h3>Actions</h3>`;
    
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'actions-container';
    
    // Add action buttons based on item type
    if (item.type === 'directory') {
        // Directory actions
        const openBtn = document.createElement('button');
        openBtn.className = 'action-btn';
        openBtn.innerHTML = '<i class="fas fa-folder-open"></i> Open';
        openBtn.addEventListener('click', () => navigateToDirectory(item));
        actionsContainer.appendChild(openBtn);
    } else {
        // File actions
        const previewBtn = document.createElement('button');
        previewBtn.className = 'action-btn';
        previewBtn.innerHTML = '<i class="fas fa-eye"></i> Preview';
        previewBtn.addEventListener('click', () => previewFile(item));
        actionsContainer.appendChild(previewBtn);
    }
    
    // Common actions
    const copyPathBtn = document.createElement('button');
    copyPathBtn.className = 'action-btn';
    copyPathBtn.innerHTML = '<i class="fas fa-copy"></i> Copy Path';
    copyPathBtn.addEventListener('click', () => {
        copyToClipboard(item.path);
        showToast('Copied', 'Path copied to clipboard', 'success');
    });
    actionsContainer.appendChild(copyPathBtn);
    
    // Bookmark action
    const isBookmarked = state.bookmarks.some(b => b.path === item.path);
    const bookmarkBtn = document.createElement('button');
    bookmarkBtn.className = 'action-btn';
    
    if (isBookmarked) {
        bookmarkBtn.innerHTML = '<i class="fas fa-bookmark"></i> Remove Bookmark';
        bookmarkBtn.addEventListener('click', () => {
            removeBookmark(item);
            updateContextPanel(item); // Refresh panel
        });
    } else {
        bookmarkBtn.innerHTML = '<i class="far fa-bookmark"></i> Add Bookmark';
        bookmarkBtn.addEventListener('click', () => {
            addBookmark(item);
            updateContextPanel(item); // Refresh panel
        });
    }
    
    actionsContainer.appendChild(bookmarkBtn);
    
    actionsSection.appendChild(actionsContainer);
    panelContent.appendChild(actionsSection);
}

/**
 * Calculate statistics for a directory
 * @param {Object} directory - The directory to analyze
 * @returns {Object} Directory statistics
 */
function calculateDirectoryStats(directory) {
    const stats = {
        fileCount: 0,
        dirCount: 0,
        totalSize: 0,
        lastModified: null
    };
    
    if (!directory || !directory.children) return stats;
    
    // Process immediate children
    directory.children.forEach(item => {
        if (item.type === 'directory') {
            stats.dirCount++;
            
            // If directory has metadata with size, use it
            if (item.metadata && item.metadata.size) {
                stats.totalSize += item.metadata.size;
            }
            
            // Update last modified if newer
            if (item.metadata && item.metadata.last_modified) {
                if (!stats.lastModified || item.metadata.last_modified > stats.lastModified) {
                    stats.lastModified = item.metadata.last_modified;
                }
            }
        } else {
            stats.fileCount++;
            
            // Add file size
            if (item.size) {
                stats.totalSize += item.size;
            }
            
            // Update last modified if newer
            if (item.modified) {
                if (!stats.lastModified || item.modified > stats.lastModified) {
                    stats.lastModified = item.modified;
                }
            }
        }
    });
    
    return stats;
}

/**
 * Get a human-readable file type from extension
 * @param {string} extension - The file extension
 * @returns {string} Human-readable file type
 */
function getReadableFileType(extension) {
    if (!extension) return 'Unknown';
    
    const ext = extension.toLowerCase();
    const type = fileExtensionTypes[ext] || 'file';
    
    // Map type to readable name
    const typeNames = {
        image: 'Image',
        video: 'Video',
        audio: 'Audio',
        document: 'Document',
        code: 'Code File',
        archive: 'Archive',
        pdf: 'PDF Document',
        spreadsheet: 'Spreadsheet',
        presentation: 'Presentation',
        text: 'Text File',
        file: 'File'
    };
    
    return typeNames[type] || 'File';
}

/**
 * Format file size to human-readable string
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 */
function formatSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format timestamp to human-readable date
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted date string
 */
function formatDate(timestamp) {
    return new Date(timestamp * 1000).toLocaleString();
}

/**
 * Preview a file (currently just shows a toast)
 * @param {Object} file - The file to preview
 */
function previewFile(file) {
    // This is a placeholder - in a real implementation, we'd show a preview
    // based on the file type (image viewer, text viewer, etc.)
    showToast('Preview', `Previewing ${file.name}`, 'info');
}

/**
 * Copy text to clipboard
 * @param {string} text - The text to copy
 * @returns {boolean} Success status
 */
function copyToClipboard(text) {
    // Create temporary element
    const elem = document.createElement('textarea');
    elem.value = text;
    document.body.appendChild(elem);
    
    // Select and copy
    elem.select();
    const success = document.execCommand('copy');
    
    // Clean up
    document.body.removeChild(elem);
    
    return success;
}

/**
 * Add a bookmark
 * @param {Object} item - The item to bookmark
 */
function addBookmark(item) {
    // Check if already bookmarked
    if (state.bookmarks.some(b => b.path === item.path)) {
        showToast('Info', 'This item is already bookmarked', 'info');
        return;
    }
    
    // Add to bookmarks
    state.bookmarks.push({
        name: item.name,
        path: item.path,
        type: item.type,
        date: Date.now()
    });
    
    // Save bookmarks
    saveBookmarks();
    
    showToast('Bookmark Added', `${item.name} has been bookmarked`, 'success');
}

/**
 * Remove a bookmark
 * @param {Object} item - The item to unbookmark
 */
function removeBookmark(item) {
    // Find and remove
    const index = state.bookmarks.findIndex(b => b.path === item.path);
    
    if (index !== -1) {
        state.bookmarks.splice(index, 1);
        
        // Save bookmarks
        saveBookmarks();
        
        showToast('Bookmark Removed', `${item.name} has been removed from bookmarks`, 'info');
    }
}

/**
 * Handle search input
 * @param {Event} e - The input event
 */
function handleSearch(e) {
    const query = e.target.value.trim().toLowerCase();
    
    // Toggle clear button visibility
    document.querySelector('.search-container').classList.toggle('has-value', query.length > 0);
    
    // If empty, reset view
    if (!query) {
        resetView();
        return;
    }
    
    // Perform search
    const results = searchDirectoryTree(state.directoryData, query);
    
    // Show results
    showSearchResults(results, query);
}

/**
 * Clear the search input
 */
function clearSearch() {
    searchInput.value = '';
    document.querySelector('.search-container').classList.remove('has-value');
    resetView();
}

/**
 * Search the directory tree for items matching the query
 * @param {Object} root - The root directory to search in
 * @param {string} query - The search query
 * @returns {Array} Matching items
 */
function searchDirectoryTree(root, query) {
    const results = [];
    
    function search(item) {
        // Check if this item matches
        if (item.name.toLowerCase().includes(query)) {
            results.push(item);
        }
        
        // Recurse into directories
        if (item.type === 'directory' && item.children) {
            item.children.forEach(search);
        }
    }
    
    search(root);
    return results;
}

/**
 * Display search results
 * @param {Array} results - The search results
 * @param {string} query - The search query
 */
function showSearchResults(results, query) {
    // Clear existing content
    spatialView.innerHTML = '';
    
    // Create results container
    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'search-results-container';
    
    // Add header
    const header = document.createElement('div');
    header.className = 'search-results-header';
    header.innerHTML = `<h2>Search Results for "${query}"</h2>`;
    
    if (results.length === 0) {
        header.innerHTML += `<p>No items found matching your search.</p>`;
    } else {
        header.innerHTML += `<p>Found ${results.length} item${results.length === 1 ? '' : 's'}</p>`;
    }
    
    resultsContainer.appendChild(header);
    
    // Add results
    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'search-results-items';
    
    results.forEach(item => {
        const resultItem = document.createElement('div');
        resultItem.className = 'search-result-item';
        
        // Determine icon
        const iconType = item.type === 'directory' ? 'directory' : getFileType(item.extension);
        const iconClass = fileTypeIcons[iconType] || fileTypeIcons.file;
        
        resultItem.innerHTML = `
            <div class="result-icon">
                <i class="fas ${iconClass}"></i>
            </div>
            <div class="result-details">
                <div class="result-name">${item.name}</div>
                <div class="result-path">${item.path}</div>
            </div>
        `;
        
        // Add click handler
        resultItem.addEventListener('click', () => handleSearchResultClick(item));
        
        itemsContainer.appendChild(resultItem);
    });
    
    resultsContainer.appendChild(itemsContainer);
    
    // Add to view
    spatialView.appendChild(resultsContainer);
}

/**
 * Handle click on a search result
 * @param {Object} item - The clicked item
 */
function handleSearchResultClick(item) {
    // If it's a directory, navigate to it
    if (item.type === 'directory') {
        navigateToDirectory(item);
    } else {
        // For files, navigate to parent directory and select the file
        const parentPath = item.path.substring(0, item.path.lastIndexOf('/'));
        const parentDir = findDirectoryByPath(state.directoryData, parentPath);
        
        if (parentDir) {
            // Navigate to parent directory
            navigateToDirectory(parentDir);
            
            // Select the file after a short delay to ensure rendering is complete
            setTimeout(() => {
                const fileElement = document.querySelector(`.spatial-item[data-path="${item.path}"]`);
                if (fileElement) {
                    // Scroll to and select the file
                    fileElement.scrollIntoView({ behavior: 'smooth' });
                    handleItemClick(item);
                }
            }, animationTiming[state.animationSpeed] + 50);
        }
    }
}

/**
 * Handle context menu on a directory item
 * @param {Event} e - The context menu event
 * @param {Object} item - The item being right-clicked
 */
function handleContextMenu(e, item) {
    e.preventDefault();
    
    // Set context menu state
    state.contextMenuState = {
        visible: true,
        x: e.clientX,
        y: e.clientY,
        targetItem: item
    };
    
    // Show custom context menu
    showContextMenu();
}

/**
 * Show the custom context menu
 */
function showContextMenu() {
    // Create menu if it doesn't exist
    if (!document.getElementById('custom-context-menu')) {
        createContextMenu();
    }
    
    const menu = document.getElementById('custom-context-menu');
    const { x, y, targetItem } = state.contextMenuState;
    
    // Update menu items based on target
    updateContextMenuItems(targetItem);
    
    // Position the menu
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    
    // Show the menu
    menu.classList.add('visible');
    
    // Add global click listener to close menu
    setTimeout(() => {
        window.addEventListener('click', closeContextMenu);
    }, 10);
}

/**
 * Create the context menu element
 */
function createContextMenu() {
    const menu = document.createElement('div');
    menu.id = 'custom-context-menu';
    menu.className = 'context-menu';
    document.body.appendChild(menu);
}

/**
 * Update context menu items based on the target item
 * @param {Object} item - The target item
 */
function updateContextMenuItems(item) {
    const menu = document.getElementById('custom-context-menu');
    menu.innerHTML = '';
    
    const isDirectory = item.type === 'directory';
    
    // Create menu items
    if (isDirectory) {
        // Directory specific items
        addContextMenuItem(menu, 'Open', 'folder-open', () => navigateToDirectory(item));
    } else {
        // File specific items
        addContextMenuItem(menu, 'Preview', 'eye', () => previewFile(item));
    }
    
    // Add separator
    addContextMenuSeparator(menu);
    
    // Common items
    addContextMenuItem(menu, 'Copy Path', 'copy', () => {
        copyToClipboard(item.path);
        showToast('Copied', 'Path copied to clipboard', 'success');
    });
    
    // Bookmark action
    const isBookmarked = state.bookmarks.some(b => b.path === item.path);
    if (isBookmarked) {
        addContextMenuItem(menu, 'Remove Bookmark', 'bookmark', () => removeBookmark(item));
    } else {
        addContextMenuItem(menu, 'Add Bookmark', 'bookmark', () => addBookmark(item));
    }
}

/**
 * Add an item to the context menu
 * @param {HTMLElement} menu - The context menu element
 * @param {string} label - The item label
 * @param {string} icon - The icon name
 * @param {Function} onClick - Click handler
 */
function addContextMenuItem(menu, label, icon, onClick) {
    const item = document.createElement('div');
    item.className = 'context-menu-item';
    item.innerHTML = `<i class="fas fa-${icon}"></i> ${label}`;
    item.addEventListener('click', () => {
        onClick();
        closeContextMenu();
    });
    menu.appendChild(item);
}

/**
 * Add a separator to the context menu
 * @param {HTMLElement} menu - The context menu element
 */
function addContextMenuSeparator(menu) {
    const separator = document.createElement('div');
    separator.className = 'context-menu-separator';
    menu.appendChild(separator);
}

/**
 * Close the context menu
 */
function closeContextMenu() {
    const menu = document.getElementById('custom-context-menu');
    if (menu) {
        menu.classList.remove('visible');
    }
    
    state.contextMenuState.visible = false;
    
    // Remove global click listener
    window.removeEventListener('click', closeContextMenu);
}

/**
 * Handle keyboard navigation
 * @param {Event} e - The keydown event
 */
function handleKeyboard(e) {
    // Escape key - close dialogs, deselect items, etc.
    if (e.key === 'Escape') {
        // Close context menu if open
        if (state.contextMenuState.visible) {
            closeContextMenu();
            return;
        }
        
        // Close context panel if open
        if (!contextPanel.classList.contains('hidden')) {
            contextPanel.classList.add('hidden');
            
            // Deselect item
            if (state.selectedItem) {
                const element = document.querySelector(`.spatial-item[data-path="${state.selectedItem.path}"]`);
                if (element) element.classList.remove('focused');
                state.selectedItem = null;
            }
            
            return;
        }
    }
    
    // Backspace - navigate up one level
    if (e.key === 'Backspace' && !searchInput.matches(':focus')) {
        navigateUp();
        return;
    }
    
    // Alt + Left Arrow - navigate back
    if (e.key === 'ArrowLeft' && e.altKey) {
        navigateBack();
        return;
    }
    
    // Alt + Right Arrow - navigate forward (if history implemented)
    if (e.key === 'ArrowRight' && e.altKey) {
        // navigateForward();
        return;
    }
    
    // Search shortcut (Ctrl+F)
    if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        searchInput.focus();
        return;
    }
}

/**
 * Navigate up one directory level
 */
function navigateUp() {
    if (state.currentPath.length === 0) {
        // Already at root
        return;
    }
    
    // Get parent path
    const parentPath = state.currentPath.slice(0, -1).join('/');
    
    // Find parent directory
    const parentDir = findDirectoryByPath(state.directoryData, parentPath);
    
    if (parentDir) {
        navigateToDirectory(parentDir);
    } else {
        // Fallback to root
        navigateToRoot();
    }
}

/**
 * Navigate back to the previous directory
 */
function navigateBack() {
    // Pop the current location
    state.navigationHistory.pop();
    
    // Get the previous location
    const prevPath = state.navigationHistory.pop();
    
    if (prevPath) {
        // Find and navigate to the directory
        const prevDir = findDirectoryByPath(state.directoryData, prevPath);
        if (prevDir) {
            navigateToDirectory(prevDir);
        }
    } else {
        // If no history, go to root
        navigateToRoot();
    }
}

/**
 * Handle mouse wheel for zooming
 * @param {Event} e - The wheel event
 */
function handleMouseWheel(e) {
    // Only zoom if Ctrl key is pressed
    if (e.ctrlKey) {
        e.preventDefault();
        
        if (e.deltaY < 0) {
            zoomIn();
        } else {
            zoomOut();
        }
    }
}

/**
 * Zoom in the spatial view
 */
function zoomIn() {
    state.zoomLevel = Math.min(state.zoomLevel * 1.2, 3);
    updateZoomAndPosition();
}

/**
 * Zoom out the spatial view
 */
function zoomOut() {
    state.zoomLevel = Math.max(state.zoomLevel / 1.2, 0.5);
    updateZoomAndPosition();
}

/**
 * Reset the view (zoom and position)
 */
function resetView() {
    state.zoomLevel = 1;
    state.viewportCenter = { x: 0, y: 0 };
    
    if (state.currentDirectory) {
        renderSpatialView(state.currentDirectory);
    } else {
        renderSpatialView(state.directoryData);
    }
}

/**
 * Update zoom level and position of the spatial view
 */
function updateZoomAndPosition() {
    // Update CSS variable for zoom
    document.documentElement.style.setProperty('--zoom-level', state.zoomLevel);
    
    // Apply transforms to the directory container
    const container = document.querySelector('.directory-container');
    if (container) {
        container.style.transform = `
            scale(${state.zoomLevel})
            translate(${state.viewportCenter.x}px, ${state.viewportCenter.y}px)
        `;
    }
    
    // Update mini-map
    updateMiniMap();
}

/**
 * Update the mini-map
 */
function updateMiniMap() {
    // Implementation will depend on how we represent the mini-map
    // For now, just update the viewport indicator
    const viewport = document.querySelector('.mini-map-viewport');
    if (viewport) {
        // Calculate viewport position and size based on zoom and position
        const scale = 1 / state.zoomLevel;
        
        viewport.style.width = `${scale * 100}%`;
        viewport.style.height = `${scale * 100}%`;
        
        // Position the viewport
        const offsetX = 50 - state.viewportCenter.x * 0.1;
        const offsetY = 50 - state.viewportCenter.y * 0.1;
        
        viewport.style.left = `${offsetX}%`;
        viewport.style.top = `${offsetY}%`;
    }
}

/**
 * Handle window resize
 */
function handleWindowResize() {
    updateLayout();
}

/**
 * Update layout based on window size
 */
function updateLayout() {
    // Adjust layout for smaller screens
    if (window.innerWidth < 768) {
        // Mobile optimizations
        document.body.classList.add('mobile-view');
    } else {
        document.body.classList.remove('mobile-view');
    }
    
    // Update mini-map
    updateMiniMap();
}

/**
 * Update the status bar with current statistics
 */
function updateStatusBar() {
    if (!state.currentDirectory) return;
    
    // Calculate stats
    const stats = calculateDirectoryStats(state.currentDirectory);
    
    // Update elements
    dirCountElement.textContent = `${stats.dirCount} director${stats.dirCount === 1 ? 'y' : 'ies'}`;
    fileCountElement.textContent = `${stats.fileCount} file${stats.fileCount === 1 ? '' : 's'}`;
    totalSizeElement.textContent = formatSize(stats.totalSize);
}

/**
 * Show a modal dialog
 * @param {string} id - The modal ID
 */
function showModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('active');
    }
}

/**
 * Hide a modal dialog
 * @param {string} id - The modal ID
 */
function hideModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('active');
    }
}

/**
 * Save settings from the settings form
 */
function saveSettingsFromForm() {
    // Get values from form
    state.animationSpeed = document.getElementById('animation-speed').value;
    state.lazyLoading = document.getElementById('enable-lazy-loading').checked;
    state.theme = document.getElementById('theme-select').value;
    state.detailLevel = document.getElementById('detail-level').value;
    
    // Save preferences
    saveUserPreferences();
    
    // Apply theme
    applyTheme();
    
    // Close modal
    hideModal('settings-modal');
}

/**
 * Reset settings to defaults
 */
function resetSettings() {
    // Reset to defaults
    state.animationSpeed = 'normal';
    state.lazyLoading = true;
    state.theme = 'auto';
    state.detailLevel = 'medium';
    
    // Update form
    document.getElementById('animation-speed').value = state.animationSpeed;
    document.getElementById('enable-lazy-loading').checked = state.lazyLoading;
    document.getElementById('theme-select').value = state.theme;
    document.getElementById('detail-level').value = state.detailLevel;
    
    // Save preferences
    saveUserPreferences();
    
    // Apply theme
    applyTheme();
    
    // Show feedback
    showToast('Reset', 'Settings have been reset to defaults', 'info');
}

/**
 * Show a toast notification
 * @param {string} title - The notification title
 * @param {string} message - The notification message
 * @param {string} type - The notification type (info, success, error, warning)
 */
function showToast(title, message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Determine icon based on type
    let icon = 'info-circle';
    switch (type) {
        case 'success': icon = 'check-circle'; break;
        case 'error': icon = 'exclamation-circle'; break;
        case 'warning': icon = 'exclamation-triangle'; break;
    }
    
    // Set content
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas fa-${icon}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Add close event
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.classList.add('exiting');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    });
    
    // Auto-remove after a delay
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.add('exiting');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }
    }, 5000);
}

/**
 * Show loading indicator
 */
function showLoading() {
    loadingContainer.classList.remove('hidden');
}

/**
 * Hide loading indicator
 */
function hideLoading() {
    loadingContainer.classList.add('hidden');
}

/**
 * Utility function to debounce function calls
 * @param {Function} func - The function to debounce
 * @param {number} wait - The debounce delay in ms
 * @returns {Function} The debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);

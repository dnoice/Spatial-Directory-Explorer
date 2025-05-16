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
        const fileUrl = state.lazyLoading ? 'data/dir_tree.min.json' : 'data/dir_tree.json';
        
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
/**
 * js/main.js - Main application logic for Spatial Directory Explorer
 */
document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // --- Configuration ---
    const CONFIG = {
        DATA_URL: 'data/dir_tree.json.min', // Path to the minified JSON data
        INITIAL_ZOOM: 1,
        MIN_ZOOM: 0.1,
        MAX_ZOOM: 5,
        ZOOM_STEP: 0.1,
        DEFAULT_THEME: 'light', // or 'dark' or 'auto'
        SEARCH_DEBOUNCE_MS: 300, // Debounce time for search input
        TOAST_DURATION_MS: 3000,
        CONTEXT_MENU_OFFSET: 5, // Offset for context menu positioning
        VIRTUALIZER_OPTIONS: { // Options for VirtualizedRenderer
            itemSize: { width: 100, height: 120 }, // Default item size
            itemMargin: 20, // Space between items
            renderMargin: 300, // Extra area outside viewport to prerender
            debug: false, // Enable virtualizer debug visuals
        },
        PERFORMANCE_MONITOR_OPTIONS: { // Options for Performance monitoring
            fpsUpdateInterval: 1000, // ms
        }
    };

    // --- DOM Elements ---
    const appContainer = document.querySelector('.app-container');
    const spatialView = document.getElementById('spatial-view'); //
    const directoryViewport = document.getElementById('directory-viewport'); //
    const searchInput = document.getElementById('search-input'); //
    const searchClearBtn = document.getElementById('search-clear'); //
    const zoomInBtn = document.getElementById('zoom-in'); //
    const zoomOutBtn = document.getElementById('zoom-out'); //
    const resetViewBtn = document.getElementById('reset-view'); //
    const themeToggleBtn = document.getElementById('theme-toggle'); //
    const breadcrumbContainer = document.getElementById('breadcrumb-container'); //
    const contextPanel = document.getElementById('context-panel'); //
    const contextPanelCloseBtn = contextPanel.querySelector('.panel-close'); //
    const contextPanelContent = contextPanel.querySelector('.panel-content'); //
    const miniMapElement = document.getElementById('mini-map'); //
    const miniMapContent = miniMapElement.querySelector('.mini-map-content'); //
    const miniMapViewport = miniMapElement.querySelector('.mini-map-viewport'); //
    const dirCountStat = document.getElementById('dir-count'); //
    const fileCountStat = document.getElementById('file-count'); //
    const totalSizeStat = document.getElementById('total-size'); //
    const loadingOverlay = document.getElementById('loading-overlay'); //
    const loadingProgressBar = document.getElementById('loading-progress-bar'); //
    const loadingProgressText = document.getElementById('loading-progress-text'); //
    const contextMenu = document.getElementById('context-menu'); //
    const toastContainer = document.getElementById('toast-container'); //

    // Modals
    const settingsModal = document.getElementById('settings-modal'); //
    const bookmarksModal = document.getElementById('bookmarks-modal'); //
    const helpModal = document.getElementById('help-modal'); //
    const previewModal = document.getElementById('preview-modal'); //
    const allModals = [settingsModal, bookmarksModal, helpModal, previewModal];

    // Settings Elements
    const themeSelect = document.getElementById('theme-select'); //
    const animationSpeedSelect = document.getElementById('animation-speed'); //
    const zoomBehaviorSelect = document.getElementById('zoom-behavior'); //
    const showMinimapCheckbox = document.getElementById('show-minimap'); //
    const enableLazyLoadingCheckbox = document.getElementById('enable-lazy-loading'); //
    const detailLevelSelect = document.getElementById('detail-level'); //
    const enableVirtualizationCheckbox = document.getElementById('enable-virtualization'); //
    const saveSettingsBtn = document.getElementById('save-settings'); //
    const resetSettingsBtn = document.getElementById('reset-settings'); //


    // --- Application State ---
    let appState = {
        currentPath: '', // Root path
        currentData: null, // Holds the full JSON data
        currentDirectoryData: null, // Data for the currently viewed directory
        zoomLevel: CONFIG.INITIAL_ZOOM,
        panOffset: { x: 0, y: 0 },
        selectedItem: null,
        isDragging: false,
        lastMousePosition: { x: 0, y: 0 },
        history: [], // For back/forward navigation
        historyIndex: -1,
        bookmarks: [], // Stores bookmarked paths
        settings: loadSettings(),
    };

    // --- Modules ---
    let virtualizer;
    const perf = window.Performance; // Access the Performance module

    // --- Initialization ---
    async function init() {
        showLoading('Loading application...');
        setupEventListeners();
        applySettings(appState.settings); // Apply loaded or default settings

        // Initialize Virtualized Renderer
        if (appState.settings.enableVirtualization && window.VirtualizedRenderer) {
            virtualizer = new window.VirtualizedRenderer({
                ...CONFIG.VIRTUALIZER_OPTIONS,
                containerSelector: '#spatial-view', //
                viewportSelector: '#directory-viewport', //
            });
        }

        // Start performance monitoring if enabled
        if (appState.settings.enablePerformanceMonitoring && perf) {
            perf.startMonitoring(updatePerformanceStats, CONFIG.PERFORMANCE_MONITOR_OPTIONS); //
        }

        try {
            await loadInitialData();
            navigateToPath(appState.currentPath, false, true); // Initial navigation to root
            updateBreadcrumbs();
            updateMiniMap();
            updateFooterStats();
        } catch (error) {
            console.error("Initialization failed:", error);
            showToast('Error loading initial data. Please try refreshing.', 'error');
        } finally {
            hideLoading();
        }
    }

    // --- Data Handling ---
    async function loadInitialData() {
        showLoading('Loading directory structure...');
        try {
            const response = await fetch(CONFIG.DATA_URL);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            appState.currentData = await response.json();
            appState.currentDirectoryData = appState.currentData; // Initially, root is current
            // Assume the root of the JSON is the first directory to display.
            // The smart_tree.py script creates a root object.
            if (appState.currentData && appState.currentData.name) {
                 appState.currentPath = appState.currentData.path || ''; // root path
            } else {
                throw new Error("Invalid data structure in JSON file.");
            }

            // Update progress for data loading
            updateLoadingProgress(100, 'Directory structure loaded.');
        } catch (error) {
            console.error('Failed to load directory data:', error);
            showToast(`Failed to load data: ${error.message}`, 'error');
            updateLoadingProgress(100, 'Error loading data.'); // Still hide overlay
            throw error; // Re-throw to be caught by init
        }
    }

    function findItemByPath(path, dataNode = appState.currentData) {
        if (!dataNode) return null;
        if ((dataNode.path || '') === path) return dataNode;

        if (dataNode.type === 'directory' && dataNode.children) { //
            for (const child of dataNode.children) {
                const found = findItemByPath(path, child);
                if (found) return found;
            }
        }
        return null;
    }

    // --- Rendering & Display ---
    function renderDirectory(directoryData) {
        if (!directoryData || directoryData.type !== 'directory') { //
            console.warn("Attempted to render invalid directory data:", directoryData);
            directoryViewport.innerHTML = '<p class="empty-directory-message">Directory is empty or cannot be displayed.</p>';
            if (virtualizer) virtualizer.setItems([], appState.zoomLevel); //
            return;
        }

        appState.currentDirectoryData = directoryData;
        const itemsToRender = directoryData.children || []; //

        if (virtualizer && appState.settings.enableVirtualization) {
            // The virtualizer needs items with x, y positions.
            // We'll need a layout algorithm here. For now, a simple grid.
            const layoutItems = calculateLayout(itemsToRender);
            virtualizer.setItems(layoutItems, appState.zoomLevel); //
        } else {
            // Manual rendering (fallback or if virtualization is off)
            directoryViewport.innerHTML = ''; // Clear previous content
            itemsToRender.forEach(item => {
                const itemElement = createItemElement(item);
                directoryViewport.appendChild(itemElement);
            });
        }
        updateFooterStats();
        updateMiniMap();
    }

    function calculateLayout(items) {
        // This is a placeholder for a spatial layout algorithm.
        // For now, a simple grid layout.
        const itemWidth = CONFIG.VIRTUALIZER_OPTIONS.itemSize.width + CONFIG.VIRTUALIZER_OPTIONS.itemMargin; //
        const itemHeight = CONFIG.VIRTUALIZER_OPTIONS.itemSize.height + CONFIG.VIRTUALIZER_OPTIONS.itemMargin; //
        const itemsPerRow = Math.floor(spatialView.offsetWidth / itemWidth) || 1;
        let x = 0, y = 0, count = 0;

        return items.map(item => {
            const positionedItem = {
                ...item,
                position: { x, y }
            };
            x += itemWidth;
            count++;
            if (count >= itemsPerRow) {
                x = 0;
                y += itemHeight;
                count = 0;
            }
            return positionedItem;
        });
    }


    function createItemElement(item) {
        const element = document.createElement('div');
        element.className = `spatial-item ${item.type}`; //
        if (item.type === 'file') { //
            element.classList.add(item.file_type_group || 'unknown'); //
            element.dataset.fileType = item.extension; //
        }
        element.dataset.path = item.path;
        element.title = item.name;

        const icon = document.createElement('div');
        icon.className = 'spatial-item-icon'; //
        const i = document.createElement('i');
        if (item.type === 'directory') {
            i.className = 'fas fa-folder'; //
        } else {
            i.className = getFileIconClass(item.extension, item.file_type_group); //
        }
        icon.appendChild(i);

        const name = document.createElement('div');
        name.className = 'spatial-item-name'; //
        name.textContent = item.name;

        element.appendChild(icon);
        element.appendChild(name);

        // Event listeners for interaction
        element.addEventListener('click', () => handleItemClick(item, element));
        element.addEventListener('dblclick', () => handleItemDblClick(item));
        element.addEventListener('contextmenu', (e) => handleItemContextMenu(e, item, element));

        return element;
    }


    function getFileIconClass(extension, group) {
        // Based on styles.css.txt definitions for file types
        const defaultIcon = 'fas fa-file';
        if (!extension && !group) return defaultIcon;

        const ext = extension ? extension.toLowerCase() : '';
        const grp = group ? group.toLowerCase() : '';

        if (grp === 'image' || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext)) return 'fas fa-file-image'; //
        if (grp === 'video' || ['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext)) return 'fas fa-file-video'; //
        if (grp === 'audio' || ['mp3', 'wav', 'ogg', 'aac'].includes(ext)) return 'fas fa-file-audio'; //
        if (ext === 'pdf') return 'fas fa-file-pdf'; //
        if (grp === 'document' || ['doc', 'docx', 'txt', 'md', 'rtf'].includes(ext)) return 'fas fa-file-alt'; //
        if (grp === 'code' || ['js', 'html', 'css', 'py', 'java', 'cpp'].includes(ext)) return 'fas fa-file-code'; //
        if (grp === 'archive' || ['zip', 'rar', 'tar', 'gz'].includes(ext)) return 'fas fa-file-archive'; //
        if (['xls', 'xlsx', 'csv'].includes(ext)) return 'fas fa-file-excel'; //
        if (['ppt', 'pptx'].includes(ext)) return 'fas fa-file-powerpoint'; //

        return defaultIcon;
    }

    function updateBreadcrumbs() {
        breadcrumbContainer.innerHTML = ''; // Clear existing
        const homeCrumb = document.createElement('div'); //
        homeCrumb.className = 'breadcrumb-item home-crumb'; //
        homeCrumb.innerHTML = `<i class="fas fa-home"></i><span>root</span>`; //
        homeCrumb.addEventListener('click', () => navigateToPath('', true));
        breadcrumbContainer.appendChild(homeCrumb);

        const parts = appState.currentPath.split('/').filter(p => p.length > 0);
        let currentBuildPath = '';
        parts.forEach((part, index) => {
            const separator = document.createElement('span');
            separator.className = 'breadcrumb-separator'; //
            separator.textContent = '/';
            breadcrumbContainer.appendChild(separator);

            const partCrumb = document.createElement('div');
            partCrumb.className = 'breadcrumb-item'; //
            partCrumb.textContent = part;
            currentBuildPath += (index > 0 || parts.length === 1 && currentBuildPath === '' ? '' : '/') + part;
            // Ensure path is correctly built, especially for root "part" if path isn't empty
             if (parts.length > 0 && currentBuildPath === part && appState.currentPath.startsWith(part)) {
                // This condition handles the first segment of a path correctly.
            }


            const pathForCrumb = currentBuildPath; // Capture path at this iteration
            partCrumb.addEventListener('click', () => navigateToPath(pathForCrumb, true));

            if (index === parts.length - 1) {
                partCrumb.classList.add('active'); //
            }
            breadcrumbContainer.appendChild(partCrumb);
        });
        // Scroll to the end of breadcrumbs if they overflow
        breadcrumbContainer.scrollLeft = breadcrumbContainer.scrollWidth;
    }


    function updateMiniMap() {
        if (!appState.settings.showMinimap || !appState.currentDirectoryData) { //
            miniMapElement.style.display = 'none'; //
            return;
        }
        miniMapElement.style.display = ''; //
        miniMapContent.innerHTML = ''; // Clear previous map

        // This is a very simplified representation.
        // A real minimap would try to spatially represent items.
        (appState.currentDirectoryData.children || []).forEach(item => {
            const miniItem = document.createElement('div');
            miniItem.className = `mini-map-item ${item.type}`;
            if (item.type === 'file') {
                miniItem.classList.add((item.file_type_group || 'unknown').toLowerCase());
            }
            miniItem.style.width = '5px';
            miniItem.style.height = '5px';
            // Basic positioning (random or simple grid for now)
            miniItem.style.position = 'absolute';
            miniItem.style.left = `${Math.random() * 90}%`;
            miniItem.style.top = `${Math.random() * 90}%`;
            miniMapContent.appendChild(miniItem);
        });

        // Update minimap viewport representation
        const scaleX = miniMapElement.offsetWidth / directoryViewport.scrollWidth;
        const scaleY = miniMapElement.offsetHeight / directoryViewport.scrollHeight;
        miniMapViewport.style.width = `${spatialView.offsetWidth * scaleX}px`; //
        miniMapViewport.style.height = `${spatialView.offsetHeight * scaleY}px`; //
        miniMapViewport.style.left = `${directoryViewport.scrollLeft * scaleX}px`; //
        miniMapViewport.style.top = `${directoryViewport.scrollTop * scaleY}px`; //
    }


    function updateFooterStats() {
        let dirs = 0;
        let files = 0;
        let totalSize = 0;

        function countRecursively(node) {
            if (!node) return;
            if (node.type === 'directory') { //
                dirs++;
                if (node.children) { //
                    node.children.forEach(countRecursively);
                }
                 // Use pre-calculated size if available from smart_tree.py
                totalSize += node.metadata?.size || 0;
            } else if (node.type === 'file') { //
                files++;
                totalSize += node.size || 0; //
            }
        }

        // If we are at root, count everything from appState.currentData
        // Otherwise, count from appState.currentDirectoryData for the current view
        const rootDataToCount = appState.currentPath === '' ? appState.currentData : appState.currentDirectoryData;

        if (rootDataToCount) {
             // Reset counts for the current view context
            dirs = 0; files = 0; totalSize = 0;
            // If it's a directory, count it and its children
            if (rootDataToCount.type === 'directory') {
                dirs++; // Count the current directory itself
                totalSize += rootDataToCount.metadata?.size || 0; // Add its own pre-calculated size
                if (rootDataToCount.children) {
                    rootDataToCount.children.forEach(child => {
                        // For children, sum up their individual contributions
                        if (child.type === 'directory') {
                            dirs++;
                            totalSize += child.metadata?.size || 0;
                            // Recursion here might be too much if stats are per-directory.
                            // Let's assume smart_tree.py gives accurate 'size' for each dir.
                        } else {
                            files++;
                            totalSize += child.size || 0;
                        }
                    });
                }
            }
        }


        dirCountStat.textContent = `${dirs} director${dirs === 1 ? 'y' : 'ies'}`; //
        fileCountStat.textContent = `${files} file${files === 1 ? 's' : ''}`; //
        totalSizeStat.textContent = formatBytes(totalSize); //
    }


    function showLoading(message = 'Loading...') {
        loadingOverlay.classList.remove('hidden'); //
        document.querySelector('.loading-text').textContent = message; //
        updateLoadingProgress(0);
    }

    function hideLoading() {
        loadingOverlay.classList.add('hidden'); //
    }

    function updateLoadingProgress(percentage, text) {
        loadingProgressBar.style.width = `${percentage}%`; //
        if (text) {
            loadingProgressText.textContent = text; //
        } else {
            loadingProgressText.textContent = `${percentage}%`; //
        }
    }

    // --- Navigation & Interaction ---
    function navigateToPath(path, addToHistory = true, isInitialLoad = false) {
        showLoading(`Navigating to ${path || 'root'}...`);
        const targetData = findItemByPath(path);

        if (targetData && targetData.type === 'directory') { //
            if (!isInitialLoad && addToHistory) {
                if (appState.historyIndex < appState.history.length - 1) {
                    appState.history = appState.history.slice(0, appState.historyIndex + 1);
                }
                appState.history.push(path);
                appState.historyIndex++;
            }
            appState.currentPath = path;
            renderDirectory(targetData);
            updateBreadcrumbs();
            resetZoomAndPan();
            hideContextPanel();
            hideContextMenu();
        } else if (targetData && targetData.type === 'file') { //
            // If it's a file, display its details or preview
            showItemDetails(targetData);
            // Optionally, attempt to navigate to parent directory if file path was directly given
            const parentPath = path.substring(0, path.lastIndexOf('/'));
             if (appState.currentPath !== parentPath) {
                navigateToPath(parentPath, addToHistory, isInitialLoad);
            }
        } else {
            showToast(`Path not found or is not a directory: ${path}`, 'error');
            console.warn("Navigation failed for path:", path);
        }
        hideLoading();
    }

    function handleItemClick(item, element) {
        if (appState.selectedItem && appState.selectedItem.element) {
            appState.selectedItem.element.classList.remove('focused'); //
        }
        element.classList.add('focused'); //
        appState.selectedItem = { data: item, element: element };
        showItemDetails(item);
    }

    function handleItemDblClick(item) {
        if (item.type === 'directory') { //
            navigateToPath(item.path, true);
        } else {
            // Preview file
            showFilePreview(item); //
        }
    }

    function showItemDetails(item) {
        contextPanelContent.innerHTML = ''; // Clear previous

        const section = document.createElement('div');
        section.className = 'panel-section'; //

        const title = document.createElement('h3'); //
        title.textContent = item.name;
        section.appendChild(title);

        function addInfo(label, value) {
            const infoItem = document.createElement('div');
            infoItem.className = 'info-item'; //
            const labelEl = document.createElement('span');
            labelEl.className = 'info-label'; //
            labelEl.textContent = label + ':';
            const valueEl = document.createElement('span');
            valueEl.className = 'info-value'; //
            valueEl.textContent = value;
            infoItem.appendChild(labelEl);
            infoItem.appendChild(valueEl);
            section.appendChild(infoItem);
        }

        addInfo('Type', item.type === 'directory' ? 'Directory' : `File (${item.extension || 'unknown'})`); //
        addInfo('Path', item.path);
        addInfo('Size', formatBytes(item.size || (item.metadata ? item.metadata.size : 0))); //
        if (item.modified) { //
            addInfo('Modified', new Date(item.modified * 1000).toLocaleString());
        }
        if (item.metadata && item.metadata.mime_type) { //
             addInfo('MIME Type', item.metadata.mime_type);
        }


        // Actions
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'actions-container'; //

        const previewBtn = document.createElement('button');
        previewBtn.className = 'action-btn'; //
        previewBtn.innerHTML = '<i class="fas fa-eye"></i> Preview';
        previewBtn.onclick = () => showFilePreview(item);
        if (item.type === 'directory') previewBtn.disabled = true; //

        const bookmarkBtn = document.createElement('button');
        bookmarkBtn.className = 'action-btn'; //
        const isBookmarked = appState.bookmarks.some(b => b.path === item.path);
        bookmarkBtn.innerHTML = `<i class="fas fa-bookmark"></i> ${isBookmarked ? 'Remove Bookmark' : 'Add Bookmark'}`;
        bookmarkBtn.onclick = () => toggleBookmark(item);


        actionsContainer.appendChild(previewBtn);
        actionsContainer.appendChild(bookmarkBtn);
        section.appendChild(actionsContainer);

        contextPanelContent.appendChild(section);
        contextPanel.classList.remove('hidden'); //
    }

    function hideContextPanel() {
        contextPanel.classList.add('hidden'); //
        if (appState.selectedItem && appState.selectedItem.element) {
            appState.selectedItem.element.classList.remove('focused'); //
        }
        appState.selectedItem = null;
    }

    function applyZoom(newZoom) {
        appState.zoomLevel = Math.max(CONFIG.MIN_ZOOM, Math.min(newZoom, CONFIG.MAX_ZOOM));
        updateTransform();
    }

    function updateTransform() {
        // When using VirtualizedRenderer, it handles its own transform.
        // We just need to tell it the new scale and pan.
        if (virtualizer && appState.settings.enableVirtualization) {
            virtualizer.setTransform({ //
                scale: appState.zoomLevel,
                translateX: appState.panOffset.x,
                translateY: appState.panOffset.y
            });
        } else {
            // Manual transform for non-virtualized view
            directoryViewport.style.transform = `translate(${appState.panOffset.x}px, ${appState.panOffset.y}px) scale(${appState.zoomLevel})`; //
        }
        updateMiniMap();
    }


    function resetZoomAndPan() {
        appState.zoomLevel = CONFIG.INITIAL_ZOOM;
        appState.panOffset = { x: 0, y: 0 };
        updateTransform();
    }

    // --- Search ---
    const debouncedSearch = perf ? perf.debounce(performSearch, CONFIG.SEARCH_DEBOUNCE_MS) : performSearch; //

    function performSearch(query) {
        query = query.toLowerCase().trim();
        if (!query) {
            // If query is empty, restore current directory view
            const currentDirData = findItemByPath(appState.currentPath);
            renderDirectory(currentDirData);
            searchInput.parentNode.classList.remove('has-value'); //
            return;
        }
        searchInput.parentNode.classList.add('has-value'); //

        showLoading(`Searching for "${query}"...`);
        const results = [];
        function findRecursively(node, currentPath) {
            if (!node) return;
            const nodeName = node.name ? node.name.toLowerCase() : '';
            const nodePath = node.path || currentPath;

            if (nodeName.includes(query) || nodePath.toLowerCase().includes(query)) {
                results.push({ ...node, path: nodePath }); // Ensure path is correctly set
            }

            if (node.type === 'directory' && node.children) { //
                node.children.forEach(child => findRecursively(child, nodePath ? `${nodePath}/${child.name}` : child.name));
            }
        }

        findRecursively(appState.currentData, ''); // Search from root
        renderSearchResults(results, query);
        hideLoading();
    }

    function renderSearchResults(results, query) {
        directoryViewport.innerHTML = ''; // Clear current view for search results
        if (virtualizer) virtualizer.setItems([], appState.zoomLevel); // Clear virtualizer

        const resultsContainer = document.createElement('div');
        resultsContainer.className = 'search-results-container fade-in'; //

        const header = document.createElement('div');
        header.className = 'search-results-header'; //
        const title = document.createElement('h2'); //
        title.textContent = `Search Results for "${query}"`;
        const count = document.createElement('p'); //
        count.textContent = `${results.length} item(s) found.`;
        header.appendChild(title);
        header.appendChild(count);
        resultsContainer.appendChild(header);

        const itemsList = document.createElement('div');
        itemsList.className = 'search-results-items'; //

        if (results.length === 0) {
            const noResultsMessage = document.createElement('p');
            noResultsMessage.className = 'empty-state-message'; //
            noResultsMessage.textContent = 'No items match your search.';
            itemsList.appendChild(noResultsMessage);
        } else {
            results.forEach(item => {
                const itemElement = createSearchResultElement(item, query);
                itemsList.appendChild(itemElement);
            });
        }
        resultsContainer.appendChild(itemsList);
        directoryViewport.appendChild(resultsContainer);
    }

    function createSearchResultElement(item, query) {
        const element = document.createElement('div');
        element.className = 'search-result-item'; //
        element.title = `Click to navigate to ${item.name}`;
        element.addEventListener('click', () => {
            // Navigate to parent directory and highlight/select the item
             const parentPath = item.path.substring(0, item.path.lastIndexOf('/'));
             navigateToPath(parentPath, true);
             // After navigation, attempt to focus on the item. This might need a slight delay
             // or a callback after renderDirectory completes.
             setTimeout(() => {
                const itemElementInView = directoryViewport.querySelector(`.spatial-item[data-path="${item.path}"]`);
                if (itemElementInView) {
                    itemElementInView.click(); // Simulate click to select and show details
                    itemElementInView.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else if (virtualizer) {
                    virtualizer.focusOnItem(item.path, appState.zoomLevel); //
                }
             }, 200);
        });

        const iconDiv = document.createElement('div');
        iconDiv.className = 'result-icon'; //
        const icon = document.createElement('i');
        icon.className = item.type === 'directory' ? 'fas fa-folder' : getFileIconClass(item.extension, item.file_type_group); //
        iconDiv.appendChild(icon);

        const details = document.createElement('div');
        details.className = 'result-details'; //
        const name = document.createElement('div');
        name.className = 'result-name'; //
        name.innerHTML = highlightMatch(item.name, query);
        const path = document.createElement('div');
        path.className = 'result-path'; //
        path.innerHTML = highlightMatch(item.path, query);

        details.appendChild(name);
        details.appendChild(path);
        element.appendChild(iconDiv);
        element.appendChild(details);
        return element;
    }

    function highlightMatch(text, query) {
        if (!text || !query) return text || '';
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<span class="match-highlight">$1</span>'); //
    }


    // --- Theme Handling ---
    function toggleTheme() {
        const currentTheme = document.body.classList.contains('dark-theme') ? 'dark' : 'light'; //
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        applyTheme(newTheme);
        appState.settings.theme = newTheme;
        saveSettings();
    }

    function applyTheme(theme) {
        document.body.classList.remove('light-theme', 'dark-theme'); //
        const moonIcon = "fa-moon"; //
        const sunIcon = "fa-sun";
        const themeIcon = themeToggleBtn.querySelector('i');

        if (theme === 'auto') {
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.body.classList.add(prefersDark ? 'dark-theme' : 'light-theme'); //
            if (themeIcon) themeIcon.className = `fas ${prefersDark ? sunIcon : moonIcon}`;
        } else {
            document.body.classList.add(theme === 'dark' ? 'dark-theme' : 'light-theme'); //
             if (themeIcon) themeIcon.className = `fas ${theme === 'dark' ? sunIcon : moonIcon}`;
        }
        // Update settings modal selection
        if (themeSelect) themeSelect.value = theme; //
    }


    // --- Modals & Panels ---
    function openModal(modalElement) {
        allModals.forEach(m => m.classList.remove('active')); //
        modalElement.classList.add('active'); //
        // Add event listener for ESC key to close modal
        document.addEventListener('keydown', closeModalOnEsc);
    }

    function closeModal(modalElement) {
        modalElement.classList.remove('active'); //
        document.removeEventListener('keydown', closeModalOnEsc);
    }
    function closeModalOnEsc(event) {
        if (event.key === 'Escape') {
            allModals.forEach(m => closeModal(m));
            hideContextMenu();
            hideContextPanel();
        }
    }


    function showFilePreview(item) { //
        if (item.type === 'directory') { //
            showToast('Cannot preview a directory.', 'info');
            return;
        }
        const previewContent = previewModal.querySelector('#preview-content'); //
        const previewTitle = previewModal.querySelector('#preview-title'); //
        previewTitle.textContent = `Preview: ${item.name}`;
        previewContent.innerHTML = ''; // Clear previous

        // Simple preview based on type (more advanced previews would require more logic)
        const ext = (item.extension || '').toLowerCase(); //
        if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'].includes(ext)) {
            const img = document.createElement('img');
            img.className = 'preview-image'; //
            // For security, in a real app, source from a trusted endpoint or internal data URI
            // img.src = `path/to/files/${item.path}`; // This needs actual file serving
            img.alt = item.name;
            img.onerror = () => { previewContent.innerHTML = '<p>Image preview not available or file not found.</p>';};
            // Placeholder if no actual image source is available for the demo
            previewContent.innerHTML = `<p>Image preview for <strong>${item.name}</strong> (actual image source not implemented in this demo).</p><div class="preview-placeholder"><i class="fas fa-image"></i></div>`; //

        } else if (['txt', 'md', 'js', 'css', 'html', 'json', 'xml', 'py', 'java', 'c', 'cpp'].includes(ext)) { //
            const pre = document.createElement('pre');
            pre.className = 'preview-text'; //
            // Fetch content (placeholder for actual file fetching)
            // For demonstration:
            pre.textContent = `Text content for ${item.name} would appear here.\n\n(Actual file content fetching is not implemented in this demo.)`;
             previewContent.appendChild(pre);
        } else {
            previewContent.innerHTML = `<p>No preview available for this file type: .${ext}</p><div class="preview-placeholder"><i class="fas fa-file-alt"></i><p>File: ${item.name}</p></div>`; //
        }
        openModal(previewModal); //
    }

    // --- Context Menu ---
    function handleItemContextMenu(event, item, element) {
        event.preventDefault();
        hideContextMenu(); // Hide any existing first

        contextMenu.innerHTML = ''; // Clear previous items

        // Common actions
        addContextMenuItem('Open', 'fa-folder-open', () => handleItemDblClick(item));
        if (item.type === 'file') { //
            addContextMenuItem('Preview', 'fa-eye', () => showFilePreview(item)); //
        }
        addContextMenuItem('Details', 'fa-info-circle', () => showItemDetails(item));

        contextMenu.appendChild(createContextMenuSeparator()); //

        const isBookmarked = appState.bookmarks.some(b => b.path === item.path);
        addContextMenuItem(isBookmarked ? 'Remove Bookmark' : 'Add Bookmark', 'fa-bookmark', () => toggleBookmark(item));

        // More actions (e.g., Download, Rename, Delete - would require backend)
        // addContextMenuItem('Download', 'fa-download', () => console.log('Download:', item.path));

        contextMenu.style.top = `${Math.min(event.clientY, window.innerHeight - contextMenu.offsetHeight - CONFIG.CONTEXT_MENU_OFFSET)}px`;
        contextMenu.style.left = `${Math.min(event.clientX, window.innerWidth - contextMenu.offsetWidth - CONFIG.CONTEXT_MENU_OFFSET)}px`;
        contextMenu.classList.add('visible'); //

        // Clicking outside hides the menu
        document.addEventListener('click', hideContextMenuOnClickOutside, { once: true });
    }

    function addContextMenuItem(label, iconClass, action) {
        const itemEl = document.createElement('div');
        itemEl.className = 'context-menu-item'; //
        itemEl.innerHTML = `<i class="fas ${iconClass}"></i><span>${label}</span>`;
        itemEl.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent click outside handler
            action();
            hideContextMenu();
        });
        contextMenu.appendChild(itemEl);
    }
    function createContextMenuSeparator() {
        const separator = document.createElement('div');
        separator.className = 'context-menu-separator'; //
        return separator;
    }

    function hideContextMenu() {
        if (contextMenu) contextMenu.classList.remove('visible'); //
        document.removeEventListener('click', hideContextMenuOnClickOutside);
    }
    function hideContextMenuOnClickOutside(event) {
        if (contextMenu && !contextMenu.contains(event.target)) {
            hideContextMenu();
        } else {
            // If click was inside, re-add listener for next outside click
            document.addEventListener('click', hideContextMenuOnClickOutside, { once: true });
        }
    }


    // --- Bookmarks ---
    function toggleBookmark(item) {
        const existingIndex = appState.bookmarks.findIndex(b => b.path === item.path);
        if (existingIndex > -1) {
            appState.bookmarks.splice(existingIndex, 1);
            showToast(`${item.name} removed from bookmarks.`, 'info');
        } else {
            appState.bookmarks.push({ name: item.name, path: item.path, type: item.type });
            showToast(`${item.name} added to bookmarks.`, 'success');
        }
        saveBookmarks();
        renderBookmarks();
        // Update context panel if item is selected
        if (appState.selectedItem && appState.selectedItem.data.path === item.path) {
            showItemDetails(item); // Re-render details to update bookmark button
        }
    }

    function renderBookmarks() {
        const container = document.getElementById('bookmarks-container'); //
        container.innerHTML = '';
        if (appState.bookmarks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-bookmark"></i>
                    <p>No bookmarks yet. Add bookmarks using the context menu or details panel.</p>
                </div>`; //
            return;
        }

        appState.bookmarks.forEach(bookmark => {
            const itemEl = document.createElement('div');
            itemEl.className = 'bookmark-item'; //
            itemEl.innerHTML = `
                <div class="bookmark-info">
                    <i class="bookmark-icon fas ${bookmark.type === 'directory' ? 'fa-folder' : getFileIconClass(bookmark.path.split('.').pop())}"></i>
                    <div class="bookmark-details">
                        <div class="bookmark-name" title="${bookmark.name}">${bookmark.name}</div>
                        <div class="bookmark-path" title="${bookmark.path}">${bookmark.path}</div>
                    </div>
                </div>
                <div class="bookmark-actions">
                    <button class="bookmark-action go-to" title="Go to item"><i class="fas fa-arrow-right"></i></button>
                    <button class="bookmark-action remove" title="Remove bookmark"><i class="fas fa-times"></i></button>
                </div>
            `; //
            itemEl.querySelector('.go-to').addEventListener('click', () => {
                navigateToPath(bookmark.path, true);
                closeModal(bookmarksModal); //
            });
            itemEl.querySelector('.remove').addEventListener('click', () => toggleBookmark(bookmark));
            container.appendChild(itemEl);
        });
    }

    function saveBookmarks() {
        try {
            localStorage.setItem('spatialExplorerBookmarks', JSON.stringify(appState.bookmarks));
        } catch (e) {
            console.warn("Could not save bookmarks to localStorage:", e);
            showToast("Could not save bookmarks. LocalStorage might be full or disabled.", "warning");
        }
    }

    function loadBookmarks() {
        try {
            const storedBookmarks = localStorage.getItem('spatialExplorerBookmarks');
            if (storedBookmarks) {
                appState.bookmarks = JSON.parse(storedBookmarks);
            }
        } catch (e) {
            console.warn("Could not load bookmarks from localStorage:", e);
            appState.bookmarks = [];
        }
        renderBookmarks();
    }


    // --- Settings ---
    function loadSettings() {
        const defaults = {
            theme: CONFIG.DEFAULT_THEME, //
            animationSpeed: 'normal', //
            zoomBehavior: 'smooth', //
            showMinimap: true, //
            enableLazyLoading: true, // (Currently conceptual, not fully tied in)
            detailLevel: 'medium', // (Conceptual for LOD)
            enableVirtualization: true, //
            enablePerformanceMonitoring: false, // User can enable this
        };
        try {
            const storedSettings = localStorage.getItem('spatialExplorerSettings');
            return storedSettings ? { ...defaults, ...JSON.parse(storedSettings) } : defaults;
        } catch (e) {
            console.warn("Could not load settings from localStorage:", e);
            return defaults;
        }
    }

    function saveSettings() {
        try {
            localStorage.setItem('spatialExplorerSettings', JSON.stringify(appState.settings));
            showToast('Settings saved!', 'success');
        } catch (e) {
            console.warn("Could not save settings to localStorage:", e);
            showToast("Could not save settings. LocalStorage might be full or disabled.", "warning");
        }
    }
    function applySettings(settings) {
        appState.settings = settings; // Update internal state

        // Apply theme
        applyTheme(settings.theme);
        if (themeSelect) themeSelect.value = settings.theme;

        // Animation Speed (conceptual, apply via CSS variables or JS)
        if (animationSpeedSelect) animationSpeedSelect.value = settings.animationSpeed;
        document.documentElement.style.setProperty('--transition-speed-modifier', getAnimationSpeedValue(settings.animationSpeed));


        // Zoom Behavior (conceptual)
        if (zoomBehaviorSelect) zoomBehaviorSelect.value = settings.zoomBehavior;

        // Show Mini-map
        if (showMinimapCheckbox) showMinimapCheckbox.checked = settings.showMinimap;
        miniMapElement.style.display = settings.showMinimap ? '' : 'none'; //

        // Lazy Loading (conceptual)
        if (enableLazyLoadingCheckbox) enableLazyLoadingCheckbox.checked = settings.enableLazyLoading;

        // Detail Level (conceptual for Virtualizer LOD)
        if (detailLevelSelect) detailLevelSelect.value = settings.detailLevel;
        if (virtualizer) virtualizer.options.lodThresholds = getLodThresholds(settings.detailLevel); //

        // Enable Virtualization
        if (enableVirtualizationCheckbox) enableVirtualizationCheckbox.checked = settings.enableVirtualization;
        if (virtualizer) virtualizer.enabled = settings.enableVirtualization; //
        if (!settings.enableVirtualization && virtualizer) {
            // If turning off, may need to re-render manually
            const currentDirData = findItemByPath(appState.currentPath);
            renderDirectory(currentDirData); // Force non-virtualized render
        } else if (settings.enableVirtualization && virtualizer) {
            virtualizer.scheduleRender(); //
        }


        // Performance Monitoring
        if (appState.settings.enablePerformanceMonitoring && perf && !perf.isMonitoring) { //
             perf.startMonitoring(updatePerformanceStats, CONFIG.PERFORMANCE_MONITOR_OPTIONS); //
        } else if (!appState.settings.enablePerformanceMonitoring && perf && perf.isMonitoring) { //
            perf.stopMonitoring(); //
            // Clear any performance stats display if you have one
        }
    }
    function getAnimationSpeedValue(speedSetting) {
        switch(speedSetting) {
            case 'fast': return '0.5';
            case 'slow': return '2';
            case 'off': return '0';
            case 'normal':
            default: return '1';
        }
    }
    function getLodThresholds(detailLevelSetting) { //
        switch(detailLevelSetting) {
            case 'high': return [1.0, 0.6, 0.3]; // More items at higher detail
            case 'low': return [0.8, 0.3, 0.1];  // Fewer items at higher detail
            case 'medium':
            default: return [1.0, 0.5, 0.2]; // Default
        }
    }


    // --- Toasts ---
    function showToast(message, type = 'info', duration = CONFIG.TOAST_DURATION_MS) { //
        const toast = document.createElement('div');
        toast.className = `toast ${type}`; //
        const iconClass = {
            info: 'fa-info-circle', //
            success: 'fa-check-circle', //
            warning: 'fa-exclamation-triangle', //
            error: 'fa-times-circle' //
        }[type] || 'fa-info-circle';

        toast.innerHTML = `
            <div class="toast-icon"><i class="fas ${iconClass}"></i></div>
            <div class="toast-content">
                <span class="toast-message">${message}</span>
            </div>
            <button class="toast-close"><i class="fas fa-times"></i></button>
        `; //

        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.classList.add('exiting'); //
            toast.addEventListener('animationend', () => toast.remove());
        });

        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('exiting'); //
            toast.addEventListener('animationend', () => toast.remove(), { once: true });
        }, duration);
    }


    // --- Event Listeners Setup ---
    function setupEventListeners() {
        // Header Controls
        searchInput.addEventListener('input', () => debouncedSearch(searchInput.value)); //
        searchClearBtn.addEventListener('click', () => { //
            searchInput.value = '';
            performSearch(''); // Clear results
            searchInput.parentNode.classList.remove('has-value'); //
            searchInput.focus();
        });
        zoomInBtn.addEventListener('click', () => applyZoom(appState.zoomLevel + CONFIG.ZOOM_STEP)); //
        zoomOutBtn.addEventListener('click', () => applyZoom(appState.zoomLevel - CONFIG.ZOOM_STEP)); //
        resetViewBtn.addEventListener('click', resetZoomAndPan); //
        themeToggleBtn.addEventListener('click', toggleTheme); //

        // Context Panel
        if(contextPanelCloseBtn) contextPanelCloseBtn.addEventListener('click', hideContextPanel); //

        // Mouse wheel zoom on spatial view
        spatialView.addEventListener('wheel', (event) => { //
            if (event.ctrlKey) { // Require Ctrl key for zooming with wheel, common UX
                event.preventDefault();
                const zoomFactor = event.deltaY < 0 ? (1 + CONFIG.ZOOM_STEP) : (1 - CONFIG.ZOOM_STEP);
                // Zoom towards mouse cursor
                const rect = spatialView.getBoundingClientRect();
                const mouseX = event.clientX - rect.left;
                const mouseY = event.clientY - rect.top;

                const newZoom = appState.zoomLevel * zoomFactor;

                // Calculate pan offset to keep point under cursor fixed
                appState.panOffset.x = mouseX - (mouseX - appState.panOffset.x) * (newZoom / appState.zoomLevel);
                appState.panOffset.y = mouseY - (mouseY - appState.panOffset.y) * (newZoom / appState.zoomLevel);

                applyZoom(newZoom);
            } else {
                 // Allow default scroll or implement panning without Ctrl if desired
                 // For now, normal scroll behavior if Ctrl not pressed
            }
        }, { passive: false });


        // Panning
        spatialView.addEventListener('mousedown', (event) => { //
            // Pan only on middle mouse button or if a modifier is pressed (e.g. Space)
            // Or if no specific item is interactive under the cursor
            if (event.button === 1 || (event.button === 0 && (event.altKey || event.shiftKey))) { // Middle mouse or Alt/Shift + Left Click
                appState.isDragging = true;
                appState.lastMousePosition = { x: event.clientX, y: event.clientY };
                spatialView.classList.add('grabbing');
                event.preventDefault(); // Prevent text selection or other default drag behaviors
            }
        });
        document.addEventListener('mousemove', (event) => {
            if (appState.isDragging) {
                const dx = event.clientX - appState.lastMousePosition.x;
                const dy = event.clientY - appState.lastMousePosition.y;
                appState.panOffset.x += dx;
                appState.panOffset.y += dy;
                appState.lastMousePosition = { x: event.clientX, y: event.clientY };
                updateTransform();
            }
        });
        document.addEventListener('mouseup', () => {
            if (appState.isDragging) {
                appState.isDragging = false;
                spatialView.classList.remove('grabbing');
            }
        });
         // Prevent context menu on spatial view drag/middle click
        spatialView.addEventListener('contextmenu', (event) => { //
            if (appState.isDragging || event.button === 1) {
                event.preventDefault();
            }
        });


        // Modal Openers
        document.getElementById('show-settings')?.addEventListener('click', (e) => { e.preventDefault(); openModal(settingsModal); }); //
        document.getElementById('show-bookmarks')?.addEventListener('click', (e) => { e.preventDefault(); openModal(bookmarksModal); renderBookmarks(); }); //
        document.getElementById('show-help')?.addEventListener('click', (e) => { e.preventDefault(); openModal(helpModal); }); //

        // Modal Closers
        allModals.forEach(modal => {
            modal.querySelector('.modal-close')?.addEventListener('click', () => closeModal(modal)); //
            // Close on backdrop click
            modal.addEventListener('click', (event) => {
                if (event.target === modal) { // Clicked on the backdrop itself
                    closeModal(modal);
                }
            });
        });
        document.addEventListener('keydown', closeModalOnEsc);


        // Settings Modal Actions
        if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', () => { //
            appState.settings.theme = themeSelect.value; //
            appState.settings.animationSpeed = animationSpeedSelect.value; //
            appState.settings.zoomBehavior = zoomBehaviorSelect.value; //
            appState.settings.showMinimap = showMinimapCheckbox.checked; //
            appState.settings.enableLazyLoading = enableLazyLoadingCheckbox.checked; //
            appState.settings.detailLevel = detailLevelSelect.value; //
            appState.settings.enableVirtualization = enableVirtualizationCheckbox.checked; //
            // Note: Performance monitoring is not in the settings modal in the HTML,
            // but could be added. For now, it's managed conceptually.
            applySettings(appState.settings);
            saveSettings();
            closeModal(settingsModal);
        });
        if (resetSettingsBtn) resetSettingsBtn.addEventListener('click', () => { //
            // Re-load defaults (which are already set in loadSettings if nothing stored)
            const defaultSettings = loadSettings(); // This effectively gets defaults if localstorage is cleared or item is missing
            // Or more explicitly reset to CONFIG values if available
            const explicitDefaults = {
                theme: CONFIG.DEFAULT_THEME, animationSpeed: 'normal', zoomBehavior: 'smooth',
                showMinimap: true, enableLazyLoading: true, detailLevel: 'medium', enableVirtualization: true,
                enablePerformanceMonitoring: false
            };
            applySettings(explicitDefaults); // Apply the fresh defaults
            saveSettings(); // Save them
             // Update UI elements in the settings modal to reflect reset values before closing
            if (themeSelect) themeSelect.value = appState.settings.theme;
            if (animationSpeedSelect) animationSpeedSelect.value = appState.settings.animationSpeed;
            if (zoomBehaviorSelect) zoomBehaviorSelect.value = appState.settings.zoomBehavior;
            if (showMinimapCheckbox) showMinimapCheckbox.checked = appState.settings.showMinimap;
            if (enableLazyLoadingCheckbox) enableLazyLoadingCheckbox.checked = appState.settings.enableLazyLoading;
            if (detailLevelSelect) detailLevelSelect.value = appState.settings.detailLevel;
            if (enableVirtualizationCheckbox) enableVirtualizationCheckbox.checked = appState.settings.enableVirtualization;

            showToast('Settings reset to default.', 'info');
        });


        // Keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            if (event.target === searchInput || event.target.closest('.modal')) return; // Ignore if typing in search or modal

            // Navigation
            if (event.key === 'Backspace' && appState.currentPath !== '') { //
                event.preventDefault();
                const parentPath = appState.currentPath.substring(0, appState.currentPath.lastIndexOf('/'));
                navigateToPath(parentPath, true);
            }
            if (event.altKey && event.key === 'ArrowLeft') { //
                event.preventDefault();
                navigateHistory(-1);
            }
            if (event.altKey && event.key === 'ArrowRight') { //
                event.preventDefault();
                navigateHistory(1);
            }

            // Zoom
            if (event.ctrlKey && (event.key === '+' || event.key === '=')) { //
                event.preventDefault();
                applyZoom(appState.zoomLevel + CONFIG.ZOOM_STEP);
            }
            if (event.ctrlKey && event.key === '-') { //
                event.preventDefault();
                applyZoom(appState.zoomLevel - CONFIG.ZOOM_STEP);
            }
            if (event.ctrlKey && event.key === '0') { //
                event.preventDefault();
                resetZoomAndPan();
            }
            // Search focus
            if (event.ctrlKey && event.key === 'f') { //
                event.preventDefault();
                searchInput.focus();
                searchInput.select();
            }
        });

        // Window resize
        window.addEventListener('resize', perf ? perf.debounce(() => { //
            if(virtualizer) virtualizer.updateRects(); //
            updateMiniMap(); // Minimap might depend on viewport size
            // If not using virtualizer, might need to re-layout/re-render items
            if (!virtualizer || !appState.settings.enableVirtualization) {
                 const currentDirData = findItemByPath(appState.currentPath);
                 renderDirectory(currentDirData);
            }
        }, 150) : () => { /* no-op or simple version */ });


        // Listener for item clicks from VirtualizedRenderer
        if (virtualizer) {
            spatialView.addEventListener('item:click', (e) => { //
                const { item, element } = e.detail;
                handleItemClick(item, element);
            });
            spatialView.addEventListener('item:dblclick', (e) => { //
                handleItemDblClick(e.detail.item);
            });
            spatialView.addEventListener('item:contextmenu', (e) => { //
                const { item, element, originalEvent } = e.detail;
                handleItemContextMenu(originalEvent, item, element);
            });
        }

    }

    // --- History Management ---
    function navigateHistory(direction) { // direction is -1 for back, 1 for forward
        const newIndex = appState.historyIndex + direction;
        if (newIndex >= 0 && newIndex < appState.history.length) {
            appState.historyIndex = newIndex;
            // Navigate without adding to history again
            navigateToPath(appState.history[appState.historyIndex], false);
        }
    }

    // --- Performance ---
    function updatePerformanceStats(stats) { //
        // This is where you would display FPS or other metrics if you have a UI element for it.
        // For now, just console log or update a debug overlay.
        // console.log(`FPS: ${stats.fps}, Min: ${stats.min}, Max: ${stats.max}, Avg: ${stats.avg}`);
        if (appState.settings.enablePerformanceMonitoring && virtualizer && virtualizer.debugOverlay) { //
            // Let virtualizer update its own debug overlay which includes its stats
            // We could add more app-level stats here if needed.
        }
    }


    // --- Utility Functions ---
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // --- Start the application ---
    init();
    loadBookmarks(); // Load bookmarks after init

});

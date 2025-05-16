/**
 * js/virtualizer.js - Advanced Virtualized Rendering Engine
 * 
 * This module provides high-performance rendering for large directory structures by:
 * 1. Only creating DOM elements for visible items
 * 2. Recycling DOM elements efficiently as items move in/out of view
 * 3. Implementing level-of-detail rendering based on zoom level
 * 4. Optimizing rendering with spatial binning and culling
 * 5. Supporting progressive loading and dynamic directory structures
 */

class VirtualizedRenderer {
    /**
     * Create a new virtualized renderer
     * @param {Object} options - Configuration options
     */
    constructor(options = {}) {
        // Default configuration
        this.options = {
            // DOM selectors
            containerSelector: '#spatial-view',      // Main container element
            viewportSelector: '#directory-viewport', // Transformable viewport element
            itemSelector: '.spatial-item',           // Item element class
            
            // Item dimensions and layout
            itemSize: { width: 100, height: 120 },   // Default item size
            itemMargin: 10,                          // Space between items
            renderMargin: 300,                       // Extra area outside viewport to prerender
            
            // Performance optimizations
            batchSize: 10,                           // Items to process per batch
            recycleThreshold: 100,                   // Max reusable elements to keep in pool
            updateThrottle: 16,                      // Ms to throttle update calls (16ms ≈ 60fps)
            
            // Levels of detail for rendering
            lodLevels: 3,                            // Levels of detail (1 = no LOD)
            lodThresholds: [1.0, 0.5, 0.2],          // Zoom thresholds for LOD levels
            detailDistanceThreshold: 300,            // Distance at which to switch detail levels
            enableCulling: true,                     // Whether to cull items outside view
            
            // Debugging
            debug: false,                            // Enable debug visualization and logging
            stats: false                             // Show rendering statistics
            
            // Additional options can be provided
        };
        
        // Apply user options
        Object.assign(this.options, options);
        
        // State
        this.container = document.querySelector(this.options.containerSelector);
        this.viewport = document.querySelector(this.options.viewportSelector) || this.container;
        this.visibleItems = new Map();        // Map of visible item elements by path
        this.itemData = new Map();            // Map of all item data by path
        this.recycledElements = new Map();    // Pool of elements to reuse by type
        this.viewportRect = null;             // Current viewport dimensions
        this.containerRect = null;            // Container dimensions 
        this.transform = {                    // Current transform state
            scale: 1,                         // Zoom level
            translateX: 0,                    // X translation
            translateY: 0                     // Y translation
        };
        this.isRendering = false;             // Flag to prevent concurrent rendering
        this.renderScheduled = false;         // Flag for scheduled renders
        this.initialized = false;             // Whether the virtualizer is initialized
        this.enabled = true;                  // Whether virtualization is enabled
        this.debug = this.options.debug;      // Debug mode
        
        // Performance tracking
        this.stats = {
            visibleItems: 0,
            recycledElements: 0,
            createdElements: 0,
            updatedElements: 0,
            culledItems: 0,
            renderTime: 0,
            lastRenderTime: performance.now()
        };
        
        // Binned spatial index for fast queries
        this.spatialIndex = {
            bins: new Map(),
            binSize: 500,  // Size of each spatial bin
            items: new Map()
        };
        
        // Initialize
        if (this.container) {
            this.initialize();
        } else {
            console.error('Virtualized Renderer: Container element not found');
        }
    }
    
    /**
     * Initialize the virtualizer
     */
    initialize() {
        if (this.initialized) return;
        
        // Initial viewport calculation
        this.updateRects();
        
        // Create throttled update function
        this.throttledUpdate = Performance.throttle(
            () => this.render(), 
            this.options.updateThrottle, 
            true
        );
        
        // Set up intersection and resize observers
        this.setupObservers();
        
        // Create object pool for recycling elements
        this.setupObjectPools();
        
        this.initialized = true;
        
        if (this.debug) {
            console.log('Virtualized Renderer initialized', this);
            
            // Add debug visuals
            this.setupDebugVisuals();
        }
    }
    
    /**
     * Set up object pools for each item type
     */
    setupObjectPools() {
        // Create pools for different element types
        const createDirectoryElement = () => this.createElementTemplate('directory');
        const createFileElement = () => this.createElementTemplate('file');
        
        // Reset functions
        const resetElement = (el) => {
            el.style.display = 'none';
            el.style.transform = '';
            el.classList.remove('focused');
            el.removeAttribute('data-path');
            
            // Remove event listeners by cloning and replacing
            const clone = el.cloneNode(true);
            if (el.parentNode) {
                el.parentNode.replaceChild(clone, el);
            }
            return clone;
        };
        
        // Create pools using Performance module
        this.directoryPool = Performance.createObjectPool(
            'virtualizer-directory-pool',
            createDirectoryElement,
            resetElement,
            { initialSize: 10, maxSize: this.options.recycleThreshold }
        );
        
        this.filePool = Performance.createObjectPool(
            'virtualizer-file-pool',
            createFileElement,
            resetElement,
            { initialSize: 10, maxSize: this.options.recycleThreshold }
        );
    }
    
    /**
     * Create template element for recycling
     * @param {string} type - Element type (directory/file)
     * @returns {HTMLElement} Template element
     */
    createElementTemplate(type) {
        const el = document.createElement('div');
        el.className = `spatial-item ${type}`;
        el.style.display = 'none';
        
        // Create icon
        const iconEl = document.createElement('div');
        iconEl.className = 'spatial-item-icon';
        
        const iconType = type === 'directory' ? 'fa-folder' : 'fa-file';
        iconEl.innerHTML = `<i class="fas ${iconType}"></i>`;
        el.appendChild(iconEl);
        
        // Create name label
        const nameEl = document.createElement('div');
        nameEl.className = 'spatial-item-name';
        nameEl.textContent = '';
        el.appendChild(nameEl);
        
        return el;
    }
    
    /**
     * Set up intersection and resize observers
     */
    setupObservers() {
        // Use IntersectionObserver to detect when items enter/exit viewport
        this.observer = new IntersectionObserver(
            (entries) => this.handleIntersection(entries),
            {
                root: this.container,
                rootMargin: `${this.options.renderMargin}px`,
                threshold: 0
            }
        );
        
        // Observe resize events on container
        if ('ResizeObserver' in window) {
            this.resizeObserver = new ResizeObserver(
                (entries) => this.handleResize(entries)
            );
            this.resizeObserver.observe(this.container);
        } else {
            // Fallback for browsers without ResizeObserver
            window.addEventListener('resize', () => this.updateRects());
        }
        
        // Also handle scroll events in the container
        this.container.addEventListener('scroll', () => this.handleScroll());
        
        // Listen for visibility changes to pause/resume when tab inactive
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.resumeRendering();
            } else {
                this.pauseRendering();
            }
        });
    }
    
    /**
     * Calculate viewport and container dimensions
     */
    updateRects() {
        this.containerRect = this.container.getBoundingClientRect();
        this.viewportRect = {
            width: this.containerRect.width,
            height: this.containerRect.height,
            left: 0,
            top: 0,
            right: this.containerRect.width,
            bottom: this.containerRect.height
        };
        
        // Schedule a render pass when viewport changes
        this.scheduleRender();
    }
    
    /**
     * Handle container resize
     * @param {ResizeObserverEntry[]} entries - Resize entries
     */
    handleResize(entries) {
        for (const entry of entries) {
            if (entry.target === this.container) {
                this.updateRects();
                break;
            }
        }
    }
    
    /**
     * Handle scroll events
     */
    handleScroll() {
        // Schedule a render pass
        this.scheduleRender();
    }
    
    /**
     * Handle intersection observer entries
     * @param {IntersectionObserverEntry[]} entries - Intersection entries
     */
    handleIntersection(entries) {
        let needsRender = false;
        
        entries.forEach(entry => {
            const path = entry.target.dataset.path;
            
            if (!path) return;
            
            if (entry.isIntersecting) {
                // Item entered viewport
                if (!this.visibleItems.has(path)) {
                    needsRender = true;
                }
            } else {
                // Item left viewport
                if (this.visibleItems.has(path)) {
                    // Recycle the element
                    this.recycleElement(entry.target);
                    this.visibleItems.delete(path);
                    needsRender = true;
                }
            }
        });
        
        if (needsRender) {
            this.scheduleRender();
        }
    }
    
    /**
     * Recycle an element by returning it to the pool
     * @param {HTMLElement} element - Element to recycle
     */
    recycleElement(element) {
        if (!element) return;
        
        // Stop observing
        this.observer.unobserve(element);
        
        // Get element type
        const isDirectory = element.classList.contains('directory');
        
        // Add to the appropriate pool
        if (isDirectory) {
            this.directoryPool.release(element);
        } else {
            this.filePool.release(element);
        }
        
        this.stats.recycledElements++;
    }
    
    /**
     * Schedule a render pass
     */
    scheduleRender() {
        if (!this.renderScheduled && this.enabled) {
            this.renderScheduled = true;
            requestAnimationFrame(() => {
                this.render();
                this.renderScheduled = false;
            });
        }
    }
    
    /**
     * Render visible items
     */
    render() {
        if (this.isRendering || !this.enabled) return;
        
        const startTime = performance.now();
        this.isRendering = true;
        
        try {
            // Reset stats for this render
            this.stats.visibleItems = 0;
            this.stats.updatedElements = 0;
            this.stats.createdElements = 0;
            this.stats.culledItems = 0;
            
            // Apply current transform to viewport
            this.applyTransform();
            
            // Get all items that should be visible
            const itemsToRender = this.getItemsInViewport();
            
            // For debugging
            if (this.debug) {
                console.log(`Rendering ${itemsToRender.length} items`);
            }
            
            // Render each item that isn't already visible
            Performance.processIncrementally(
                itemsToRender,
                (item) => {
                    if (!this.visibleItems.has(item.path)) {
                        this.renderItem(item);
                    } else {
                        // Update existing item if needed
                        this.updateItemPosition(item);
                    }
                },
                {
                    batchSize: this.options.batchSize, 
                    interval: 0  // Process immediately in this frame
                }
            );
            
            this.stats.visibleItems = this.visibleItems.size;
            
            // Update stats
            this.stats.renderTime = performance.now() - startTime;
            this.stats.lastRenderTime = performance.now();
            
            // Update debug visuals if enabled
            if (this.debug) {
                this.updateDebugVisuals();
            }
        } catch (error) {
            console.error('Error during rendering:', error);
        } finally {
            this.isRendering = false;
        }
    }
    
    /**
     * Apply current transform to viewport element
     */
    applyTransform() {
        if (!this.viewport) return;
        
        const { scale, translateX, translateY } = this.transform;
        
        // Apply transform
        this.viewport.style.transform = `
            translate(${translateX}px, ${translateY}px)
            scale(${scale})
        `;
    }
    
    /**
     * Get items that should be visible in the current viewport
     * @returns {Array} Array of item data objects that should be visible
     */
    getItemsInViewport() {
        // Get visible area in content coordinates (accounting for transform)
        const visibleRect = this.getVisibleContentRect();
        
        // Use spatial index for fast querying if available
        if (this.spatialIndex.items.size > 0 && this.options.enableCulling) {
            return this.queryVisibleItemsFromSpatialIndex(visibleRect);
        }
        
        // Fallback: linear scan through all items
        const visibleItems = [];
        
        this.itemData.forEach(item => {
            if (this.isItemVisible(item, visibleRect)) {
                visibleItems.push(item);
            } else {
                this.stats.culledItems++;
            }
        });
        
        return visibleItems;
    }
    
    /**
     * Get the visible content rectangle accounting for transform
     * @returns {Object} Visible rectangle in content coordinates
     */
    getVisibleContentRect() {
        const { scale, translateX, translateY } = this.transform;
        
        // Convert viewport rect to content coordinates
        return {
            left: (-translateX / scale),
            top: (-translateY / scale),
            right: (-translateX / scale) + (this.viewportRect.width / scale),
            bottom: (-translateY / scale) + (this.viewportRect.height / scale),
            width: this.viewportRect.width / scale,
            height: this.viewportRect.height / scale
        };
    }
    
    /**
     * Check if an item is visible within the given rectangle
     * @param {Object} item - The item to check
     * @param {Object} rect - The visible rectangle
     * @returns {boolean} True if item is visible
     */
    isItemVisible(item, rect) {
        // Add render margin to visible area
        const margin = this.options.renderMargin / this.transform.scale;
        const visibleRect = {
            left: rect.left - margin,
            top: rect.top - margin,
            right: rect.right + margin,
            bottom: rect.bottom + margin
        };
        
        // Check if item overlaps with visible rect
        const itemRight = item.position.x + this.options.itemSize.width;
        const itemBottom = item.position.y + this.options.itemSize.height;
        
        return !(
            itemRight < visibleRect.left ||
            item.position.x > visibleRect.right ||
            itemBottom < visibleRect.top ||
            item.position.y > visibleRect.bottom
        );
    }
    
    /**
     * Query visible items efficiently using spatial index
     * @param {Object} visibleRect - The visible rectangle
     * @returns {Array} Visible items
     */
    queryVisibleItemsFromSpatialIndex(visibleRect) {
        const margin = this.options.renderMargin / this.transform.scale;
        const expandedRect = {
            left: visibleRect.left - margin,
            top: visibleRect.top - margin,
            right: visibleRect.right + margin,
            bottom: visibleRect.bottom + margin
        };
        
        // Calculate bin coordinates
        const binSize = this.spatialIndex.binSize;
        const startBinX = Math.floor(expandedRect.left / binSize);
        const startBinY = Math.floor(expandedRect.top / binSize);
        const endBinX = Math.ceil(expandedRect.right / binSize);
        const endBinY = Math.ceil(expandedRect.bottom / binSize);
        
        // Collect all items from visible bins
        const visibleItems = new Set();
        
        for (let x = startBinX; x <= endBinX; x++) {
            for (let y = startBinY; y <= endBinY; y++) {
                const binKey = `${x},${y}`;
                const bin = this.spatialIndex.bins.get(binKey);
                
                if (bin) {
                    bin.forEach(itemPath => {
                        const item = this.itemData.get(itemPath);
                        if (item) {
                            visibleItems.add(item);
                        }
                    });
                }
            }
        }
        
        this.stats.culledItems = this.itemData.size - visibleItems.size;
        
        return Array.from(visibleItems);
    }
    
    /**
     * Render an individual item
     * @param {Object} item - Item data to render
     */
    renderItem(item) {
        let element;
        
        // Get element from pool based on type
        if (item.type === 'directory') {
            element = this.directoryPool.get();
            this.stats.createdElements++;
        } else {
            element = this.filePool.get();
            this.stats.createdElements++;
        }
        
        // Update element
        this.updateElement(element, item);
        
        // Show the element
        element.style.display = '';
        
        // Add to viewport if not already in DOM
        if (!element.parentNode) {
            this.viewport.appendChild(element);
        }
        
        // Start observing
        this.observer.observe(element);
        
        // Add to visible items
        this.visibleItems.set(item.path, element);
    }
    
    /**
     * Update an existing element with new item data
     * @param {HTMLElement} element - Element to update
     * @param {Object} item - New item data
     */
    updateElement(element, item) {
        // Set position
        element.style.transform = `translate(${item.position.x}px, ${item.position.y}px)`;
        
        // Set data attributes
        element.dataset.path = item.path;
        element.dataset.name = item.name;
        element.dataset.type = item.type === 'directory' ? 'directory' : item.fileType || 'file';
        
        // Set content based on detail level
        const detailLevel = this.getDetailLevel(item);
        element.dataset.detailLevel = detailLevel;
        
        // Update icon
        const iconElement = element.querySelector('.spatial-item-icon i');
        if (iconElement) {
            const iconClass = this.getIconClass(item);
            iconElement.className = iconClass;
        }
        
        // Update name
        const nameElement = element.querySelector('.spatial-item-name');
        if (nameElement) {
            nameElement.textContent = item.name;
            nameElement.title = item.name; // For tooltip on hover
        }
        
        // Add event listeners if not already added
        if (!element.dataset.hasListeners) {
            element.addEventListener('click', (e) => {
                // Dispatch custom event
                const event = new CustomEvent('item:click', {
                    bubbles: true,
                    detail: { item, element, originalEvent: e }
                });
                this.container.dispatchEvent(event);
            });
            
            element.addEventListener('dblclick', (e) => {
                // Dispatch custom event
                const event = new CustomEvent('item:dblclick', {
                    bubbles: true,
                    detail: { item, element, originalEvent: e }
                });
                this.container.dispatchEvent(event);
            });
            
            element.addEventListener('contextmenu', (e) => {
                // Dispatch custom event
                const event = new CustomEvent('item:contextmenu', {
                    bubbles: true,
                    detail: { item, element, originalEvent: e }
                });
                this.container.dispatchEvent(event);
            });
            
            element.dataset.hasListeners = 'true';
        }
    }
    
    /**
     * Get the appropriate icon class for an item
     * @param {Object} item - The item
     * @returns {string} Icon class
     */
    getIconClass(item) {
        if (item.type === 'directory') {
            return 'fas fa-folder';
        }
        
        // Determine based on file extension or type
        const fileType = item.fileType || 'file';
        
        const iconMap = {
            'image': 'fas fa-file-image',
            'video': 'fas fa-file-video',
            'audio': 'fas fa-file-audio',
            'document': 'fas fa-file-alt',
            'code': 'fas fa-file-code',
            'archive': 'fas fa-file-archive',
            'pdf': 'fas fa-file-pdf',
            'spreadsheet': 'fas fa-file-excel',
            'presentation': 'fas fa-file-powerpoint',
            'text': 'fas fa-file-alt',
            'file': 'fas fa-file'
        };
        
        return iconMap[fileType] || 'fas fa-file';
    }
    
    /**
     * Update position of an existing item
     * @param {Object} item - Item to update
     */
    updateItemPosition(item) {
        const element = this.visibleItems.get(item.path);
        if (!element) return;
        
        // Update position
        element.style.transform = `translate(${item.position.x}px, ${item.position.y}px)`;
        
        // Check if detail level needs to be updated
        const currentDetailLevel = parseInt(element.dataset.detailLevel || '1', 10);
        const newDetailLevel = this.getDetailLevel(item);
        
        if (currentDetailLevel !== newDetailLevel) {
            element.dataset.detailLevel = newDetailLevel;
            this.updateElement(element, item);
        }
        
        this.stats.updatedElements++;
    }
    
    /**
     * Calculate the appropriate detail level based on zoom and distance
     * @param {Object} item - The item to check
     * @returns {number} Detail level (1=highest, 3=lowest)
     */
    getDetailLevel(item) {
        if (this.options.lodLevels === 1) {
            return 1; // Always full detail if LOD is disabled
        }
        
        // First check zoom level
        const { scale } = this.transform;
        
        for (let i = 0; i < this.options.lodThresholds.length; i++) {
            if (scale >= this.options.lodThresholds[i]) {
                return i + 1;
            }
        }
        
        // If zoom level doesn't determine it, check distance from viewport center
        const visibleRect = this.getVisibleContentRect();
        const viewportCenterX = visibleRect.left + (visibleRect.width / 2);
        const viewportCenterY = visibleRect.top + (visibleRect.height / 2);
        
        const itemCenterX = item.position.x + (this.options.itemSize.width / 2);
        const itemCenterY = item.position.y + (this.options.itemSize.height / 2);
        
        const dx = itemCenterX - viewportCenterX;
        const dy = itemCenterY - viewportCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Determine detail level based on distance
        const threshold = this.options.detailDistanceThreshold / scale;
        
        if (distance < threshold) {
            return 1; // High detail for close items
        } else if (distance < threshold * 2) {
            return 2; // Medium detail
        } else {
            return 3; // Low detail for distant items
        }
    }
    
    /**
     * Set items to be rendered
     * @param {Array} items - Array of item objects
     * @param {number} scale - Current zoom scale
     */
    setItems(items, scale) {
        // Update transform
        this.transform.scale = scale || this.transform.scale;
        
        // Clear current data
        this.itemData.clear();
        
        // Add new items
        items.forEach(item => {
            this.itemData.set(item.path, item);
        });
        
        // Rebuild spatial index
        this.buildSpatialIndex();
        
        // Schedule a render
        this.scheduleRender();
    }
    
    /**
     * Build spatial index for efficient item lookup
     */
    buildSpatialIndex() {
        const { binSize } = this.spatialIndex;
        
        // Clear existing index
        this.spatialIndex.bins.clear();
        this.spatialIndex.items.clear();
        
        // Add all items to spatial index
        this.itemData.forEach(item => {
            // Calculate bin coordinates for item
            const startBinX = Math.floor(item.position.x / binSize);
            const startBinY = Math.floor(item.position.y / binSize);
            const endBinX = Math.ceil((item.position.x + this.options.itemSize.width) / binSize);
            const endBinY = Math.ceil((item.position.y + this.options.itemSize.height) / binSize);
            
            // Store which bins this item belongs to
            const itemBins = [];
            
            // Add item to each bin it overlaps
            for (let x = startBinX; x <= endBinX; x++) {
                for (let y = startBinY; y <= endBinY; y++) {
                    const binKey = `${x},${y}`;
                    
                    if (!this.spatialIndex.bins.has(binKey)) {
                        this.spatialIndex.bins.set(binKey, new Set());
                    }
                    
                    this.spatialIndex.bins.get(binKey).add(item.path);
                    itemBins.push(binKey);
                }
            }
            
            // Store which bins this item is in
            this.spatialIndex.items.set(item.path, itemBins);
        });
        
        if (this.debug) {
            console.log(`Spatial index built with ${this.spatialIndex.bins.size} bins for ${this.itemData.size} items`);
        }
    }
    
    /**
     * Update an item's position in the spatial index
     * @param {Object} item - Item that moved
     * @param {Object} oldPosition - Previous position
     */
    updateItemInSpatialIndex(item, oldPosition) {
        const { binSize } = this.spatialIndex;
        
        // Remove from old bins
        if (this.spatialIndex.items.has(item.path)) {
            const oldBins = this.spatialIndex.items.get(item.path);
            
            oldBins.forEach(binKey => {
                const bin = this.spatialIndex.bins.get(binKey);
                if (bin) {
                    bin.delete(item.path);
                    
                    // Clean up empty bins
                    if (bin.size === 0) {
                        this.spatialIndex.bins.delete(binKey);
                    }
                }
            });
        }
        
        // Calculate new bin coordinates
        const startBinX = Math.floor(item.position.x / binSize);
        const startBinY = Math.floor(item.position.y / binSize);
        const endBinX = Math.ceil((item.position.x + this.options.itemSize.width) / binSize);
        const endBinY = Math.ceil((item.position.y + this.options.itemSize.height) / binSize);
        
        // Store which bins this item belongs to
        const itemBins = [];
        
        // Add to new bins
        for (let x = startBinX; x <= endBinX; x++) {
            for (let y = startBinY; y <= endBinY; y++) {
                const binKey = `${x},${y}`;
                
                if (!this.spatialIndex.bins.has(binKey)) {
                    this.spatialIndex.bins.set(binKey, new Set());
                }
                
                this.spatialIndex.bins.get(binKey).add(item.path);
                itemBins.push(binKey);
            }
        }
        
        // Update item's bin list
        this.spatialIndex.items.set(item.path, itemBins);
    }
    
    /**
     * Set the current transform
     * @param {Object} transform - New transform values
     */
    setTransform(transform) {
        const { scale, translateX, translateY } = transform;
        
        if (scale !== undefined) this.transform.scale = scale;
        if (translateX !== undefined) this.transform.translateX = translateX;
        if (translateY !== undefined) this.transform.translateY = translateY;
        
        // Apply new transform
        this.applyTransform();
        
        // Schedule a render to update visible items
        this.scheduleRender();
    }
    
    /**
     * Focus on an item by centering it in view
     * @param {string} itemPath - Path of item to focus
     * @param {number} scale - Optional zoom scale
     */
    focusOnItem(itemPath, scale) {
        const item = this.itemData.get(itemPath);
        
        if (!item) {
            console.warn(`Item not found: ${itemPath}`);
            return;
        }
        
        // Calculate center position of item
        const itemCenterX = item.position.x + (this.options.itemSize.width / 2);
        const itemCenterY = item.position.y + (this.options.itemSize.height / 2);
        
        // Calculate transform to center item
        const newScale = scale || this.transform.scale;
        const containerCenterX = this.containerRect.width / 2;
        const containerCenterY = this.containerRect.height / 2;
        
        const newTranslateX = containerCenterX - (itemCenterX * newScale);
        const newTranslateY = containerCenterY - (itemCenterY * newScale);
        
        // Update transform
        this.setTransform({
            scale: newScale,
            translateX: newTranslateX,
            translateY: newTranslateY
        });
        
        // Highlight the item
        this.highlightItem(itemPath);
    }
    
    /**
     * Highlight an item
     * @param {string} itemPath - Path of item to highlight
     */
    highlightItem(itemPath) {
        // Remove highlight from all items
        this.visibleItems.forEach((element) => {
            element.classList.remove('focused');
        });
        
        // Add highlight to specified item
        const element = this.visibleItems.get(itemPath);
        if (element) {
            element.classList.add('focused');
        }
    }
    
    /**
     * Pause rendering (for when tab is inactive)
     */
    pauseRendering() {
        this.enabled = false;
    }
    
    /**
     * Resume rendering
     */
    resumeRendering() {
        this.enabled = true;
        this.scheduleRender();
    }
    
    /**
     * Set up debug visualizations
     */
    setupDebugVisuals() {
        // Create debug overlay
        this.debugOverlay = document.createElement('div');
        this.debugOverlay.className = 'virtualizer-debug-overlay';
        this.debugOverlay.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 10px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 12px;
            z-index: 9999;
            pointer-events: none;
            white-space: pre;
        `;
        
        document.body.appendChild(this.debugOverlay);
        
        // Create bin visualization overlay if debug mode is enabled
        if (this.debug) {
            this.binOverlay = document.createElement('div');
            this.binOverlay.className = 'virtualizer-bin-overlay';
            this.binOverlay.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 1000;
            `;
            
            this.viewport.appendChild(this.binOverlay);
        }
    }
    
    /**
     * Update debug visualizations
     */
    updateDebugVisuals() {
        if (!this.debugOverlay) return;
        
        // Update stats display
        this.debugOverlay.textContent = `Virtualizer Stats:
- Visible Items: ${this.stats.visibleItems}
- Created: ${this.stats.createdElements}
- Updated: ${this.stats.updatedElements}
- Culled: ${this.stats.culledItems}
- Recycled: ${this.directoryPool.size() + this.filePool.size()}
- Render Time: ${this.stats.renderTime.toFixed(2)}ms
- Transform: scale(${this.transform.scale.toFixed(2)})`;
        
        // Update bin visualization if enabled
        if (this.debug && this.binOverlay) {
            this.updateBinVisualization();
        }
    }
    
    /**
     * Update spatial bin visualization
     */
    updateBinVisualization() {
        if (!this.binOverlay) return;
        
        // Clear existing visualization
        this.binOverlay.innerHTML = '';
        
        // Get visible area in content coordinates
        const visibleRect = this.getVisibleContentRect();
        const margin = this.options.renderMargin / this.transform.scale;
        const expandedRect = {
            left: visibleRect.left - margin,
            top: visibleRect.top - margin,
            right: visibleRect.right + margin,
            bottom: visibleRect.bottom + margin
        };
        
        // Calculate visible bin coordinates
        const binSize = this.spatialIndex.binSize;
        const startBinX = Math.floor(expandedRect.left / binSize);
        const startBinY = Math.floor(expandedRect.top / binSize);
        const endBinX = Math.ceil(expandedRect.right / binSize);
        const endBinY = Math.ceil(expandedRect.bottom / binSize);
        
        // Draw visible bins
        const { scale, translateX, translateY } = this.transform;
        
        for (let x = startBinX; x <= endBinX; x++) {
            for (let y = startBinY; y <= endBinY; y++) {
                const binKey = `${x},${y}`;
                const bin = this.spatialIndex.bins.get(binKey);
                
                // Calculate bin position in screen coordinates
                const left = (x * binSize * scale) + translateX;
                const top = (y * binSize * scale) + translateY;
                const width = binSize * scale;
                const height = binSize * scale;
                
                // Create bin visualization element
                const binElement = document.createElement('div');
                binElement.style.cssText = `
                    position: absolute;
                    left: ${left}px;
                    top: ${top}px;
                    width: ${width}px;
                    height: ${height}px;
                    border: 1px dashed rgba(255, 255, 255, 0.3);
                    pointer-events: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: rgba(255, 255, 255, 0.7);
                    font-size: ${10 * scale}px;
                    background: rgba(0, 0, 255, 0.05);
                `;
                
                // Show bin item count
                binElement.textContent = bin ? bin.size : '0';
                if (bin && bin.size > 0) {
                    binElement.style.backgroundColor = `rgba(0, 255, 0, ${Math.min(0.2, bin.size / 10)})`;
                }
                
                this.binOverlay.appendChild(binElement);
            }
        }
    }
    
    /**
     * Add a new item dynamically
     * @param {Object} item - Item to add
     */
    addItem(item) {
        // Add to data store
        this.itemData.set(item.path, item);
        
        // Add to spatial index
        this.updateItemInSpatialIndex(item);
        
        // Render if in view
        const visibleRect = this.getVisibleContentRect();
        if (this.isItemVisible(item, visibleRect)) {
            this.renderItem(item);
        }
    }
    
    /**
     * Remove an item
     * @param {string} itemPath - Path of item to remove
     */
    removeItem(itemPath) {
        // Remove from data store
        this.itemData.delete(itemPath);
        
        // Remove from spatial index
        if (this.spatialIndex.items.has(itemPath)) {
            const bins = this.spatialIndex.items.get(itemPath);
            
            bins.forEach(binKey => {
                const bin = this.spatialIndex.bins.get(binKey);
                if (bin) {
                    bin.delete(itemPath);
                    
                    // Clean up empty bins
                    if (bin.size === 0) {
                        this.spatialIndex.bins.delete(binKey);
                    }
                }
            });
            
            this.spatialIndex.items.delete(itemPath);
        }
        
        // Remove visible element if present
        if (this.visibleItems.has(itemPath)) {
            const element = this.visibleItems.get(itemPath);
            this.recycleElement(element);
            this.visibleItems.delete(itemPath);
        }
    }
    
    /**
     * Clean up resources
     */
    dispose() {
        // Stop observers
        if (this.observer) {
            this.observer.disconnect();
        }
        
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        
        // Remove event listeners
        this.container.removeEventListener('scroll', this.handleScroll);
        window.removeEventListener('resize', this.updateRects);
        
        // Clean up all visible elements
        this.visibleItems.forEach((element) => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });
        
        // Clear data structures
        this.visibleItems.clear();
        this.itemData.clear();
        this.spatialIndex.bins.clear();
        this.spatialIndex.items.clear();
        
        // Remove debug overlays
        if (this.debugOverlay && this.debugOverlay.parentNode) {
            this.debugOverlay.parentNode.removeChild(this.debugOverlay);
        }
        
        if (this.binOverlay && this.binOverlay.parentNode) {
            this.binOverlay.parentNode.removeChild(this.binOverlay);
        }
        
        console.log('Virtualized Renderer disposed');
    }
}

// Export to window
window.VirtualizedRenderer = VirtualizedRenderer;

/**
 * js/virtualizer.js - Virtualized rendering module for Spatial Directory Explorer
 * 
 * This module optimizes performance when rendering large directories by:
 * 1. Only creating DOM elements for visible items
 * 2. Recycling DOM elements as items move in and out of view
 * 3. Implementing level-of-detail rendering based on distance
 */

class VirtualizedRenderer {
    constructor(options = {}) {
        // Configuration
        this.options = {
            containerSelector: '#spatial-view',
            itemSelector: '.spatial-item',
            itemSize: { width: 100, height: 120 },
            renderMargin: 200,         // Extra area outside viewport to prerender
            recycleThreshold: 100,     // Max reusable elements to keep in pool
            lodLevels: 3,              // Levels of detail (1 = no LOD)
            detailDistanceThreshold: 300, // Distance at which to switch detail levels
            ...options
        };
        
        // State
        this.container = document.querySelector(this.options.containerSelector);
        this.visibleItems = new Map();  // Map of visible item elements by id
        this.recycledElements = [];     // Pool of elements to reuse
        this.viewportRect = null;       // Current viewport dimensions
        this.zoomLevel = 1;             // Current zoom level
        this.isRendering = false;       // Flag to prevent concurrent rendering
        
        // Initialize
        this.initialize();
    }
    
    /**
     * Initialize the virtualizer
     */
    initialize() {
        // Initial viewport calculation
        this.updateViewport();
        
        // Set up scroll and resize observers
        this.setupObservers();
        
        console.log('Virtualizer initialized');
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
        
        // Observe resize events
        const resizeObserver = new ResizeObserver(
            (entries) => this.updateViewport()
        );
        resizeObserver.observe(this.container);
        
        // Also handle scroll events in the container
        this.container.addEventListener('scroll', this.handleScroll.bind(this));
    }
    
    /**
     * Update the viewport dimensions
     */
    updateViewport() {
        this.viewportRect = this.container.getBoundingClientRect();
        
        // Schedule a render pass when viewport changes
        this.scheduleRender();
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
     */
    handleIntersection(entries) {
        let needsRender = false;
        
        entries.forEach(entry => {
            const itemId = entry.target.dataset.id;
            
            if (entry.isIntersecting) {
                // Item entered viewport
                if (!this.visibleItems.has(itemId)) {
                    needsRender = true;
                }
            } else {
                // Item left viewport
                if (this.visibleItems.has(itemId)) {
                    // Add to recycle pool
                    const element = entry.target;
                    
                    if (this.recycledElements.length < this.options.recycleThreshold) {
                        // Clean up the element for recycling
                        element.style.display = 'none';
                        this.recycledElements.push(element);
                    } else {
                        // Just remove it if we have enough recycled elements
                        element.remove();
                    }
                    
                    // Remove from visible items
                    this.visibleItems.delete(itemId);
                    needsRender = true;
                }
            }
        });
        
        if (needsRender) {
            this.scheduleRender();
        }
    }
    
    /**
     * Schedule a render pass
     */
    scheduleRender() {
        if (!this.renderScheduled) {
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
        if (this.isRendering) return;
        this.isRendering = true;
        
        try {
            // Get all items that should be visible
            const itemsToRender = this.getItemsInViewport();
            
            // Render each item that isn't already visible
            itemsToRender.forEach(item => {
                if (!this.visibleItems.has(item.id)) {
                    this.renderItem(item);
                } else {
                    // Update existing item if needed
                    this.updateItemPosition(item);
                }
            });
            
            console.log(`Rendered ${this.visibleItems.size} items`);
        } catch (error) {
            console.error('Error during rendering:', error);
        } finally {
            this.isRendering = false;
        }
    }
    
    /**
     * Get items that should be visible in the current viewport
     */
    getItemsInViewport() {
        // This would be provided by the parent application
        // Returns array of item data objects that should be visible
        
        // For testing, return empty array
        return [];
    }
    
    /**
     * Render an individual item
     */
    renderItem(item) {
        let element;
        
        // Try to reuse a recycled element
        if (this.recycledElements.length > 0) {
            element = this.recycledElements.pop();
            this.updateElement(element, item);
        } else {
            // Create new element
            element = this.createElement(item);
        }
        
        // Show the element
        element.style.display = '';
        
        // Add to viewport
        this.container.appendChild(element);
        
        // Start observing
        this.observer.observe(element);
        
        // Add to visible items
        this.visibleItems.set(item.id, element);
    }
    
    /**
     * Create a new element for an item
     */
    createElement(item) {
        const element = document.createElement('div');
        element.className = 'spatial-item';
        element.dataset.id = item.id;
        
        // Apply position and add content
        this.updateElement(element, item);
        
        return element;
    }
    
    /**
     * Update an existing element with new item data
     */
    updateElement(element, item) {
        // Set position
        element.style.transform = `translate(${item.position.x}px, ${item.position.y}px)`;
        
        // Set content based on detail level
        const detailLevel = this.getDetailLevel(item);
        
        // Update content based on detail level (1=highest, 3=lowest)
        switch (detailLevel) {
            case 1:
                // Full detail
                element.innerHTML = `
                    <div class="spatial-item-icon">
                        <i class="fas ${item.icon}"></i>
                    </div>
                    <div class="spatial-item-name">${item.name}</div>
                `;
                break;
                
            case 2:
                // Medium detail (icon only)
                element.innerHTML = `
                    <div class="spatial-item-icon">
                        <i class="fas ${item.icon}"></i>
                    </div>
                `;
                break;
                
            case 3:
                // Low detail (simplified representation)
                element.innerHTML = `
                    <div class="spatial-item-dot" style="background-color: ${item.color}"></div>
                `;
                break;
        }
        
        // Set data attributes
        element.dataset.type = item.type;
        element.dataset.path = item.path;
        element.dataset.name = item.name;
    }
    
    /**
     * Update position of an existing item
     */
    updateItemPosition(item) {
        const element = this.visibleItems.get(item.id);
        if (element) {
            element.style.transform = `translate(${item.position.x}px, ${item.position.y}px)`;
            
            // Also update detail level if needed
            const currentDetailLevel = element.dataset.detailLevel;
            const newDetailLevel = this.getDetailLevel(item);
            
            if (currentDetailLevel !== newDetailLevel) {
                element.dataset.detailLevel = newDetailLevel;
                this.updateElement(element, item);
            }
        }
    }
    
    /**
     * Calculate the appropriate detail level based on distance from viewport center
     */
    getDetailLevel(item) {
        if (this.options.lodLevels === 1) {
            return 1; // Always full detail if LOD is disabled
        }
        
        // Calculate distance from viewport center
        const viewportCenterX = this.viewportRect.width / 2;
        const viewportCenterY = this.viewportRect.height / 2;
        
        const dx = item.position.x - viewportCenterX;
        const dy = item.position.y - viewportCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Adjust for zoom level
        const adjustedDistance = distance / this.zoomLevel;
        
        // Determine detail level based on distance
        if (adjustedDistance < this.options.detailDistanceThreshold) {
            return 1; // High detail for close items
        } else if (adjustedDistance < this.options.detailDistanceThreshold * 2) {
            return 2; // Medium detail for mid-range items
        } else {
            return 3; // Low detail for distant items
        }
    }
    
    /**
     * Set the current zoom level
     */
    setZoomLevel(zoomLevel) {
        this.zoomLevel = zoomLevel;
        this.scheduleRender();
    }
    
    /**
     * Reset the virtualizer
     */
    reset() {
        // Clear all tracked items
        this.visibleItems.forEach(element => {
            this.observer.unobserve(element);
            element.remove();
        });
        
        // Clear collections
        this.visibleItems.clear();
        this.recycledElements = [];
        
        console.log('Virtualizer reset');
    }
}

// Export the class
window.VirtualizedRenderer = VirtualizedRenderer;

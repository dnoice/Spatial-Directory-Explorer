/**
 * js/performance.js - Performance optimization utilities for Spatial Directory Explorer
 * 
 * This module provides utilities for improving performance:
 * - Efficient memory management
 * - Throttling and debouncing functions
 * - Frame rate monitoring
 * - Incremental data loading
 */

const Performance = (function() {
    // Private variables
    let _frameCounter = 0;
    let _lastTime = performance.now();
    let _fps = 60;
    let _fpsUpdateInterval = 1000; // ms
    let _fpsCallback = null;
    let _rafId = null;
    let _isMonitoring = false;
    
    /**
     * Throttle a function to limit how often it can be called
     * @param {Function} func - The function to throttle
     * @param {number} limit - Minimum time between calls in ms
     * @returns {Function} Throttled function
     */
    function throttle(func, limit) {
        let inThrottle;
        let lastResult;
        
        return function(...args) {
            if (!inThrottle) {
                inThrottle = true;
                lastResult = func.apply(this, args);
                
                setTimeout(() => {
                    inThrottle = false;
                }, limit);
            }
            
            return lastResult;
        };
    }
    
    /**
     * Debounce a function to delay execution until after wait milliseconds
     * @param {Function} func - The function to debounce
     * @param {number} wait - Time to wait in ms
     * @param {boolean} immediate - Whether to call immediately on the leading edge
     * @returns {Function} Debounced function
     */
    function debounce(func, wait, immediate = false) {
        let timeout;
        
        return function(...args) {
            const context = this;
            
            const later = function() {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            
            const callNow = immediate && !timeout;
            
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            
            if (callNow) func.apply(context, args);
        };
    }
    
    /**
     * Monitor frame rate
     * @param {Function} callback - Function to call with FPS updates
     */
    function startMonitoringFPS(callback) {
        if (_isMonitoring) return;
        
        _fpsCallback = callback;
        _isMonitoring = true;
        _lastTime = performance.now();
        _frameCounter = 0;
        
        // Start the monitoring loop
        monitorFrameRate();
    }
    
    /**
     * Stop monitoring frame rate
     */
    function stopMonitoringFPS() {
        if (!_isMonitoring) return;
        
        _isMonitoring = false;
        if (_rafId) {
            cancelAnimationFrame(_rafId);
            _rafId = null;
        }
    }
    
    /**
     * Internal function to monitor frame rate
     */
    function monitorFrameRate() {
        _frameCounter++;
        const currentTime = performance.now();
        const elapsed = currentTime - _lastTime;
        
        if (elapsed >= _fpsUpdateInterval) {
            _fps = Math.round((_frameCounter * 1000) / elapsed);
            _lastTime = currentTime;
            _frameCounter = 0;
            
            if (_fpsCallback) {
                _fpsCallback(_fps);
            }
        }
        
        _rafId = requestAnimationFrame(monitorFrameRate);
    }
    
    /**
     * Load data incrementally
     * @param {Array} items - Items to process
     * @param {Function} processFunc - Function to process each item
     * @param {number} batchSize - Number of items to process in each batch
     * @param {number} interval - Time between batches in ms
     * @param {Function} onComplete - Function to call when done
     */
    function processIncrementally(items, processFunc, batchSize = 10, interval = 16, onComplete = null) {
        if (!items || !items.length) {
            if (onComplete) onComplete();
            return;
        }
        
        const totalItems = items.length;
        let processedCount = 0;
        
        function processBatch() {
            const start = processedCount;
            const end = Math.min(processedCount + batchSize, totalItems);
            
            // Process batch
            for (let i = start; i < end; i++) {
                processFunc(items[i], i, items);
            }
            
            processedCount = end;
            
            // Continue or complete
            if (processedCount < totalItems) {
                setTimeout(processBatch, interval);
            } else if (onComplete) {
                onComplete();
            }
        }
        
        // Start processing
        processBatch();
    }
    
    /**
     * Create an efficient pooled object factory
     * @param {Function} createFunc - Function to create a new object
     * @param {Function} resetFunc - Function to reset an object for reuse
     * @param {number} initialSize - Initial pool size
     * @returns {Object} Object factory with get and release methods
     */
    function createObjectPool(createFunc, resetFunc, initialSize = 0) {
        const pool = [];
        
        // Initialize pool
        for (let i = 0; i < initialSize; i++) {
            pool.push(createFunc());
        }
        
        return {
            /**
             * Get an object from the pool or create a new one
             */
            get() {
                if (pool.length > 0) {
                    return pool.pop();
                } else {
                    return createFunc();
                }
            },
            
            /**
             * Return an object to the pool
             * @param {Object} obj - The object to return to the pool
             */
            release(obj) {
                resetFunc(obj);
                pool.push(obj);
            },
            
            /**
             * Get the current size of the pool
             */
            size() {
                return pool.length;
            },
            
            /**
             * Clear the pool
             */
            clear() {
                pool.length = 0;
            }
        };
    }
    
    /**
     * Prioritize tasks based on importance
     * @param {Array} tasks - Array of task objects with priority property
     * @param {Function} executeFunc - Function to execute a task
     * @param {number} maxConcurrent - Maximum concurrent tasks
     */
    function prioritizedTaskQueue(tasks, executeFunc, maxConcurrent = 2) {
        // Sort by priority (higher first)
        const sortedTasks = [...tasks].sort((a, b) => b.priority - a.priority);
        
        let running = 0;
        let nextIndex = 0;
        
        function runNextTask() {
            if (nextIndex >= sortedTasks.length || running >= maxConcurrent) {
                return;
            }
            
            running++;
            const task = sortedTasks[nextIndex++];
            
            // Execute task
            Promise.resolve(executeFunc(task))
                .finally(() => {
                    running--;
                    runNextTask();
                });
            
            // Try to start another task
            runNextTask();
        }
        
        // Start initial tasks
        for (let i = 0; i < maxConcurrent; i++) {
            runNextTask();
        }
    }
    
    // Public API
    return {
        throttle,
        debounce,
        startMonitoringFPS,
        stopMonitoringFPS,
        processIncrementally,
        createObjectPool,
        prioritizedTaskQueue,
        
        /**
         * Get current FPS
         * @returns {number} Current FPS
         */
        getFPS() {
            return _fps;
        },
        
        /**
         * Set FPS update interval
         * @param {number} interval - Update interval in ms
         */
        setFPSUpdateInterval(interval) {
            _fpsUpdateInterval = interval;
        }
    };
})();

// Export to window
window.Performance = Performance;

/**
 * js/performance.js - Advanced Performance Optimization Utilities
 * 
 * This module provides comprehensive utilities for improving performance in the 
 * Spatial Directory Explorer application:
 * - Efficient memory management and garbage collection
 * - Throttling and debouncing for event handling
 * - Frame rate monitoring and performance metrics
 * - Incremental data loading with progress tracking
 * - Task prioritization and scheduling
 * - Resource pooling
 */

const Performance = (function() {
    'use strict';
    
    // Performance monitoring state
    const metrics = {
        fps: {
            current: 60,
            min: 60,
            max: 60,
            history: [],
            historySize: 60 // Keep record of the last 60 frames (1 second at 60fps)
        },
        memory: {
            lastUsage: 0,
            measurements: []
        },
        renders: {
            count: 0,
            lastDuration: 0,
            totalDuration: 0,
            avgDuration: 0
        },
        events: {
            count: 0,
            throttled: 0,
            debounced: 0
        }
    };
    
    // Monitoring state
    let _lastTime = performance.now();
    let _frameCounter = 0;
    let _fpsUpdateInterval = 1000; // ms
    let _fpsCallback = null;
    let _rafId = null;
    let _isMonitoring = false;
    
    // Active tasks and callbacks
    const _activeTasks = new Map();
    const _objectPools = new Map();
    
    /**
     * Throttle a function to limit how often it can be called
     * @param {Function} func - The function to throttle
     * @param {number} limit - Minimum time between calls in ms
     * @param {boolean} trailingEdge - Whether to execute on the trailing edge
     * @returns {Function} Throttled function
     */
    function throttle(func, limit, trailingEdge = false) {
        let inThrottle = false;
        let lastArgs = null;
        let lastThis = null;
        let lastResult;
        let timeoutId = null;
        
        return function(...args) {
            // Track event metrics
            metrics.events.count++;
            
            if (!inThrottle) {
                inThrottle = true;
                lastResult = func.apply(this, args);
                lastArgs = null;
                lastThis = null;
                
                setTimeout(() => {
                    inThrottle = false;
                    
                    // Execute on trailing edge if enabled and there were calls during throttle
                    if (trailingEdge && lastArgs) {
                        func.apply(lastThis, lastArgs);
                        lastArgs = null;
                        lastThis = null;
                    }
                }, limit);
            } else {
                // Track throttled events
                metrics.events.throttled++;
                
                // Save last call arguments
                lastArgs = args;
                lastThis = this;
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
        let previousArgs;
        
        return function(...args) {
            // Track event metrics
            metrics.events.count++;
            
            const context = this;
            const callNow = immediate && !timeout;
            
            const later = function() {
                timeout = null;
                if (!immediate) {
                    func.apply(context, previousArgs);
                    previousArgs = null;
                }
            };
            
            if (timeout) {
                // Track debounced events
                metrics.events.debounced++;
            }
            
            clearTimeout(timeout);
            previousArgs = args;
            timeout = setTimeout(later, wait);
            
            if (callNow) {
                return func.apply(context, args);
            }
        };
    }
    
    /**
     * Throttle a function on requestAnimationFrame for smooth animations
     * @param {Function} func - The function to throttle
     * @returns {Function} RAF-throttled function
     */
    function rafThrottle(func) {
        let queued = false;
        let lastArgs = null;
        let lastThis = null;
        
        return function(...args) {
            // Keep track of latest call arguments
            lastArgs = args;
            lastThis = this;
            
            if (!queued) {
                queued = true;
                
                requestAnimationFrame(() => {
                    queued = false;
                    func.apply(lastThis, lastArgs);
                });
            }
        };
    }
    
    /**
     * Monitor frame rate and gather performance metrics
     * @param {Function} callback - Function to call with FPS updates
     * @param {Object} options - Monitoring options
     */
    function startMonitoring(callback, options = {}) {
        if (_isMonitoring) return;
        
        _fpsCallback = callback;
        _isMonitoring = true;
        _lastTime = performance.now();
        _frameCounter = 0;
        
        // Update options
        if (options.fpsUpdateInterval) {
            _fpsUpdateInterval = options.fpsUpdateInterval;
        }
        
        // Reset metrics
        metrics.fps.history = [];
        metrics.memory.measurements = [];
        
        // Start the monitoring loop
        monitorFrameRate();
        
        // If performance.memory is available (Chrome), monitor memory usage
        if (performance.memory) {
            monitorMemory();
        }
        
        console.log('Performance monitoring started');
    }
    
    /**
     * Stop monitoring frame rate
     */
    function stopMonitoring() {
        if (!_isMonitoring) return;
        
        _isMonitoring = false;
        
        if (_rafId) {
            cancelAnimationFrame(_rafId);
            _rafId = null;
        }
        
        // Clear all monitoring intervals
        clearAllTasks();
        
        console.log('Performance monitoring stopped');
    }
    
    /**
     * Internal function to monitor frame rate
     */
    function monitorFrameRate() {
        _frameCounter++;
        const currentTime = performance.now();
        const elapsed = currentTime - _lastTime;
        
        if (elapsed >= _fpsUpdateInterval) {
            const currentFps = Math.round((_frameCounter * 1000) / elapsed);
            metrics.fps.current = currentFps;
            
            // Update min/max
            metrics.fps.min = Math.min(metrics.fps.min, currentFps);
            metrics.fps.max = Math.max(metrics.fps.max, currentFps);
            
            // Add to history, maintaining historySize
            metrics.fps.history.push(currentFps);
            if (metrics.fps.history.length > metrics.fps.historySize) {
                metrics.fps.history.shift();
            }
            
            _lastTime = currentTime;
            _frameCounter = 0;
            
            if (_fpsCallback) {
                _fpsCallback({
                    fps: metrics.fps.current,
                    min: metrics.fps.min,
                    max: metrics.fps.max,
                    avg: calculateAverageFps()
                });
            }
        }
        
        _rafId = requestAnimationFrame(monitorFrameRate);
    }
    
    /**
     * Monitor memory usage if available
     */
    function monitorMemory() {
        if (!performance.memory) return;
        
        const memoryTask = setInterval(() => {
            if (!_isMonitoring) {
                clearInterval(memoryTask);
                return;
            }
            
            const memoryInfo = {
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
                timestamp: performance.now()
            };
            
            // Calculate memory usage change
            if (metrics.memory.lastUsage > 0) {
                memoryInfo.change = memoryInfo.usedJSHeapSize - metrics.memory.lastUsage;
            } else {
                memoryInfo.change = 0;
            }
            
            metrics.memory.lastUsage = memoryInfo.usedJSHeapSize;
            metrics.memory.measurements.push(memoryInfo);
            
            // Keep only the last 20 measurements
            if (metrics.memory.measurements.length > 20) {
                metrics.memory.measurements.shift();
            }
        }, 2000);
        
        // Store task reference for cleanup
        _activeTasks.set('memoryMonitor', memoryTask);
    }
    
    /**
     * Calculate average FPS from history
     * @returns {number} Average FPS
     */
    function calculateAverageFps() {
        if (metrics.fps.history.length === 0) return metrics.fps.current;
        
        const sum = metrics.fps.history.reduce((a, b) => a + b, 0);
        return Math.round(sum / metrics.fps.history.length);
    }
    
    /**
     * Clear all active tasks (intervals, timeouts)
     */
    function clearAllTasks() {
        _activeTasks.forEach((taskId, taskName) => {
            if (typeof taskId === 'number') {
                clearInterval(taskId);
                clearTimeout(taskId);
            }
        });
        
        _activeTasks.clear();
    }
    
    /**
     * Track a render operation performance
     * @param {Function} renderFunc - The render function to track
     * @returns {Function} Wrapped render function with tracking
     */
    function trackRender(renderFunc) {
        return function(...args) {
            const startTime = performance.now();
            
            try {
                const result = renderFunc.apply(this, args);
                const endTime = performance.now();
                const duration = endTime - startTime;
                
                // Update render metrics
                metrics.renders.count++;
                metrics.renders.lastDuration = duration;
                metrics.renders.totalDuration += duration;
                metrics.renders.avgDuration = metrics.renders.totalDuration / metrics.renders.count;
                
                return result;
            } catch (error) {
                console.error('Error in tracked render:', error);
                throw error;
            }
        };
    }
    
    /**
     * Load data incrementally with progress tracking
     * @param {Array} items - Items to process
     * @param {Function} processFunc - Function to process each item
     * @param {Object} options - Processing options
     * @returns {Promise} Promise resolving when complete
     */
    function processIncrementally(items, processFunc, options = {}) {
        // Default options
        const settings = {
            batchSize: 10,
            interval: 16,
            onProgress: null,
            priority: 'normal',
            key: 'incr-' + Date.now()
        };
        
        // Apply user options
        Object.assign(settings, options);
        
        return new Promise((resolve, reject) => {
            if (!items || !items.length) {
                resolve();
                return;
            }
            
            const totalItems = items.length;
            let processedCount = 0;
            let cancelled = false;
            
            // Time tracking
            const startTime = performance.now();
            
            function processBatch() {
                if (cancelled) return;
                
                const start = processedCount;
                const end = Math.min(processedCount + settings.batchSize, totalItems);
                
                try {
                    // Process batch
                    for (let i = start; i < end; i++) {
                        processFunc(items[i], i, items);
                    }
                    
                    processedCount = end;
                    
                    // Call progress callback if provided
                    if (settings.onProgress) {
                        const progress = {
                            processed: processedCount,
                            total: totalItems,
                            percent: Math.floor((processedCount / totalItems) * 100),
                            elapsed: performance.now() - startTime
                        };
                        
                        settings.onProgress(progress);
                    }
                    
                    // Continue or complete
                    if (processedCount < totalItems) {
                        const timeoutId = setTimeout(processBatch, settings.interval);
                        _activeTasks.set(settings.key, timeoutId);
                    } else {
                        _activeTasks.delete(settings.key);
                        resolve();
                    }
                } catch (error) {
                    _activeTasks.delete(settings.key);
                    reject(error);
                }
            }
            
            // Start processing
            processBatch();
        });
    }
    
    /**
     * Cancel an incremental processing task
     * @param {string} key - The task identifier
     */
    function cancelProcess(key) {
        if (_activeTasks.has(key)) {
            const taskId = _activeTasks.get(key);
            clearTimeout(taskId);
            _activeTasks.delete(key);
            console.log(`Cancelled process: ${key}`);
        }
    }
    
    /**
     * Create an efficient pooled object factory
     * @param {string} poolName - Name for this object pool
     * @param {Function} createFunc - Function to create a new object
     * @param {Function} resetFunc - Function to reset an object for reuse
     * @param {Object} options - Pool options
     * @returns {Object} Object factory with get and release methods
     */
    function createObjectPool(poolName, createFunc, resetFunc, options = {}) {
        // Default options
        const settings = {
            initialSize: 0,
            maxSize: 100,
            growthRate: 5,
            debug: false
        };
        
        // Apply user options
        Object.assign(settings, options);
        
        // Create the pool
        const pool = [];
        
        // Initialize pool
        for (let i = 0; i < settings.initialSize; i++) {
            try {
                pool.push(createFunc());
            } catch (error) {
                console.error(`Error creating pool object: ${error.message}`);
            }
        }
        
        const objectPool = {
            /**
             * Get an object from the pool or create a new one
             * @returns {Object} Object from pool or newly created
             */
            get() {
                if (pool.length > 0) {
                    return pool.pop();
                } else {
                    // Create a batch for efficiency when pool is empty
                    if (settings.debug) {
                        console.log(`${poolName}: Creating ${settings.growthRate} new objects (pool empty)`);
                    }
                    
                    // Create at growth rate
                    const newItems = Math.min(settings.growthRate, settings.maxSize - pool.length);
                    for (let i = 0; i < newItems - 1; i++) {
                        try {
                            pool.push(createFunc());
                        } catch (error) {
                            console.error(`Error creating object in pool ${poolName}: ${error.message}`);
                        }
                    }
                    
                    return createFunc();
                }
            },
            
            /**
             * Return an object to the pool
             * @param {Object} obj - The object to return to the pool
             */
            release(obj) {
                if (!obj) return;
                
                try {
                    resetFunc(obj);
                    
                    // Only add to pool if under max size
                    if (pool.length < settings.maxSize) {
                        pool.push(obj);
                    }
                } catch (error) {
                    console.error(`Error resetting object in pool ${poolName}: ${error.message}`);
                }
            },
            
            /**
             * Get the current size of the pool
             * @returns {number} Current pool size
             */
            size() {
                return pool.length;
            },
            
            /**
             * Clear the pool
             */
            clear() {
                pool.length = 0;
                if (settings.debug) {
                    console.log(`${poolName}: Pool cleared`);
                }
            },
            
            /**
             * Prewarm the pool to a specific size
             * @param {number} size - Size to warm up to
             */
            prewarm(size) {
                const targetSize = Math.min(size, settings.maxSize);
                const itemsToCreate = targetSize - pool.length;
                
                if (itemsToCreate <= 0) return;
                
                if (settings.debug) {
                    console.log(`${poolName}: Prewarming pool with ${itemsToCreate} items`);
                }
                
                for (let i = 0; i < itemsToCreate; i++) {
                    try {
                        pool.push(createFunc());
                    } catch (error) {
                        console.error(`Error during pool prewarm: ${error.message}`);
                        break;
                    }
                }
            }
        };
        
        // Store in registry
        _objectPools.set(poolName, objectPool);
        
        return objectPool;
    }
    
    /**
     * Get an object pool by name
     * @param {string} poolName - Name of the pool
     * @returns {Object|null} The object pool or null if not found
     */
    function getObjectPool(poolName) {
        return _objectPools.get(poolName) || null;
    }
    
    /**
     * Prioritize tasks based on importance
     * @param {Array} tasks - Array of task objects with priority property
     * @param {Function} executeFunc - Function to execute a task
     * @param {Object} options - Execution options
     * @returns {Promise} Promise resolving when all tasks complete
     */
    function prioritizedTaskQueue(tasks, executeFunc, options = {}) {
        // Default options
        const settings = {
            maxConcurrent: 2,
            delayBetweenTasks: 0,
            onProgress: null
        };
        
        // Apply user options
        Object.assign(settings, options);
        
        return new Promise((resolve) => {
            // Sort by priority (higher first)
            const sortedTasks = [...tasks].sort((a, b) => {
                // First by priority (high to low)
                const priorityDiff = (b.priority || 0) - (a.priority || 0);
                if (priorityDiff !== 0) return priorityDiff;
                
                // Then by index (low to high) to maintain stable order
                return (a.index || 0) - (b.index || 0);
            });
            
            let running = 0;
            let completed = 0;
            let nextIndex = 0;
            const results = [];
            
            function runNextTask() {
                if (nextIndex >= sortedTasks.length) {
                    // No more tasks to start
                    if (running === 0) {
                        // All tasks completed
                        resolve(results);
                    }
                    return;
                }
                
                if (running >= settings.maxConcurrent) {
                    // At max concurrent tasks
                    return;
                }
                
                running++;
                const taskIndex = nextIndex++;
                const task = sortedTasks[taskIndex];
                
                // Execute task with delay if specified
                const runTask = () => {
                    Promise.resolve(executeFunc(task, taskIndex))
                        .then(result => {
                            // Store result
                            results[taskIndex] = result;
                            
                            // Update counters
                            running--;
                            completed++;
                            
                            // Report progress
                            if (settings.onProgress) {
                                settings.onProgress({
                                    completed,
                                    total: sortedTasks.length,
                                    percent: Math.floor((completed / sortedTasks.length) * 100)
                                });
                            }
                            
                            // Try to start more tasks
                            runNextTask();
                        })
                        .catch(error => {
                            console.error('Error executing task:', error);
                            
                            // Update counters
                            running--;
                            completed++;
                            
                            // Try to start more tasks
                            runNextTask();
                        });
                };
                
                if (settings.delayBetweenTasks > 0) {
                    setTimeout(runTask, settings.delayBetweenTasks);
                } else {
                    runTask();
                }
                
                // Try to start another task
                runNextTask();
            }
            
            // Start initial tasks up to maxConcurrent
            for (let i = 0; i < settings.maxConcurrent; i++) {
                runNextTask();
            }
            
            // Handle empty tasks array
            if (sortedTasks.length === 0) {
                resolve([]);
            }
        });
    }
    
    /**
     * Schedule a function to run at a specific time or after a delay
     * @param {Function} func - Function to schedule
     * @param {Object} options - Schedule options
     * @returns {Object} Control object with cancel method
     */
    function scheduleTask(func, options = {}) {
        const settings = {
            delay: 0,               // Delay in ms
            time: null,             // Specific time to run (Date object)
            repeat: false,          // Whether to repeat
            interval: 1000,         // Repeat interval in ms
            key: 'task-' + Date.now()
        };
        
        Object.assign(settings, options);
        
        let timeoutId;
        let intervalId;
        
        function executeTask() {
            try {
                func();
                
                if (settings.repeat) {
                    intervalId = setInterval(func, settings.interval);
                    _activeTasks.set(settings.key + '-interval', intervalId);
                }
            } catch (error) {
                console.error('Error in scheduled task:', error);
            }
        }
        
        // Schedule based on options
        if (settings.time instanceof Date) {
            const now = new Date();
            const timeToRun = settings.time.getTime() - now.getTime();
            
            if (timeToRun <= 0) {
                // Run immediately if the time has passed
                executeTask();
            } else {
                timeoutId = setTimeout(executeTask, timeToRun);
                _activeTasks.set(settings.key, timeoutId);
            }
        } else {
            timeoutId = setTimeout(executeTask, settings.delay);
            _activeTasks.set(settings.key, timeoutId);
        }
        
        // Return control object
        return {
            cancel() {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    _activeTasks.delete(settings.key);
                }
                
                if (intervalId) {
                    clearInterval(intervalId);
                    _activeTasks.delete(settings.key + '-interval');
                }
            },
            key: settings.key
        };
    }
    
    /**
     * Efficiently batch DOM operations to minimize layout thrashing
     */
    const domBatch = {
        reads: [],
        writes: [],
        scheduled: false,
        
        /**
         * Schedule a DOM read operation
         * @param {Function} readFunc - Function that reads from the DOM
         * @returns {Promise} Promise resolving with the read result
         */
        read(readFunc) {
            return new Promise(resolve => {
                this.reads.push(() => {
                    const result = readFunc();
                    resolve(result);
                    return result;
                });
                this.schedule();
            });
        },
        
        /**
         * Schedule a DOM write operation
         * @param {Function} writeFunc - Function that writes to the DOM
         * @returns {Promise} Promise resolving when the write completes
         */
        write(writeFunc) {
            return new Promise(resolve => {
                this.writes.push(() => {
                    const result = writeFunc();
                    resolve(result);
                    return result;
                });
                this.schedule();
            });
        },
        
        /**
         * Schedule the batch to process on next animation frame
         */
        schedule() {
            if (this.scheduled) return;
            
            this.scheduled = true;
            requestAnimationFrame(() => this.process());
        },
        
        /**
         * Process all batched operations
         */
        process() {
            // First do all reads
            const results = this.reads.map(read => read());
            
            // Then do all writes
            this.writes.forEach(write => write());
            
            // Reset batch state
            this.reads = [];
            this.writes = [];
            this.scheduled = false;
        }
    };
    
    /**
     * Wrapper for requestIdleCallback with fallback
     * @param {Function} callback - Function to execute during idle time
     * @param {Object} options - Options for idle callback
     * @returns {number} Callback ID
     */
    function requestIdleTask(callback, options = {}) {
        if ('requestIdleCallback' in window) {
            return window.requestIdleCallback(callback, options);
        } else {
            // Fallback to setTimeout with a reasonable delay
            return setTimeout(() => {
                const deadline = {
                    didTimeout: false,
                    timeRemaining: () => 50
                };
                callback(deadline);
            }, options.timeout || 50);
        }
    }
    
    /**
     * Cancel an idle callback
     * @param {number} id - The callback ID
     */
    function cancelIdleTask(id) {
        if ('cancelIdleCallback' in window) {
            window.cancelIdleCallback(id);
        } else {
            clearTimeout(id);
        }
    }
    
    // Public API
    return {
        // Core utilities
        throttle,
        debounce,
        rafThrottle,
        
        // Performance monitoring
        startMonitoring,
        stopMonitoring,
        getMetrics: () => ({ ...metrics }),
        getFPS: () => metrics.fps.current,
        
        // Task management
        processIncrementally,
        cancelProcess,
        prioritizedTaskQueue,
        scheduleTask,
        
        // Object pooling
        createObjectPool,
        getObjectPool,
        
        // DOM optimization
        domBatch,
        trackRender,
        
        // Idle scheduling
        requestIdleTask,
        cancelIdleTask,
        
        /**
         * Check if browser tab is visible
         * @returns {boolean} True if page is visible
         */
        isPageVisible: () => document.visibilityState === 'visible',
        
        /**
         * Set FPS update interval
         * @param {number} interval - Update interval in ms
         */
        setFPSUpdateInterval(interval) {
            _fpsUpdateInterval = interval;
        },
        
        /**
         * Clear all memory and resources used by the module
         */
        dispose() {
            stopMonitoring();
            clearAllTasks();
            
            // Clear all object pools
            _objectPools.forEach(pool => pool.clear());
            _objectPools.clear();
            
            console.log('Performance module disposed');
        }
    };
})();

// Export to window
window.Performance = Performance;

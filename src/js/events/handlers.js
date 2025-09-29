/**
 * Event Handlers for FogLAMP DataLink
 * Centralized event handling and user interaction management
 */

import { elements } from '../ui/elements.js';
import { normalizeBaseUrl, addInstance, getInstances } from '../core/storage.js';
import { INSTANCE_STATUS } from '../core/config.js';
import { logMessage } from '../ui/console.js';

/**
 * Event Handler Manager Class
 * Manages all user interface events and interactions
 */
export class EventHandlerManager {
    
    constructor() {
        this.eventListeners = new Map(); // Track registered event listeners
        this.addInstanceTimeout = null; // Debounce timeout for add instance
        this.updateConnectionsInProgress = false; // Prevent multiple simultaneous updates
    }

    /**
     * Initialize the event handler manager
     * Called during system startup to setup event listeners
     */
    initialize() {
        logMessage('info', 'Initializing event handler manager');
        
        // Setup all event listeners
        this.setupEventListeners();
        
        logMessage('info', 'Event handler manager initialized');
    }

    /**
     * Handle adaptive Add button click with validation flow
     */
    async handleAddInstance() {
        const baseUrlInput = elements.baseUrl();
        if (!baseUrlInput) return;

        const baseUrl = baseUrlInput.value.trim();
        const url = normalizeBaseUrl(baseUrl);

        if (!url) {
            this.showAddFeedback("Please enter a valid URL", "error");
            return;
        }

        // Check if instance already exists
        const existingInstances = getInstances();
        if (existingInstances.includes(url)) {
            this.showAddFeedback("Instance already registered", "warning");
            return;
        }

        logMessage('info', 'Adding new instance', { url });

        // Show checking state
        this.showAddFeedback("Checking...", "checking");
        this.hideAddActions();

        try {
            // Ping the URL for validation
            const pingResult = await this.pingUrlForValidation(url, 8000);
            
            if (pingResult.ok) {
                // Success - show Add/Skip options
                this.showAddFeedback("✅ Ping successful! Instance is reachable", "success");
                this.toggleAddActions(true, url, pingResult);
                
                logMessage('info', 'Instance validation successful', { 
                    url, 
                    hostName: pingResult.hostName,
                    status: pingResult.status
                });
            } else {
                // Failed - still show Add/Skip options
                this.showAddFeedback("❌ Ping failed - Instance may be unreachable", "error");
                this.toggleAddActions(true, url, pingResult);
                
                logMessage('warn', 'Instance validation failed', { 
                    url, 
                    error: pingResult.error 
                });
            }

        } catch (error) {
            this.showAddFeedback("❌ Connection error", "error");
            this.toggleAddActions(true, url, { ok: false, error: error.message });
            
            logMessage('error', 'Instance validation error', { 
                url, 
                error: error.message 
            });
        }
    }

    /**
     * Handle update connections - comprehensive connection management
     * Combines smart refresh with full reset when needed
     */
    async handleUpdateConnections() {
        if (this.updateConnectionsInProgress) {
            logMessage('info', 'Update connections already in progress, skipping');
            return;
        }

        this.updateConnectionsInProgress = true;

        try {
            const instances = getInstances();
            
            if (instances.length === 0) {
                logMessage('info', 'Update connections: no instances to check');
                return;
            }

            logMessage('info', `🔄 Updating connections for ${instances.length} instances...`);

            // Phase 1: Smart Manager Reset & Re-discovery
            if (window.smartManager) {
                try {
                    logMessage('info', '🔄 Phase 1: Resetting connection state...');
                    
                    // Reset proxy state to force fresh detection
                    window.smartManager.proxyAvailable = false;
                    
                    // Re-detect environment (Desktop vs Web)
                    const oldEnvironment = window.smartManager.environment;
                    window.smartManager.environment = window.smartManager.detectEnvironment();
                    const environmentChanged = oldEnvironment !== window.smartManager.environment;
                    
                    if (environmentChanged) {
                        logMessage('info', `Environment changed: ${oldEnvironment} → ${window.smartManager.environment}`);
                    }
                    
                    // Re-check proxy availability
                    await window.smartManager.checkProxyAvailability();
                    
                    // Force complete instance re-discovery
                    await window.smartManager.discoverInstances();
                    
                    logMessage('info', '✅ Connection state reset completed', {
                        environment: window.smartManager.environment,
                        proxy: window.smartManager.proxyAvailable,
                        environmentChanged
                    });
                } catch (error) {
                    logMessage('warn', 'Smart manager reset failed, continuing with basic refresh', { 
                        error: error.message 
                    });
                }
            }

            // Phase 2: Comprehensive Instance Ping
            logMessage('info', '🔄 Phase 2: Testing all instance connectivity...');
            
            const pingPromises = instances.map(url => 
                this.pingInstanceSafely(url).catch(error => ({
                    url,
                    success: false,
                    error: error.message
                }))
            );

            const results = await Promise.allSettled(pingPromises);
            
            // Process and analyze results
            let successful = 0;
            let failed = 0;
            const resultDetails = [];

            results.forEach((result, index) => {
                const url = instances[index];
                
                if (result.status === 'fulfilled') {
                    const pingResult = result.value;
                    if (pingResult && pingResult.success !== false) {
                        successful++;
                        resultDetails.push({
                            url,
                            status: 'success', 
                            pingMs: pingResult.pingMs,
                            hostName: pingResult.hostName
                        });
                        logMessage('info', `✅ Instance reachable: ${url}`, { 
                            pingMs: pingResult.pingMs,
                            hostName: pingResult.hostName 
                        });
                    } else {
                        failed++;
                        resultDetails.push({
                            url,
                            status: 'failed',
                            error: pingResult?.error
                        });
                        logMessage('warn', `❌ Instance unreachable: ${url}`, { 
                            error: pingResult?.error 
                        });
                    }
                } else {
                    failed++;
                    resultDetails.push({
                        url,
                        status: 'error',
                        error: result.reason?.message
                    });
                    logMessage('error', `⚠️ Instance error: ${url}`, { 
                        error: result.reason?.message 
                    });
                }
            });

            // Phase 3: Status Synchronization
            logMessage('info', '🔄 Phase 3: Synchronizing system state...');
            
            // Sync with smart manager to ensure consistency
            if (window.syncFromSmartManager) {
                try {
                    window.syncFromSmartManager();
                    logMessage('info', '✅ Smart manager synchronization completed');
                } catch (error) {
                    logMessage('warn', 'Smart manager sync failed', { error: error.message });
                }
            }

            // Phase 4: UI Updates
            logMessage('info', '🔄 Phase 4: Updating user interface...');
            
            this.updateUIAfterRefresh();

            // Refresh asset list for active instance
            if (window.refreshAssetListForActiveInstance) {
                try {
                    await window.refreshAssetListForActiveInstance();
                    logMessage('info', '✅ Asset list refreshed');
                } catch (error) {
                    logMessage('warn', 'Asset list refresh failed', { error: error.message });
                }
            }

            // Final Summary
            const summary = {
                total: instances.length,
                successful,
                failed,
                successRate: Math.round((successful / instances.length) * 100)
            };

            logMessage('info', '🎉 Connection update completed!', summary);
            
            if (successful === instances.length) {
                logMessage('info', '✅ All instances are reachable and healthy');
            } else if (successful > 0) {
                logMessage('warn', `⚠️ ${failed} instance(s) unreachable - check network or instance status`);
            } else {
                logMessage('error', '❌ No instances reachable - check network connection and instance URLs');
            }

        } catch (error) {
            logMessage('error', 'Connection update failed', { error: error.message });
        } finally {
            this.updateConnectionsInProgress = false;
        }
    }

    /**
     * Handle summary button click - get active instance details
     */
    async handleGetSummary() {
        const activeInstance = window.getActiveInstanceWithMeta ? window.getActiveInstanceWithMeta() : null;
        const summaryElement = elements.summary();
        
        if (!activeInstance) {
            if (summaryElement) {
                this.updateSummaryDisplay(summaryElement, { error: "No active instance selected" });
            }
            logMessage('warn', 'Get Summary: No active instance');
            return;
        }

        try {
            logMessage('info', 'Fetching active instance details...', { 
                instance: window.getDisplayName ? window.getDisplayName(activeInstance) : activeInstance.url 
            });

            // Show loading state
            if (summaryElement) {
                this.updateSummaryDisplay(summaryElement, "Loading instance details...");
            }

            // Fetch comprehensive data
            const [ping, stats, assets] = await Promise.allSettled([
                this.fetchPingData(),
                this.fetchStatisticsData(), 
                this.fetchAssetsData()
            ]);

            // Prepare summary data
            const summary = {
                instance: {
                    name: window.getDisplayName ? window.getDisplayName(activeInstance) : 'Unknown',
                    url: activeInstance.url,
                    timestamp: new Date().toISOString()
                },
                ping: this.formatPromiseResult(ping),
                statistics: this.formatPromiseResult(stats),
                assets: this.formatPromiseResult(assets)
            };

            // Display in summary area
            if (summaryElement) {
                this.updateSummaryDisplay(summaryElement, summary);
            }

            logMessage('info', 'Instance details retrieved successfully');

        } catch (error) {
            const errorSummary = { error: `Failed to get instance details: ${error.message}` };
            
            if (summaryElement) {
                this.updateSummaryDisplay(summaryElement, errorSummary);
            }
            
            logMessage('error', 'Get Summary failed', { error: error.message });
        }
    }

    /**
     * Setup all event listeners for the enhanced UI
     */
    setupEventListeners() {
        this.clearEventListeners(); // Clear any existing listeners

        // Add Instance (Adaptive flow)
        this.addEventListenerSafely('register', 'click', () => this.handleAddInstance());

        // Update Connections (Merged refresh + reset)
        this.addEventListenerSafely('updateConnections', 'click', () => this.handleUpdateConnections());

        // Check Summary
        this.addEventListenerSafely('checkSummary', 'click', () => this.handleGetSummary());

        // Export Status
        this.addEventListenerSafely('writeStatus', 'click', () => {
            if (window.handleExportStatus) {
                window.handleExportStatus();
            } else {
                logMessage('error', 'Export Status function not available');
            }
        });

        // Export Asset Readings
        this.addEventListenerSafely('getReadings', 'click', () => {
            if (window.handleExportReadings) {
                window.handleExportReadings();
            } else {
                logMessage('error', 'Export Readings function not available');
            }
        });

        // Clear Console
        this.addEventListenerSafely('clear-console', 'click', () => {
            if (window.clearConsole) {
                window.clearConsole();
            }
        }, true); // Use document.getElementById for this one

        logMessage('info', 'Event listeners configured', { 
            count: this.eventListeners.size 
        });
    }

    /**
     * Safely add event listener with error handling and tracking
     * @param {string} elementId - Element ID or elements property name
     * @param {string} event - Event type (click, change, etc.)
     * @param {Function} handler - Event handler function
     * @param {boolean} useGetElementById - Use document.getElementById instead of elements
     */
    addEventListenerSafely(elementId, event, handler, useGetElementById = false) {
        try {
            let element;
            
            if (useGetElementById) {
                element = document.getElementById(elementId);
            } else {
                const elementFunc = elements[elementId];
                element = elementFunc ? elementFunc() : null;
            }

            if (element) {
                const wrappedHandler = (e) => {
                    try {
                        handler(e);
                    } catch (error) {
                        logMessage('error', `Event handler error for ${elementId}`, { 
                            event,
                            error: error.message 
                        });
                    }
                };

                element.addEventListener(event, wrappedHandler);
                
                // Track for cleanup
                const listenerKey = `${elementId}_${event}`;
                this.eventListeners.set(listenerKey, {
                    element,
                    event,
                    handler: wrappedHandler
                });

            } else {
                console.warn(`Element not found for event listener: ${elementId}`);
            }
        } catch (error) {
            logMessage('error', `Failed to add event listener for ${elementId}`, { 
                error: error.message 
            });
        }
    }

    /**
     * Clear all registered event listeners
     */
    clearEventListeners() {
        this.eventListeners.forEach((listener, key) => {
            try {
                listener.element.removeEventListener(listener.event, listener.handler);
            } catch (error) {
                console.warn(`Failed to remove event listener: ${key}`, error);
            }
        });
        
        this.eventListeners.clear();
        logMessage('info', 'Event listeners cleared');
    }

    /**
     * Show add feedback with styling
     * @param {string} message - Feedback message
     * @param {string} type - Message type (success, error, warning, checking)
     */
    showAddFeedback(message, type) {
        const feedback = elements.addFeedback();
        if (feedback) {
            feedback.textContent = message;
            feedback.className = `add-feedback ${type}`;
            feedback.style.display = 'block';
        }
    }

    /**
     * Hide add feedback
     */
    hideAddFeedback() {
        const feedback = elements.addFeedback();
        if (feedback) {
            feedback.style.display = 'none';
        }
    }

    /**
     * Toggle add action buttons visibility
     * @param {boolean} show - Whether to show actions
     * @param {string} url - Instance URL
     * @param {Object} pingResult - Ping result data
     */
    toggleAddActions(show, url, pingResult) {
        const actions = elements.addActions();
        const addBtn = elements.addConfirm();
        const skipBtn = elements.addSkip();

        if (!actions) return;

        if (show) {
            actions.style.display = 'flex';
            
            // Wire up Add button
            if (addBtn) {
                addBtn.onclick = () => this.confirmAddInstance(url, pingResult);
            }
            
            // Wire up Skip button  
            if (skipBtn) {
                skipBtn.onclick = () => this.skipAddInstance();
            }
        } else {
            actions.style.display = 'none';
        }
    }

    /**
     * Hide add actions
     */
    hideAddActions() {
        this.toggleAddActions(false);
    }

    /**
     * Confirm adding instance with metadata
     * @param {string} url - Instance URL to add
     * @param {Object} pingResult - Ping result with metadata
     */
    confirmAddInstance(url, pingResult) {
        const hostName = pingResult.hostName || pingResult.data?.hostName || '';
        const status = pingResult.ok ? INSTANCE_STATUS.SUCCESS : INSTANCE_STATUS.FAILED;

        const added = addInstance(url, {
            name: '', // User can edit this later
            hostName: hostName,
            lastStatus: status,
            lastPingMs: pingResult.ok ? pingResult.pingMs : null,
            lastCheckedAt: new Date().toISOString()
        });

        if (added) {
            logMessage('info', 'Instance added successfully', { 
                url, 
                hostName, 
                status 
            });

            // Clear the form
            const baseUrlInput = elements.baseUrl();
            if (baseUrlInput) {
                baseUrlInput.value = '';
            }

            this.hideAddFeedback();
            this.hideAddActions();

            // Update UI
            this.updateUIAfterInstanceAdd();
        } else {
            logMessage('error', 'Failed to add instance', { url });
        }
    }

    /**
     * Skip adding instance
     */
    skipAddInstance() {
        logMessage('info', 'Instance addition skipped by user');
        
        // Clear the form
        const baseUrlInput = elements.baseUrl();
        if (baseUrlInput) {
            baseUrlInput.value = '';
        }

        this.hideAddFeedback();
        this.hideAddActions();
    }

    /**
     * Safely ping instance with error handling
     * @param {string} url - Instance URL
     * @returns {Promise<Object>} Ping result
     */
    async pingInstanceSafely(url) {
        if (window.pingInstance) {
            return await window.pingInstance(url);
        } else if (window.instancePingManager) {
            return await window.instancePingManager.pingInstance(url);
        } else {
            throw new Error('Ping function not available');
        }
    }

    /**
     * Ping URL for validation with timeout
     * @param {string} url - URL to validate
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<Object>} Validation result
     */
    async pingUrlForValidation(url, timeout = 8000) {
        if (window.pingUrlForValidation) {
            return await window.pingUrlForValidation(url, timeout);
        } else if (window.instancePingManager) {
            return await window.instancePingManager.pingUrlForValidation(url, timeout);
        } else {
            // Fallback direct ping
            return await this.directPingValidation(url, timeout);
        }
    }

    /**
     * Direct ping validation fallback
     * @param {string} url - URL to ping
     * @param {number} timeout - Timeout in ms
     * @returns {Promise<Object>} Ping result
     */
    async directPingValidation(url, timeout) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(`${url}/foglamp/ping`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                return {
                    ok: true,
                    status: response.status,
                    hostName: data.hostName || data.serviceName || '',
                    data
                };
            } else {
                return {
                    ok: false,
                    status: response.status,
                    error: `HTTP ${response.status}`
                };
            }
        } catch (error) {
            clearTimeout(timeoutId);
            return {
                ok: false,
                error: error.message || 'Connection failed'
            };
        }
    }

    /**
     * Update UI components after refresh
     */
    updateUIAfterRefresh() {
        if (window.renderInstanceList) {
            window.renderInstanceList();
        }
        if (window.updateOverviewBadges) {
            window.updateOverviewBadges();
        }
    }

    /**
     * Update UI components after reset
     */
    updateUIAfterReset() {
        this.updateUIAfterRefresh();
    }

    /**
     * Update UI components after instance add
     */
    updateUIAfterInstanceAdd() {
        this.updateUIAfterRefresh();
        
        // Load assets for newly added active instance
        if (window.loadAssetsForActiveInstance) {
            window.loadAssetsForActiveInstance().catch(error => {
                logMessage('warn', 'Failed to load assets for new instance', { 
                    error: error.message 
                });
            });
        }
    }

    /**
     * Update summary display element
     * @param {HTMLElement} element - Summary element
     * @param {Object|string} data - Data to display
     */
    updateSummaryDisplay(element, data) {
        if (!element) return;
        
        try {
            if (typeof data === 'string') {
                element.textContent = data;
            } else {
                element.textContent = JSON.stringify(data, null, 2);
            }
        } catch (error) {
            element.textContent = String(data);
        }
    }

    /**
     * Format Promise.allSettled result for display
     * @param {Object} result - Promise settled result
     * @returns {Object|string} Formatted result
     */
    formatPromiseResult(result) {
        if (result.status === 'fulfilled') {
            return result.value;
        } else {
            return { error: result.reason?.message || 'Unknown error' };
        }
    }

    /**
     * Fetch ping data (shared with Excel integration)
     */
    async fetchPingData() {
        if (window.foglampPingSmart) {
            return await window.foglampPingSmart();
        } else if (window.smartManager) {
            return await window.smartManager.foglampPing();
        } else {
            throw new Error('Ping function not available');
        }
    }

    /**
     * Fetch statistics data (shared with Excel integration)
     */
    async fetchStatisticsData() {
        if (window.foglampStatisticsSmart) {
            return await window.foglampStatisticsSmart();
        } else if (window.smartManager) {
            return await window.smartManager.foglampStatistics();
        } else {
            throw new Error('Statistics function not available');
        }
    }

    /**
     * Fetch assets data (shared with Excel integration)
     */
    async fetchAssetsData() {
        if (window.foglampAssetsSmart) {
            return await window.foglampAssetsSmart();
        } else if (window.smartManager) {
            return await window.smartManager.foglampAssets();
        } else {
            throw new Error('Assets function not available');
        }
    }

    /**
     * Get event handler statistics
     * @returns {Object} Handler statistics
     */
    getHandlerStats() {
        return {
            registeredListeners: this.eventListeners.size,
            refreshInProgress: this.refreshStatusInProgress,
            resetInProgress: this.resetConnectionsInProgress,
            hasAddTimeout: !!this.addInstanceTimeout
        };
    }

    /**
     * Initialize event handler manager
     */
    initialize() {
        this.setupEventListeners();
        console.log('✅ Event handler system initialized');
    }

    /**
     * Cleanup when destroyed
     */
    destroy() {
        this.clearEventListeners();
        
        if (this.addInstanceTimeout) {
            clearTimeout(this.addInstanceTimeout);
            this.addInstanceTimeout = null;
        }
        
        console.log('Event handler manager destroyed');
    }
}

// Create singleton instance
export const eventHandlerManager = new EventHandlerManager();

// Export individual methods for backward compatibility
export const setupEventListeners = () => eventHandlerManager.setupEventListeners();
export const handleAddInstance = () => eventHandlerManager.handleAddInstance();
export const handleUpdateConnections = () => eventHandlerManager.handleUpdateConnections();

// Export singleton as default
export default eventHandlerManager;

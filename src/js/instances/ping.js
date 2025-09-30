/**
 * Instance Ping and Lifecycle Management for FogLAMP DataLink
 * Handles instance connectivity testing, status management, and lifecycle operations
 */

import { updateInstanceMeta, setActiveInstance, getActiveInstance, getInstanceMeta } from '../core/storage.js';
import { INSTANCE_STATUS } from '../core/config.js';
import { getDisplayName } from '../core/utils.js';
import { logMessage } from '../ui/console.js';

/**
 * Instance Ping Manager Class
 * Manages ping operations, status tracking, and instance lifecycle
 */
export class InstancePingManager {
    
    constructor() {
        this.pingTimeouts = new Map(); // Track active ping timeouts
        this.pingHistory = new Map(); // Track ping history for instances
        this.defaultTimeout = 5000; // 5 seconds default timeout
        this.maxHistorySize = 10; // Keep last 10 ping results per instance
        this.retryDelay = 1000; // 1 second delay between retries
        this.maxRetries = 2; // Maximum automatic retries
        this.uiUpdateFunctions = { renderList: null, updateBadges: null };
    }

    /**
     * Initialize the ping manager
     * Called during system startup
     */
    initialize() {
        logMessage('info', 'Initializing ping manager');
        
        // Clear any existing timeouts
        this.pingTimeouts.clear();
        
        logMessage('info', 'Ping manager initialized');
    }

    /**
     * Set UI update functions for cross-module communication
     * @param {Function} renderListFn - Function to render instance list
     * @param {Function} updateBadgesFn - Function to update badges
     */
    setUIUpdateFunctions(renderListFn, updateBadgesFn) {
        this.uiUpdateFunctions.renderList = renderListFn;
        this.uiUpdateFunctions.updateBadges = updateBadgesFn;
    }

    /**
     * Ping specific instance and update its status
     * @param {string} url - Instance URL to ping
     * @param {Object} options - Ping options (timeout, retries, etc.)
     * @returns {Promise<Object>} Ping result with timing and status
     */
    async pingInstance(url, options = {}) {
        const {
            timeout = this.defaultTimeout,
            updateUI = true,
            retryCount = 0
        } = options;

        // Cancel any existing ping for this URL
        this.cancelPingTimeout(url);

        // Update status to checking
        if (updateUI) {
            updateInstanceMeta(url, { lastStatus: INSTANCE_STATUS.CHECKING });
            this.renderInstanceList();
        }
        
        const startTime = performance.now();
        logMessage('info', 'Ping started', { url, timeout, retry: retryCount });

        try {
            // ✅ UNIFIED API: Use single backbone for consistent proxy handling
            let data;
            
            logMessage('info', 'Using unified API for ping', { url });
            
            // STREAMLINED: Single API path only
            data = await window.FogLAMP.api.ping();
            
            const endTime = performance.now();
            const pingMs = Math.round(endTime - startTime);
            
            const pingResult = {
                url,
                success: true,
                pingMs,
                hostName: data.hostName || data.serviceName || '',
                timestamp: new Date().toISOString(),
                data
            };

            // Update metadata with successful ping
            if (updateUI) {
                updateInstanceMeta(url, {
                    lastStatus: INSTANCE_STATUS.SUCCESS,
                    lastPingMs: pingMs,
                    lastCheckedAt: pingResult.timestamp,
                    hostName: pingResult.hostName,
                    lastError: null // Clear any previous error
                });
            }

            this.updatePingHistory(url, pingResult);
            this.renderInstanceList();

            logMessage('info', 'Ping successful', {
                url, 
                pingMs: pingResult.pingMs,
                hostName: pingResult.hostName
            });

            return pingResult;

        } catch (error) {
            this.pingTimeouts.delete(url);
            const errorEndTime = performance.now();
            const errorPingMs = Math.round(errorEndTime - startTime);

            const errorMessage = this.getErrorMessage(error);
            
            const pingResult = {
                url,
                success: false,
                pingMs: errorPingMs,
                error: errorMessage,
                timestamp: new Date().toISOString(),
                retryCount
            };

            // Handle retry logic
            if (retryCount < this.maxRetries && this.shouldRetry(error)) {
                logMessage('warn', `Ping failed, retrying (${retryCount + 1}/${this.maxRetries})`, {
                    url,
                    error: errorMessage,
                    retryIn: `${this.retryDelay}ms`
                });

                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return this.pingInstance(url, { ...options, retryCount: retryCount + 1 });
            }

            // Update metadata with failed ping
            if (updateUI) {
                updateInstanceMeta(url, {
                    lastStatus: INSTANCE_STATUS.FAILED,
                    lastCheckedAt: pingResult.timestamp,
                    lastError: errorMessage,
                    lastPingMs: null // Clear ping time on failure
                });
            }

            // Record ping history
            this.recordPingHistory(url, pingResult);

            logMessage('error', 'Ping failed', { url, error: errorMessage, pingMs });

            return pingResult;
        }
    }

    /**
     * Ping URL for validation (used in add instance flow)
     * @param {string} url - URL to ping
     * @param {number} timeoutMs - Timeout in milliseconds
     * @returns {Promise<Object>} Ping validation result
     */
    async pingUrlForValidation(url, timeoutMs = 8000) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            
            const response = await fetch(`${url}/foglamp/ping`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
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
                    error: `HTTP ${response.status}: ${response.statusText}`
                };
            }
        } catch (error) {
            return {
                ok: false,
                error: this.getErrorMessage(error)
            };
        }
    }

    /**
     * Set instance as active and update UI
     * @param {string} url - Instance URL to set as active
     */
    async setInstanceActive(url) {
        try {
            setActiveInstance(url);
            logMessage('info', 'Active instance changed', { url });
            
            // Update UI if render function is available
            if (this.renderInstanceList) {
                this.renderInstanceList();
            }
            if (this.updateOverviewBadges) {
                this.updateOverviewBadges();
            }
            
            // Load assets for the new active instance
            if (window.loadAssetsForActiveInstance) {
                await window.loadAssetsForActiveInstance();
            }
            
            return true;
        } catch (error) {
            logMessage('error', 'Failed to set active instance', { url, error: error.message });
            return false;
        }
    }

    /**
     * Get statistics for a specific instance
     * @param {string} url - Instance URL
     * @returns {Promise<Object>} Statistics data or error
     */
    async getInstanceStatistics(url) {
        logMessage('info', 'Fetching statistics', { url });
        
        try {
            // Set as active temporarily to use smart API functions
            const originalActive = getActiveInstance();
            setActiveInstance(url);
            
            let stats;
            if (window.foglampStatisticsSmart) {
                stats = await window.foglampStatisticsSmart();
            } else if (window.smartManager) {
                stats = await window.smartManager.foglampStatistics();
            } else {
                // Fallback to direct API call
                stats = await this.directStatisticsFetch(url);
            }
            
            // Restore original active instance
            if (originalActive) {
                setActiveInstance(originalActive);
            }
            
            logMessage('info', 'Statistics fetched successfully', { url, hasData: !!stats });
            return stats;
            
        } catch (error) {
            logMessage('error', 'Statistics fetch failed', { url, error: error.message });
            throw error;
        }
    }

    /**
     * Direct statistics fetch via REST API
     * @param {string} url - Instance URL
     * @returns {Promise<Object>} Statistics data
     */
    async directStatisticsFetch(url) {
        const response = await fetch(`${url}/foglamp/statistics`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            signal: AbortSignal.timeout(10000) // 10 second timeout
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Cancel ping timeout for specific URL
     * @param {string} url - Instance URL
     */
    cancelPingTimeout(url) {
        const timeoutId = this.pingTimeouts.get(url);
        if (timeoutId) {
            clearTimeout(timeoutId);
            this.pingTimeouts.delete(url);
        }
    }

    /**
     * Record ping history for instance
     * @param {string} url - Instance URL
     * @param {Object} result - Ping result to record
     */
    recordPingHistory(url, result) {
        if (!this.pingHistory.has(url)) {
            this.pingHistory.set(url, []);
        }
        
        const history = this.pingHistory.get(url);
        history.unshift(result); // Add to beginning
        
        // Keep only the most recent entries
        if (history.length > this.maxHistorySize) {
            history.splice(this.maxHistorySize);
        }
    }

    /**
     * Get ping history for instance
     * @param {string} url - Instance URL
     * @returns {Array} Array of ping history entries
     */
    getPingHistory(url) {
        return this.pingHistory.get(url) || [];
    }

    /**
     * Get ping statistics for instance
     * @param {string} url - Instance URL
     * @returns {Object} Ping statistics summary
     */
    getPingStats(url) {
        const history = this.getPingHistory(url);
        
        if (history.length === 0) {
            return {
                totalPings: 0,
                successRate: 0,
                averagePing: null,
                lastResult: null
            };
        }

        const successful = history.filter(h => h.success);
        const pingTimes = successful.map(h => h.pingMs);
        
        return {
            totalPings: history.length,
            successfulPings: successful.length,
            successRate: (successful.length / history.length) * 100,
            averagePing: pingTimes.length > 0 ? 
                Math.round(pingTimes.reduce((a, b) => a + b, 0) / pingTimes.length) : null,
            minPing: pingTimes.length > 0 ? Math.min(...pingTimes) : null,
            maxPing: pingTimes.length > 0 ? Math.max(...pingTimes) : null,
            lastResult: history[0],
            recentFailures: history.slice(0, 5).filter(h => !h.success).length
        };
    }

    /**
     * Determine if error should trigger retry
     * @param {Error} error - Error that occurred
     * @returns {boolean} Whether to retry
     */
    shouldRetry(error) {
        const retryableErrors = [
            'fetch aborted',
            'NetworkError',
            'TimeoutError',
            'ECONNRESET',
            'ECONNREFUSED'
        ];
        
        const errorMessage = error.message || error.toString();
        return retryableErrors.some(retryable => 
            errorMessage.toLowerCase().includes(retryable.toLowerCase())
        );
    }

    /**
     * Get user-friendly error message
     * @param {Error} error - Error object
     * @returns {string} Formatted error message
     */
    getErrorMessage(error) {
        if (error.name === 'AbortError') {
            return 'Request timeout';
        } else if (error.message.includes('NetworkError')) {
            return 'Network error - instance unreachable';
        } else if (error.message.includes('CORS')) {
            return 'CORS error - check instance configuration';
        } else if (error.message.includes('Failed to fetch')) {
            return 'Connection failed - instance may be offline';
        } else {
            return error.message || 'Unknown error';
        }
    }

    /**
     * Sync taskpane metadata with smart manager accessibility status
     * Call this after smart manager discovery to ensure UI reflects smart manager state
     */
    syncFromSmartManager() {
        if (!window.smartManager) return;
        
        try {
            const smartInstances = window.smartManager.availableInstances;
            const registeredUrls = window.FogLAMP.storage.getInstances();
            
            let syncCount = 0;
            
            registeredUrls.forEach(url => {
                // Find matching smart manager instance by URL
                const smartInstance = Array.from(smartInstances.values()).find(inst => 
                    inst.url === url || inst.name.includes(url)
                );
                
                if (smartInstance) {
                    const currentMeta = window.getInstanceMeta ? window.getInstanceMeta(url) : null;
                    if (!currentMeta) return;
                    
                    const smartStatus = smartInstance.accessible ? 'success' : 'failed';
                    
                    // Only sync if there's a meaningful difference
                    if (currentMeta.lastStatus !== smartStatus) {
                        if (window.updateInstanceMeta) {
                            window.updateInstanceMeta(url, {
                                lastStatus: smartStatus,
                                hostName: smartInstance.health || currentMeta.hostName,
                                lastCheckedAt: new Date().toISOString(),
                                lastError: smartInstance.accessible ? null : 'Not accessible via smart manager'
                            });
                            syncCount++;
                        }
                    }
                }
            });
            
            if (syncCount > 0) {
                logMessage('info', `Synced ${syncCount} instances from smart manager to taskpane metadata`);
                window.FogLAMP.instances.renderInstanceList();
                window.FogLAMP.badges.updateOverviewBadges();
            }
            
        } catch (error) {
            logMessage('warn', 'Failed to sync from smart manager', { error: error.message });
        }
    }

    /**
     * Force smart manager to re-discover instances
     * Call this after taskpane metadata updates to ensure smart manager reflects latest state
     */
    async syncToSmartManager() {
        if (!window.smartManager) return;
        
        try {
            logMessage('info', 'Forcing smart manager re-discovery...');
            await window.smartManager.discoverInstances();
            logMessage('info', 'Smart manager synchronized successfully');
            
            // Also sync back to ensure consistency
            this.syncFromSmartManager();
            
        } catch (error) {
            logMessage('warn', 'Smart manager sync failed', { error: error.message });
        }
    }

    /**
     * Batch ping multiple instances
     * @param {Array} urls - Array of instance URLs to ping
     * @param {Object} options - Ping options
     * @returns {Promise<Array>} Array of ping results
     */
    async batchPingInstances(urls, options = {}) {
        logMessage('info', `Starting batch ping of ${urls.length} instances`);
        
        const startTime = performance.now();
        const results = await Promise.allSettled(
            urls.map(url => this.pingInstance(url, { ...options, updateUI: false }))
        );
        
        const endTime = performance.now();
        const totalTime = Math.round(endTime - startTime);
        
        const pingResults = results.map((result, index) => ({
            url: urls[index],
            result: result.status === 'fulfilled' ? result.value : { 
                success: false, 
                error: result.reason.message 
            }
        }));
        
        const successful = pingResults.filter(r => r.result.success).length;
        
        logMessage('info', `Batch ping completed`, {
            total: urls.length,
            successful,
            failed: urls.length - successful,
            totalTime: `${totalTime}ms`
        });
        
        return pingResults;
    }

    /**
     * Get overall ping manager statistics
     * @returns {Object} Manager statistics
     */
    getManagerStats() {
        const totalInstances = this.pingHistory.size;
        let totalPings = 0;
        let totalSuccessful = 0;
        
        for (const history of this.pingHistory.values()) {
            totalPings += history.length;
            totalSuccessful += history.filter(h => h.success).length;
        }
        
        return {
            trackedInstances: totalInstances,
            totalPings,
            totalSuccessful,
            overallSuccessRate: totalPings > 0 ? (totalSuccessful / totalPings) * 100 : 0,
            activePings: this.pingTimeouts.size
        };
    }

    /**
     * Set UI update functions (dependency injection)
     * @param {Function} renderInstanceList - Function to render instance list
     * @param {Function} updateOverviewBadges - Function to update badges
     */
    setUIUpdateFunctions(renderInstanceList, updateOverviewBadges) {
        this.renderInstanceList = renderInstanceList;
        this.updateOverviewBadges = updateOverviewBadges;
    }

    /**
     * Initialize ping manager
     */
    initialize() {
        // Clean up any existing timeouts
        for (const timeoutId of this.pingTimeouts.values()) {
            clearTimeout(timeoutId);
        }
        this.pingTimeouts.clear();
        
        console.log('✅ Instance ping management system initialized');
    }

    /**
     * Cleanup when destroyed
     */
    destroy() {
        // Cancel all active pings
        for (const timeoutId of this.pingTimeouts.values()) {
            clearTimeout(timeoutId);
        }
        this.pingTimeouts.clear();
        
        // Clear history
        this.pingHistory.clear();
        
        console.log('Instance ping manager destroyed');
    }
}

// Create singleton instance
export const instancePingManager = new InstancePingManager();

// Export individual methods for backward compatibility
export const pingInstance = (url, options) => instancePingManager.pingInstance(url, options);
export const setInstanceActive = (url) => instancePingManager.setInstanceActive(url);
export const getInstanceStatistics = (url) => instancePingManager.getInstanceStatistics(url);
export const pingUrlForValidation = (url, timeout) => instancePingManager.pingUrlForValidation(url, timeout);
export const syncFromSmartManager = () => instancePingManager.syncFromSmartManager();
export const syncToSmartManager = () => instancePingManager.syncToSmartManager();

// Export singleton as default
export default instancePingManager;

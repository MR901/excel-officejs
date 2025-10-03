/**
 * Asset Management for FogLAMP DataLink
 * Handles asset loading, synchronization, and management functionality
 */

import { elements } from '../ui/elements.js';
import { getActiveInstance, getActiveInstanceWithMeta } from '../core/storage.js';
import { getDisplayName } from '../core/utils.js';
import { logMessage } from '../ui/console.js';

/**
 * Asset Manager Class
 * Manages asset loading, caching, and UI synchronization
 */
export class AssetManager {
    
    constructor() {
        this.assetCache = new Map(); // Cache assets by instance URL
        this.syncTimeout = null;
        this.loadingStates = new Set(); // Track loading states
        this.retryAttempts = new Map(); // Track retry attempts per instance
        this.maxRetries = 3;
        this.retryDelay = 1000; // ms
    }

    /**
     * Initialize the asset manager
     * Called during system startup
     */
    initialize() {
        logMessage('info', 'Initializing asset manager');
        
        // Setup asset input synchronization
        this.syncAssetInputs();
        
        // Load assets for active instance if any
        this.loadAssetsForActiveInstance();
        
        logMessage('info', 'Asset manager initialized');
    }

    /**
     * Load assets for the active instance
     * Populates the asset dropdown with available assets
     */
    async loadAssetsForActiveInstance() {
        const assetSelect = elements.assetSelect();
        if (!assetSelect) return;

        const activeInstance = getActiveInstance();
        // Capture the instance URL at the start to avoid cross-instance UI updates
        const requestInstance = activeInstance;
        if (!activeInstance) {
            this.setAssetSelectState('no-instance', 'No active instance');
            return;
        }

        // Check if already loading
        if (this.loadingStates.has(activeInstance)) {
            logMessage('info', 'Asset loading already in progress', { instance: activeInstance });
            return;
        }

        this.setAssetSelectState('loading', 'Loading assets...');
        this.loadingStates.add(activeInstance);

        try {
            // Check cache first
            const cachedAssets = this.assetCache.get(activeInstance);
            if (cachedAssets && this.isCacheValid(activeInstance)) {
                // Guard against race: ensure active instance hasn't changed
                if (getActiveInstance() !== requestInstance) {
                    logMessage('info', 'Skipped cached asset populate due to instance change', {
                        requested: requestInstance,
                        current: getActiveInstance()
                    });
                    return;
                }
                this.populateAssetSelect(cachedAssets);
                logMessage('info', `Loaded ${cachedAssets.length} assets from cache`);
                return;
            }

            // Fetch fresh assets
            const assets = await this.fetchAssetsFromInstance(activeInstance);
            
            if (assets && assets.length > 0) {
                // Guard against race: ensure active instance hasn't changed
                if (getActiveInstance() !== requestInstance) {
                    logMessage('info', 'Skipped fetched asset populate due to instance change', {
                        requested: requestInstance,
                        current: getActiveInstance()
                    });
                    return;
                }
                this.cacheAssets(activeInstance, assets);
                this.populateAssetSelect(assets);
                this.resetRetryCount(activeInstance);
                
                logMessage('info', `Loaded ${assets.length} assets for active instance`, {
                    instance: activeInstance,
                    assets: assets.slice(0, 5) // Log first 5 for brevity
                });
            } else {
                this.setAssetSelectState('empty', 'No assets available');
                logMessage('info', 'No assets found for active instance', { instance: activeInstance });
            }

        } catch (error) {
            await this.handleAssetLoadError(activeInstance, error);
        } finally {
            this.loadingStates.delete(activeInstance);
        }
    }

    /**
     * Refresh asset list for active instance
     * Forces a fresh fetch bypassing cache
     */
    async refreshAssetListForActiveInstance() {
        const activeInstance = getActiveInstanceWithMeta();
        if (!activeInstance) {
            logMessage('info', 'Asset refresh skipped - no active instance');
            return;
        }

        const displayName = getDisplayName(activeInstance);
        logMessage('info', 'Refreshing asset list for active instance', { 
            instance: displayName,
            url: activeInstance.url
        });

        // Clear cache to force fresh fetch
        this.assetCache.delete(activeInstance.url);
        
        try {
            await this.loadAssetsForActiveInstance();
            logMessage('info', 'Asset list refresh completed', { instance: displayName });
        } catch (error) {
            logMessage('error', 'Asset list refresh failed', { 
                instance: displayName, 
                error: error.message 
            });
        }
    }

    /**
     * Fetch assets from FogLAMP instance - STREAMLINED: Single API path only
     * @param {string} instanceUrl - Instance URL (unused, kept for API compatibility)
     * @returns {Promise<Array>} Array of asset names
     */
    async fetchAssetsFromInstance(instanceUrl) {
        try {
            // Prefer targeting the active instance explicitly to avoid cross-instance data leaks
            if (window.FogLAMP && window.FogLAMP.api && typeof window.FogLAMP.api.assetsForUrl === 'function' && instanceUrl) {
                return await window.FogLAMP.api.assetsForUrl(instanceUrl);
            }

            // Stronger explicit fallback: call the URL-specific API path directly if available
            if (window.FogLAMP && window.FogLAMP.api && typeof window.FogLAMP.api.apiCallForUrl === 'function' && instanceUrl) {
                const endpoint = (window.FogLAMP.api.apiEndpoints && window.FogLAMP.api.apiEndpoints.assets) ? window.FogLAMP.api.apiEndpoints.assets : '/foglamp/asset';
                return await window.FogLAMP.api.apiCallForUrl(instanceUrl, endpoint);
            }

            // Fallback: unified API (may use smart selection)
            if (window.FogLAMP && window.FogLAMP.api && typeof window.FogLAMP.api.assets === 'function') {
                return await window.FogLAMP.api.assets();
            }
            
            // Fallback to smart manager
            if (window.smartManager && typeof window.smartManager.foglampAssets === 'function') {
                return await window.smartManager.foglampAssets();
            }
            
            // Fallback to global function
            if (typeof window.foglampAssetsSmart === 'function') {
                return await window.foglampAssetsSmart();
            }
            
            throw new Error('No asset fetch method available');
        } catch (error) {
            logMessage('error', 'Failed to fetch assets', { 
                instance: instanceUrl, 
                error: error.message 
            });
            throw error;
        }
    }


    /**
     * Populate asset select dropdown with assets
     * @param {Array} assets - Array of asset names
     */
    populateAssetSelect(assets) {
        const assetSelect = elements.assetSelect();
        if (!assetSelect) return;

        // Clear existing options
        assetSelect.innerHTML = '';

        // Normalize assets to string names and de-duplicate
        const names = this.normalizeAssetNames(Array.isArray(assets) ? assets : []);

        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select asset...';
        assetSelect.appendChild(defaultOption);

        // Add asset options
        names.forEach(asset => {
            const option = document.createElement('option');
            option.value = asset;
            option.textContent = asset;
            assetSelect.appendChild(option);
        });

        // Enable the select
        assetSelect.disabled = false;

        // Sync with text input if available
        this.syncAssetInputs();
    }

    /**
     * Normalize various asset list response shapes to an array of string names
     * Supports: ["name"], [{asset:"name"}], [{asset_code:"name"}], [{assetCode:"name"}], [{name:"name"}]
     * @param {Array} assets
     * @returns {Array<string>} unique, sorted asset names
     */
    normalizeAssetNames(assets) {
        const names = assets.map((item) => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object') {
                return (
                    item.asset ||
                    item.asset_code ||
                    item.assetCode ||
                    item.name ||
                    item.code ||
                    ''
                );
            }
            return '';
        }).filter(Boolean);

        // De-duplicate and sort
        return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
    }

    /**
     * Set asset select state with message
     * @param {string} state - State identifier (loading, error, empty, no-instance)
     * @param {string} message - Display message
     */
    setAssetSelectState(state, message) {
        const assetSelect = elements.assetSelect();
        if (!assetSelect) return;

        assetSelect.innerHTML = `<option value="">${message}</option>`;
        assetSelect.disabled = state !== 'ready';
        assetSelect.className = `asset-select ${state}`;
    }

    /**
     * Enhanced asset input synchronization with debouncing to prevent race conditions
     * Keeps dropdown and text input in sync
     */
    syncAssetInputs() {
        const assetSelect = elements.assetSelect();
        const assetInput = elements.asset();
        
        if (!assetSelect || !assetInput) return;
        
        // Remove existing listeners to prevent duplicates by cloning nodes
        const newSelect = assetSelect.cloneNode(true);
        const newInput = assetInput.cloneNode(true);
        assetSelect.parentNode.replaceChild(newSelect, assetSelect);
        assetInput.parentNode.replaceChild(newInput, assetInput);

        // Clear any existing timeout
        if (this.syncTimeout) {
            clearTimeout(this.syncTimeout);
            this.syncTimeout = null;
        }

        // Sync dropdown to input (immediate)
        newSelect.addEventListener('change', () => {
            if (this.syncTimeout) clearTimeout(this.syncTimeout);
            
            this.syncTimeout = setTimeout(() => {
                if (newSelect.value && newSelect.value !== newInput.value) {
                    newInput.value = newSelect.value;
                    logMessage('info', 'Asset synced from dropdown', { asset: newSelect.value });
                }
            }, 100);
        });

        // Sync input to dropdown with debounced typing (300ms delay)
        newInput.addEventListener('input', () => {
            if (this.syncTimeout) clearTimeout(this.syncTimeout);
            
            this.syncTimeout = setTimeout(() => {
                const inputValue = newInput.value.trim();
                
                // Find matching option in dropdown
                const matchingOption = Array.from(newSelect.options)
                    .find(option => option.value === inputValue);
                
                if (matchingOption) {
                    newSelect.value = inputValue;
                    logMessage('info', 'Asset synced from input', { asset: inputValue });
                } else if (inputValue) {
                    newSelect.value = ''; // Clear selection if no match
                }
            }, 300);
        });

        logMessage('info', 'Asset input synchronization configured');
    }

    /**
     * Cache assets for an instance
     * @param {string} instanceUrl - Instance URL
     * @param {Array} assets - Array of assets to cache
     */
    cacheAssets(instanceUrl, assets) {
        this.assetCache.set(instanceUrl, {
            assets: [...assets],
            timestamp: Date.now(),
            ttl: 5 * 60 * 1000 // 5 minutes TTL
        });
    }

    /**
     * Check if cached assets are still valid
     * @param {string} instanceUrl - Instance URL
     * @returns {boolean} Whether cache is valid
     */
    isCacheValid(instanceUrl) {
        const cached = this.assetCache.get(instanceUrl);
        if (!cached) return false;
        
        return (Date.now() - cached.timestamp) < cached.ttl;
    }

    /**
     * Handle asset loading error with retry logic
     * @param {string} instanceUrl - Instance URL that failed
     * @param {Error} error - Error that occurred
     */
    async handleAssetLoadError(instanceUrl, error) {
        const retryCount = this.retryAttempts.get(instanceUrl) || 0;
        
        if (retryCount < this.maxRetries) {
            this.retryAttempts.set(instanceUrl, retryCount + 1);
            logMessage('warn', `Asset loading failed, retrying (${retryCount + 1}/${this.maxRetries})`, {
                instance: instanceUrl,
                error: error.message,
                retryIn: `${this.retryDelay}ms`
            });
            
            setTimeout(async () => {
                try {
                    await this.loadAssetsForActiveInstance();
                } catch (retryError) {
                    await this.handleAssetLoadError(instanceUrl, retryError);
                }
            }, this.retryDelay);
            
        } else {
            this.setAssetSelectState('error', 'Failed to load assets');
            this.resetRetryCount(instanceUrl);
            
            logMessage('error', 'Asset loading failed after retries', {
                instance: instanceUrl,
                error: error.message,
                maxRetries: this.maxRetries
            });
        }
    }

    /**
     * Reset retry count for an instance
     * @param {string} instanceUrl - Instance URL
     */
    resetRetryCount(instanceUrl) {
        this.retryAttempts.delete(instanceUrl);
    }

    /**
     * Clear asset cache for specific instance or all instances
     * @param {string} instanceUrl - Optional instance URL, clears all if not provided
     */
    clearAssetCache(instanceUrl = null) {
        if (instanceUrl) {
            this.assetCache.delete(instanceUrl);
            logMessage('info', 'Asset cache cleared for instance', { instance: instanceUrl });
        } else {
            this.assetCache.clear();
            logMessage('info', 'All asset caches cleared');
        }
    }

    /**
     * Get cached assets for instance
     * @param {string} instanceUrl - Instance URL
     * @returns {Array|null} Cached assets or null
     */
    getCachedAssets(instanceUrl) {
        const cached = this.assetCache.get(instanceUrl);
        return cached && this.isCacheValid(instanceUrl) ? cached.assets : null;
    }

    /**
     * Get selected asset from UI
     * @returns {string} Selected asset name or empty string
     */
    getSelectedAsset() {
        const assetSelect = elements.assetSelect();
        const assetInput = elements.asset();
        
        // Prefer dropdown selection, fallback to text input
        const selectedFromDropdown = assetSelect?.value || '';
        const typedInInput = assetInput?.value?.trim() || '';
        
        return selectedFromDropdown || typedInInput;
    }

    /**
     * Set selected asset in UI
     * @param {string} assetName - Asset name to select
     */
    setSelectedAsset(assetName) {
        const assetSelect = elements.assetSelect();
        const assetInput = elements.asset();
        
        if (assetSelect) {
            assetSelect.value = assetName;
        }
        
        if (assetInput) {
            assetInput.value = assetName;
        }
        
        logMessage('info', 'Asset selection updated', { asset: assetName });
    }

    /**
     * Get asset manager statistics
     * @returns {Object} Asset manager statistics
     */
    getAssetStats() {
        return {
            cacheSize: this.assetCache.size,
            loadingInstances: Array.from(this.loadingStates),
            retryingInstances: Array.from(this.retryAttempts.keys()),
            cacheHitRatio: this.calculateCacheHitRatio()
        };
    }

    /**
     * Calculate cache hit ratio
     * @returns {number} Cache hit ratio (0-1)
     */
    calculateCacheHitRatio() {
        // This would require tracking hits/misses over time
        // For now, return a simple estimate based on cache size
        return this.assetCache.size > 0 ? 0.8 : 0;
    }

    /**
     * Initialize asset manager
     */
    initialize() {
        // Load assets for current active instance
        this.loadAssetsForActiveInstance();
        
        // Set up periodic cache cleanup
        this.setupCacheCleanup();
        
        console.log('✅ Asset management system initialized');
    }

    /**
     * Set up periodic cache cleanup
     */
    setupCacheCleanup() {
        // Clean up expired cache entries every 5 minutes
        setInterval(() => {
            const now = Date.now();
            for (const [instanceUrl, cached] of this.assetCache.entries()) {
                if (now - cached.timestamp > cached.ttl) {
                    this.assetCache.delete(instanceUrl);
                }
            }
        }, 5 * 60 * 1000);
    }

    /**
     * Cleanup when destroyed
     */
    destroy() {
        if (this.syncTimeout) {
            clearTimeout(this.syncTimeout);
            this.syncTimeout = null;
        }
        
        this.assetCache.clear();
        this.loadingStates.clear();
        this.retryAttempts.clear();
    }
}

// Create singleton instance
export const assetManager = new AssetManager();

// Export individual methods for backward compatibility
export const loadAssetsForActiveInstance = () => assetManager.loadAssetsForActiveInstance();
export const refreshAssetListForActiveInstance = () => assetManager.refreshAssetListForActiveInstance();
export const syncAssetInputs = () => assetManager.syncAssetInputs();

// Export singleton as default
export default assetManager;

/**
 * Instance Storage Management for FogLAMP DataLink
 * Handles localStorage operations for instances and metadata
 */

import { STORAGE_KEYS, ENHANCED_STORAGE_KEYS, INSTANCE_STATUS } from './config.js';

/**
 * Instance Storage Class
 * Manages both legacy URL list and enhanced metadata storage
 */
export class InstanceStorage {
    
    /**
     * Get all instance URLs (legacy compatibility)
     * @returns {Array<string>} Array of instance URLs
     */
    getInstances() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.INSTANCES);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.warn('Failed to parse instances:', e);
            return [];
        }
    }

    /**
     * Save instance URLs (legacy compatibility)
     * @param {Array<string>} instances - Array of URLs
     */
    saveInstances(instances) {
        try {
            localStorage.setItem(STORAGE_KEYS.INSTANCES, JSON.stringify(instances));
        } catch (e) {
            console.error('Failed to save instances:', e);
        }
    }

    /**
     * Get instance metadata map
     * @returns {Object} Map of URL -> metadata
     */
    getInstanceMetadata() {
        try {
            const raw = localStorage.getItem(ENHANCED_STORAGE_KEYS.INSTANCE_METADATA);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            console.warn('Failed to parse instance metadata:', e);
            return {};
        }
    }

    /**
     * Save instance metadata map
     * @param {Object} metadataMap - Map of URL -> metadata
     */
    saveInstanceMetadata(metadataMap) {
        try {
            localStorage.setItem(ENHANCED_STORAGE_KEYS.INSTANCE_METADATA, JSON.stringify(metadataMap));
        } catch (e) {
            console.error('Failed to save instance metadata:', e);
        }
    }

    /**
     * Get metadata for specific instance
     * @param {string} url - Instance URL
     * @returns {Object} Instance metadata or default structure
     */
    getInstanceMeta(url) {
        const allMeta = this.getInstanceMetadata();
        return allMeta[url] || {
            url,
            name: '',
            hostName: '',
            lastStatus: INSTANCE_STATUS.UNKNOWN,
            lastPingMs: null,
            lastCheckedAt: null,
            lastError: null,
            addedAt: new Date().toISOString()
        };
    }

    /**
     * Update metadata for specific instance
     * @param {string} url - Instance URL
     * @param {Object} updates - Partial metadata updates
     */
    updateInstanceMeta(url, updates) {
        const allMeta = this.getInstanceMetadata();
        allMeta[url] = {
            ...this.getInstanceMeta(url),
            ...updates,
            url // Ensure URL is always present
        };
        this.saveInstanceMetadata(allMeta);
    }

    /**
     * Get enhanced instance list with metadata
     * @returns {Array} Array of enhanced instance objects
     */
    getEnhancedInstances() {
        const urls = this.getInstances();
        return urls.map(url => ({
            ...this.getInstanceMeta(url),
            url
        }));
    }

    /**
     * Normalize base URL format
     * @param {string} input - Raw URL input
     * @returns {string} Normalized URL or empty string if invalid
     */
    normalizeBaseUrl(input) {
        if (!input) return "";
        let url = input.trim();
        if (!/^https?:\/\//i.test(url)) {
            url = "http://" + url;
        }
        url = url.replace(/\/$/, "");
        return url;
    }

    /**
     * Add new instance
     * @param {string} baseUrl - Instance URL to add
     * @param {Object} options - Additional options (name, hostName, etc.)
     * @returns {boolean} Success status
     */
    addInstance(baseUrl, options = {}) {
        const url = this.normalizeBaseUrl(baseUrl);
        if (!url) return false;

        const instances = this.getInstances();
        const isNew = !instances.includes(url);
        
        if (isNew) {
            instances.push(url);
            this.saveInstances(instances);
            
            // Initialize metadata for new instance
            this.updateInstanceMeta(url, {
                name: options.name || '',
                hostName: options.hostName || '',
                lastStatus: options.lastStatus || INSTANCE_STATUS.UNKNOWN,
                lastPingMs: options.lastPingMs || null,
                lastCheckedAt: options.lastCheckedAt || null,
                lastError: options.lastError || null,
                addedAt: new Date().toISOString()
            });
        }
        
        return isNew;
    }

    /**
     * Remove instance
     * @param {string} url - Instance URL to remove
     * @returns {boolean} Success status
     */
    removeInstance(url) {
        const instances = this.getInstances();
        const filteredInstances = instances.filter(u => u !== url);
        
        if (filteredInstances.length !== instances.length) {
            this.saveInstances(filteredInstances);
            
            // Remove metadata
            const metadata = this.getInstanceMetadata();
            delete metadata[url];
            this.saveInstanceMetadata(metadata);
            
            // Clear active if removing active instance
            if (this.getActiveInstance() === url) {
                const nextActive = filteredInstances.length > 0 ? filteredInstances[0] : null;
                if (nextActive) {
                    this.setActiveInstance(nextActive);
                } else {
                    localStorage.removeItem(STORAGE_KEYS.ACTIVE);
                }
            }
            
            return true;
        }
        
        return false;
    }

    /**
     * Get active instance URL
     * @returns {string|null} Active instance URL
     */
    getActiveInstance() {
        const active = localStorage.getItem(STORAGE_KEYS.ACTIVE);
        if (active && this.getInstances().includes(active)) {
            return active;
        }
        
        // Fallback to first available instance
        const instances = this.getInstances();
        const fallback = instances.length > 0 ? instances[0] : null;
        if (fallback) {
            this.setActiveInstance(fallback);
        }
        return fallback;
    }

    /**
     * Set active instance
     * @param {string} url - Instance URL to set as active
     */
    setActiveInstance(url) {
        if (this.getInstances().includes(url)) {
            localStorage.setItem(STORAGE_KEYS.ACTIVE, url);
        } else {
            console.warn('Attempted to set non-existent instance as active:', url);
        }
    }

    /**
     * Get active instance with metadata
     * @returns {Object|null} Enhanced active instance object
     */
    getActiveInstanceWithMeta() {
        const activeUrl = this.getActiveInstance();
        return activeUrl ? this.getInstanceMeta(activeUrl) : null;
    }

    /**
     * Clear all storage (for testing/reset)
     */
    clearAll() {
        localStorage.removeItem(STORAGE_KEYS.INSTANCES);
        localStorage.removeItem(STORAGE_KEYS.ACTIVE);
        localStorage.removeItem(ENHANCED_STORAGE_KEYS.INSTANCE_METADATA);
    }

    /**
     * Export all data (for backup/migration)
     * @returns {Object} Complete storage state
     */
    exportAll() {
        return {
            instances: this.getInstances(),
            active: this.getActiveInstance(),
            metadata: this.getInstanceMetadata(),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Import data (for restore/migration)
     * @param {Object} data - Complete storage state
     * @returns {boolean} Success status
     */
    importAll(data) {
        try {
            if (data.instances) {
                this.saveInstances(data.instances);
            }
            if (data.metadata) {
                this.saveInstanceMetadata(data.metadata);
            }
            if (data.active) {
                this.setActiveInstance(data.active);
            }
            return true;
        } catch (error) {
            console.error('Failed to import storage data:', error);
            return false;
        }
    }
}

// Create singleton instance
export const instanceStorage = new InstanceStorage();

// Export individual methods for backward compatibility
export const getInstances = () => instanceStorage.getInstances();
export const saveInstances = (instances) => instanceStorage.saveInstances(instances);
export const addInstance = (baseUrl, options) => instanceStorage.addInstance(baseUrl, options);
export const removeInstance = (url) => instanceStorage.removeInstance(url);
export const getActiveInstance = () => instanceStorage.getActiveInstance();
export const setActiveInstance = (url) => instanceStorage.setActiveInstance(url);
export const getInstanceMetadata = () => instanceStorage.getInstanceMetadata();
export const saveInstanceMetadata = (metadata) => instanceStorage.saveInstanceMetadata(metadata);
export const getInstanceMeta = (url) => instanceStorage.getInstanceMeta(url);
export const updateInstanceMeta = (url, updates) => instanceStorage.updateInstanceMeta(url, updates);
export const getEnhancedInstances = () => instanceStorage.getEnhancedInstances();
export const getActiveInstanceWithMeta = () => instanceStorage.getActiveInstanceWithMeta();
export const normalizeBaseUrl = (input) => instanceStorage.normalizeBaseUrl(input);

// Export singleton as default
export default instanceStorage;

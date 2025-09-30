/**
 * FogLAMP Unified API Manager
 * Single backbone for all FogLAMP API access across platforms
 * Works with and without proxy server, supports Excel Desktop/Web and Google Sheets
 */

export class FogLAMPAPIManager {
    constructor() {
        this.smartManager = null;
        this.proxyAvailable = false;
        this.initPromise = null;
        this.platform = this.detectPlatform();
        this.apiEndpoints = {
            ping: '/foglamp/ping',
            statistics: '/foglamp/statistics', 
            assets: '/foglamp/asset',
            readings: '/foglamp/asset'
        };
        
        // Platform-specific configurations
        this.platformConfig = {
            'excel-desktop': { corsMode: 'cors', credentials: 'omit' },
            'excel-web': { corsMode: 'cors', credentials: 'omit' },
            'google-sheets': { corsMode: 'cors', credentials: 'omit' },
            'unknown': { corsMode: 'cors', credentials: 'omit' }
        };
    }

    /**
     * Detect the current platform for cross-platform compatibility
     * @returns {string} Platform identifier
     */
    detectPlatform() {
        try {
            if (typeof Office !== 'undefined' && Office.context) {
                if (Office.context.host === Office.HostType.Excel) {
                    // Detect if Excel Desktop or Excel Web
                    const platform = Office.context.platform;
                    if (platform === Office.PlatformType.OfficeOnline) {
                        return 'excel-web';
                    } else {
                        return 'excel-desktop'; // Mac or Windows
                    }
                }
            } else if (typeof google !== 'undefined' && google.script) {
                return 'google-sheets';
            }
        } catch (error) {
            console.warn('Platform detection failed:', error.message);
        }
        
        return 'unknown';
    }

    /**
     * Initialize the API manager - single initialization point
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = this._performInitialization();
        return this.initPromise;
    }

    /**
     * Internal initialization logic
     * @private
     */
    async _performInitialization() {
        try {
            console.log(`🔧 FogLAMP API Manager initializing for platform: ${this.platform}`);
            
            // Wait for smart manager to be available
            await this._ensureSmartManagerReady();
            
            if (this.smartManager) {
                // Check proxy availability
                await this.smartManager.checkProxyAvailability();
                this.proxyAvailable = this.smartManager.proxyAvailable;
                
                console.log(`✅ API Manager ready - Proxy: ${this.proxyAvailable}, Platform: ${this.platform}`);
            } else {
                console.warn('⚠️  Smart manager not available, using direct API access');
            }
            
        } catch (error) {
            console.error('❌ API Manager initialization failed:', error.message);
            throw error;
        }
    }

    /**
     * Wait for smart manager to become available
     * @private
     */
    async _ensureSmartManagerReady() {
        let retries = 0;
        const maxRetries = 50; // 5 seconds max wait
        
        while (!window.smartManager && retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 100));
            retries++;
        }
        
        if (window.smartManager) {
            this.smartManager = window.smartManager;
            return true;
        }
        
        console.warn('Smart manager not available after timeout');
        return false;
    }

    /**
     * Universal API call method - single backbone for all FogLAMP APIs
     * Works with and without proxy across all platforms
     * @param {string} endpoint - API endpoint path
     * @param {Object} options - Request options
     * @returns {Promise<any>} API response data
     */
    async apiCall(endpoint, options = {}) {
        await this.initialize();
        
        const method = options.method || 'GET';
        const timeout = options.timeout || 10000;
        
        try {
            console.log(`🌐 API Call: ${method} ${endpoint} (Platform: ${this.platform}, Proxy: ${this.proxyAvailable})`);
            
            // Strategy 1: Try smart manager first (handles proxy automatically)
            if (this.smartManager) {
                try {
                    const response = await this._callViaSmartManager(endpoint, options, timeout);
                    console.log(`✅ API success via smart manager: ${endpoint}`);
                    return response;
                } catch (smartManagerError) {
                    console.warn(`⚠️  Smart manager failed for ${endpoint}:`, smartManagerError.message);
                    // Continue to fallback strategies
                }
            }

            // Strategy 2: Try direct API call (for local instances or when proxy not needed)
            try {
                const response = await this._callDirectAPI(endpoint, options, timeout);
                console.log(`✅ API success via direct call: ${endpoint}`);
                return response;
            } catch (directError) {
                console.warn(`⚠️  Direct API failed for ${endpoint}:`, directError.message);
                
                // If we get here, both strategies failed
                throw new Error(`All API strategies failed for ${endpoint}. Smart manager: ${this.smartManager ? 'available' : 'unavailable'}, Direct: ${directError.message}`);
            }
            
        } catch (error) {
            console.error(`❌ API Call failed: ${method} ${endpoint}`, error);
            
            // Use Office.js compliant error handling if available
            if (window.FogLAMP?.errors) {
                await window.FogLAMP.errors.handleApiError(`${method} ${endpoint}`, error, { 
                    endpoint,
                    platform: this.platform,
                    proxy: this.proxyAvailable 
                });
            } else if (window.FogLAMPErrorHandler) {
                await window.FogLAMPErrorHandler.handleApiError(`${method} ${endpoint}`, error, {
                    endpoint,
                    platform: this.platform,
                    proxy: this.proxyAvailable
                });
            }
            
            throw error;
        }
    }

    /**
     * Call API via smart manager (handles proxy automatically)
     * @private
     */
    async _callViaSmartManager(endpoint, options, timeout) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await this.smartManager.smartFetch(endpoint, {
                method: options.method || 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                body: options.body,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Call API directly (fallback for local instances)
     * @private
     */
    async _callDirectAPI(endpoint, options, timeout) {
        // Get active instance URL
        const activeInstance = window.getActiveInstanceWithMeta ? window.getActiveInstanceWithMeta() : null;
        if (!activeInstance) {
            throw new Error('No active instance available for direct API call');
        }

        const url = `${activeInstance.url}${endpoint}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const platformConfig = this.platformConfig[this.platform] || this.platformConfig.unknown;
            
            const response = await fetch(url, {
                method: options.method || 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                body: options.body,
                mode: platformConfig.corsMode,
                credentials: platformConfig.credentials,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * FogLAMP Ping API - unified method for all ping operations
     * @returns {Promise<Object>} Ping response data
     */
    async ping() {
        return await this.apiCall(this.apiEndpoints.ping);
    }

    /**
     * FogLAMP Statistics API - unified method for all statistics operations
     * @returns {Promise<Object>} Statistics response data
     */
    async statistics() {
        return await this.apiCall(this.apiEndpoints.statistics);
    }

    /**
     * FogLAMP Assets API - unified method for all asset operations
     * @returns {Promise<Array>} Assets response data
     */
    async assets() {
        return await this.apiCall(this.apiEndpoints.assets);
    }

    /**
     * FogLAMP Asset Readings API - unified method for readings operations
     * @param {string} asset - Asset name
     * @param {string} datapoint - Optional datapoint name
     * @param {Object} params - Query parameters (limit, skip, seconds, etc.)
     * @returns {Promise<Array>} Readings response data
     */
    async readings(asset, datapoint = null, params = {}) {
        const path = datapoint ? `${this.apiEndpoints.readings}/${asset}/${datapoint}` : `${this.apiEndpoints.readings}/${asset}`;
        
        // Build query string
        const queryParams = new URLSearchParams();
        Object.keys(params).forEach(key => {
            if (params[key] != null && params[key] !== '') {
                queryParams.set(key, String(params[key]));
            }
        });
        
        const fullPath = queryParams.toString() ? `${path}?${queryParams.toString()}` : path;
        return await this.apiCall(fullPath);
    }

    /**
     * Get API manager status information
     * @returns {Object} Status object
     */
    getStatus() {
        return {
            platform: this.platform,
            smartManagerAvailable: !!this.smartManager,
            proxyAvailable: this.proxyAvailable,
            initialized: !!this.initPromise,
            apiEndpoints: this.apiEndpoints
        };
    }

    /**
     * Reset API manager (useful for testing or reconnection)
     */
    async reset() {
        this.smartManager = null;
        this.proxyAvailable = false;
        this.initPromise = null;
        
        console.log('🔄 API Manager reset, reinitializing...');
        await this.initialize();
    }
}

// Create singleton instance
export const apiManager = new FogLAMPAPIManager();

// Make available globally for backward compatibility
if (typeof window !== 'undefined') {
    window.FogLAMPAPI = apiManager;
}

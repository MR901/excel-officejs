/**
 * FogLAMP Unified API Manager
 * Single backbone for all FogLAMP API access across platforms
 * Works with and without proxy server, supports Excel Desktop/Web and Google Sheets
 */

import { CONNECTION_CONFIG } from './config.js';

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
     * Force API call for a specific base URL (bypasses smart selection)
     * Automatically uses proxy in web environments when available
     * @param {string} baseUrl - Exact instance base URL
     * @param {string} endpoint - Endpoint path starting with '/'
     * @param {Object} options - Request options
     * @returns {Promise<any>} JSON data
     */
    async apiCallForUrl(baseUrl, endpoint, options = {}) {
        await this.initialize();

        const method = options.method || 'GET';
        const timeout = options.timeout || 10000;

        const isWeb = this.platform === 'excel-web';
        const isLocal = /^(https?:\/\/)?(localhost|127\.0\.0\.1)/i.test(baseUrl);

        // Choose proxy base respecting page protocol
        const isHttpsPage = typeof window !== 'undefined' && window.location && window.location.protocol === 'https:';
        const proxyBaseHttps = `https://localhost:${CONNECTION_CONFIG.PROXY_PORT || 3001}`;
        const proxyBaseHttp = CONNECTION_CONFIG.PROXY_BASE_URL || 'http://localhost:3001';
        const proxyBase = isHttpsPage ? proxyBaseHttps : proxyBaseHttp;
        const discoveredProxyBase = (this.smartManager && this.smartManager.PROXY_BASE_URL) ? this.smartManager.PROXY_BASE_URL : null;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            // Prefer proxy in web for non-local URLs.
            // Try HTTPS first on HTTPS pages, then HTTP, regardless of current proxyAvailable flag.
            if (isWeb && !isLocal) {
                const path = this._getProxyPath(baseUrl);
                let proxyCandidates;
                if (discoveredProxyBase && /^https:\/\//i.test(discoveredProxyBase)) {
                    // If we've already discovered a working HTTPS proxy, don't try HTTP fallback
                    proxyCandidates = [discoveredProxyBase];
                } else if (isHttpsPage) {
                    proxyCandidates = [
                        `https://localhost:${CONNECTION_CONFIG.PROXY_PORT || 3001}`,
                        (CONNECTION_CONFIG.PROXY_BASE_URL || 'http://localhost:3001')
                    ];
                } else {
                    proxyCandidates = [ (CONNECTION_CONFIG.PROXY_BASE_URL || 'http://localhost:3001') ];
                }

                for (const candidateBase of proxyCandidates) {
                    try {
                        // Ensure mapping exists for this candidate
                        try {
                            await fetch(`${candidateBase}/config`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ instances: { [path]: baseUrl } })
                            });
                        } catch (_) {}

                        const resp = await fetch(`${candidateBase}/${path}${endpoint}`, {
                            method,
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json',
                                ...options.headers
                            },
                            body: options.body,
                            credentials: 'omit',
                            mode: 'cors',
                            signal: controller.signal
                        });
                        if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
                        return await resp.json();
                    } catch (_tryNextProxy) {
                        // Try next candidate or fall through to direct
                    }
                }
            }

            // Direct call
            const url = `${baseUrl}${endpoint}`;
            const platformConfig = this.platformConfig[this.platform] || this.platformConfig.unknown;
            const resp = await fetch(url, {
                method,
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
            if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
            return await resp.json();
        } finally {
            clearTimeout(timeoutId);
        }
    }

    _getProxyPath(targetUrl) {
        try {
            const parsed = new URL(targetUrl);
            const host = parsed.hostname;
            if (host === '127.0.0.1' || host === 'localhost') return 'local';
            return host.replace(/\./g, '-').toLowerCase();
        } catch (_e) {
            return 'instance';
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

    async pingForUrl(baseUrl) {
        return await this.apiCallForUrl(baseUrl, this.apiEndpoints.ping);
    }

    /**
     * FogLAMP Statistics API - unified method for all statistics operations
     * @returns {Promise<Object>} Statistics response data
     */
    async statistics() {
        return await this.apiCall(this.apiEndpoints.statistics);
    }

    async statisticsForUrl(baseUrl) {
        return await this.apiCallForUrl(baseUrl, this.apiEndpoints.statistics);
    }

    /**
     * FogLAMP Assets API - unified method for all asset operations
     * @returns {Promise<Array>} Assets response data
     */
    async assets() {
        return await this.apiCall(this.apiEndpoints.assets);
    }

    async assetsForUrl(baseUrl) {
        return await this.apiCallForUrl(baseUrl, this.apiEndpoints.assets);
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
     * FogLAMP Asset Readings Summary
     */
    async readingsSummary(asset, datapoint = null, params = {}) {
        const base = datapoint ? `${this.apiEndpoints.readings}/${asset}/${datapoint}` : `${this.apiEndpoints.readings}/${asset}`;
        const path = `${base}/summary`;
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
     * FogLAMP Asset Readings Time Span
     */
    async readingsTimespan(asset, datapoint = null, params = {}) {
        const base = datapoint ? `${this.apiEndpoints.readings}/${asset}/${datapoint}` : `${this.apiEndpoints.readings}/${asset}`;
        const path = `${base}/timespan`;
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
     * FogLAMP Asset Readings Series
     */
    async readingsSeries(asset, datapoint = null, params = {}) {
        const base = datapoint ? `${this.apiEndpoints.readings}/${asset}/${datapoint}` : `${this.apiEndpoints.readings}/${asset}`;
        const path = `${base}/series`;
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

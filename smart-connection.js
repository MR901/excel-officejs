// Smart FogLAMP Connection Manager
// Auto-detects environment and uses best connection strategy

class SmartFogLAMPManager {
    constructor() {
        this.environment = 'unknown';
        this.connectionStrategy = 'direct';
        this.availableInstances = new Map();
        this.proxyAvailable = false;
        
        // Dynamic instances - loaded from user registrations
        this.targetInstances = [];
        this.proxyInstances = [];
        
        // Configuration constants
        this.PROXY_PORT = 3001;
        this.DEFAULT_FOGLAMP_PORT = '8081';
        this.PROXY_TIMEOUT_MS = 2000;
        this.CONNECTION_TIMEOUT_MS = 3000;
        this.PROXY_BASE_URL = `http://localhost:${this.PROXY_PORT}`;
    }

    // Load instances from user registration system
    loadUserRegisteredInstances() {
        // Get instances from the existing registration system (taskpane.html)
        const registeredUrls = typeof getInstances === 'function' ? getInstances() : [];
        
        this.targetInstances = registeredUrls.map((url, index) => {
            const isLocalhost = url.includes('127.0.0.1') || url.includes('localhost');
            return {
                name: isLocalhost ? 'Local' : `Instance ${index + 1}`,
                url: url,
                priority: isLocalhost ? 1 : index + 2,
                alwaysAvailable: isLocalhost
            };
        });

        // Generate corresponding proxy instances
        this.proxyInstances = this.targetInstances
            .filter(instance => !instance.url.includes('localhost') && !instance.url.includes('127.0.0.1'))
            .map((instance, index) => {
                // Convert direct URL to proxy URL
                const urlPath = this.generateProxyPath(instance.url);
                return {
                    name: `${instance.name} (Proxy)`,
                    url: `${this.PROXY_BASE_URL}/${urlPath}`,
                    priority: instance.priority,
                    originalUrl: instance.url
                };
            });

        console.log(`🔄 Loaded ${this.targetInstances.length} registered instances`);
        console.log(`📡 Generated ${this.proxyInstances.length} proxy instances`);
    }

    // Generate a proxy path from a FogLAMP URL
    generateProxyPath(url) {
        try {
            const parsed = new URL(url);
            const host = parsed.hostname;
            const port = parsed.port || this.DEFAULT_FOGLAMP_PORT;
            
            // Create a simple identifier from IP/hostname
            if (host === '127.0.0.1' || host === 'localhost') {
                return 'local';
            } else {
                // Create path like "192-168-0-208" or "hostname"
                return host.replace(/\./g, '-').toLowerCase();
            }
        } catch (error) {
            // Fallback: use a hash of the URL
            return 'instance-' + Math.abs(url.split('').reduce((a,b) => {
                a = ((a << 5) - a) + b.charCodeAt(0);
                return a & a;
            }, 0)).toString(16);
        }
    }

    // Get proxy configuration for the simple-proxy.js server
    getProxyConfiguration() {
        const config = {};
        
        this.targetInstances.forEach(instance => {
            const proxyPath = this.generateProxyPath(instance.url);
            config[proxyPath] = instance.url;
        });
        
        return config;
    }

    // Detect Excel environment
    detectEnvironment() {
        try {
            // Check if we're in Office Online (Excel Web)
            const isOfficeOnline = typeof Office !== 'undefined' && 
                                 Office.context && 
                                 Office.context.host && 
                                 Office.context.host.toLowerCase().includes('excel') &&
                                 (window.location.hostname.includes('office.com') || 
                                  window.location.hostname.includes('live.com') ||
                                  window.location.hostname.includes('sharepoint.com') ||
                                  window.location.protocol === 'https:' && window.parent !== window);

            // Additional web detection
            const hasWebIndicators = window.navigator.userAgent.includes('Excel') || 
                                   window.location.href.includes('office.com') ||
                                   document.referrer.includes('office.com');

            if (isOfficeOnline || hasWebIndicators) {
                this.environment = 'web';
                this.connectionStrategy = 'proxy-fallback';
            } else {
                this.environment = 'desktop';
                this.connectionStrategy = 'direct';
            }
            
            console.log(`🔍 Environment detected: ${this.environment} (strategy: ${this.connectionStrategy})`);
            return this.environment;
            
        } catch (error) {
            console.warn('Environment detection failed, assuming desktop:', error);
            this.environment = 'desktop';
            this.connectionStrategy = 'direct';
            return this.environment;
        }
    }

    // Check if proxy server is available and configure it
    async checkProxyAvailability() {
        try {
            const controller = new AbortController();
            setTimeout(() => controller.abort(), this.PROXY_TIMEOUT_MS);

            const response = await fetch(`${this.PROXY_BASE_URL}/health`, {
                method: 'GET',
                signal: controller.signal
            });

            if (response.ok) {
                this.proxyAvailable = true;
                console.log('✅ Proxy server available');
                
                // Configure the proxy server with current instances
                await this.configureProxyServer();
                
                return true;
            }
        } catch (error) {
            console.log('ℹ️  Proxy server not available');
        }
        
        this.proxyAvailable = false;
        return false;
    }

    // Configure the proxy server with current registered instances
    async configureProxyServer() {
        try {
            const proxyConfig = this.getProxyConfiguration();
            
            const response = await fetch(`${this.PROXY_BASE_URL}/config`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    instances: proxyConfig
                })
            });

            if (response.ok) {
                const result = await response.json();
                console.log('📡 Proxy server configured with instances:', result.instances);
                
                // Update proxy instances based on what was actually configured
                this.proxyInstances = Object.keys(proxyConfig).map((path, index) => ({
                    name: `${path.replace(/-/g, '.')} (Proxy)`,
                    url: `${this.PROXY_BASE_URL}/${path}`,
                    priority: index + 1,
                    originalUrl: proxyConfig[path]
                }));
                
                return true;
            } else {
                console.warn('⚠️  Failed to configure proxy server');
                return false;
            }
        } catch (error) {
            console.warn('⚠️  Error configuring proxy server:', error.message);
            return false;
        }
    }

    // Test direct connection to instance
    async testDirectConnection(instance) {
        try {
            const controller = new AbortController();
            setTimeout(() => controller.abort(), this.CONNECTION_TIMEOUT_MS);

            const response = await fetch(`${instance.url}/foglamp/ping`, {
                method: 'GET',
                mode: 'cors',
                signal: controller.signal
            });

            if (response.ok) {
                const data = await response.json();
                return {
                    ...instance,
                    accessible: true,
                    method: 'direct',
                    health: data.health,
                    hostname: data.hostName,
                    uptime: data.uptime
                };
            }
        } catch (error) {
            // Expected for private networks in web environment
        }

        return { ...instance, accessible: false, method: 'direct' };
    }

    // Test proxy connection to instance
    async testProxyConnection(instance) {
        try {
            const controller = new AbortController();
            setTimeout(() => controller.abort(), this.CONNECTION_TIMEOUT_MS);

            const response = await fetch(`${instance.url}/foglamp/ping`, {
                method: 'GET',
                signal: controller.signal
            });

            if (response.ok) {
                const data = await response.json();
                return {
                    ...instance,
                    accessible: true,
                    method: 'proxy',
                    health: data.health,
                    hostname: data.hostName,
                    uptime: data.uptime
                };
            }
        } catch (error) {
            // Proxy not working for this instance
        }

        return { ...instance, accessible: false, method: 'proxy' };
    }

    // Smart discovery based on environment
    async discoverInstances() {
        console.log(`🔍 Discovering instances for ${this.environment} environment...`);
        
        // First, load user-registered instances
        this.loadUserRegisteredInstances();
        
        this.availableInstances.clear();
        const results = [];

        if (this.environment === 'desktop') {
            // Desktop: Try direct connections to all instances
            console.log('📱 Desktop environment: Testing direct connections...');
            
            const directTests = await Promise.allSettled(
                this.targetInstances.map(instance => this.testDirectConnection(instance))
            );

            directTests.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value.accessible) {
                    this.availableInstances.set(result.value.name, result.value);
                    results.push(result.value);
                }
            });

        } else {
            // Web environment: Try proxy first, then localhost fallback
            console.log('🌐 Web environment: Testing connections...');
            
            await this.checkProxyAvailability();
            
            if (this.proxyAvailable) {
                console.log('📡 Trying proxy connections...');
                
                const proxyTests = await Promise.allSettled(
                    this.proxyInstances.map(instance => this.testProxyConnection(instance))
                );

                proxyTests.forEach((result, index) => {
                    if (result.status === 'fulfilled' && result.value.accessible) {
                        this.availableInstances.set(result.value.name, result.value);
                        results.push(result.value);
                    }
                });
            }
            
            // Always test localhost directly (should work in web)
            console.log('🏠 Testing direct localhost connection...');
            const localInstance = this.targetInstances[0]; // 127.0.0.1:8081
            const localResult = await this.testDirectConnection(localInstance);
            
            if (localResult.accessible) {
                this.availableInstances.set(localResult.name, localResult);
                results.push(localResult);
            }
        }

        console.log(`✅ Discovery complete: ${results.length} instances available`);
        results.forEach(instance => {
            console.log(`   ${instance.name} (${instance.method}): ${instance.url}`);
        });

        return results;
    }

    // Get available instances sorted by priority
    getAvailableInstances() {
        return Array.from(this.availableInstances.values())
            .filter(instance => instance.accessible)
            .sort((a, b) => a.priority - b.priority);
    }

    // Get best instance for API calls
    getBestInstance() {
        const available = this.getAvailableInstances();
        return available.length > 0 ? available[0] : null;
    }

    // Smart fetch with automatic fallback
    async smartFetch(endpoint, options = {}) {
        const sortedInstances = this.getAvailableInstances();
        
        if (sortedInstances.length === 0) {
            throw new Error('No FogLAMP instances are available');
        }

        for (const instance of sortedInstances) {
            try {
                const response = await fetch(`${instance.url}${endpoint}`, {
                    mode: 'cors',
                    ...options
                });

                if (response.ok) {
                    console.log(`✅ Success via ${instance.name} (${instance.method})`);
                    return response;
                }
            } catch (error) {
                console.log(`❌ ${instance.name} failed:`, error.message);
                // Mark temporarily inaccessible
                instance.accessible = false;
            }
        }

        throw new Error('All FogLAMP instances are unreachable');
    }

    // Get connection status message for UI
    getConnectionStatus() {
        const available = this.getAvailableInstances();
        const total = this.targetInstances.length;
        
        if (available.length === 0) {
            return {
                status: 'error',
                message: 'No FogLAMP instances accessible',
                suggestion: this.environment === 'web' && !this.proxyAvailable 
                    ? 'Run the proxy server to access remote instances'
                    : 'Check if FogLAMP instances are running'
            };
        }

        if (available.length === total) {
            return {
                status: 'success',
                message: `All ${total} FogLAMP instances accessible`,
                suggestion: null
            };
        }

        const missingCount = total - available.length;
        return {
            status: 'partial',
            message: `${available.length}/${total} FogLAMP instances accessible`,
            suggestion: this.environment === 'web' && !this.proxyAvailable
                ? `${missingCount} remote instances need proxy server`
                : `${missingCount} instances may be offline`
        };
    }
}

// Enhanced API functions using smart manager
const smartManager = new SmartFogLAMPManager();

async function foglampPingSmart() {
    const response = await smartManager.smartFetch('/foglamp/ping');
    return response.json();
}

async function foglampStatisticsSmart() {
    const response = await smartManager.smartFetch('/foglamp/statistics');
    return response.json();
}

async function foglampAssetsSmart() {
    const response = await smartManager.smartFetch('/foglamp/asset');
    return response.json();
}

async function foglampAssetReadingsSmart(asset, datapoint, limit) {
    const dp = (datapoint || "").trim();
    const path = dp ? `/foglamp/asset/${asset}/${dp}` : `/foglamp/asset/${asset}`;
    const params = new URLSearchParams();
    if (limit != null) params.set("limit", String(limit));
    
    // Add other parameters as needed (skip, seconds, minutes, etc.)
    const skipVal = document.getElementById("fl-skip")?.value;
    if (skipVal) params.set("skip", String(parseInt(skipVal, 10)));
    
    const endpoint = `${path}?${params.toString()}`;
    const response = await smartManager.smartFetch(endpoint);
    return response.json();
}

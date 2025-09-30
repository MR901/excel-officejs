#!/usr/bin/env node
// Simple FogLAMP Proxy Server
// Run: node simple-proxy.js
// No dependencies needed - uses built-in Node.js modules only

const http = require('http');
const https = require('https');
const url = require('url');

// Configuration
const PROXY_PORT = 3001;
// Allow multiple origins commonly used by Excel Web and local dev
const ALLOWED_ORIGINS = new Set([
    'https://mr901.github.io',
    'https://excel.officeapps.live.com',
    'https://office.live.com',
    'https://www.office.com',
    'https://*.sharepoint.com',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
]);

// Dynamic FogLAMP instances - will be populated at runtime
let INSTANCES = {
    'local': 'http://127.0.0.1:8081' // Default local instance
};

// Note: Instances are updated dynamically via the /config POST endpoint

// CORS headers
function setCORSHeaders(res, req) {
    const reqOrigin = req && req.headers && req.headers.origin;
    let allowOrigin = 'https://mr901.github.io';
    if (reqOrigin) {
        // Simple wildcard support for *.sharepoint.com
        const isSharePoint = /https?:\/\/([a-z0-9-]+\.)*sharepoint\.com$/i.test(reqOrigin);
        if (ALLOWED_ORIGINS.has(reqOrigin) || isSharePoint) {
            allowOrigin = reqOrigin;
        }
    }
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
}

// Forward request to FogLAMP instance
function proxyRequest(instanceUrl, clientReq, clientRes, path) {
    const targetUrl = url.parse(instanceUrl + path);
    const requestModule = targetUrl.protocol === 'https:' ? https : http;
    
    const options = {
        hostname: targetUrl.hostname,
        port: targetUrl.port,
        path: targetUrl.path,
        method: clientReq.method,
        headers: {
            ...clientReq.headers,
            host: targetUrl.host
        }
    };

    const proxyReq = requestModule.request(options, (proxyRes) => {
        setCORSHeaders(clientRes);
        clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(clientRes);
    });

    proxyReq.on('error', (error) => {
        console.error(`❌ Proxy error for ${instanceUrl}:`, error.message);
        setCORSHeaders(clientRes);
        clientRes.writeHead(500, {'Content-Type': 'application/json'});
        clientRes.end(JSON.stringify({
            error: 'FogLAMP instance unreachable',
            instance: instanceUrl,
            details: error.message
        }));
    });

    // Forward request body if present
    clientReq.pipe(proxyReq);
}

// Create proxy server
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        setCORSHeaders(res, req);
        res.writeHead(200);
        res.end();
        return;
    }

    // Health check endpoint
    if (pathname === '/health') {
        setCORSHeaders(res, req);
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({
            status: 'ok',
            instances: Object.keys(INSTANCES),
            timestamp: new Date().toISOString()
        }));
        return;
    }

    // Configuration endpoint - allows Excel add-in to update proxy instances
    if (pathname === '/config') {
        setCORSHeaders(res, req);
        
        if (req.method === 'GET') {
            // Return current configuration
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({
                instances: INSTANCES,
                timestamp: new Date().toISOString()
            }));
            return;
        }
        
        if (req.method === 'POST') {
            // Update configuration
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            
            req.on('end', () => {
                try {
                    const newConfig = JSON.parse(body);
                    if (newConfig.instances && typeof newConfig.instances === 'object') {
                        INSTANCES = { ...INSTANCES, ...newConfig.instances };
                        console.log('🔄 Configuration updated via API:', Object.keys(INSTANCES));
                        
                        res.writeHead(200, {'Content-Type': 'application/json'});
                        res.end(JSON.stringify({
                            status: 'success',
                            message: 'Instances configuration updated',
                            instances: Object.keys(INSTANCES),
                            timestamp: new Date().toISOString()
                        }));
                    } else {
                        res.writeHead(400, {'Content-Type': 'application/json'});
                        res.end(JSON.stringify({
                            status: 'error',
                            message: 'Invalid configuration format. Expected: {"instances": {...}}'
                        }));
                    }
                } catch (error) {
                    res.writeHead(400, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({
                        status: 'error',
                        message: 'Invalid JSON in request body',
                        error: error.message
                    }));
                }
            });
            return;
        }
    }

    // Route to instances
    for (const [instanceName, instanceUrl] of Object.entries(INSTANCES)) {
        const prefix = `/${instanceName}`;
        if (pathname.startsWith(prefix)) {
            const remainingPath = pathname.substring(prefix.length);
            console.log(`📡 Proxying ${instanceName}: ${req.method} ${remainingPath}`);
            proxyRequest(instanceUrl, req, res, remainingPath);
            return;
        }
    }

    // 404 for unknown routes
    setCORSHeaders(res, req);
    res.writeHead(404, {'Content-Type': 'application/json'});
    
    // Generate dynamic examples based on current instances
    const instanceNames = Object.keys(INSTANCES);
    const examples = instanceNames.slice(0, 3).map((name, index) => {
        const endpoints = ['/foglamp/ping', '/foglamp/statistics', '/foglamp/asset'];
        return `/${name}${endpoints[index] || '/foglamp/ping'}`;
    });
    
    res.end(JSON.stringify({
        error: 'Route not found',
        availableInstances: instanceNames.map(name => `/${name}`),
        examples: examples.length > 0 ? examples : ['/local/foglamp/ping'],
        tip: 'Use POST /config to add more instances dynamically'
    }));
});

// Start server
server.listen(PROXY_PORT, () => {
    console.log('🚀 FogLAMP Proxy Server started');
    console.log(`📡 Listening on: http://localhost:${PROXY_PORT}`);
    console.log(`🌐 CORS dynamic origins enabled`);
    console.log('\n📋 Available endpoints:');
    
    Object.keys(INSTANCES).forEach(name => {
        console.log(`   /${name}/foglamp/ping   → ${INSTANCES[name]}`);
    });
    
    console.log(`\n🏥 Health check: http://localhost:${PROXY_PORT}/health`);
    console.log('\n⭐ Your Excel add-in can now access all instances!');
    console.log('⏹️  Press Ctrl+C to stop the proxy');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down FogLAMP Proxy Server...');
    server.close(() => {
        console.log('✅ Proxy server stopped');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Proxy server terminated');
    process.exit(0);
});

#!/usr/bin/env node
// Simple FogLAMP Proxy Server
// Run: node simple-proxy.js
// No dependencies needed - uses built-in Node.js modules only

const http = require('http');
const https = require('https');
const fs = require('fs');
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
// Request correlation
let REQUEST_COUNTER = 0;
function nextRequestId() {
    REQUEST_COUNTER += 1;
    return String(REQUEST_COUNTER).padStart(6, '0');
}

// CORS headers
function setCORSHeaders(res, req) {
    console.log(`reached-3`);
    const reqOrigin = req && req.headers && req.headers.origin;
    let allowOrigin = '*';
    // let allowOrigin = 'https://mr901.github.io';
    if (reqOrigin) {
        // Simple wildcard support for *.sharepoint.com
        const isSharePoint = /https?:\/\/([a-z0-9-]+\.)*sharepoint\.com$/i.test(reqOrigin);
        if (ALLOWED_ORIGINS.has(reqOrigin) || isSharePoint) {
            allowOrigin = reqOrigin;
        }
    }
    const requestedMethod = req && req.headers && req.headers['access-control-request-method'];
    const requestedHeaders = req && req.headers && req.headers['access-control-request-headers'];

    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Access-Control-Allow-Methods', requestedMethod ? `${requestedMethod}, OPTIONS` : 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', requestedHeaders || 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
    if (req && req._requestId) {
        console.log(`   [${req._requestId}] CORS Allow-Origin -> ${allowOrigin}`);
        if (requestedMethod) console.log(`   [${req._requestId}] CORS Requested-Method -> ${requestedMethod}`);
        if (requestedHeaders) console.log(`   [${req._requestId}] CORS Requested-Headers -> ${requestedHeaders}`);
    }
}

// Forward request to FogLAMP instance
function proxyRequest(instanceUrl, clientReq, clientRes, path, requestId) {
    console.log(`reached-2`);
    // Normalize path to start with a single leading slash
    const normalizedPath = path && path.startsWith('/') ? path : `/${path || ''}`;
    // Build a robust target URL using WHATWG URL to avoid bad concatenation
    const base = instanceUrl.endsWith('/') ? instanceUrl : `${instanceUrl}/`;
    const targetUrl = new URL(normalizedPath.replace(/^\/+/, ''), base);
    const requestModule = targetUrl.protocol === 'https:' ? https : http;
    const startMs = Date.now();
    console.log(`🔀 [${requestId}] Forwarding ${clientReq.method} ${normalizedPath} -> ${targetUrl.href}`);
    
    const options = {
        hostname: targetUrl.hostname,
        port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
        path: `${targetUrl.pathname}${targetUrl.search}`,
        method: clientReq.method,
        headers: {
            ...clientReq.headers,
            host: targetUrl.host
        }
    };

    const proxyReq = requestModule.request(options, (proxyRes) => {
        setCORSHeaders(clientRes, clientReq);
        clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
        let responseBytes = 0;
        proxyRes.on('data', (chunk) => {
            responseBytes += chunk.length;
        });
        proxyRes.on('end', () => {
            const durationMs = Date.now() - startMs;
            console.log(`✅ [${requestId}] ${clientReq.method} ${path} -> ${proxyRes.statusCode} in ${durationMs}ms (${responseBytes} bytes)`);
        });
        proxyRes.pipe(clientRes);
    });

    proxyReq.on('error', (error) => {
        const durationMs = Date.now() - startMs;
        console.error(`❌ [${requestId}] Proxy error for ${instanceUrl}${path} after ${durationMs}ms: ${error.message}`);
        setCORSHeaders(clientRes, clientReq);
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

// Common request handler
function requestListener(req, res) {
    console.log(`reached-1`);
    const requestId = nextRequestId();
    req._requestId = requestId;
    const remote = req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : 'unknown';
    const origin = req.headers && req.headers.origin ? req.headers.origin : 'n/a';
    const contentType = req.headers && req.headers['content-type'] ? req.headers['content-type'] : 'n/a';
    const contentLength = req.headers && req.headers['content-length'] ? req.headers['content-length'] : 'n/a';
    console.log(`➡️  [${requestId}] ${req.method} ${req.url} from ${remote}`);
    console.log(`   [${requestId}] Origin: ${origin} | Content-Type: ${contentType} | Content-Length: ${contentLength}`);

    req.on('aborted', () => {
        console.warn(`⚠️  [${requestId}] Client aborted request`);
    });
    req.on('close', () => {
        // Close without status, informational only
        console.log(`↘️  [${requestId}] Connection closed`);
    });

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        setCORSHeaders(res, req);
        res.writeHead(200);
        res.end();
        console.log(`🟡 [${requestId}] Handled CORS preflight for ${pathname}`);
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
        console.log(`🩺 [${requestId}] Health responded OK`);
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
            console.log(`⚙️  [${requestId}] Returned proxy configuration`);
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
                    console.log(`⚙️  [${requestId}] Received /config POST body (${body.length} bytes)`);
                    const newConfig = JSON.parse(body);
                    if (newConfig.instances && typeof newConfig.instances === 'object') {
                        INSTANCES = { ...INSTANCES, ...newConfig.instances };
                        console.log(`🔄 [${requestId}] Configuration updated via API → Instances: ${Object.keys(INSTANCES).join(', ')}`);
                        
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
                        console.warn(`⚠️  [${requestId}] Invalid configuration format`);
                    }
                } catch (error) {
                    res.writeHead(400, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({
                        status: 'error',
                        message: 'Invalid JSON in request body',
                        error: error.message
                    }));
                    console.error(`❌ [${requestId}] Invalid JSON in /config POST: ${error.message}`);
                }
            });
            return;
        }
    }

    // Route to instances
    for (const [instanceName, instanceUrl] of Object.entries(INSTANCES)) {
        const prefix = `/${instanceName}`;
        if (pathname.startsWith(prefix)) {
            let remainingPath = pathname.substring(prefix.length);
            if (remainingPath.length === 0) {
                remainingPath = '/';
            }
            console.log(`📡 [${requestId}] Proxying ${instanceName}: ${req.method} ${remainingPath}`);
            proxyRequest(instanceUrl, req, res, remainingPath, requestId);
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
    console.warn(`❓ [${requestId}] Route not found: ${pathname}`);
}

// Create HTTP or HTTPS server depending on env
const ENABLE_HTTPS = process.env.HTTPS === '1' || process.env.HTTPS === 'true';
const SSL_KEY_PATH = process.env.SSL_KEY_PATH;
const SSL_CERT_PATH = process.env.SSL_CERT_PATH;
let server;
if (ENABLE_HTTPS && SSL_KEY_PATH && SSL_CERT_PATH) {
    try {
        const key = fs.readFileSync(SSL_KEY_PATH);
        const cert = fs.readFileSync(SSL_CERT_PATH);
        server = https.createServer({ key, cert }, requestListener);
        console.log('🔒 HTTPS mode enabled');
    } catch (err) {
        console.error(`⚠️  Failed to load SSL certs (${err.message}). Falling back to HTTP.`);
        server = http.createServer(requestListener);
    }
} else {
    server = http.createServer(requestListener);
    if (ENABLE_HTTPS) {
        console.warn('⚠️  HTTPS requested but SSL_KEY_PATH / SSL_CERT_PATH not set; using HTTP');
    }
}

// Surface lower-level HTTP parser errors
server.on('clientError', (err, socket) => {
    console.error(`⚠️  clientError: ${err && err.message ? err.message : String(err)}`);
    try {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    } catch (_) {
        try { socket.destroy(); } catch (_) {}
    }
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
    console.log('\n🌍 Allowed origins:');
    ALLOWED_ORIGINS.forEach(o => console.log(`   ${o}`));
    console.log('   *.sharepoint.com (wildcard)');
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

// Global error visibility
process.on('unhandledRejection', (reason) => {
    console.error('🚨 Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('🚨 Uncaught exception:', err && err.stack ? err.stack : err);
});

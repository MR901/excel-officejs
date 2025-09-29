/**
 * Configuration constants for FogLAMP DataLink
 * Centralized location for all configuration values, constants, and defaults
 */

// Storage keys for localStorage
export const STORAGE_KEYS = {
    INSTANCES: "FOGLAMP_INSTANCES",
    ACTIVE: "FOGLAMP_ACTIVE"
};

// Enhanced storage keys (includes backward compatibility)
export const ENHANCED_STORAGE_KEYS = {
    ...STORAGE_KEYS,
    INSTANCE_METADATA: 'foglamp_instance_metadata'
};

// Instance status constants to prevent inconsistencies
export const INSTANCE_STATUS = {
    SUCCESS: 'success',
    FAILED: 'failed', 
    CHECKING: 'checking',
    UNKNOWN: 'unknown'
};

// Default configuration values
export const DEFAULTS = {
    PING_TIMEOUT: 5000,
    SYNC_DEBOUNCE_DELAY: 300,
    ASSET_DEBOUNCE_DELAY: 100,
    CONSOLE_HEIGHT: 28
};

// Smart connection configuration
export const CONNECTION_CONFIG = {
    PROXY_PORT: 3001,
    DEFAULT_FOGLAMP_PORT: 8081,
    PROXY_TIMEOUT_MS: 3000,
    CONNECTION_TIMEOUT_MS: 5000,
    PROXY_BASE_URL: 'http://localhost:3001'
};

/**
 * Instance metadata structure reference:
 * {
 *   url: string,
 *   name: string,               // User-provided or generated name
 *   hostName: string,           // From ping response or URL parsing
 *   lastStatus: 'success'|'failed'|'checking'|'unknown',
 *   lastPingMs: number|null,    // Ping time in milliseconds
 *   lastCheckedAt: string|null, // ISO timestamp
 *   lastError: string|null      // Error message if failed
 * }
 */

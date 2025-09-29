/**
 * Utility functions for FogLAMP DataLink
 * Pure functions and helpers used throughout the application
 */

/**
 * Safely extract display name from instance
 * @param {Object} instance - Instance metadata object
 * @returns {string} Safe display name
 */
export function getDisplayName(instance) {
    if (instance?.name) return instance.name;
    if (instance?.hostName) return instance.hostName;
    
    try {
        return new URL(instance.url).hostname;
    } catch (e) {
        // Fallback parsing for malformed URLs
        return instance.url?.replace(/^https?:\/\//, '').split('/')[0] || 'Unknown Instance';
    }
}

/**
 * Get Excel column letter from column index
 * @param {number} colIndex - 0-based column index
 * @returns {string} Excel column letter (A, B, ..., Z, AA, AB, ...)
 */
export function getColumnLetter(colIndex) {
    let result = '';
    while (colIndex >= 0) {
        result = String.fromCharCode(65 + (colIndex % 26)) + result;
        colIndex = Math.floor(colIndex / 26) - 1;
    }
    return result;
}

/**
 * Debounce function execution
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

/**
 * Deep clone an object
 * @param {any} obj - Object to clone
 * @returns {any} Cloned object
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj);
    if (Array.isArray(obj)) return obj.map(deepClone);
    
    const cloned = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            cloned[key] = deepClone(obj[key]);
        }
    }
    return cloned;
}

/**
 * Format timestamp to human readable format
 * @param {string|Date} timestamp - Timestamp to format
 * @returns {string} Formatted timestamp
 */
export function formatTimestamp(timestamp) {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleString();
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid URL
 */
export function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * Extract hostname from URL
 * @param {string} url - URL to parse
 * @returns {string} Hostname or fallback
 */
export function getHostname(url) {
    try {
        return new URL(url).hostname;
    } catch {
        return url?.replace(/^https?:\/\//, '').split('/')[0] || 'unknown';
    }
}

/**
 * Safe parseInt with fallback
 * @param {string|number} value - Value to parse
 * @param {number} fallback - Fallback value if parsing fails
 * @returns {number} Parsed integer or fallback
 */
export function safeParseInt(value, fallback = 0) {
    const parsed = parseInt(value);
    return isNaN(parsed) ? fallback : parsed;
}

/**
 * Sleep/delay function
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise} Promise that resolves after delay
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Truncate string to specified length
 * @param {string} str - String to truncate
 * @param {number} length - Maximum length
 * @param {string} suffix - Suffix to add if truncated
 * @returns {string} Truncated string
 */
export function truncate(str, length = 50, suffix = '...') {
    if (!str || str.length <= length) return str || '';
    return str.substring(0, length - suffix.length) + suffix;
}

/**
 * Generate unique ID
 * @returns {string} Unique identifier
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

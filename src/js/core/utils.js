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
    // Prefer resolved hostName; otherwise show full URL to avoid stale/incorrect hostnames
    if (instance?.hostName) return instance.hostName;
    return instance?.url || 'Unknown Instance';
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
 * Format a Date or date-like value using a limited strftime-style pattern.
 * Supported tokens:
 * %m - month (01-12)
 * %d - day of month (01-31)
 * %Y - 4-digit year
 * %I - hour (01-12)
 * %M - minute (00-59)
 * %S - second (00-59)
 * %p - AM/PM
 *
 * Note: This returns a string for UI/logs. For Excel, prefer passing
 * actual Date objects and apply numberFormat on the range.
 * @param {Date|string|number} input
 * @param {string} pattern e.g. "%m/%d/%Y %I:%M:%S %p"
 * @returns {string}
 */
export function formatDatePattern(input, pattern) {
    if (!input) return '';
    const d = input instanceof Date ? input : new Date(input);
    if (isNaN(d.getTime())) return '';

    const pad2 = (n) => String(n).padStart(2, '0');
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const seconds = d.getSeconds();
    const isPM = hours >= 12;
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;

    const replacements = {
        '%m': pad2(d.getMonth() + 1),
        '%d': pad2(d.getDate()),
        '%Y': String(d.getFullYear()),
        '%I': pad2(hour12),
        '%M': pad2(minutes),
        '%S': pad2(seconds),
        '%p': isPM ? 'PM' : 'AM'
    };

    return pattern.replace(/%[mdYIMSps]/g, (token) => {
        return Object.prototype.hasOwnProperty.call(replacements, token)
            ? replacements[token]
            : token;
    });
}

/**
 * Generate unique ID
 * @returns {string} Unique identifier
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

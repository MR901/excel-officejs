/**
 * UI element selectors for FogLAMP DataLink
 * Centralized access to all DOM elements used throughout the application
 */

/**
 * Enhanced UI element selectors
 * Maps to the redesigned interface components
 */
export const elements = {
    // Overview badges
    environmentBadge: () => document.getElementById("environment-badge"),
    connectivityBadge: () => document.getElementById("connectivity-badge"),
    proxyBadge: () => document.getElementById("proxy-badge"),
    activeInstanceDisplay: () => document.getElementById("active-instance-display"),
    refreshConnections: () => document.getElementById("refresh-connections"),
    resetConnections: () => document.getElementById("reset-connections"),
    proxyGuidance: () => document.getElementById("proxy-guidance"),

    // Add instance form
    baseUrl: () => document.getElementById("fl-base-url"),
    register: () => document.getElementById("fl-register"),
    addFeedback: () => document.getElementById("fl-add-feedback"),
    addActions: () => document.getElementById("fl-add-actions"),
    addConfirm: () => document.getElementById("fl-add-confirm"),
    addSkip: () => document.getElementById("fl-add-skip"),

    // Instance management
    instancesContainer: () => document.getElementById("instances-container"),
    emptyInstances: () => document.getElementById("empty-instances"),
    checkSummary: () => document.getElementById("fl-check-summary"),
    summary: () => document.getElementById("fl-summary"),

    // Data actions
    writeStatus: () => document.getElementById("fl-write-status"),
    assetSelect: () => document.getElementById("fl-asset-select"),
    asset: () => document.getElementById("fl-asset"),
    datapoint: () => document.getElementById("fl-datapoint"),
    limit: () => document.getElementById("fl-limit"),
    skip: () => document.getElementById("fl-skip"),
    seconds: () => document.getElementById("fl-seconds"),
    minutes: () => document.getElementById("fl-minutes"),
    hours: () => document.getElementById("fl-hours"),
    previous: () => document.getElementById("fl-previous"),
    getReadings: () => document.getElementById("fl-get-readings"),

    // Console
    status: () => document.getElementById("fl-status")
};

/**
 * Get element with error handling
 * @param {string} id - Element ID
 * @returns {HTMLElement|null} Element or null if not found
 */
export function getElement(id) {
    try {
        return document.getElementById(id);
    } catch (error) {
        console.warn(`Element not found: ${id}`, error);
        return null;
    }
}

/**
 * Check if element exists and is visible
 * @param {string} id - Element ID
 * @returns {boolean} True if element exists and is visible
 */
export function isElementVisible(id) {
    const element = getElement(id);
    return element && element.offsetParent !== null;
}

/**
 * Safe element property access
 * @param {string} id - Element ID
 * @param {string} property - Property name
 * @returns {any} Property value or null
 */
export function getElementProperty(id, property) {
    const element = getElement(id);
    return element ? element[property] : null;
}

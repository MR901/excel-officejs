/**
 * Instance List Management for FogLAMP DataLink
 * Handles instance list rendering, editing, and UI interactions
 */

import { elements } from './elements.js';
import { getEnhancedInstances, getActiveInstance, updateInstanceMeta } from '../core/storage.js';
import { logMessage } from './console.js';

/**
 * Instance List Manager Class
 * Manages the display and interaction with the instance list
 */
export class InstanceListManager {
    
    constructor() {
        this.editingTimeouts = new Map();
        this.statusIcons = {
            success: '🟢',
            failed: '🔴',
            checking: '🟡', 
            unknown: '⚫'
        };
    }

    /**
     * Initialize the instance list manager
     * Called during system startup to render initial instance list
     */
    initialize() {
        logMessage('info', 'Initializing instance list manager');
        
        // Render the initial instance list
        this.renderInstanceList();
        
        logMessage('info', 'Instance list manager initialized');
    }

    /**
     * Render enhanced instance list with metadata and actions
     * Creates a dynamic list with status dots, names, URLs, and action buttons
     */
    renderInstanceList() {
        const container = elements.instancesContainer();
        const emptyState = elements.emptyInstances();
        if (!container || !emptyState) return;

        const instances = getEnhancedInstances();
        const activeUrl = getActiveInstance();

        // Clear container and remove existing event listeners
        container.innerHTML = '';

        if (instances.length === 0) {
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        // Sort instances: active first, then by reachability and ping time
        const sortedInstances = this.sortInstances(instances, activeUrl);

        // Create instance rows
        sortedInstances.forEach(instance => {
            const row = this.createInstanceRow(instance, activeUrl);
            container.appendChild(row);
        });

        logMessage('info', `Rendered ${instances.length} instances in list`);
    }

    /**
     * Sort instances for optimal display
     * @param {Array} instances - Array of instance objects
     * @param {string} activeUrl - Currently active instance URL
     * @returns {Array} Sorted instances array
     */
    sortInstances(instances, activeUrl) {
        return [...instances].sort((a, b) => {
            // Active instance first
            if (a.url === activeUrl) return -1;
            if (b.url === activeUrl) return 1;
            
            // Then by reachability
            const aReachable = a.lastStatus === 'success';
            const bReachable = b.lastStatus === 'success';
            if (aReachable && !bReachable) return -1;
            if (!aReachable && bReachable) return 1;
            
            // Among reachable, sort by ping time (faster first)
            if (aReachable && bReachable) {
                const aPing = a.lastPingMs || Infinity;
                const bPing = b.lastPingMs || Infinity;
                return aPing - bPing;
            }
            
            // Fallback to URL for consistent ordering
            return a.url.localeCompare(b.url);
        });
    }

    /**
     * Create instance row element with all components
     * @param {Object} instance - Instance metadata object
     * @param {string} activeUrl - Currently active instance URL
     * @returns {HTMLElement} Instance row element
     */
    createInstanceRow(instance, activeUrl) {
        const row = document.createElement('div');
        row.className = 'instance-row';
        if (instance.url === activeUrl) {
            row.classList.add('active');
        }

        // Status dot
        const statusDot = this.createStatusDot(instance);
        
        // Instance info section
        const info = this.createInstanceInfo(instance);
        
        // Actions section  
        const actions = this.createInstanceActions(instance);

        row.appendChild(statusDot);
        row.appendChild(info);
        row.appendChild(actions);

        return row;
    }

    /**
     * Create status dot element
     * @param {Object} instance - Instance metadata object
     * @returns {HTMLElement} Status dot element
     */
    createStatusDot(instance) {
        const dot = document.createElement('div');
        dot.className = `status-dot ${instance.lastStatus || 'unknown'}`;
        dot.title = this.getStatusTitle(instance);
        dot.textContent = this.statusIcons[instance.lastStatus] || this.statusIcons.unknown;
        return dot;
    }

    /**
     * Create instance info section (name, URL, metadata)
     * @param {Object} instance - Instance metadata object
     * @returns {HTMLElement} Instance info element
     */
    createInstanceInfo(instance) {
        const info = document.createElement('div');
        info.className = 'instance-info';

        // Instance name (editable)
        const name = document.createElement('div');
        name.className = 'instance-name';
        
        const displayName = instance.name || instance.hostName || this.extractHostname(instance.url);
        name.textContent = displayName;
        name.title = 'Double-click to edit name';
        
        // Add editable functionality
        name.addEventListener('dblclick', () => this.editInstanceName(instance.url, name));

        // Instance URL
        const url = document.createElement('div');
        url.className = 'instance-url';
        url.textContent = instance.url;

        // Instance metadata (ping time, last checked)
        const metadata = this.createInstanceMetadata(instance);

        info.appendChild(name);
        info.appendChild(url);
        if (metadata) {
            info.appendChild(metadata);
        }

        return info;
    }

    /**
     * Create instance metadata display
     * @param {Object} instance - Instance metadata object
     * @returns {HTMLElement|null} Metadata element or null
     */
    createInstanceMetadata(instance) {
        if (!instance.lastPingMs && !instance.lastCheckedAt) return null;

        const metadata = document.createElement('div');
        metadata.className = 'instance-metadata';

        const parts = [];
        
        if (instance.lastPingMs && instance.lastStatus === 'success') {
            parts.push(`${instance.lastPingMs}ms`);
        }
        
        if (instance.lastCheckedAt) {
            const timeAgo = this.getTimeAgo(instance.lastCheckedAt);
            parts.push(`checked ${timeAgo}`);
        }

        if (parts.length > 0) {
            metadata.textContent = parts.join(' • ');
            return metadata;
        }

        return null;
    }

    /**
     * Create instance action buttons
     * @param {Object} instance - Instance metadata object
     * @returns {HTMLElement} Actions container element
     */
    createInstanceActions(instance) {
        const actions = document.createElement('div');
        actions.className = 'instance-actions';

        // Set Active button
        const setActiveBtn = this.createActionButton('Set Active', 'set-active', () => {
            this.setInstanceActive(instance.url);
        });

        // Ping button
        const pingBtn = this.createActionButton('Ping', 'ping', () => {
            this.pingInstance(instance.url);
        });

        // Remove button
        const removeBtn = this.createActionButton('Remove', 'remove', () => {
            this.removeInstanceWithConfirm(instance.url);
        });

        actions.appendChild(setActiveBtn);
        actions.appendChild(pingBtn);
        actions.appendChild(removeBtn);

        return actions;
    }

    /**
     * Create action button element
     * @param {string} text - Button text
     * @param {string} className - CSS class name
     * @param {Function} clickHandler - Click event handler
     * @returns {HTMLElement} Button element
     */
    createActionButton(text, className, clickHandler) {
        const button = document.createElement('button');
        button.textContent = text;
        button.className = `action-btn ${className}`;
        button.type = 'button';
        button.addEventListener('click', clickHandler);
        return button;
    }

    /**
     * Edit instance name with inline editing
     * @param {string} url - Instance URL
     * @param {HTMLElement} nameElement - Name element to edit
     */
    editInstanceName(url, nameElement) {
        if (!window.getInstanceMeta || !window.updateInstanceMeta) {
            console.warn('Instance metadata functions not available');
            return;
        }

        const currentName = window.getInstanceMeta(url).name || '';
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentName;
        input.style.width = '100%';
        input.style.fontSize = '14px';
        input.style.fontWeight = '600';

        const save = () => {
            const newName = input.value.trim();
            window.updateInstanceMeta(url, { name: newName });
            this.renderInstanceList();
            
            logMessage('info', 'Instance name updated', { 
                url, 
                oldName: currentName, 
                newName 
            });
        };

        const cancel = () => {
            nameElement.textContent = currentName || this.extractHostname(url);
        };

        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') cancel();
        });

        nameElement.replaceWith(input);
        input.focus();
        input.select();
    }

    /**
     * Set instance as active
     * @param {string} url - Instance URL to set as active
     */
    async setInstanceActive(url) {
        if (!window.setActiveInstance) {
            console.warn('setActiveInstance function not available');
            return;
        }

        try {
            window.setActiveInstance(url);
            logMessage('info', 'Active instance changed', { url });
            this.renderInstanceList();
            
            // Update badges if available
            if (window.updateOverviewBadges) {
                window.updateOverviewBadges();
            }
            
            // Load assets for the new active instance
            if (window.loadAssetsForActiveInstance) {
                await window.loadAssetsForActiveInstance();
            }
        } catch (error) {
            logMessage('error', 'Failed to set active instance', { url, error: error.message });
        }
    }

    /**
     * Ping instance and update status
     * @param {string} url - Instance URL to ping
     */
    async pingInstance(url) {
        if (!window.pingInstance) {
            console.warn('pingInstance function not available');
            return;
        }

        try {
            await window.pingInstance(url);
            this.renderInstanceList();
        } catch (error) {
            logMessage('error', 'Ping failed', { url, error: error.message });
        }
    }

    /**
     * Remove instance with confirmation
     * @param {string} url - Instance URL to remove
     */
    removeInstanceWithConfirm(url) {
        if (!window.removeInstance || !window.getInstanceMeta || !window.getDisplayName) {
            console.warn('Required functions not available for instance removal');
            return;
        }

        try {
            const instance = window.getInstanceMeta(url);
            const displayName = window.getDisplayName(instance);
            
            logMessage('info', 'Remove requested', { url, displayName });
            
            if (confirm(`Remove instance "${displayName}"?\n\nURL: ${url}`)) {
                const removed = window.removeInstance(url);
                if (removed) {
                    logMessage('info', 'Instance removed successfully', { url, name: displayName });
                    this.renderInstanceList();
                    
                    // Update badges if available
                    if (window.updateOverviewBadges) {
                        window.updateOverviewBadges();
                    }
                } else {
                    logMessage('warn', 'Failed to remove instance', { url });
                }
            } else {
                logMessage('info', 'Remove cancelled by user', { url });
            }
        } catch (error) {
            logMessage('error', 'Error during instance removal', { url, error: error.message });
        }
    }

    /**
     * Get status title for tooltip
     * @param {Object} instance - Instance metadata object
     * @returns {string} Status description
     */
    getStatusTitle(instance) {
        const statusMessages = {
            success: 'Connected and responding',
            failed: 'Connection failed or unreachable',
            checking: 'Currently checking connection...',
            unknown: 'Status not yet determined'
        };
        
        let title = statusMessages[instance.lastStatus] || statusMessages.unknown;
        
        if (instance.lastPingMs && instance.lastStatus === 'success') {
            title += ` (${instance.lastPingMs}ms)`;
        }
        
        if (instance.lastError && instance.lastStatus === 'failed') {
            title += `\n${instance.lastError}`;
        }
        
        return title;
    }

    /**
     * Extract hostname from URL
     * @param {string} url - Full URL string
     * @returns {string} Hostname or fallback
     */
    extractHostname(url) {
        try {
            return new URL(url).hostname;
        } catch (e) {
            // Fallback parsing for malformed URLs
            return url.replace(/^https?:\/\//, '').split('/')[0] || 'Unknown';
        }
    }

    /**
     * Get human-readable time ago string
     * @param {string} timestamp - ISO timestamp string
     * @returns {string} Time ago description
     */
    getTimeAgo(timestamp) {
        try {
            const now = new Date();
            const then = new Date(timestamp);
            const diffMs = now - then;
            const diffSecs = Math.floor(diffMs / 1000);
            const diffMins = Math.floor(diffSecs / 60);
            const diffHours = Math.floor(diffMins / 60);
            
            if (diffSecs < 60) return `${diffSecs}s ago`;
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            return `${Math.floor(diffHours / 24)}d ago`;
        } catch (e) {
            return 'unknown';
        }
    }

    /**
     * Highlight instance row temporarily
     * @param {string} url - Instance URL to highlight
     * @param {string} type - Highlight type (success, warning, error)
     */
    highlightInstance(url, type = 'success') {
        const container = elements.instancesContainer();
        if (!container) return;
        
        const rows = container.querySelectorAll('.instance-row');
        const targetRow = Array.from(rows).find(row => {
            const urlElement = row.querySelector('.instance-url');
            return urlElement && urlElement.textContent === url;
        });
        
        if (targetRow) {
            targetRow.classList.add(`highlight-${type}`);
            setTimeout(() => {
                targetRow.classList.remove(`highlight-${type}`);
            }, 2000);
        }
    }

    /**
     * Get instance list statistics
     * @returns {Object} Instance list statistics
     */
    getInstanceListStats() {
        const instances = getEnhancedInstances();
        const statusCounts = instances.reduce((acc, instance) => {
            const status = instance.lastStatus || 'unknown';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {});
        
        return {
            total: instances.length,
            active: getActiveInstance() ? 1 : 0,
            statusBreakdown: statusCounts,
            avgPingTime: this.calculateAveragePingTime(instances)
        };
    }

    /**
     * Calculate average ping time for successful instances
     * @param {Array} instances - Array of instances
     * @returns {number|null} Average ping time in ms or null
     */
    calculateAveragePingTime(instances) {
        const successful = instances.filter(i => i.lastStatus === 'success' && i.lastPingMs);
        if (successful.length === 0) return null;
        
        const total = successful.reduce((sum, i) => sum + i.lastPingMs, 0);
        return Math.round(total / successful.length);
    }

    /**
     * Initialize instance list manager
     */
    initialize() {
        this.addInstanceListStyles();
        this.renderInstanceList();
        console.log('✅ Instance list management system initialized');
    }

    /**
     * Add necessary CSS styles for instance list
     */
    addInstanceListStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .instance-row {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 8px;
                border: 1px solid #e5e7eb;
                border-radius: 6px;
                margin-bottom: 6px;
                background: #ffffff;
                transition: all 0.2s ease;
            }
            
            .instance-row:hover {
                background: #f9fafb;
                border-color: #d1d5db;
            }
            
            .instance-row.active {
                background: #f0f9ff;
                border-color: #3b82f6;
            }
            
            .status-dot {
                flex-shrink: 0;
                width: 8px;
                height: 8px;
                border-radius: 50%;
                font-size: 8px;
            }
            
            .status-dot.success { background: #10b981; }
            .status-dot.failed { background: #ef4444; }
            .status-dot.checking { background: #f59e0b; }
            .status-dot.unknown { background: #6b7280; }
            
            .instance-info {
                flex: 1;
                min-width: 0;
            }
            
            .instance-name {
                font-weight: 600;
                color: #1f2937;
                cursor: pointer;
                margin-bottom: 2px;
            }
            
            .instance-name:hover {
                text-decoration: underline;
            }
            
            .instance-url {
                font-size: 11px;
                color: #6b7280;
                font-family: monospace;
                margin-bottom: 2px;
            }
            
            .instance-metadata {
                font-size: 10px;
                color: #9ca3af;
            }
            
            .instance-actions {
                display: flex;
                gap: 4px;
                flex-shrink: 0;
            }
            
            .action-btn {
                padding: 4px 8px;
                font-size: 10px;
                border: 1px solid #d1d5db;
                border-radius: 4px;
                background: #ffffff;
                color: #374151;
                cursor: pointer;
                transition: all 0.15s ease;
            }
            
            .action-btn:hover {
                background: #f3f4f6;
                border-color: #9ca3af;
            }
            
            .action-btn.set-active:hover {
                background: #dbeafe;
                border-color: #3b82f6;
                color: #1d4ed8;
            }
            
            .action-btn.ping:hover {
                background: #ecfdf5;
                border-color: #10b981;
                color: #047857;
            }
            
            .action-btn.remove:hover {
                background: #fef2f2;
                border-color: #f87171;
                color: #dc2626;
            }
            
            .highlight-success {
                background: #dcfce7 !important;
                border-color: #16a34a !important;
                animation: highlight-pulse 1s ease-out;
            }
            
            .highlight-warning {
                background: #fef3c7 !important;
                border-color: #f59e0b !important;
                animation: highlight-pulse 1s ease-out;
            }
            
            .highlight-error {
                background: #fef2f2 !important;
                border-color: #ef4444 !important;
                animation: highlight-pulse 1s ease-out;
            }
            
            @keyframes highlight-pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.02); }
                100% { transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
    }
}

// Create singleton instance
export const instanceListManager = new InstanceListManager();

// Export individual methods for backward compatibility
export const renderInstanceList = () => instanceListManager.renderInstanceList();
export const editInstanceName = (url, nameElement) => instanceListManager.editInstanceName(url, nameElement);

// Export singleton as default
export default instanceListManager;

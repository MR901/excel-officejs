/**
 * Badge and Status Display Management for FogLAMP DataLink
 * Handles overview badges, status displays, and visual feedback
 */

import { elements } from './elements.js';
import { getEnhancedInstances } from '../core/storage.js';

/**
 * Badge Manager Class
 * Manages overview badges and connection status displays
 */
export class BadgeManager {
    
    constructor() {
        this.statusColors = {
            success: '#16a34a',
            failed: '#dc2626', 
            checking: '#f59e0b',
            unknown: '#6b7280'
        };
        
        this.badgeLabels = {
            environment: {
                desktop: 'Excel Desktop',
                web: 'Excel Web',
                unknown: 'Unknown Environment'
            },
            proxy: {
                true: 'Proxy On',
                false: 'Proxy Off',
                unknown: 'Proxy Unknown'
            }
        };
    }

    /**
     * Initialize the badge manager
     * Called during system startup to render initial badges
     */
    initialize() {
        console.log('Badge manager initializing');
        
        // Render the initial badge status
        this.updateOverviewBadges();
        
        console.log('Badge manager initialized');
    }

    /**
     * Update overview badges with current system status
     * Shows environment, connectivity, and proxy status
     */
    updateOverviewBadges() {
        // Ensure smart manager is detected/initialized
        if (window.smartManager && window.smartManager.environment === 'unknown') {
            window.smartManager.detectEnvironment();
        }
        
        const environment = window.smartManager?.environment || 'unknown';
        const proxy = window.smartManager?.proxyAvailable || false;
        const instances = getEnhancedInstances();
        const reachableCount = instances.filter(i => i.lastStatus === 'success').length;
        
        // Debug logging for status calculation
        if (instances.length > 0) {
            const statusBreakdown = instances.reduce((acc, inst) => {
                acc[inst.lastStatus || 'unknown'] = (acc[inst.lastStatus || 'unknown'] || 0) + 1;
                return acc;
            }, {});
            
            console.log('📊 Badge status breakdown:', statusBreakdown);
        }
        
        // Update Environment Badge
        const envBadge = elements.environmentBadge();
        if (envBadge) {
            const envLabel = this.badgeLabels.environment[environment] || environment;
            const envIcon = environment === 'web' ? '🌐' : environment === 'desktop' ? '🖥️' : '❓';
            envBadge.textContent = `${envIcon} ${envLabel}`;
            envBadge.className = `badge ${environment}`;
        }
        
        // Update Connectivity Badge  
        const connBadge = elements.connectivityBadge();
        if (connBadge) {
            if (instances.length === 0) {
                connBadge.textContent = '⚫ No instances';
                connBadge.className = 'badge unknown';
            } else {
                const status = reachableCount > 0 ? 'success' : 'failed';
                connBadge.textContent = `${reachableCount}/${instances.length} connected`;
                connBadge.className = `badge ${status}`;
            }
        }
        
        // Update Proxy Badge
        const proxyBadge = elements.proxyBadge();
        if (proxyBadge) {
            const proxyLabel = this.badgeLabels.proxy[proxy] || 'Proxy Unknown';
            const proxyIcon = proxy ? '🔗' : '❌';
            proxyBadge.textContent = `${proxyIcon} ${proxyLabel}`;
            proxyBadge.className = `badge ${proxy ? 'success' : 'failed'}`;
        }
        
        // Update Active Instance Display
        const activeDisplay = elements.activeInstanceDisplay();
        if (activeDisplay) {
            const activeInstance = instances.find(i => window.FogLAMP.storage.getActiveInstance() === i.url);
            
            if (activeInstance) {
                const displayName = window.FogLAMP.utils.getDisplayName(activeInstance);
                const statusIcon = this.getStatusIcon(activeInstance.lastStatus);
                activeDisplay.innerHTML = `
                    <div class="active-instance">
                        <div class="active-label">Active:</div>
                        <div class="active-details">
                            ${statusIcon} <strong>${displayName}</strong>
                            <div class="active-url">${activeInstance.url}</div>
                        </div>
                    </div>
                `;
                activeDisplay.style.display = 'block';
            } else {
                activeDisplay.innerHTML = '<div class="no-active">No active instance</div>';
                activeDisplay.style.display = 'block';
            }
        }
        
        // Control proxy guidance visibility - only when private/local instances are unreachable in web without proxy
        const hasUnreachablePrivate = instances.some(i => this.isPrivateUrl(i.url) && i.lastStatus === 'failed');
        const anyPrivate = instances.some(i => this.isPrivateUrl(i.url));
        this.updateProxyGuidance(environment, proxy, hasUnreachablePrivate, anyPrivate);
    }

    /**
     * Update connection status display
     * @param {Object} status - Status object with message and suggestion
     */
    updateConnectionStatus() {
        if (!window.smartManager) return;
        
        try {
            const status = window.smartManager.getConnectionStatus();
            this.updateConnectionSummary(status.message);
            
            // Show proxy guidance only when relevant to private/local access issues
            const hasProxySuggestion = status.suggestion && status.suggestion.includes('proxy');
            const proxyGuidance = elements.proxyGuidance();
            if (proxyGuidance) {
                const instances = getEnhancedInstances();
                const env = window.smartManager?.environment || 'unknown';
                const proxy = window.smartManager?.proxyAvailable || false;
                const hasUnreachablePrivate = instances.some(i => this.isPrivateUrl(i.url) && i.lastStatus === 'failed');
                const show = hasProxySuggestion && env === 'web' && !proxy && hasUnreachablePrivate;
                proxyGuidance.style.display = show ? 'block' : 'none';
                if (!show) {
                    proxyGuidance.innerHTML = '';
                }
            }
            
            // Update header styling based on status
            this.updateHeaderStyling(status);
            
        } catch (error) {
            console.error('Failed to update connection status:', error);
        }
    }

    /**
     * Update proxy guidance visibility and content
     * @param {string} environment - Current environment (web/desktop) 
     * @param {boolean} proxy - Proxy availability
     * @param {boolean} hasUnreachableInstances - Whether there are unreachable instances
     */
    updateProxyGuidance(environment, proxy, hasUnreachablePrivateInstances, anyPrivateInstances) {
        const proxyGuidance = elements.proxyGuidance();
        if (!proxyGuidance) return;
        
        // Show guidance only if in web environment, proxy is off, and there are unreachable private/local instances
        const shouldShow = environment === 'web' && !proxy && !!hasUnreachablePrivateInstances && !!anyPrivateInstances;
        proxyGuidance.style.display = shouldShow ? 'block' : 'none';
        
        if (shouldShow) {
            proxyGuidance.innerHTML = `
                <div class="proxy-guidance-content">
                    <strong>⚠️ Private Network Access Issue</strong>
                    <p>Excel Web cannot access private IP addresses (192.168.x.x). 
                       Start the proxy server to enable access:</p>
                    <code>node simple-proxy.js</code>
                    <p><small>Or use Excel Desktop for direct access.</small></p>
                </div>
            `;
        } else {
            proxyGuidance.innerHTML = '';
        }
    }

    /**
     * Determine if a URL points to a private/local network host
     * @param {string} url
     * @returns {boolean}
     */
    isPrivateUrl(url) {
        try {
            const host = new URL(url).hostname.toLowerCase();
            // Localhost and loopback
            if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
            // IPv4 private ranges
            if (host.startsWith('10.')) return true;
            if (host.startsWith('192.168.')) return true;
            if (host.startsWith('172.')) {
                const parts = host.split('.');
                const second = parseInt(parts[1], 10);
                if (second >= 16 && second <= 31) return true;
            }
            // IPv6 Unique Local Address fc00::/7
            if (host.startsWith('fc') || host.startsWith('fd')) return true;
            return false;
        } catch (_e) {
            return false;
        }
    }

    /**
     * Update connection summary display
     * @param {string} message - Summary message to display
     */
    updateConnectionSummary(message) {
        // This is a placeholder for connection summary display
        // Implementation depends on where connection summary is displayed
        console.log('Connection status:', message);
    }

    /**
     * Update header styling based on connection status
     * @param {Object} status - Status object with styling information
     */
    updateHeaderStyling(status) {
        // Update header color or styling based on status
        // Implementation depends on specific header styling requirements
        const header = document.querySelector('.app-header');
        if (header && status.color) {
            header.style.borderColor = status.color;
        }
    }

    /**
     * Get status icon for instance status
     * @param {string} status - Instance status (success, failed, checking, unknown)
     * @returns {string} Status icon
     */
    getStatusIcon(status) {
        const icons = {
            success: '🟢',
            failed: '🔴', 
            checking: '🟡',
            unknown: '⚫'
        };
        return icons[status] || icons.unknown;
    }

    /**
     * Flash badge to indicate update
     * @param {HTMLElement} badge - Badge element to flash
     * @param {string} type - Flash type (success, warning, error)
     */
    flashBadge(badge, type = 'success') {
        if (!badge) return;
        
        const flashClass = `flash-${type}`;
        badge.classList.add(flashClass);
        
        setTimeout(() => {
            badge.classList.remove(flashClass);
        }, 1000);
    }

    /**
     * Get badge status summary
     * @returns {Object} Current badge status information
     */
    getBadgeStatus() {
        const instances = getEnhancedInstances();
        const reachableCount = instances.filter(i => i.lastStatus === 'success').length;
        
        return {
            environment: window.smartManager?.environment || 'unknown',
            proxy: window.smartManager?.proxyAvailable || false,
            instances: {
                total: instances.length,
                reachable: reachableCount,
                unreachable: instances.length - reachableCount
            },
            connectivity: instances.length === 0 ? 'no-instances' : 
                         reachableCount === 0 ? 'all-unreachable' :
                         reachableCount === instances.length ? 'all-reachable' : 'partial'
        };
    }

    /**
     * Initialize badge system
     */
    initialize() {
        // Set up initial badge states
        this.updateOverviewBadges();
        
        // Add CSS classes if needed
        this.addBadgeStyles();
        
        console.log('✅ Badge management system initialized');
    }

    /**
     * Add necessary CSS classes for badges
     */
    addBadgeStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .flash-success { 
                background-color: #10b981 !important;
                animation: flash-pulse 0.5s ease-in-out;
            }
            
            .flash-warning { 
                background-color: #f59e0b !important;
                animation: flash-pulse 0.5s ease-in-out;
            }
            
            .flash-error { 
                background-color: #ef4444 !important;
                animation: flash-pulse 0.5s ease-in-out;
            }
            
            @keyframes flash-pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; transform: scale(1.05); }
            }
            
            .active-instance {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            
            .active-label {
                font-size: 11px;
                color: #6b7280;
                text-transform: uppercase;
                font-weight: 600;
            }
            
            .active-details strong {
                color: #1f2937;
            }
            
            .active-url {
                font-size: 11px;
                color: #6b7280;
                font-family: monospace;
            }
            
            .no-active {
                color: #9ca3af;
                font-style: italic;
                font-size: 13px;
            }
            
            .proxy-guidance-content {
                padding: 8px;
                background: #fef3c7;
                border: 1px solid #f59e0b;
                border-radius: 4px;
                font-size: 12px;
            }
            
            .proxy-guidance-content code {
                background: #374151;
                color: #f3f4f6;
                padding: 2px 4px;
                border-radius: 2px;
                font-family: monospace;
            }
        `;
        document.head.appendChild(style);
    }
}

// Create singleton instance
export const badgeManager = new BadgeManager();

// Export individual methods for backward compatibility
export const updateOverviewBadges = () => badgeManager.updateOverviewBadges();
export const updateConnectionStatus = () => badgeManager.updateConnectionStatus();

// Export singleton as default
export default badgeManager;

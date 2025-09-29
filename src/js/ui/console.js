/**
 * Console and Logging Management for FogLAMP DataLink
 * Handles UI console display, logging, and console resizing functionality
 */

import { elements } from './elements.js';

/**
 * Console Manager Class
 * Manages console logging, display, and UI interactions
 */
export class ConsoleManager {
    
    constructor() {
        this.isDragging = false;
        this.startY = 0;
        this.startH = 0;
        this.setupConsoleResize();
    }

    /**
     * Log message to both browser console and UI console
     * @param {string} level - Log level (info, warn, error)
     * @param {string} message - Log message
     * @param {Object} details - Optional details object
     */
    logMessage(level, message, details = null) {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = `[${level.toUpperCase()}]`;
        const fullMessage = `${timestamp} ${prefix} ${message}`;
        
        // Log to browser console
        const consoleMethod = level === 'error' ? 'error' : (level === 'warn' ? 'warn' : 'log');
        if (details) {
            console[consoleMethod](`${fullMessage}`, details);
        } else {
            console[consoleMethod](fullMessage);
        }
        
        // Log to UI console with enhanced formatting
        const statusElement = elements.status();
        if (statusElement) {
            const levelEmoji = {
                info: '🔹',
                warn: '⚠️',
                error: '❌'
            }[level] || '📝';
            
            const logLine = details ?
                `${levelEmoji} ${fullMessage} ${JSON.stringify(details)}` :
                `${levelEmoji} ${fullMessage}`;
            
            statusElement.textContent += logLine + '\n';
            
            // Auto-scroll to bottom
            statusElement.scrollTop = statusElement.scrollHeight;
            
            // Visual highlight for new entries (brief color flash)
            const colorClass = {
                info: 'log-info',
                warn: 'log-warn',
                error: 'log-error'
            }[level] || 'log-default';
            
            statusElement.classList.add(colorClass);
            setTimeout(() => statusElement.classList.remove(colorClass), 2000);
        }
    }

    /**
     * Clear console logs
     */
    clearConsole() {
        const statusElement = elements.status();
        if (statusElement) {
            statusElement.textContent = '';
            this.logMessage('info', 'Console cleared');
        }
    }

    /**
     * Update summary display in console or summary elements
     * @param {HTMLElement} preEl - Pre element to update
     * @param {Object} payload - Data to display
     */
    updateSummary(preEl, payload) {
        try {
            preEl.textContent = JSON.stringify(payload, null, 2);
        } catch (e) {
            preEl.textContent = String(payload);
        }
    }

    /**
     * Set console height with constraints
     * @param {number} height - Desired height in pixels
     * @returns {number} Actual height set
     */
    setConsoleHeight(height) {
        const minHeight = 28; // Collapsed height (header only)
        const maxHeight = Math.min(500, window.innerHeight * 0.7); // Max 70% of viewport
        const newHeight = Math.max(minHeight, Math.min(maxHeight, height));
        document.documentElement.style.setProperty('--console-height', newHeight + 'px');
        return newHeight;
    }

    /**
     * Setup console resize drag functionality
     */
    setupConsoleResize() {
        const consoleEl = document.querySelector('.app-console');
        const resizerEl = document.querySelector('.console-resizer');
        
        if (!consoleEl || !resizerEl) {
            console.warn('Console resize elements not found');
            return;
        }

        // Mouse event handlers
        const onMouseDown = (e) => {
            this.isDragging = true;
            this.startY = e.clientY;
            this.startH = parseInt(getComputedStyle(consoleEl).height, 10) || 28;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            e.preventDefault();
        };

        const onMouseMove = (e) => {
            if (!this.isDragging) return;
            const dy = this.startY - e.clientY; // Dragging up increases height
            const newHeight = this.startH + dy;
            this.setConsoleHeight(newHeight);
        };

        const onMouseUp = () => {
            this.isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        // Attach events
        resizerEl.addEventListener('mousedown', onMouseDown);
        
        // Touch events for mobile support
        resizerEl.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            this.isDragging = true;
            this.startY = touch.clientY;
            this.startH = parseInt(getComputedStyle(consoleEl).height, 10) || 28;
            e.preventDefault();
        });

        document.addEventListener('touchmove', (e) => {
            if (!this.isDragging) return;
            const touch = e.touches[0];
            const dy = this.startY - touch.clientY;
            const newHeight = this.startH + dy;
            this.setConsoleHeight(newHeight);
            e.preventDefault();
        });

        document.addEventListener('touchend', () => {
            this.isDragging = false;
        });
    }

    /**
     * Setup console event listeners (clear button, etc.)
     */
    setupConsoleEventListeners() {
        const clearBtn = document.getElementById('clear-console');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearConsole());
        }
    }

    /**
     * Initialize console with default settings
     */
    initialize() {
        this.setConsoleHeight(28); // Default collapsed height
        this.setupConsoleEventListeners();
        this.logMessage('info', 'Console system initialized');
    }

    /**
     * Get console statistics
     * @returns {Object} Console usage statistics
     */
    getStats() {
        const statusElement = elements.status();
        const content = statusElement ? statusElement.textContent : '';
        const lines = content.split('\n').filter(line => line.trim());
        
        const stats = {
            totalLines: lines.length,
            infoCount: lines.filter(line => line.includes('🔹') || line.includes('[INFO]')).length,
            warnCount: lines.filter(line => line.includes('⚠️') || line.includes('[WARN]')).length,
            errorCount: lines.filter(line => line.includes('❌') || line.includes('[ERROR]')).length,
            contentLength: content.length
        };
        
        return stats;
    }

    /**
     * Export console content
     * @returns {string} Console content as text
     */
    exportContent() {
        const statusElement = elements.status();
        return statusElement ? statusElement.textContent : '';
    }

    /**
     * Import console content
     * @param {string} content - Content to load into console
     */
    importContent(content) {
        const statusElement = elements.status();
        if (statusElement) {
            statusElement.textContent = content;
            this.logMessage('info', 'Console content imported');
        }
    }
}

// Create singleton instance
export const consoleManager = new ConsoleManager();

// Export individual methods for backward compatibility
export const logMessage = (level, message, details) => consoleManager.logMessage(level, message, details);
export const clearConsole = () => consoleManager.clearConsole();
export const updateSummary = (preEl, payload) => consoleManager.updateSummary(preEl, payload);
export const setConsoleHeight = (height) => consoleManager.setConsoleHeight(height);

// Export singleton as default
export default consoleManager;

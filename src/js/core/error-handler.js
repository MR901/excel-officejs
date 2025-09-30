/**
 * Office.js Compliant Error Handling System
 * Cross-platform error handling with proper dialog integration
 */

export class OfficeErrorHandler {
    constructor() {
        this.platform = this.detectPlatform();
        this.dialogsSupported = this.checkDialogSupport();
    }

    /**
     * Detect the current platform for error handling
     * @returns {string} Platform identifier
     */
    detectPlatform() {
        try {
            if (typeof Office !== 'undefined' && Office.context) {
                if (Office.context.host === Office.HostType.Excel) {
                    return Office.context.platform === Office.PlatformType.OfficeOnline 
                        ? 'excel-web' : 'excel-desktop';
                }
            } else if (typeof google !== 'undefined' && google.script) {
                return 'google-sheets';
            }
        } catch (error) {
            console.warn('Platform detection failed in error handler:', error.message);
        }
        
        return 'unknown';
    }

    /**
     * Check if Office.js dialogs are supported
     * @returns {boolean} True if dialogs are available
     */
    checkDialogSupport() {
        try {
            return (
                typeof Office !== 'undefined' && 
                Office.context && 
                Office.context.ui && 
                typeof Office.context.ui.displayDialogAsync === 'function'
            );
        } catch (error) {
            return false;
        }
    }

    /**
     * Show error to user using the best available method
     * @param {string} title - Error title
     * @param {string} message - Error message
     * @param {Object} options - Additional options
     */
    async showError(title, message, options = {}) {
        const errorDetails = {
            title,
            message,
            platform: this.platform,
            timestamp: new Date().toISOString(),
            ...options
        };

        // Log the error for debugging
        console.error(`[${title}] ${message}`, errorDetails);

        // Also log to the console UI if available
        if (window.logMessage) {
            window.logMessage('error', title, { error: message, ...options });
        }

        // Show error to user based on platform capabilities
        if (this.dialogsSupported) {
            await this.showOfficeDialog(errorDetails);
        } else {
            this.showFallbackError(errorDetails);
        }
    }

    /**
     * Show Office.js dialog for errors
     * @param {Object} errorDetails - Error information
     */
    async showOfficeDialog(errorDetails) {
        try {
            const dialogHtml = this.createErrorDialogHtml(errorDetails);
            const blob = new Blob([dialogHtml], { type: 'text/html' });
            const dialogUrl = URL.createObjectURL(blob);

            const dialogOptions = {
                height: 40,
                width: 50,
                displayInIframe: true
            };

            return new Promise((resolve) => {
                Office.context.ui.displayDialogAsync(dialogUrl, dialogOptions, (result) => {
                    if (result.status === Office.AsyncResultStatus.Succeeded) {
                        const dialog = result.value;
                        
                        // Auto-close after 5 seconds
                        setTimeout(() => {
                            dialog.close();
                            URL.revokeObjectURL(dialogUrl);
                            resolve();
                        }, 5000);

                        // Handle user closing dialog
                        dialog.addEventHandler(Office.EventType.DialogEventReceived, () => {
                            URL.revokeObjectURL(dialogUrl);
                            resolve();
                        });
                    } else {
                        console.warn('Failed to show Office.js error dialog, using fallback');
                        this.showFallbackError(errorDetails);
                        resolve();
                    }
                });
            });
        } catch (error) {
            console.warn('Office.js dialog error, using fallback:', error.message);
            this.showFallbackError(errorDetails);
        }
    }

    /**
     * Create HTML content for error dialog
     * @param {Object} errorDetails - Error information
     * @returns {string} HTML content
     */
    createErrorDialogHtml(errorDetails) {
        return `
<!DOCTYPE html>
<html>
<head>
    <title>FogLAMP Error</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 20px;
            background-color: #fdf2f2;
            color: #721c24;
        }
        .error-container {
            background: white;
            border: 1px solid #f5c6cb;
            border-radius: 6px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .error-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 10px;
            color: #721c24;
        }
        .error-message {
            font-size: 14px;
            line-height: 1.5;
            margin-bottom: 15px;
        }
        .error-details {
            font-size: 12px;
            color: #6c757d;
            border-top: 1px solid #dee2e6;
            padding-top: 10px;
        }
        .close-note {
            text-align: center;
            font-style: italic;
            color: #6c757d;
            margin-top: 15px;
        }
    </style>
</head>
<body>
    <div class="error-container">
        <div class="error-title">⚠️ ${errorDetails.title}</div>
        <div class="error-message">${errorDetails.message}</div>
        <div class="error-details">
            <strong>Platform:</strong> ${errorDetails.platform}<br>
            <strong>Time:</strong> ${new Date(errorDetails.timestamp).toLocaleString()}
        </div>
        <div class="close-note">This dialog will close automatically in 5 seconds</div>
    </div>
</body>
</html>`;
    }

    /**
     * Fallback error display for non-Office.js environments
     * @param {Object} errorDetails - Error information
     */
    showFallbackError(errorDetails) {
        const fallbackMessage = `${errorDetails.title}\n\n${errorDetails.message}\n\nPlatform: ${errorDetails.platform}`;
        
        // Try different fallback methods
        if (typeof alert !== 'undefined') {
            alert(fallbackMessage);
        } else if (console.error) {
            console.error('ERROR DISPLAY:', fallbackMessage);
        }
    }

    /**
     * Show success notification
     * @param {string} title - Success title
     * @param {string} message - Success message
     */
    async showSuccess(title, message) {
        // Log success
        console.log(`[SUCCESS] ${title}: ${message}`);
        
        if (window.logMessage) {
            window.logMessage('info', title, { message });
        }

        // For success, we typically don't need intrusive dialogs
        // Just ensure it's logged and visible in the console
    }

    /**
     * Handle API errors specifically
     * @param {string} operation - What operation failed
     * @param {Error} error - The error object
     * @param {Object} context - Additional context
     */
    async handleApiError(operation, error, context = {}) {
        const errorMessage = this.formatApiErrorMessage(operation, error, context);
        
        await this.showError(
            `API Error: ${operation}`,
            errorMessage,
            { 
                operation,
                error: error.message,
                context,
                type: 'api-error'
            }
        );
    }

    /**
     * Format API error messages for better user understanding
     * @param {string} operation - Operation that failed
     * @param {Error} error - Error object
     * @param {Object} context - Additional context
     * @returns {string} Formatted error message
     */
    formatApiErrorMessage(operation, error, context) {
        const baseMessage = `Failed to ${operation.toLowerCase()}.`;
        
        // Check for common error patterns and provide helpful messages
        if (error.message.includes('Failed to fetch')) {
            return `${baseMessage}\n\nConnection issue: Unable to reach the FogLAMP server. Please check:\n• Server is running\n• Network connection\n• Proxy server (if using Excel Web)`;
        }
        
        if (error.message.includes('CORS')) {
            return `${baseMessage}\n\nCORS error: Cross-origin request blocked. This typically happens when:\n• Using Excel Web without proxy server\n• Server doesn't allow web requests`;
        }
        
        if (error.message.includes('404')) {
            return `${baseMessage}\n\nServer returned 404: The requested resource was not found.\n• Check the instance URL\n• Verify the server is running properly`;
        }
        
        if (error.message.includes('timeout')) {
            return `${baseMessage}\n\nRequest timeout: The server took too long to respond.\n• Server may be overloaded\n• Network connection may be slow`;
        }
        
        // Default message with technical details
        return `${baseMessage}\n\nTechnical details: ${error.message}${context.url ? `\n\nURL: ${context.url}` : ''}`;
    }

    /**
     * Handle network/connectivity errors
     * @param {Error} error - Network error
     * @param {Object} context - Additional context
     */
    async handleNetworkError(error, context = {}) {
        await this.handleApiError('connect to server', error, context);
    }

    /**
     * Get error handler status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            platform: this.platform,
            dialogsSupported: this.dialogsSupported,
            officeJsAvailable: typeof Office !== 'undefined',
            initialized: true
        };
    }
}

// Create singleton instance
export const errorHandler = new OfficeErrorHandler();

// Make available globally
if (typeof window !== 'undefined') {
    window.FogLAMPErrorHandler = errorHandler;
}

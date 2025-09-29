/**
 * Main entry point for FogLAMP DataLink
 * Coordinates initialization and module loading
 */

// Import all the modules we've extracted
import { STORAGE_KEYS, ENHANCED_STORAGE_KEYS, INSTANCE_STATUS, DEFAULTS } from './core/config.js';
import { elements } from './ui/elements.js';
import { getDisplayName, getColumnLetter, debounce, formatTimestamp, isValidUrl } from './core/utils.js';
import { 
    instanceStorage,
    getInstances, 
    addInstance, 
    removeInstance, 
    getActiveInstance, 
    setActiveInstance,
    getInstanceMetadata,
    saveInstanceMetadata,
    getInstanceMeta,
    updateInstanceMeta,
    getEnhancedInstances,
    getActiveInstanceWithMeta,
    normalizeBaseUrl
} from './core/storage.js';
import { 
    consoleManager,
    logMessage,
    clearConsole,
    updateSummary,
    setConsoleHeight
} from './ui/console.js';
import { 
    badgeManager,
    updateOverviewBadges,
    updateConnectionStatus
} from './ui/badges.js';
import { 
    instanceListManager,
    renderInstanceList,
    editInstanceName
} from './ui/instances.js';
import { 
    assetManager,
    loadAssetsForActiveInstance,
    refreshAssetListForActiveInstance,
    syncAssetInputs
} from './assets/manager.js';
import { 
    instancePingManager,
    pingInstance,
    setInstanceActive,
    getInstanceStatistics,
    pingUrlForValidation,
    syncFromSmartManager,
    syncToSmartManager
} from './instances/ping.js';
import { 
    excelIntegrationManager,
    ensureWorksheet,
    handleExportStatus,
    handleExportReadings
} from './excel/integration.js';
import { 
    eventHandlerManager,
    setupEventListeners,
    handleAddInstance,
    handleUpdateConnections
} from './events/handlers.js';

/**
 * Main application class to coordinate initialization
 */
class FogLAMPDataLink {
    constructor() {
        this.config = {
            STORAGE_KEYS,
            ENHANCED_STORAGE_KEYS, 
            INSTANCE_STATUS,
            DEFAULTS
        };
        this.elements = elements;
        this.utils = {
            getDisplayName,
            getColumnLetter, 
            debounce,
            formatTimestamp,
            isValidUrl
        };
        this.storage = instanceStorage;
        this.console = consoleManager;
        this.badges = badgeManager;
        this.instances = instanceListManager;
        this.assets = assetManager;
        this.ping = instancePingManager;
        this.excel = excelIntegrationManager;
        this.events = eventHandlerManager;
        
        // Make all modules available globally during transition
        window.FogLAMP = {
            config: this.config,
            elements: this.elements,
            utils: this.utils,
            storage: this.storage,
            console: this.console,
            badges: this.badges,
            instances: this.instances,
            assets: this.assets,
            ping: this.ping,
            excel: this.excel,
            events: this.events,
            app: this  // Expose the app instance for manual initialization
        };
        
        // Expose individual storage functions globally for backward compatibility
        window.getInstances = getInstances;
        window.addInstance = addInstance;
        window.removeInstance = removeInstance;
        window.getActiveInstance = getActiveInstance;
        window.setActiveInstance = setActiveInstance;
        window.getInstanceMetadata = getInstanceMetadata;
        window.saveInstanceMetadata = saveInstanceMetadata;
        window.getInstanceMeta = getInstanceMeta;
        window.updateInstanceMeta = updateInstanceMeta;
        window.getEnhancedInstances = getEnhancedInstances;
        window.getActiveInstanceWithMeta = getActiveInstanceWithMeta;
        window.normalizeBaseUrl = normalizeBaseUrl;
        window.saveInstances = (instances) => instanceStorage.saveInstances(instances);
        
        // Expose utility functions globally for backward compatibility
        window.getDisplayName = getDisplayName;
        
        // Expose console functions globally for backward compatibility  
        window.logMessage = logMessage;
        window.clearConsole = clearConsole;
        window.updateSummary = updateSummary;
        window.setConsoleHeight = setConsoleHeight;
        
        // Expose UI management functions globally for backward compatibility
        window.updateOverviewBadges = updateOverviewBadges;
        window.updateConnectionStatus = updateConnectionStatus;
        window.renderInstanceList = renderInstanceList;
        window.editInstanceName = editInstanceName;
        
        // Expose asset management functions globally for backward compatibility
        window.loadAssetsForActiveInstance = loadAssetsForActiveInstance;
        window.refreshAssetListForActiveInstance = refreshAssetListForActiveInstance;
        window.syncAssetInputs = syncAssetInputs;
        
        // Expose instance ping functions globally for backward compatibility
        window.pingInstance = pingInstance;
        window.setInstanceActive = setInstanceActive;
        window.getInstanceStatistics = getInstanceStatistics;
        window.pingUrlForValidation = pingUrlForValidation;
        window.syncFromSmartManager = syncFromSmartManager;
        window.syncToSmartManager = syncToSmartManager;
        
        // Expose Excel integration functions globally for backward compatibility
        window.ensureWorksheet = ensureWorksheet;
        window.handleExportStatus = handleExportStatus;
        window.handleExportReadings = handleExportReadings;
        
        // Expose event handler functions globally for backward compatibility
        window.setupEventListeners = setupEventListeners;
        window.handleAddInstance = handleAddInstance;
        window.handleUpdateConnections = handleUpdateConnections;
    }

    /**
     * Initialize the application
     */
    async initialize() {
        try {
            // Wait for Office.js to be ready
            await new Promise(resolve => {
                Office.onReady(() => resolve());
            });

            // Initialize all systems in order
            this.console.initialize();
            this.badges.initialize();
            this.instances.initialize();
            this.assets.initialize();
            this.ping.initialize();
            this.excel.initialize();
            this.events.initialize();
            
            // Set up module cross-dependencies
            this.setupModuleDependencies();

            // Perform initial refresh of connections and overview
            await this.performInitialRefresh();

            console.log('✅ FogLAMP DataLink modules loaded successfully');
            console.log('📋 Available Modules:', {
                config: Object.keys(this.config),
                elements: 'elements object with selectors',
                utils: Object.keys(this.utils),
                storage: 'instanceStorage class with methods',
                console: 'consoleManager class with logging',
                badges: 'badgeManager for status display',
                instances: 'instanceListManager for UI management',
                assets: 'assetManager for asset handling',
                ping: 'instancePingManager for connectivity',
                excel: 'excelIntegrationManager for exports',
                events: 'eventHandlerManager for interactions'
            });
            console.log('🗄️ Storage functions globally available:', {
                getInstances: typeof getInstances,
                addInstance: typeof addInstance,
                removeInstance: typeof removeInstance,
                getActiveInstance: typeof getActiveInstance
            });
            console.log('📝 UI functions globally available:', {
                updateOverviewBadges: typeof updateOverviewBadges,
                renderInstanceList: typeof renderInstanceList,
                loadAssetsForActiveInstance: typeof loadAssetsForActiveInstance,
                pingInstance: typeof pingInstance
            });
            console.log('📊 Excel integration available:', {
                handleExportStatus: typeof handleExportStatus,
                handleExportReadings: typeof handleExportReadings,
                excelApiDetected: typeof Excel !== 'undefined'
            });

        } catch (error) {
            console.error('❌ FogLAMP DataLink initialization failed:', error);
        }
    }

    /**
     * Set up cross-module dependencies and integrations
     */
    setupModuleDependencies() {
        // Configure ping manager with UI update functions
        this.ping.setUIUpdateFunctions(
            () => this.instances.renderInstanceList(),
            () => this.badges.updateOverviewBadges()
        );
        
        // Set up asset manager cache clearing when instances change
        const originalAddInstance = window.addInstance;
        const originalRemoveInstance = window.removeInstance;
        
        window.addInstance = (...args) => {
            const result = originalAddInstance.apply(this, args);
            if (result) {
                this.assets.clearAssetCache(); // Clear cache when instances change
            }
            return result;
        };
        
        window.removeInstance = (...args) => {
            const result = originalRemoveInstance.apply(this, args);
            if (result) {
                this.assets.clearAssetCache(); // Clear cache when instances change
            }
            return result;
        };
        
        console.log('✅ Module dependencies configured');
    }

    /**
     * Perform initial refresh of connections and overview on startup
     * Ensures the overview section is populated when taskpane loads
     */
    async performInitialRefresh() {
        try {
            console.log('🔄 Performing initial system refresh...');
            
            // Small delay to ensure UI elements are fully rendered
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Check if we have any instances to refresh
            const instances = getInstances();
            if (instances && instances.length > 0) {
                console.log(`🔄 Auto-refreshing ${instances.length} instances on startup...`);
                
                // Perform the same comprehensive refresh as "Refresh Connections" button
                if (window.handleUpdateConnections) {
                    await window.handleUpdateConnections();
                    console.log('✅ Initial system refresh completed successfully');
                } else {
                    console.warn('⚠️ handleUpdateConnections not available, falling back to basic UI update');
                    // Fallback: just update UI elements
                    if (window.updateOverviewBadges) {
                        window.updateOverviewBadges();
                    }
                    if (window.renderInstanceList) {
                        window.renderInstanceList();
                    }
                }
            } else {
                console.log('ℹ️ No instances found, updating UI to show empty state');
                // Update UI to show proper empty state
                if (window.updateOverviewBadges) {
                    window.updateOverviewBadges();
                }
                if (window.renderInstanceList) {
                    window.renderInstanceList();
                }
            }
            
        } catch (error) {
            console.error('❌ Initial refresh failed:', error);
            // Don't throw - initialization should continue even if refresh fails
            
            // Ensure basic UI update happens even if refresh fails
            try {
                if (window.updateOverviewBadges) {
                    window.updateOverviewBadges();
                }
                if (window.renderInstanceList) {
                    window.renderInstanceList();
                }
            } catch (fallbackError) {
                console.error('❌ Fallback UI update also failed:', fallbackError);
            }
        }
    }
}

// Create and initialize the application
const app = new FogLAMPDataLink();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.initialize());
} else {
    app.initialize();
}

// Export for global access during transition
export default app;

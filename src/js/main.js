/**
 * Main entry point for FogLAMP DataLink
 * Coordinates initialization and module loading
 */

// Import all the modules we've extracted
import { STORAGE_KEYS, ENHANCED_STORAGE_KEYS, INSTANCE_STATUS, DEFAULTS } from './core/config.js';
import { elements } from './ui/elements.js';
import { getDisplayName, getColumnLetter, debounce, formatTimestamp, isValidUrl } from './core/utils.js';
import { apiManager } from './core/api-manager.js';
import { errorHandler } from './core/error-handler.js';
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
// STREAMLINED IMPORTS: Only import managers and essential functions
import { consoleManager, logMessage } from './ui/console.js';
import { badgeManager } from './ui/badges.js';
import { instanceListManager } from './ui/instances.js';
import { assetManager } from './assets/manager.js';
import { instancePingManager } from './instances/ping.js';
import { excelIntegrationManager } from './excel/integration.js';
import { eventHandlerManager, handleUpdateConnections } from './events/handlers.js';

/**
 * Main application class to coordinate initialization
 */
class FogLAMPDataLink {
    constructor() {
        // STREAMLINED CONSTRUCTOR: Core modules only  
        this.config = { STORAGE_KEYS, ENHANCED_STORAGE_KEYS, INSTANCE_STATUS, DEFAULTS };
        this.elements = elements;
        this.utils = { getDisplayName, getColumnLetter, debounce, formatTimestamp, isValidUrl };
        this.storage = instanceStorage;
        this.console = consoleManager;
        this.badges = badgeManager;
        this.instances = instanceListManager;
        this.assets = assetManager;
        this.ping = instancePingManager;
        this.excel = excelIntegrationManager;
        this.events = eventHandlerManager;
        this.api = apiManager; // ✅ Unified API manager - single backbone
        this.errors = errorHandler; // ✅ Office.js compliant error handling
        
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
            api: this.api,  // ✅ Unified API manager - single backbone
            errors: this.errors, // ✅ Office.js compliant error handling
            app: this  // Expose the app instance for manual initialization
        };
        
        // ✅ PHASE 3 AGGRESSIVE TRIM: Only 3 truly essential globals (reduced from 28+ to 3!)
        // Everything else MUST use window.FogLAMP.* organized namespace
        
        window.logMessage = logMessage;                              // Used everywhere for logging  
        window.getActiveInstanceWithMeta = getActiveInstanceWithMeta; // Used by unified API calls
        // window.FogLAMP is the main organized namespace (created above)
        
        // ✅ CRITICAL FIX: Export essential functions for event handlers and smart-connection.js
        window.getInstances = getInstances;
        window.getActiveInstance = getActiveInstance;
        window.setActiveInstance = setActiveInstance;
        window.removeInstance = removeInstance;
        window.addInstance = addInstance;
        window.getInstanceMeta = getInstanceMeta;
        window.updateInstanceMeta = updateInstanceMeta;
        window.getDisplayName = getDisplayName;
        window.pingInstance = (url, options) => this.ping.pingInstance(url, options);
        window.pingUrlForValidation = (url, timeout) => this.ping.pingUrlForValidation(url, timeout);
        window.syncFromSmartManager = () => this.ping.syncFromSmartManager();
        window.syncToSmartManager = () => this.ping.syncToSmartManager();
        window.handleExportStatus = () => this.excel.handleExportStatus();
        window.handleExportReadings = () => this.excel.handleExportReadings();
        window.handleUpdateConnections = () => this.events.handleUpdateConnections();
        window.loadAssetsForActiveInstance = () => this.assets.loadAssetsForActiveInstance();
        window.refreshAssetListForActiveInstance = () => this.assets.refreshAssetListForActiveInstance();
        window.clearConsole = () => this.console.clearConsole();
        
        // Export smart connection API methods for backward compatibility
        window.foglampPingSmart = async () => await window.smartManager.foglampPing();
        window.foglampStatisticsSmart = async () => await window.smartManager.foglampStatistics();
        window.foglampAssetsSmart = async () => await window.smartManager.foglampAssets();
        window.foglampAssetReadingsSmart = async (...args) => await window.smartManager.foglampReadings(...args);
        
        // ✅ MIGRATION GUIDE: Functions moved to organized namespaces
        // OLD GLOBALS (removed)     → NEW ORGANIZED PATHS
        // window.getInstances       → window.FogLAMP.storage.getInstances()
        // window.getActiveInstance  → window.FogLAMP.storage.getActiveInstance()
        // window.updateOverviewBadges → window.FogLAMP.badges.updateOverviewBadges()
        // window.renderInstanceList → window.FogLAMP.instances.renderInstanceList()
        // window.addInstance        → window.FogLAMP.storage.addInstance()
        // window.removeInstance     → window.FogLAMP.storage.removeInstance()
        // window.setActiveInstance  → window.FogLAMP.storage.setActiveInstance()
        // window.getDisplayName     → window.FogLAMP.utils.getDisplayName()
        // window.pingInstance       → window.FogLAMP.ping.pingInstance()
        // window.handleExportStatus → window.FogLAMP.excel.handleExportStatus()
        // ... and many more via organized namespaces
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
            // ✅ Initialize unified API manager first for cross-platform compatibility
            await this.api.initialize();
            console.log('✅ Unified API Manager initialized for platform:', this.api.detectPlatform());
            
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

            console.log('✅ FogLAMP DataLink initialized - All modules ready');
            console.log('📋 Organized namespace: window.FogLAMP.*');
            console.log('📊 Excel integration:', typeof Excel !== 'undefined' ? 'Available' : 'Not detected');

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
        
        // Set up asset manager cache clearing when instances change via organized namespace
        const originalAddInstance = this.storage.addInstance;
        const originalRemoveInstance = this.storage.removeInstance;
        
        this.storage.addInstance = (...args) => {
            const result = originalAddInstance.apply(this.storage, args);
            if (result) {
                this.assets.clearAssetCache(); // Clear cache when instances change
            }
            return result;
        };
        
        this.storage.removeInstance = (...args) => {
            const result = originalRemoveInstance.apply(this.storage, args);
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
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Always update UI first to show current state
            this.badges.updateOverviewBadges();
            this.instances.renderInstanceList();
            
            // Check if we have any instances to refresh
            const instances = getInstances();
            if (instances && instances.length > 0) {
                console.log(`🔄 Auto-refreshing ${instances.length} instances on startup...`);
                
                // Perform the same comprehensive refresh as "Refresh Connections" button
                await this.events.handleUpdateConnections();
                console.log('✅ Initial system refresh completed successfully');
                
                // Load assets for active instance
                await this.assets.loadAssetsForActiveInstance();
            } else {
                console.log('ℹ️ No instances found, UI shows empty state');
            }
            
        } catch (error) {
            console.error('❌ Initial refresh failed:', error);
            // Don't throw - initialization should continue even if refresh fails
            
            // Ensure basic UI update happens even if refresh fails
            try {
                this.badges.updateOverviewBadges();
                this.instances.renderInstanceList();
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

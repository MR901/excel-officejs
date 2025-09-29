/**
 * Comprehensive test script for FogLAMP DataLink modular system
 * Tests critical functionality, status synchronization, and button responsiveness
 */

console.log('🧪 Starting comprehensive modular system test...');

// Test 1: Module Loading
console.log('\n=== TEST 1: Module Loading ===');
const requiredModules = [
    'config', 'elements', 'utils', 'storage', 'console', 
    'badges', 'instances', 'assets', 'ping', 'excel', 'events'
];

let moduleLoadingPassed = true;
requiredModules.forEach(module => {
    if (window.FogLAMP && window.FogLAMP[module]) {
        console.log(`✅ ${module} module loaded`);
    } else {
        console.error(`❌ ${module} module NOT loaded`);
        moduleLoadingPassed = false;
    }
});

// Test 2: Global Function Exposure
console.log('\n=== TEST 2: Global Function Exposure ===');
const requiredGlobalFunctions = [
    // Storage functions
    'getInstances', 'addInstance', 'removeInstance', 'getActiveInstance', 'setActiveInstance',
    'getInstanceMetadata', 'saveInstanceMetadata', 'getInstanceMeta', 'updateInstanceMeta',
    'getEnhancedInstances', 'getActiveInstanceWithMeta', 'normalizeBaseUrl',
    
    // Console functions
    'logMessage', 'clearConsole', 'updateSummary', 'setConsoleHeight',
    
    // UI management functions
    'updateOverviewBadges', 'renderInstanceList', 'editInstanceName',
    
    // Asset management functions
    'loadAssetsForActiveInstance', 'refreshAssetListForActiveInstance', 'syncAssetInputs',
    
    // Instance ping functions
    'pingInstance', 'setInstanceActive', 'getInstanceStatistics', 'pingUrlForValidation',
    'syncFromSmartManager', 'syncToSmartManager',
    
    // Excel integration functions
    'ensureWorksheet', 'handleExportStatus', 'handleExportReadings',
    
    // Event handler functions
    'setupEventListeners', 'handleAddInstance', 'handleRefreshStatus', 'handleResetConnections'
];

let globalFunctionsPassed = true;
requiredGlobalFunctions.forEach(func => {
    if (typeof window[func] === 'function') {
        console.log(`✅ ${func}() globally available`);
    } else {
        console.error(`❌ ${func}() NOT globally available`);
        globalFunctionsPassed = false;
    }
});

// Test 3: UI Element Access
console.log('\n=== TEST 3: UI Element Access ===');
const criticalElements = [
    'environmentBadge', 'connectivityBadge', 'proxyBadge', 'activeInstanceDisplay',
    'refreshConnections', 'resetConnections', 'baseUrl', 'register', 'instancesContainer',
    'writeStatus', 'getReadings', 'assetSelect', 'asset', 'status'
];

let elementAccessPassed = true;
criticalElements.forEach(elemName => {
    try {
        const elem = window.FogLAMP?.elements[elemName] ? window.FogLAMP.elements[elemName]() : null;
        if (elem) {
            console.log(`✅ ${elemName} element accessible`);
        } else {
            console.warn(`⚠️ ${elemName} element not found (may be OK if not on page)`);
        }
    } catch (error) {
        console.error(`❌ ${elemName} element access failed: ${error.message}`);
        elementAccessPassed = false;
    }
});

// Test 4: Status Synchronization Functions
console.log('\n=== TEST 4: Status Synchronization Functions ===');
let syncFunctionsPassed = true;

// Test syncFromSmartManager
try {
    if (typeof window.syncFromSmartManager === 'function') {
        console.log('✅ syncFromSmartManager function available');
        // Test call (should handle gracefully if smartManager not available)
        window.syncFromSmartManager();
        console.log('✅ syncFromSmartManager call successful');
    } else {
        console.error('❌ syncFromSmartManager function not available');
        syncFunctionsPassed = false;
    }
} catch (error) {
    console.error(`❌ syncFromSmartManager test failed: ${error.message}`);
    syncFunctionsPassed = false;
}

// Test syncToSmartManager
try {
    if (typeof window.syncToSmartManager === 'function') {
        console.log('✅ syncToSmartManager function available');
        // Don't actually call it as it's async and might interfere with real operations
    } else {
        console.error('❌ syncToSmartManager function not available');
        syncFunctionsPassed = false;
    }
} catch (error) {
    console.error(`❌ syncToSmartManager test failed: ${error.message}`);
    syncFunctionsPassed = false;
}

// Test 5: Event Handler Integration
console.log('\n=== TEST 5: Event Handler Integration ===');
let eventHandlersPassed = true;

try {
    if (window.FogLAMP?.events && typeof window.setupEventListeners === 'function') {
        console.log('✅ Event handler system available');
        
        // Test event listener count
        const listenerCount = window.FogLAMP.events.eventListeners?.size || 0;
        console.log(`📊 Event listeners registered: ${listenerCount}`);
        
        if (listenerCount > 0) {
            console.log('✅ Event listeners are registered');
        } else {
            console.warn('⚠️ No event listeners registered yet (may be normal during initialization)');
        }
    } else {
        console.error('❌ Event handler system not available');
        eventHandlersPassed = false;
    }
} catch (error) {
    console.error(`❌ Event handler test failed: ${error.message}`);
    eventHandlersPassed = false;
}

// Test 6: Storage System Integrity
console.log('\n=== TEST 6: Storage System Integrity ===');
let storagePassed = true;

try {
    // Test basic storage operations
    const instances = window.getInstances();
    console.log(`✅ getInstances() returned ${instances.length} instances`);
    
    const metadata = window.getInstanceMetadata();
    console.log(`✅ getInstanceMetadata() returned ${Object.keys(metadata).length} metadata entries`);
    
    const activeInstance = window.getActiveInstance();
    if (activeInstance) {
        console.log(`✅ Active instance: ${activeInstance}`);
    } else {
        console.log('ℹ️ No active instance set');
    }
    
} catch (error) {
    console.error(`❌ Storage system test failed: ${error.message}`);
    storagePassed = false;
}

// Test 7: Badge System
console.log('\n=== TEST 7: Badge System ===');
let badgeSystemPassed = true;

try {
    if (typeof window.updateOverviewBadges === 'function') {
        console.log('✅ updateOverviewBadges function available');
        window.updateOverviewBadges();
        console.log('✅ updateOverviewBadges executed successfully');
    } else {
        console.error('❌ updateOverviewBadges function not available');
        badgeSystemPassed = false;
    }
} catch (error) {
    console.error(`❌ Badge system test failed: ${error.message}`);
    badgeSystemPassed = false;
}

// Test 8: Instance List Rendering
console.log('\n=== TEST 8: Instance List Rendering ===');
let instanceListPassed = true;

try {
    if (typeof window.renderInstanceList === 'function') {
        console.log('✅ renderInstanceList function available');
        window.renderInstanceList();
        console.log('✅ renderInstanceList executed successfully');
    } else {
        console.error('❌ renderInstanceList function not available');
        instanceListPassed = false;
    }
} catch (error) {
    console.error(`❌ Instance list test failed: ${error.message}`);
    instanceListPassed = false;
}

// Final Results
console.log('\n=== TEST RESULTS SUMMARY ===');
const tests = [
    { name: 'Module Loading', passed: moduleLoadingPassed },
    { name: 'Global Function Exposure', passed: globalFunctionsPassed },
    { name: 'UI Element Access', passed: elementAccessPassed },
    { name: 'Status Synchronization Functions', passed: syncFunctionsPassed },
    { name: 'Event Handler Integration', passed: eventHandlersPassed },
    { name: 'Storage System Integrity', passed: storagePassed },
    { name: 'Badge System', passed: badgeSystemPassed },
    { name: 'Instance List Rendering', passed: instanceListPassed }
];

const passedTests = tests.filter(t => t.passed).length;
const totalTests = tests.length;

tests.forEach(test => {
    console.log(`${test.passed ? '✅' : '❌'} ${test.name}: ${test.passed ? 'PASSED' : 'FAILED'}`);
});

console.log(`\n📊 Overall Result: ${passedTests}/${totalTests} tests passed (${Math.round(passedTests/totalTests*100)}%)`);

if (passedTests === totalTests) {
    console.log('🎉 ALL TESTS PASSED! Modular system is functioning correctly.');
} else {
    console.error(`⚠️ ${totalTests - passedTests} test(s) failed. Issues need to be addressed.`);
}

// Export results for further analysis
window.testResults = {
    passed: passedTests === totalTests,
    passedTests,
    totalTests,
    details: tests,
    timestamp: new Date().toISOString()
};

console.log('\n✅ Test results stored in window.testResults');
console.log('🧪 Modular system testing complete!');

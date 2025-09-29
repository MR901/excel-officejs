/**
 * Test Instance List Visibility Fix
 * 
 * This script helps verify that the instance list UI is properly rendering
 * after the initialization fixes.
 */

console.log('🧪 TESTING INSTANCE LIST VISIBILITY FIX');
console.log('========================================');

// Test 1: Check if required functions are available
console.log('\n📋 Test 1: Function Availability');
const requiredFunctions = [
    'getInstances',
    'getEnhancedInstances', 
    'getActiveInstance',
    'renderInstanceList',
    'updateOverviewBadges',
    'debugInstanceList'
];

requiredFunctions.forEach(funcName => {
    const available = typeof window[funcName] !== 'undefined';
    console.log(`- ${funcName}: ${available ? '✅ Available' : '❌ Missing'}`);
});

// Test 2: Check DOM elements
console.log('\n🏗️ Test 2: DOM Element Presence');
const requiredElements = [
    'instances-container',
    'empty-instances',
    'update-connections'
];

requiredElements.forEach(elementId => {
    const element = document.getElementById(elementId);
    console.log(`- #${elementId}: ${element ? '✅ Found' : '❌ Missing'}`);
});

// Test 3: Check current instance data
console.log('\n📊 Test 3: Current Instance Data');
if (window.getInstances) {
    const instances = window.getInstances();
    console.log(`- Stored instances: ${instances.length}`);
    instances.forEach((url, index) => {
        console.log(`  ${index + 1}. ${url}`);
    });
    
    if (window.getEnhancedInstances) {
        const enhanced = window.getEnhancedInstances();
        console.log(`- Enhanced instances: ${enhanced.length}`);
        enhanced.forEach((instance, index) => {
            const name = instance.name || instance.hostName || 'Unnamed';
            const status = instance.lastStatus || 'unknown';
            console.log(`  ${index + 1}. ${name} (${status}) - ${instance.url}`);
        });
    }
    
    if (window.getActiveInstance) {
        const active = window.getActiveInstance();
        console.log(`- Active instance: ${active || 'None'}`);
    }
} else {
    console.log('❌ getInstances function not available');
}

// Test 4: Check FogLAMP global object
console.log('\n🌐 Test 4: FogLAMP Global Object');
if (window.FogLAMP) {
    console.log('✅ window.FogLAMP available');
    console.log('- Available modules:', Object.keys(window.FogLAMP));
    
    if (window.FogLAMP.app) {
        console.log('✅ FogLAMP.app instance available');
        console.log('- App type:', typeof window.FogLAMP.app);
        console.log('- App initialize method:', typeof window.FogLAMP.app.initialize);
    } else {
        console.log('❌ FogLAMP.app instance missing');
    }
} else {
    console.log('❌ window.FogLAMP not available');
}

// Test 5: Force render attempt
console.log('\n🔄 Test 5: Force Rendering Instance List');
if (window.renderInstanceList) {
    try {
        window.renderInstanceList();
        console.log('✅ renderInstanceList() executed successfully');
        
        // Check if instances are now visible
        const container = document.getElementById('instances-container');
        if (container) {
            const instanceRows = container.querySelectorAll('.instance-row');
            const emptyState = document.getElementById('empty-instances');
            const emptyVisible = emptyState && emptyState.style.display !== 'none';
            
            console.log(`- Instance rows found: ${instanceRows.length}`);
            console.log(`- Empty state visible: ${emptyVisible}`);
            
            if (instanceRows.length > 0) {
                console.log('✅ Instance list is now visible!');
                instanceRows.forEach((row, index) => {
                    const name = row.querySelector('.instance-name')?.textContent || 'Unknown';
                    const url = row.querySelector('.instance-url')?.textContent || 'Unknown URL';
                    const statusDot = row.querySelector('.status-dot');
                    const status = statusDot ? statusDot.className.split(' ')[1] : 'unknown';
                    console.log(`  ${index + 1}. ${name} (${status}) - ${url}`);
                });
            } else if (emptyVisible) {
                console.log('ℹ️ Empty state showing (no instances registered)');
            } else {
                console.log('❓ Unclear state - no instances but no empty state either');
            }
        }
    } catch (error) {
        console.log('❌ Error executing renderInstanceList():', error);
    }
} else {
    console.log('❌ renderInstanceList function not available');
}

// Test 6: Provide debugging recommendations
console.log('\n💡 Test 6: Debugging Recommendations');
console.log('If instance list is still not visible:');
console.log('1. 🐞 Run debugInstanceList() in console for detailed debug info');
console.log('2. 🔄 Try manually calling window.renderInstanceList()');
console.log('3. 📊 Check if you have instances: window.getInstances()');
console.log('4. ➕ Add test instance: window.addInstance("http://127.0.0.1:8081")');
console.log('5. 🔄 Refresh page and check console for initialization errors');

console.log('\n🎯 INSTANCE LIST FIX TEST COMPLETE');
console.log('=====================================');

// Return summary for easy console verification
return {
    functionsAvailable: requiredFunctions.filter(f => typeof window[f] !== 'undefined').length,
    totalFunctions: requiredFunctions.length,
    elementsFound: requiredElements.filter(id => document.getElementById(id)).length,
    totalElements: requiredElements.length,
    instanceCount: window.getInstances ? window.getInstances().length : 0,
    fogLAMPAvailable: !!window.FogLAMP,
    appAvailable: !!(window.FogLAMP && window.FogLAMP.app)
};

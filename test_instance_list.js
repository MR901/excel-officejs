/**
 * Test specifically for instance list rendering
 * Focuses on the missing instance details and buttons issue
 */

console.log('🔍 Testing Instance List Rendering...');

function testInstanceListRendering() {
    console.log('\n=== INSTANCE LIST RENDERING TEST ===');
    
    // Test 1: Check if DOM elements exist
    console.log('\n1. Checking DOM elements...');
    const container = document.getElementById('instances-container');
    const emptyState = document.getElementById('empty-instances');
    
    console.log(`instances-container: ${container ? '✅ Found' : '❌ Missing'}`);
    console.log(`empty-instances: ${emptyState ? '✅ Found' : '❌ Missing'}`);
    
    if (!container) {
        console.error('❌ CRITICAL: instances-container element missing from DOM');
        return false;
    }
    
    // Test 2: Check if renderInstanceList function is available
    console.log('\n2. Checking renderInstanceList function...');
    const renderFunction = window.renderInstanceList;
    console.log(`renderInstanceList function: ${typeof renderFunction === 'function' ? '✅ Available' : '❌ Missing'}`);
    
    if (typeof renderFunction !== 'function') {
        console.error('❌ CRITICAL: renderInstanceList function not available globally');
        return false;
    }
    
    // Test 3: Check current instances
    console.log('\n3. Checking current instances...');
    let instances = [];
    if (typeof window.getInstances === 'function') {
        instances = window.getInstances();
        console.log(`Found ${instances.length} registered instances:`, instances);
    } else {
        console.error('❌ getInstances function not available');
        return false;
    }
    
    // Test 4: Check instance metadata
    console.log('\n4. Checking instance metadata...');
    if (typeof window.getEnhancedInstances === 'function') {
        const enhancedInstances = window.getEnhancedInstances();
        console.log(`Enhanced instances: ${enhancedInstances.length}`);
        enhancedInstances.forEach((inst, idx) => {
            console.log(`  ${idx + 1}. ${inst.url} (status: ${inst.lastStatus}, name: ${inst.name || 'none'})`);
        });
    }
    
    // Test 5: Attempt to render the list
    console.log('\n5. Attempting to render instance list...');
    try {
        console.log('Before render - container content:', container.innerHTML.slice(0, 200));
        
        renderFunction();
        
        console.log('After render - container content:', container.innerHTML.slice(0, 200));
        
        // Check if we have instance rows
        const instanceRows = container.querySelectorAll('.instance-row');
        console.log(`Found ${instanceRows.length} instance rows after render`);
        
        instanceRows.forEach((row, idx) => {
            const url = row.querySelector('.instance-url');
            const name = row.querySelector('.instance-name');
            const actions = row.querySelector('.instance-actions');
            const buttons = row.querySelectorAll('button');
            
            console.log(`  Row ${idx + 1}:`);
            console.log(`    URL: ${url ? url.textContent : 'Missing'}`);
            console.log(`    Name: ${name ? name.textContent : 'Missing'}`);
            console.log(`    Actions: ${actions ? '✅' : '❌'}`);
            console.log(`    Buttons: ${buttons.length} found`);
            
            buttons.forEach((btn, btnIdx) => {
                console.log(`      Button ${btnIdx + 1}: "${btn.textContent}" (${btn.className})`);
            });
        });
        
        return instanceRows.length > 0;
        
    } catch (error) {
        console.error('❌ Instance list rendering failed:', error);
        return false;
    }
}

// Test 6: Check specific missing elements
function testMissingElements() {
    console.log('\n=== MISSING ELEMENTS TEST ===');
    
    const elements = [
        'instances-container',
        'empty-instances'
    ];
    
    elements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            console.log(`✅ ${id}: Found, innerHTML length: ${element.innerHTML.length}`);
        } else {
            console.error(`❌ ${id}: Missing from DOM`);
        }
    });
    
    // Check for instance rows specifically
    const instanceRows = document.querySelectorAll('.instance-row');
    const actionButtons = document.querySelectorAll('.instance-actions button');
    
    console.log(`\n📊 Current DOM state:`);
    console.log(`  Instance rows: ${instanceRows.length}`);
    console.log(`  Action buttons: ${actionButtons.length}`);
    
    actionButtons.forEach((btn, idx) => {
        console.log(`    Button ${idx + 1}: "${btn.textContent}" (class: ${btn.className})`);
    });
}

// Run the tests
async function runInstanceListTests() {
    console.log('🧪 Starting Instance List Tests...\n');
    
    const testResults = {
        rendering: testInstanceListRendering(),
        elements: testMissingElements(),
        timestamp: new Date().toISOString()
    };
    
    console.log('\n=== TEST RESULTS ===');
    console.log(`Instance List Rendering: ${testResults.rendering ? '✅ WORKING' : '❌ FAILED'}`);
    
    if (testResults.rendering) {
        console.log('🎉 Instance list rendering appears to be working!');
        console.log('✅ Per-instance buttons and details should now be visible.');
    } else {
        console.error('⚠️ Instance list rendering still has issues.');
        console.error('📋 Check the errors above for specific problems.');
    }
    
    // Store results for further analysis
    window.instanceListTestResults = testResults;
    
    return testResults;
}

// Auto-run if not in test mode
if (typeof module === 'undefined') {
    // Run in browser after a brief delay to ensure DOM is ready
    setTimeout(runInstanceListTests, 500);
} else {
    // Export for Node.js testing
    module.exports = { runInstanceListTests, testInstanceListRendering };
}

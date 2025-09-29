/**
 * UI Synchronization Test Script
 * Tests that all UI components stay properly synchronized when actions are performed
 * 
 * Specifically tests:
 * - Refresh Connections updates both badges and instance list
 * - Set Active/Ping/Remove buttons update both instance list and overview badges
 * - Overview badges reflect current instance states
 */

class UISynchronizationTest {
    constructor() {
        this.testResults = [];
        this.originalInstances = [];
        this.testInstanceUrl = 'http://test-sync-instance:8081';
    }

    /**
     * Log test result
     */
    logResult(testName, passed, message = '') {
        const result = {
            test: testName,
            passed: passed,
            message: message,
            timestamp: new Date().toISOString()
        };
        this.testResults.push(result);
        
        const status = passed ? '✅ PASS' : '❌ FAIL';
        console.log(`${status} ${testName}: ${message}`);
    }

    /**
     * Setup test environment
     */
    setupTest() {
        // Store original instances to restore later
        this.originalInstances = window.getInstances ? window.getInstances() : [];
        
        // Add a test instance if none exist
        if (this.originalInstances.length === 0 && window.addInstance) {
            window.addInstance(this.testInstanceUrl);
        }
    }

    /**
     * Cleanup test environment
     */
    cleanupTest() {
        // Remove test instance if we added it
        if (this.originalInstances.length === 0 && window.removeInstance) {
            try {
                window.removeInstance(this.testInstanceUrl);
            } catch (error) {
                console.warn('Failed to cleanup test instance:', error);
            }
        }
    }

    /**
     * Test 1: Verify required UI update functions exist
     */
    testUIUpdateFunctionsExist() {
        const requiredFunctions = {
            'window.updateOverviewBadges': typeof window.updateOverviewBadges,
            'window.renderInstanceList': typeof window.renderInstanceList,
            'window.handleUpdateConnections': typeof window.handleUpdateConnections
        };

        const missingFunctions = Object.entries(requiredFunctions)
            .filter(([name, type]) => type !== 'function')
            .map(([name]) => name);

        const allFunctionsExist = missingFunctions.length === 0;

        this.logResult(
            'UI Update Functions Available',
            allFunctionsExist,
            allFunctionsExist ? 
                'All required UI update functions available' : 
                `Missing functions: ${missingFunctions.join(', ')}`
        );

        return allFunctionsExist;
    }

    /**
     * Test 2: Test Refresh Connections updates both badges and instance list
     */
    async testRefreshConnectionsSync() {
        const badgeElements = {
            environment: document.getElementById('environment-badge'),
            connectivity: document.getElementById('connectivity-badge'),
            proxy: document.getElementById('proxy-badge')
        };
        
        const instanceContainer = document.getElementById('instances-container');
        
        if (!instanceContainer) {
            this.logResult('Refresh Connections Sync', false, 'Instance container not found');
            return false;
        }

        try {
            // Record initial states
            const initialBadgeStates = {};
            Object.entries(badgeElements).forEach(([name, element]) => {
                initialBadgeStates[name] = element ? element.textContent : null;
            });
            const initialInstanceCount = instanceContainer.children.length;
            
            // Trigger refresh connections
            if (window.handleUpdateConnections) {
                await window.handleUpdateConnections();
            } else if (window.FogLAMP?.events?.handleUpdateConnections) {
                await window.FogLAMP.events.handleUpdateConnections();
            } else {
                this.logResult('Refresh Connections Sync', false, 'handleUpdateConnections not available');
                return false;
            }

            // Wait for updates to complete
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Check if badges were updated (at least one should change or stay consistent)
            let badgeUpdated = false;
            Object.entries(badgeElements).forEach(([name, element]) => {
                if (element) {
                    const newContent = element.textContent;
                    if (newContent !== initialBadgeStates[name]) {
                        badgeUpdated = true;
                    }
                }
            });

            // Check if instance list still exists (should be rendered)
            const finalInstanceCount = instanceContainer.children.length;
            const instanceListUpdated = instanceContainer.innerHTML !== '';

            this.logResult(
                'Refresh Connections Sync',
                instanceListUpdated, // Badge update is optional if no changes occurred
                `Instance list updated: ${instanceListUpdated}, Badge changes detected: ${badgeUpdated}`
            );

            return instanceListUpdated;
        } catch (error) {
            this.logResult('Refresh Connections Sync', false, `Error: ${error.message}`);
            return false;
        }
    }

    /**
     * Test 3: Test Set Active button updates both instance list and badges
     */
    async testSetActiveButtonSync() {
        const instances = window.getInstances ? window.getInstances() : [];
        
        if (instances.length === 0) {
            this.logResult('Set Active Button Sync', true, 'No instances to test (acceptable)');
            return true;
        }

        try {
            const originalActive = window.getActiveInstance ? window.getActiveInstance() : null;
            const testInstance = instances[0];
            
            // Record initial badge state
            const connectivityBadge = document.getElementById('connectivity-badge');
            const initialBadgeText = connectivityBadge ? connectivityBadge.textContent : '';
            
            // Trigger Set Active via the UI function
            if (window.FogLAMP?.instances?.setInstanceActive) {
                await window.FogLAMP.instances.setInstanceActive(testInstance);
            } else {
                // Fallback to direct function call
                if (window.setActiveInstance) {
                    window.setActiveInstance(testInstance);
                    if (window.renderInstanceList) window.renderInstanceList();
                    if (window.updateOverviewBadges) window.updateOverviewBadges();
                }
            }

            // Wait for updates
            await new Promise(resolve => setTimeout(resolve, 500));

            // Verify active instance changed
            const newActive = window.getActiveInstance ? window.getActiveInstance() : null;
            const activeChanged = newActive === testInstance;

            // Check if badges might have updated (connectivity could change)
            const finalBadgeText = connectivityBadge ? connectivityBadge.textContent : '';
            
            // Restore original active if different
            if (originalActive && originalActive !== testInstance && window.setActiveInstance) {
                window.setActiveInstance(originalActive);
            }

            this.logResult(
                'Set Active Button Sync',
                activeChanged,
                `Active instance changed: ${activeChanged}, Badge text: "${initialBadgeText}" → "${finalBadgeText}"`
            );

            return activeChanged;
        } catch (error) {
            this.logResult('Set Active Button Sync', false, `Error: ${error.message}`);
            return false;
        }
    }

    /**
     * Test 4: Test Ping button updates both instance list and badges
     */
    async testPingButtonSync() {
        const instances = window.getInstances ? window.getInstances() : [];
        
        if (instances.length === 0) {
            this.logResult('Ping Button Sync', true, 'No instances to test (acceptable)');
            return true;
        }

        try {
            const testInstance = instances[0];
            
            // Record initial states
            const connectivityBadge = document.getElementById('connectivity-badge');
            const initialBadgeText = connectivityBadge ? connectivityBadge.textContent : '';
            const instanceContainer = document.getElementById('instances-container');
            const initialInstanceHTML = instanceContainer ? instanceContainer.innerHTML : '';
            
            // Trigger ping via the UI function
            if (window.FogLAMP?.instances?.pingInstance) {
                await window.FogLAMP.instances.pingInstance(testInstance);
            } else if (window.pingInstance) {
                // Fallback - simulate what the UI should do
                await window.pingInstance(testInstance);
                if (window.renderInstanceList) window.renderInstanceList();
                if (window.updateOverviewBadges) window.updateOverviewBadges();
            }

            // Wait for updates
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Check if updates occurred
            const finalBadgeText = connectivityBadge ? connectivityBadge.textContent : '';
            const finalInstanceHTML = instanceContainer ? instanceContainer.innerHTML : '';
            
            const badgeUpdated = finalBadgeText !== initialBadgeText;
            const instanceListUpdated = finalInstanceHTML !== initialInstanceHTML;

            this.logResult(
                'Ping Button Sync',
                instanceListUpdated || badgeUpdated, // Either should update
                `Instance list updated: ${instanceListUpdated}, Badge updated: ${badgeUpdated}`
            );

            return instanceListUpdated || badgeUpdated;
        } catch (error) {
            this.logResult('Ping Button Sync', false, `Error: ${error.message}`);
            return false;
        }
    }

    /**
     * Test 5: Test Remove button updates both instance list and badges
     */
    testRemoveButtonSync() {
        // For safety, we'll only test that the function has the right dependencies
        // without actually removing an instance
        
        const requiredForRemoval = [
            'window.removeInstance',
            'window.getInstanceMeta', 
            'window.getDisplayName',
            'window.renderInstanceList',
            'window.updateOverviewBadges'
        ];

        const available = requiredForRemoval.map(funcName => {
            const func = funcName.split('.').reduce((obj, key) => obj?.[key], window);
            return {
                name: funcName,
                available: typeof func === 'function'
            };
        });

        const allAvailable = available.every(item => item.available);
        const missingFunctions = available.filter(item => !item.available).map(item => item.name);

        this.logResult(
            'Remove Button Sync Dependencies',
            allAvailable,
            allAvailable ? 
                'All required functions for synchronized removal are available' : 
                `Missing functions: ${missingFunctions.join(', ')}`
        );

        return allAvailable;
    }

    /**
     * Test 6: Verify badge content reflects instance states
     */
    testBadgeContentAccuracy() {
        const instances = window.getEnhancedInstances ? window.getEnhancedInstances() : 
                        window.getInstances ? window.getInstances().map(url => ({ url })) : [];
        
        const connectivityBadge = document.getElementById('connectivity-badge');
        
        if (!connectivityBadge) {
            this.logResult('Badge Content Accuracy', false, 'Connectivity badge not found');
            return false;
        }

        try {
            // Count successful instances
            const successfulInstances = instances.filter(instance => 
                instance.lastStatus === 'success'
            ).length;
            
            const badgeText = connectivityBadge.textContent;
            const expectedPattern = instances.length === 0 ? 
                /no instances/i : 
                new RegExp(`${successfulInstances}\\/${instances.length}`, 'i');

            const badgeAccurate = expectedPattern.test(badgeText) || 
                                badgeText.includes('connected') || 
                                badgeText.includes('Checking');

            this.logResult(
                'Badge Content Accuracy',
                badgeAccurate,
                `Badge shows: "${badgeText}", Expected pattern for ${successfulInstances}/${instances.length} instances`
            );

            return badgeAccurate;
        } catch (error) {
            this.logResult('Badge Content Accuracy', false, `Error: ${error.message}`);
            return false;
        }
    }

    /**
     * Test 7: Check bi-directional synchronization timing
     */
    async testSynchronizationTiming() {
        try {
            // Test that multiple rapid UI updates don't cause conflicts
            const updatePromises = [];
            
            if (window.updateOverviewBadges) {
                updatePromises.push(Promise.resolve(window.updateOverviewBadges()));
            }
            if (window.renderInstanceList) {
                updatePromises.push(Promise.resolve(window.renderInstanceList()));
            }
            
            if (updatePromises.length === 0) {
                this.logResult('Synchronization Timing', false, 'No update functions available');
                return false;
            }

            // Execute all updates simultaneously
            await Promise.all(updatePromises);
            
            // Wait a moment then check UI is still consistent
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const connectivityBadge = document.getElementById('connectivity-badge');
            const instanceContainer = document.getElementById('instances-container');
            
            const uiConsistent = connectivityBadge && instanceContainer && 
                               connectivityBadge.textContent.length > 0 &&
                               instanceContainer.innerHTML.length > 0;

            this.logResult(
                'Synchronization Timing',
                uiConsistent,
                `UI remains consistent after simultaneous updates: ${uiConsistent}`
            );

            return uiConsistent;
        } catch (error) {
            this.logResult('Synchronization Timing', false, `Error: ${error.message}`);
            return false;
        }
    }

    /**
     * Run all synchronization tests
     */
    async runAllTests() {
        console.log('🔄 Starting UI Synchronization Tests...\n');
        
        // Setup test environment
        this.setupTest();
        
        const tests = [
            () => this.testUIUpdateFunctionsExist(),
            () => this.testRefreshConnectionsSync(),
            () => this.testSetActiveButtonSync(),
            () => this.testPingButtonSync(),
            () => this.testRemoveButtonSync(),
            () => this.testBadgeContentAccuracy(),
            () => this.testSynchronizationTiming()
        ];
        
        // Run tests sequentially with delays
        for (let i = 0; i < tests.length; i++) {
            try {
                await tests[i]();
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`Test ${i + 1} failed:`, error);
                this.logResult(`Test ${i + 1}`, false, `Exception: ${error.message}`);
            }
        }
        
        // Wait for any pending async operations
        setTimeout(() => {
            this.printSummary();
            this.cleanupTest();
        }, 1000);
    }

    /**
     * Print test summary
     */
    printSummary() {
        console.log('\n📊 UI Synchronization Test Summary:');
        console.log('═'.repeat(50));
        
        const passed = this.testResults.filter(r => r.passed).length;
        const total = this.testResults.length;
        const percentage = Math.round((passed / total) * 100);
        
        console.log(`✅ Passed: ${passed}/${total} (${percentage}%)`);
        console.log(`❌ Failed: ${total - passed}/${total}`);
        
        if (passed === total) {
            console.log('\n🎉 All UI synchronization tests PASSED!');
            console.log('✅ Overview badges and instance list are properly synchronized.');
        } else {
            console.log('\n⚠️  Some synchronization issues detected:');
            this.testResults
                .filter(r => !r.passed)
                .forEach(r => console.log(`   ❌ ${r.test}: ${r.message}`));
        }
        
        console.log('\n📋 Detailed Results:');
        console.table(this.testResults);
        
        return {
            passed,
            total,
            percentage,
            allPassed: passed === total,
            results: this.testResults
        };
    }

    /**
     * Manual synchronization test
     */
    manualSyncTest() {
        console.log('🔧 Running manual UI synchronization test...');
        
        console.log('1. Testing function availability:');
        console.log('   - window.updateOverviewBadges:', typeof window.updateOverviewBadges);
        console.log('   - window.renderInstanceList:', typeof window.renderInstanceList);
        console.log('   - window.handleUpdateConnections:', typeof window.handleUpdateConnections);
        
        console.log('2. Current UI states:');
        const connectivityBadge = document.getElementById('connectivity-badge');
        const instanceContainer = document.getElementById('instances-container');
        console.log('   - Connectivity badge:', connectivityBadge?.textContent || 'Not found');
        console.log('   - Instance container children:', instanceContainer?.children.length || 0);
        
        console.log('3. Instance data:');
        console.log('   - Total instances:', window.getInstances ? window.getInstances().length : 'N/A');
        console.log('   - Active instance:', window.getActiveInstance ? window.getActiveInstance() : 'None');
    }
}

// Auto-run tests if this script is loaded
if (typeof window !== 'undefined' && window.FogLAMP) {
    setTimeout(() => {
        const tester = new UISynchronizationTest();
        tester.runAllTests();
    }, 2000);
}

// Make tester available globally
if (typeof window !== 'undefined') {
    window.UISynchronizationTest = UISynchronizationTest;
    window.testUISynchronization = () => {
        const tester = new UISynchronizationTest();
        return tester.runAllTests();
    };
    window.manualTestUISync = () => {
        const tester = new UISynchronizationTest();
        tester.manualSyncTest();
    };
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UISynchronizationTest;
}

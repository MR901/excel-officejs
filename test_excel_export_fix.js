/**
 * Excel Export Fix Test Script
 * Tests the fixed Excel status and readings export functionality
 * 
 * This script verifies that the Excel export issues have been resolved:
 * - Sheet name length and character restrictions
 * - Data validation and sanitization
 * - Large data handling
 * - Error recovery
 */

class ExcelExportTest {
    constructor() {
        this.testResults = [];
        this.excelManager = null;
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
        // Get Excel integration manager
        this.excelManager = window.FogLAMP?.excel || null;
        
        if (!this.excelManager && window.excelIntegrationManager) {
            this.excelManager = window.excelIntegrationManager;
        }
    }

    /**
     * Test 1: Verify Excel manager is available
     */
    testExcelManagerAvailable() {
        const hasManager = !!this.excelManager;
        const hasExcelAPI = typeof Excel !== 'undefined' && typeof Excel.run === 'function';
        const hasExportFunctions = !!(window.handleExportStatus && window.handleExportReadings);
        
        const isReady = hasManager && hasExcelAPI;
        
        this.logResult(
            'Excel Manager Available',
            isReady,
            `Manager: ${hasManager}, Excel API: ${hasExcelAPI}, Export Functions: ${hasExportFunctions}`
        );
        
        return isReady;
    }

    /**
     * Test 2: Test createSafeSheetName function
     */
    testCreateSafeSheetName() {
        if (!this.excelManager?.createSafeSheetName) {
            this.logResult('Safe Sheet Name Creation', false, 'Function not available');
            return false;
        }

        const testCases = [
            {
                instanceName: 'mohit-prime-laptop',
                suffix: 'Status',
                expectedLength: 31, // Should be <= 31
                description: 'Normal case'
            },
            {
                instanceName: 'very-long-instance-name-that-exceeds-excel-limits',
                suffix: 'Status',
                expectedLength: 31,
                description: 'Long instance name'
            },
            {
                instanceName: 'instance/with\\invalid?chars*[]',
                suffix: 'Status',
                expectedLength: 31,
                description: 'Invalid characters'
            },
            {
                instanceName: 'short',
                suffix: 'VeryLongSuffixThatShouldBeTruncated',
                expectedLength: 31,
                description: 'Long suffix'
            }
        ];

        let allPassed = true;
        const results = [];

        for (const testCase of testCases) {
            try {
                const result = this.excelManager.createSafeSheetName(testCase.instanceName, testCase.suffix);
                const isValidLength = result.length <= 31 && result.length > 0;
                const hasNoInvalidChars = !/[\\\/\?\*\[\]:]/.test(result);
                
                const passed = isValidLength && hasNoInvalidChars;
                if (!passed) allPassed = false;
                
                results.push(`${testCase.description}: ${passed ? 'PASS' : 'FAIL'} (${result.length} chars: "${result}")`);
            } catch (error) {
                allPassed = false;
                results.push(`${testCase.description}: ERROR - ${error.message}`);
            }
        }

        this.logResult(
            'Safe Sheet Name Creation',
            allPassed,
            allPassed ? 'All test cases passed' : `Some cases failed: ${results.join('; ')}`
        );

        return allPassed;
    }

    /**
     * Test 3: Test validateDataForExcel function
     */
    testValidateDataForExcel() {
        if (!this.excelManager?.validateDataForExcel) {
            this.logResult('Data Validation', false, 'Function not available');
            return false;
        }

        const testCases = [
            {
                data: [['Header1', 'Header2'], ['Data1', 'Data2']],
                expected: true,
                description: 'Valid data'
            },
            {
                data: [['Header', null, undefined], ['Data', '', 123]],
                expected: true,
                description: 'Data with null/undefined values'
            },
            {
                data: [['Header'], ['VeryLongString'.repeat(1000)]],
                expected: true,
                description: 'Very long string (should be truncated)'
            },
            {
                data: 'not an array',
                expected: false,
                description: 'Invalid data type'
            },
            {
                data: [['Header'], 'invalid row'],
                expected: false,
                description: 'Invalid row type'
            }
        ];

        let allPassed = true;
        const results = [];

        for (const testCase of testCases) {
            try {
                // Create a copy to avoid mutating original test data
                const testData = JSON.parse(JSON.stringify(testCase.data));
                const result = this.excelManager.validateDataForExcel(testData);
                
                const passed = result === testCase.expected;
                if (!passed) allPassed = false;
                
                results.push(`${testCase.description}: ${passed ? 'PASS' : 'FAIL'} (expected: ${testCase.expected}, got: ${result})`);
            } catch (error) {
                const passed = !testCase.expected; // Error should only occur for invalid cases
                if (!passed) allPassed = false;
                results.push(`${testCase.description}: ${passed ? 'PASS' : 'ERROR'} - ${error.message}`);
            }
        }

        this.logResult(
            'Data Validation',
            allPassed,
            allPassed ? 'All test cases passed' : `Some cases failed: ${results.join('; ')}`
        );

        return allPassed;
    }

    /**
     * Test 4: Test formatResultData function
     */
    testFormatResultData() {
        if (!this.excelManager?.formatResultData) {
            this.logResult('Result Data Formatting', false, 'Function not available');
            return false;
        }

        const testCases = [
            {
                input: { status: 'fulfilled', value: { key: 'value' } },
                description: 'Fulfilled promise with object'
            },
            {
                input: { status: 'fulfilled', value: 'simple string' },
                description: 'Fulfilled promise with string'
            },
            {
                input: { status: 'rejected', reason: { message: 'Test error' } },
                description: 'Rejected promise'
            },
            {
                input: { status: 'fulfilled', value: { large: 'data'.repeat(10000) } },
                description: 'Fulfilled promise with large data'
            }
        ];

        let allPassed = true;
        const results = [];

        for (const testCase of testCases) {
            try {
                const result = this.excelManager.formatResultData(testCase.input);
                
                const isString = typeof result === 'string';
                const isReasonableLength = result.length <= 32000;
                const hasContent = result.length > 0;
                
                const passed = isString && isReasonableLength && hasContent;
                if (!passed) allPassed = false;
                
                results.push(`${testCase.description}: ${passed ? 'PASS' : 'FAIL'} (${result.length} chars)`);
            } catch (error) {
                allPassed = false;
                results.push(`${testCase.description}: ERROR - ${error.message}`);
            }
        }

        this.logResult(
            'Result Data Formatting',
            allPassed,
            allPassed ? 'All test cases passed' : `Some cases failed: ${results.join('; ')}`
        );

        return allPassed;
    }

    /**
     * Test 5: Test that export functions exist and are properly wired
     */
    testExportFunctionWiring() {
        const requiredFunctions = [
            'window.handleExportStatus',
            'window.handleExportReadings'
        ];

        const available = requiredFunctions.map(funcName => {
            const func = funcName.split('.').reduce((obj, key) => obj?.[key], window);
            return {
                name: funcName,
                available: typeof func === 'function'
            };
        });

        const allAvailable = available.every(item => item.available);
        const missingFunctions = available.filter(item => !item.available).map(item => item.name);

        this.logResult(
            'Export Function Wiring',
            allAvailable,
            allAvailable ? 
                'All export functions available' : 
                `Missing functions: ${missingFunctions.join(', ')}`
        );

        return allAvailable;
    }

    /**
     * Test 6: Test sheet name generation with real data
     */
    testRealWorldSheetNames() {
        if (!this.excelManager?.createSafeSheetName) {
            this.logResult('Real World Sheet Names', false, 'Function not available');
            return false;
        }

        // Get actual instance name from the system
        const instanceName = window.getDisplayName ? 
            (window.getActiveInstanceWithMeta ? 
                window.getDisplayName(window.getActiveInstanceWithMeta()) : 
                'test-instance') :
            'test-instance';

        try {
            const statusSheetName = this.excelManager.createSafeSheetName(instanceName, 'Status');
            const readingsSheetName = this.excelManager.createSafeSheetName(instanceName, 'sinusoid-data');

            const statusValid = statusSheetName.length <= 31 && statusSheetName.length > 0;
            const readingsValid = readingsSheetName.length <= 31 && readingsSheetName.length > 0;

            const allValid = statusValid && readingsValid;

            this.logResult(
                'Real World Sheet Names',
                allValid,
                `Status: "${statusSheetName}" (${statusSheetName.length}), Readings: "${readingsSheetName}" (${readingsSheetName.length})`
            );

            return allValid;
        } catch (error) {
            this.logResult('Real World Sheet Names', false, `Error: ${error.message}`);
            return false;
        }
    }

    /**
     * Test 7: Simulate potential Excel export scenarios
     */
    async testExportScenarios() {
        // This test simulates the export process without actually calling Excel
        try {
            // Test status export preparation
            if (this.excelManager?.prepareStatusData) {
                const mockInstance = { 
                    url: 'http://test:8081', 
                    name: 'test-instance' 
                };
                const mockResults = [
                    { status: 'fulfilled', value: { ping: 'ok' } },
                    { status: 'fulfilled', value: [{ key: 'READINGS', value: 100 }] },
                    { status: 'fulfilled', value: ['asset1', 'asset2'] }
                ];

                const statusData = this.excelManager.prepareStatusData(mockInstance, ...mockResults);
                const isValidData = Array.isArray(statusData) && statusData.length > 0;
                
                if (isValidData && this.excelManager.validateDataForExcel) {
                    const dataValid = this.excelManager.validateDataForExcel(statusData);
                    
                    this.logResult(
                        'Export Scenarios Simulation',
                        dataValid,
                        `Status data prepared and validated: ${statusData.length} rows`
                    );
                    
                    return dataValid;
                }
            }
            
            this.logResult('Export Scenarios Simulation', false, 'Required functions not available');
            return false;
        } catch (error) {
            this.logResult('Export Scenarios Simulation', false, `Error: ${error.message}`);
            return false;
        }
    }

    /**
     * Run all tests
     */
    async runAllTests() {
        console.log('🧪 Starting Excel Export Fix Tests...\n');
        
        this.setupTest();
        
        const tests = [
            () => this.testExcelManagerAvailable(),
            () => this.testCreateSafeSheetName(),
            () => this.testValidateDataForExcel(),
            () => this.testFormatResultData(),
            () => this.testExportFunctionWiring(),
            () => this.testRealWorldSheetNames(),
            () => this.testExportScenarios()
        ];
        
        // Run tests sequentially
        for (let i = 0; i < tests.length; i++) {
            try {
                await tests[i]();
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
                console.error(`Test ${i + 1} failed:`, error);
                this.logResult(`Test ${i + 1}`, false, `Exception: ${error.message}`);
            }
        }
        
        setTimeout(() => {
            this.printSummary();
        }, 500);
    }

    /**
     * Print test summary
     */
    printSummary() {
        console.log('\n📊 Excel Export Fix Test Summary:');
        console.log('═'.repeat(50));
        
        const passed = this.testResults.filter(r => r.passed).length;
        const total = this.testResults.length;
        const percentage = Math.round((passed / total) * 100);
        
        console.log(`✅ Passed: ${passed}/${total} (${percentage}%)`);
        console.log(`❌ Failed: ${total - passed}/${total}`);
        
        if (passed === total) {
            console.log('\n🎉 All Excel export tests PASSED!');
            console.log('✅ Excel export functionality should work correctly now.');
        } else {
            console.log('\n⚠️  Some tests failed. Issues detected:');
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
     * Manual test of Excel export functions
     */
    manualTest() {
        console.log('🔧 Running manual Excel export test...');
        
        console.log('1. Function availability:');
        console.log('   - Excel integration manager:', !!this.excelManager);
        console.log('   - handleExportStatus:', typeof window.handleExportStatus);
        console.log('   - handleExportReadings:', typeof window.handleExportReadings);
        
        if (this.excelManager) {
            console.log('2. Testing sheet name creation:');
            const instanceName = 'mohit-prime-laptop';
            const statusSheet = this.excelManager.createSafeSheetName?.(instanceName, 'Status');
            const readingsSheet = this.excelManager.createSafeSheetName?.(instanceName, 'sinusoid-data');
            
            console.log(`   - Status sheet: "${statusSheet}" (${statusSheet?.length || 0} chars)`);
            console.log(`   - Readings sheet: "${readingsSheet}" (${readingsSheet?.length || 0} chars)`);
        }
        
        console.log('3. Current instance info:');
        const activeInstance = window.getActiveInstanceWithMeta?.();
        console.log('   - Active instance:', activeInstance?.url || 'None');
        console.log('   - Display name:', activeInstance ? window.getDisplayName?.(activeInstance) : 'N/A');
    }
}

// Auto-run tests if this script is loaded
if (typeof window !== 'undefined' && window.FogLAMP) {
    setTimeout(() => {
        const tester = new ExcelExportTest();
        tester.runAllTests();
    }, 1500);
}

// Make tester available globally
if (typeof window !== 'undefined') {
    window.ExcelExportTest = ExcelExportTest;
    window.testExcelExport = () => {
        const tester = new ExcelExportTest();
        return tester.runAllTests();
    };
    window.manualTestExcelExport = () => {
        const tester = new ExcelExportTest();
        tester.manualTest();
    };
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExcelExportTest;
}

/**
 * Console Resize Functionality Test Script
 * Tests and verifies that the console drag-to-resize functionality works properly
 * 
 * This script can be run in the browser developer console when taskpane.html is loaded
 * to verify all console resizing functionality is working correctly.
 */

class ConsoleResizeTest {
    constructor() {
        this.testResults = [];
        this.consoleEl = document.querySelector('.app-console');
        this.resizerEl = document.querySelector('.console-resizer');
        this.originalHeight = 28; // Default collapsed height
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
     * Test 1: Verify console DOM elements exist
     */
    testConsoleElementsExist() {
        const consoleExists = !!this.consoleEl;
        const resizerExists = !!this.resizerEl;
        
        this.logResult(
            'Console Elements Exist',
            consoleExists && resizerExists,
            `Console: ${consoleExists ? 'Found' : 'Missing'}, Resizer: ${resizerExists ? 'Found' : 'Missing'}`
        );
        
        return consoleExists && resizerExists;
    }

    /**
     * Test 2: Verify CSS properties are set correctly
     */
    testCSSProperties() {
        if (!this.consoleEl || !this.resizerEl) return false;

        const consoleStyles = getComputedStyle(this.consoleEl);
        const resizerStyles = getComputedStyle(this.resizerEl);
        
        // Check console height CSS variable
        const heightVariable = getComputedStyle(document.documentElement)
            .getPropertyValue('--console-height');
        
        // Check resizer cursor style
        const hasResizeCursor = resizerStyles.cursor === 'ns-resize';
        
        // Check console height is using the variable
        const usesHeightVariable = consoleStyles.getPropertyValue('flex').includes('var(--console-height') || 
                                   consoleStyles.height.includes('var(--console-height');
        
        this.logResult(
            'CSS Properties',
            hasResizeCursor && (heightVariable !== ''),
            `Cursor: ${resizerStyles.cursor}, Height Variable: ${heightVariable}`
        );
        
        return hasResizeCursor;
    }

    /**
     * Test 3: Verify console manager initialization
     */
    testConsoleManagerInit() {
        const hasConsoleManager = !!window.FogLAMP?.console;
        const hasGlobalFunctions = !!(window.setConsoleHeight && window.logMessage);
        
        this.logResult(
            'Console Manager Initialization',
            hasConsoleManager || hasGlobalFunctions,
            `Manager: ${hasConsoleManager ? 'Available' : 'Missing'}, Global Functions: ${hasGlobalFunctions ? 'Available' : 'Missing'}`
        );
        
        return hasConsoleManager || hasGlobalFunctions;
    }

    /**
     * Test 4: Test setConsoleHeight function
     */
    testSetConsoleHeight() {
        const setHeightFunction = window.setConsoleHeight || window.FogLAMP?.console?.setConsoleHeight;
        
        if (!setHeightFunction) {
            this.logResult('Set Console Height Function', false, 'Function not available');
            return false;
        }

        try {
            // Test setting various heights
            const testHeights = [50, 100, 200, 15, 600]; // Including edge cases
            let allTestsPassed = true;
            
            for (const testHeight of testHeights) {
                const actualHeight = setHeightFunction(testHeight);
                const expectedMin = Math.max(28, testHeight); // Should be at least 28px
                const expectedMax = Math.min(testHeight, window.innerHeight * 0.7);
                
                // Validate the returned height is within expected bounds
                if (actualHeight < 28 || actualHeight > window.innerHeight * 0.7) {
                    allTestsPassed = false;
                    break;
                }
            }
            
            // Reset to original height
            setHeightFunction(this.originalHeight);
            
            this.logResult(
                'Set Console Height Function',
                allTestsPassed,
                allTestsPassed ? 'All height constraints work correctly' : 'Height constraint validation failed'
            );
            
            return allTestsPassed;
        } catch (error) {
            this.logResult('Set Console Height Function', false, `Error: ${error.message}`);
            return false;
        }
    }

    /**
     * Test 5: Simulate mouse events for drag functionality
     */
    testMouseDragEvents() {
        if (!this.resizerEl) return false;

        try {
            const initialHeight = parseInt(getComputedStyle(this.consoleEl).height, 10) || 28;
            
            // Create mouse events
            const mouseDownEvent = new MouseEvent('mousedown', {
                clientY: 400,
                bubbles: true
            });
            
            const mouseMoveEvent = new MouseEvent('mousemove', {
                clientY: 350, // Move up by 50px to increase height
                bubbles: true
            });
            
            const mouseUpEvent = new MouseEvent('mouseup', {
                bubbles: true
            });
            
            // Simulate drag sequence
            this.resizerEl.dispatchEvent(mouseDownEvent);
            
            // Wait a moment then move and release
            setTimeout(() => {
                document.dispatchEvent(mouseMoveEvent);
                setTimeout(() => {
                    document.dispatchEvent(mouseUpEvent);
                    
                    // Check if height changed
                    const newHeight = parseInt(getComputedStyle(this.consoleEl).height, 10) || 28;
                    const heightChanged = Math.abs(newHeight - initialHeight) > 5; // Allow some tolerance
                    
                    this.logResult(
                        'Mouse Drag Events',
                        heightChanged,
                        `Initial: ${initialHeight}px, Final: ${newHeight}px, Changed: ${heightChanged}`
                    );
                }, 100);
            }, 100);
            
            return true;
        } catch (error) {
            this.logResult('Mouse Drag Events', false, `Error: ${error.message}`);
            return false;
        }
    }

    /**
     * Test 6: Verify touch events work (mobile support)
     */
    testTouchEvents() {
        if (!this.resizerEl) return false;

        try {
            // Create touch events
            const touchStartEvent = new TouchEvent('touchstart', {
                touches: [{
                    clientY: 400
                }],
                bubbles: true
            });
            
            const touchMoveEvent = new TouchEvent('touchmove', {
                touches: [{
                    clientY: 350
                }],
                bubbles: true
            });
            
            const touchEndEvent = new TouchEvent('touchend', {
                touches: [],
                bubbles: true
            });
            
            // Test that touch events don't throw errors
            this.resizerEl.dispatchEvent(touchStartEvent);
            document.dispatchEvent(touchMoveEvent);
            document.dispatchEvent(touchEndEvent);
            
            this.logResult(
                'Touch Events Support',
                true,
                'Touch events dispatched without errors'
            );
            
            return true;
        } catch (error) {
            this.logResult('Touch Events Support', false, `Error: ${error.message}`);
            return false;
        }
    }

    /**
     * Test 7: Verify console content scrolling
     */
    testConsoleScrolling() {
        const statusElement = document.getElementById('fl-status');
        
        if (!statusElement) {
            this.logResult('Console Scrolling', false, 'Status element not found');
            return false;
        }

        try {
            // Add test content
            const originalContent = statusElement.textContent;
            const testContent = Array(50).fill('Test log line').join('\n');
            statusElement.textContent = testContent;
            
            // Check if scrolling works
            const hasScrolling = statusElement.scrollHeight > statusElement.clientHeight;
            statusElement.scrollTop = statusElement.scrollHeight;
            const scrolledToBottom = statusElement.scrollTop > 0;
            
            // Restore original content
            statusElement.textContent = originalContent;
            
            this.logResult(
                'Console Scrolling',
                hasScrolling && scrolledToBottom,
                `Has scrolling: ${hasScrolling}, Can scroll: ${scrolledToBottom}`
            );
            
            return hasScrolling && scrolledToBottom;
        } catch (error) {
            this.logResult('Console Scrolling', false, `Error: ${error.message}`);
            return false;
        }
    }

    /**
     * Run all tests
     */
    async runAllTests() {
        console.log('🧪 Starting Console Resize Functionality Tests...\n');
        
        const tests = [
            () => this.testConsoleElementsExist(),
            () => this.testCSSProperties(),
            () => this.testConsoleManagerInit(),
            () => this.testSetConsoleHeight(),
            () => this.testMouseDragEvents(),
            () => this.testTouchEvents(),
            () => this.testConsoleScrolling()
        ];
        
        // Run tests sequentially
        for (let i = 0; i < tests.length; i++) {
            try {
                await new Promise(resolve => {
                    tests[i]();
                    setTimeout(resolve, 200); // Small delay between tests
                });
            } catch (error) {
                console.error(`Test ${i + 1} failed:`, error);
            }
        }
        
        // Wait a bit for async tests to complete
        setTimeout(() => {
            this.printSummary();
        }, 1000);
    }

    /**
     * Print test summary
     */
    printSummary() {
        console.log('\n📊 Test Summary:');
        console.log('═'.repeat(50));
        
        const passed = this.testResults.filter(r => r.passed).length;
        const total = this.testResults.length;
        const percentage = Math.round((passed / total) * 100);
        
        console.log(`✅ Passed: ${passed}/${total} (${percentage}%)`);
        console.log(`❌ Failed: ${total - passed}/${total}`);
        
        if (passed === total) {
            console.log('\n🎉 All console resize functionality tests PASSED!');
            console.log('✅ Console drag-to-resize is working correctly.');
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
     * Quick visual test - resize console to demonstrate functionality
     */
    visualDemo() {
        console.log('🎬 Running visual demonstration...');
        
        const setHeight = window.setConsoleHeight || window.FogLAMP?.console?.setConsoleHeight;
        if (!setHeight) {
            console.log('❌ setConsoleHeight function not available');
            return;
        }

        const heights = [28, 100, 200, 150, 28];
        let index = 0;
        
        const animate = () => {
            if (index < heights.length) {
                setHeight(heights[index]);
                console.log(`📏 Console height set to: ${heights[index]}px`);
                index++;
                setTimeout(animate, 1000);
            } else {
                console.log('✅ Visual demonstration completed!');
            }
        };
        
        animate();
    }
}

// Auto-run tests if this script is loaded in a page with the console
if (typeof document !== 'undefined' && document.readyState === 'complete') {
    const tester = new ConsoleResizeTest();
    tester.runAllTests();
} else if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        const tester = new ConsoleResizeTest();
        tester.runAllTests();
    });
}

// Make tester available globally for manual testing
if (typeof window !== 'undefined') {
    window.ConsoleResizeTest = ConsoleResizeTest;
    window.testConsoleResize = () => {
        const tester = new ConsoleResizeTest();
        return tester.runAllTests();
    };
    window.demoConsoleResize = () => {
        const tester = new ConsoleResizeTest();
        tester.visualDemo();
    };
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConsoleResizeTest;
}

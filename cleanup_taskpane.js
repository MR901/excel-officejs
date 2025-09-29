// Node.js script to clean up taskpane.html by removing extracted functions

const fs = require('fs');

// Read the current file
let content = fs.readFileSync('taskpane.html', 'utf8');

// Define all the function signatures that should be removed (they're now in modules)
const extractedFunctions = [
    // Instance Management Functions
    'async function pingInstance(',
    'async function setInstanceActive(',
    'function removeInstanceWithConfirm(',
    'async function getInstanceStatistics(',
    
    // Asset Management Functions  
    'async function loadAssetsForActiveInstance(',
    'async function refreshAssetListForActiveInstance(',
    'function syncAssetInputs(',
    
    // Add Instance Flow Functions
    'function showAddFeedback(',
    'function hideAddFeedback(',
    'function toggleAddActions(',
    'async function confirmAddInstance(',
    'async function pingUrlForValidation(',
    
    // Event Handler Functions
    'async function handleAddInstance(',
    'async function handleRefreshStatus(',
    'async function handleResetConnections(',
    'function setupEventListeners(',
    
    // Excel Integration Functions
    'async function ensureWorksheet(',
    'function writeTable(',
    'function toKeyValueRows(',
    'function stringifyCell(',
    'function flattenAssets(',
    'function flattenStatistics(',
    'function flattenReadings(',
    
    // Utility Functions
    'function updateStatus(',
    'async function populateList(',
    
    // Smart Manager Integration
    'function syncFromSmartManager(',
    'async function syncToSmartManager(',
    'async function populateSmartInstances(',
    'function updateConnectionStatus('
];

console.log('Function signatures to find and remove:');
extractedFunctions.forEach((sig, i) => {
    console.log(`${i + 1}. ${sig}`);
});

// Find function boundaries and collect removal ranges
const lines = content.split('\n');
const functionsToRemove = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check if this line starts with any of our extracted functions
    for (const funcSig of extractedFunctions) {
        if (line.includes(funcSig)) {
            // Find the end of this function
            let braceCount = 0;
            let started = false;
            let endLine = -1;
            
            for (let j = i; j < lines.length; j++) {
                const currentLine = lines[j];
                
                // Count braces to find function end
                for (const char of currentLine) {
                    if (char === '{') {
                        braceCount++;
                        started = true;
                    }
                    if (char === '}') {
                        braceCount--;
                        if (started && braceCount === 0) {
                            endLine = j;
                            break;
                        }
                    }
                }
                
                if (endLine !== -1) break;
            }
            
            if (endLine !== -1) {
                functionsToRemove.push({
                    name: funcSig,
                    startLine: i,
                    endLine: endLine,
                    lineCount: endLine - i + 1
                });
                console.log(`Found ${funcSig}: lines ${i + 1}-${endLine + 1} (${endLine - i + 1} lines)`);
            }
            break;
        }
    }
}

console.log(`\nFound ${functionsToRemove.length} functions to remove`);
console.log(`Total lines to remove: ${functionsToRemove.reduce((sum, f) => sum + f.lineCount, 0)}`);

// Sort by start line (descending) so we can remove from bottom to top
functionsToRemove.sort((a, b) => b.startLine - a.startLine);

console.log('\nFunctions to remove (sorted by line number):');
functionsToRemove.forEach(f => {
    console.log(`${f.name}: lines ${f.startLine + 1}-${f.endLine + 1} (${f.lineCount} lines)`);
});

// Actually perform the cleanup
console.log('\nProceeding with cleanup...');

// Remove functions from bottom to top (higher line numbers first)
let modifiedContent = content;
let totalLinesRemoved = 0;

functionsToRemove.forEach(func => {
    const contentLines = modifiedContent.split('\n');
    const beforeLines = contentLines.slice(0, func.startLine);
    const afterLines = contentLines.slice(func.endLine + 1);
    
    // Add a comment indicating what was removed
    const replacementComment = `        // ${func.name.replace('(', '()')} moved to modular system`;
    
    modifiedContent = [...beforeLines, replacementComment, ...afterLines].join('\n');
    totalLinesRemoved += func.lineCount - 1; // -1 because we're adding a comment line
    
    console.log(`✅ Removed ${func.name} (${func.lineCount} lines)`);
});

// Write the cleaned file
fs.writeFileSync('taskpane.html', modifiedContent);

console.log(`\n🎉 Cleanup complete!`);
console.log(`📊 Removed ${functionsToRemove.length} functions`);
console.log(`📉 Removed ${totalLinesRemoved} lines total`);

// Check final line count
const finalLines = modifiedContent.split('\n').length;
console.log(`📋 Final line count: ${finalLines} lines`);

// Calculate reduction
const originalLines = content.split('\n').length;
const reduction = ((originalLines - finalLines) / originalLines * 100).toFixed(1);
console.log(`📈 Size reduction: ${reduction}%`);

console.log('\n✅ taskpane.html has been cleaned up successfully!');

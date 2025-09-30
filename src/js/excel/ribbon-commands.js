/**
 * Excel Ribbon Commands for FogLAMP DataLink
 * LEAN PHASE 3 ADDITION: Minimal ribbon integration
 */

/**
 * Quick ping active instance from ribbon
 */
async function ribbonPingActive() {
    try {
        const data = await window.FogLAMP.api.ping();
        const message = `FogLAMP Health: ${data.health}\nUptime: ${data.uptime}`;
        
        if (window.FogLAMP.errors) {
            await window.FogLAMP.errors.showSuccess('Ping Successful', message);
        } else {
            console.log('Ping successful:', message);
        }
    } catch (error) {
        if (window.FogLAMP.errors) {
            await window.FogLAMP.errors.handleApiError('ribbon ping', error);
        } else {
            console.error('Ribbon ping failed:', error);
        }
    }
}

/**
 * Quick export status to Excel from ribbon
 */
async function ribbonExportStatus() {
    try {
        await window.FogLAMP.excel.handleExportStatus();
        
        if (window.FogLAMP.errors) {
            await window.FogLAMP.errors.showSuccess('Export Complete', 'Status data exported to Excel sheet');
        }
    } catch (error) {
        if (window.FogLAMP.errors) {
            await window.FogLAMP.errors.handleApiError('ribbon export', error);
        } else {
            console.error('Ribbon export failed:', error);
        }
    }
}

/**
 * Open FogLAMP taskpane from ribbon
 */
function ribbonOpenTaskpane() {
    // This will be handled by the manifest.xml action
    console.log('Opening FogLAMP taskpane...');
}

// Make ribbon commands globally available
if (typeof window !== 'undefined') {
    window.ribbonPingActive = ribbonPingActive;
    window.ribbonExportStatus = ribbonExportStatus;
    window.ribbonOpenTaskpane = ribbonOpenTaskpane;
}

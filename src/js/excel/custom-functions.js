/**
 * Excel Custom Functions for FogLAMP DataLink
 * LEAN PHASE 3 ADDITION: Minimal custom functions for real-time data
 */

/**
 * Get FogLAMP ping status for active instance
 * @customfunction
 * @returns {Promise<string>} Ping status
 */
async function FOGLAMP_PING() {
    try {
        const data = await window.FogLAMP.api.ping();
        return data.health || 'Unknown';
    } catch (error) {
        return '#ERROR: ' + error.message;
    }
}

/**
 * Get FogLAMP asset count for active instance
 * @customfunction  
 * @returns {Promise<number>} Number of assets
 */
async function FOGLAMP_ASSET_COUNT() {
    try {
        const assets = await window.FogLAMP.api.assets();
        return Array.isArray(assets) ? assets.length : 0;
    } catch (error) {
        return '#ERROR: ' + error.message;
    }
}

/**
 * Get FogLAMP uptime for active instance
 * @customfunction
 * @returns {Promise<string>} Uptime in human readable format
 */
async function FOGLAMP_UPTIME() {
    try {
        const data = await window.FogLAMP.api.ping();
        const uptime = data.uptime;
        if (typeof uptime === 'number') {
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            return `${hours}h ${minutes}m`;
        }
        return uptime || 'Unknown';
    } catch (error) {
        return '#ERROR: ' + error.message;
    }
}

// Register custom functions
if (typeof CustomFunctions !== 'undefined') {
    CustomFunctions.associate('FOGLAMP_PING', FOGLAMP_PING);
    CustomFunctions.associate('FOGLAMP_ASSET_COUNT', FOGLAMP_ASSET_COUNT);
    CustomFunctions.associate('FOGLAMP_UPTIME', FOGLAMP_UPTIME);
}

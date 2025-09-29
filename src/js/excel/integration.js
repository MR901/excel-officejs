/**
 * Excel Integration for FogLAMP DataLink
 * Handles Excel worksheet operations, data export, and formatting
 */

import { getActiveInstanceWithMeta } from '../core/storage.js';
import { getDisplayName, getColumnLetter } from '../core/utils.js';
import { logMessage } from '../ui/console.js';
import { elements } from '../ui/elements.js';

/**
 * Excel Integration Manager Class
 * Manages all Excel-related operations for FogLAMP DataLink
 */
export class ExcelIntegrationManager {
    
    constructor() {
        this.worksheetCache = new Map(); // Cache worksheets by name
        this.exportFormats = {
            status: {
                sheetSuffix: '- FogLAMP - Status',
                dateFormat: 'mm/dd/yyyy hh:mm:ss',
                headers: ['Type', 'Data']
            },
            readings: {
                sheetSuffix: '- asset -',
                dateFormat: 'mm/dd/yyyy hh:mm:ss AM/PM',
                timestampColumn: 'timestamp'
            }
        };
    }

    /**
     * Initialize the Excel integration manager
     * Called during system startup
     */
    initialize() {
        logMessage('info', 'Initializing Excel integration manager');
        
        // Check if Excel API is available
        const excelAvailable = typeof Excel !== 'undefined' && typeof Excel.run === 'function';
        logMessage('info', `Excel API available: ${excelAvailable}`);
        
        logMessage('info', 'Excel integration manager initialized');
    }

    /**
     * Ensure worksheet exists, create if needed
     * @param {Object} context - Excel context object
     * @param {string} name - Worksheet name
     * @returns {Promise<Object>} Excel worksheet object
     */
    async ensureWorksheet(context, name) {
        // Check cache first
        if (this.worksheetCache.has(name)) {
            try {
                const cachedSheet = this.worksheetCache.get(name);
                cachedSheet.load("name");
                await context.sync();
                return cachedSheet;
            } catch (error) {
                // Cache invalid, remove it
                this.worksheetCache.delete(name);
            }
        }

        const sheets = context.workbook.worksheets;
        let sheet;
        
        try {
            sheet = sheets.getItem(name);
            sheet.load("name");
            await context.sync();
        } catch (error) {
            // Sheet doesn't exist, create it
            sheet = sheets.add(name);
            await context.sync();
        }

        // Cache the sheet
        this.worksheetCache.set(name, sheet);
        return sheet;
    }

    /**
     * Write table data to Excel with headers and formatting
     * @param {Object} startRange - Starting Excel range
     * @param {Array} rows - Data rows
     * @param {Array} headers - Column headers
     * @param {Object} options - Formatting options
     */
    async writeTable(startRange, rows, headers = [], options = {}) {
        if (!startRange || !Array.isArray(rows)) {
            throw new Error('Invalid parameters for writeTable');
        }

        const {
            headerFormat = true,
            dataFormat = true,
            autoFit = true
        } = options;

        const context = startRange.context;
        let currentRow = 0;

        try {
            // Write headers if provided
            if (headers.length > 0) {
                const headerRange = startRange.getOffsetRange(0, 0).getResizedRange(0, headers.length - 1);
                headerRange.values = [headers];
                
                if (headerFormat) {
                    this.formatHeaders(headerRange);
                }
                
                currentRow = 1;
            }

            // Write data rows
            if (rows.length > 0) {
                const dataRange = startRange.getOffsetRange(currentRow, 0)
                    .getResizedRange(rows.length - 1, Math.max(1, rows[0]?.length || 1) - 1);
                
                dataRange.values = rows;
                
                if (dataFormat) {
                    this.formatDataRows(dataRange, options);
                }
            }

            // Auto-fit columns if requested
            if (autoFit) {
                const totalCols = Math.max(headers.length, rows[0]?.length || 0);
                if (totalCols > 0) {
                    const autoFitRange = startRange.getResizedRange(
                        Math.max(0, (headers.length > 0 ? 1 : 0) + rows.length - 1),
                        totalCols - 1
                    );
                    autoFitRange.format.autofitColumns();
                }
            }

            await context.sync();
            
        } catch (error) {
            logMessage('error', 'Failed to write table to Excel', { 
                error: error.message,
                rowCount: rows.length,
                headerCount: headers.length
            });
            throw error;
        }
    }

    /**
     * Format header row with styling
     * @param {Object} headerRange - Excel range for headers
     */
    formatHeaders(headerRange) {
        const format = headerRange.format;
        format.font.bold = true;
        format.font.color = '#FFFFFF';
        format.fill.color = '#4472C4';
        format.horizontalAlignment = 'Center';
        format.verticalAlignment = 'Middle';
    }

    /**
     * Format data rows with styling
     * @param {Object} dataRange - Excel range for data
     * @param {Object} options - Formatting options
     */
    formatDataRows(dataRange, options = {}) {
        const format = dataRange.format;
        
        // Basic data formatting
        format.horizontalAlignment = 'Left';
        format.verticalAlignment = 'Top';
        format.wrapText = false;
        
        // Apply specific formatting based on data type
        if (options.timestampColumn) {
            // This would require column-specific formatting
            // For now, apply general date formatting
            format.numberFormat = this.exportFormats.readings.dateFormat;
        }
        
        // Zebra striping for better readability
        // Note: This would require row-by-row formatting for true zebra effect
        format.borders.getItem('InsideHorizontal').style = 'Continuous';
        format.borders.getItem('InsideHorizontal').color = '#D1D5DB';
    }

    /**
     * Export status data to formatted Excel sheet
     * @returns {Promise<boolean>} Success status
     */
    async handleExportStatus() {
        const activeInstance = getActiveInstanceWithMeta();
        if (!activeInstance) {
            logMessage('warn', 'Export Status: no active instance');
            return false;
        }

        const instanceName = getDisplayName(activeInstance);
        const sheetName = `${instanceName} ${this.exportFormats.status.sheetSuffix}`;

        try {
            logMessage('info', 'Starting status export', { instance: instanceName, sheet: sheetName });

            // Fetch all required data
            const [ping, stats, assets] = await Promise.allSettled([
                this.fetchPingData(),
                this.fetchStatisticsData(),
                this.fetchAssetsData()
            ]);

            await Excel.run(async (context) => {
                const sheet = await this.ensureWorksheet(context, sheetName);
                sheet.load("usedRange");
                await context.sync();
                
                // Clear existing content
                if (sheet.usedRange) {
                    sheet.usedRange.clear();
                    await context.sync();
                }
                
                const start = sheet.getRange("A1");

                // Prepare status data
                const statusData = this.prepareStatusData(activeInstance, ping, stats, assets);
                
                // Write data to sheet
                await this.writeTable(start, statusData, this.exportFormats.status.headers, {
                    headerFormat: true,
                    dataFormat: true,
                    autoFit: true
                });

                logMessage('info', 'Status export completed successfully', { 
                    sheet: sheetName,
                    rows: statusData.length 
                });
            });

            return true;

        } catch (error) {
            logMessage('error', 'Status export failed', { 
                instance: instanceName,
                error: error.message 
            });
            return false;
        }
    }

    /**
     * Export asset readings to formatted Excel sheet
     * @returns {Promise<boolean>} Success status
     */
    async handleExportReadings() {
        const activeInstance = getActiveInstanceWithMeta();
        if (!activeInstance) {
            logMessage('warn', 'Export Readings: no active instance');
            return false;
        }

        // Get selected asset
        const asset = this.getSelectedAsset();
        if (!asset) {
            logMessage('warn', 'Export Readings: no asset specified');
            return false;
        }

        // Get export parameters
        const exportParams = this.getExportParameters();
        if (!exportParams.valid) {
            logMessage('warn', 'Export Readings: invalid parameters', exportParams.errors);
            return false;
        }

        const instanceName = getDisplayName(activeInstance);
        const sheetName = `${instanceName} ${this.exportFormats.readings.sheetSuffix} ${asset}`;

        try {
            logMessage('info', 'Starting readings export', { 
                instance: instanceName,
                asset,
                sheet: sheetName,
                params: exportParams.data
            });

            // Fetch readings data
            const readings = await this.fetchReadingsData(asset, exportParams.data);
            if (!readings || readings.length === 0) {
                logMessage('warn', 'No readings data found for export', { asset });
                return false;
            }

            await Excel.run(async (context) => {
                const sheet = await this.ensureWorksheet(context, sheetName);
                const start = sheet.getRange("A1");
                
                // Process readings data
                const { headers, rows } = this.flattenReadings(readings);
                
                // Write data to sheet with proper formatting
                await this.writeTable(start, rows, headers, {
                    headerFormat: true,
                    dataFormat: true,
                    autoFit: true,
                    timestampColumn: this.exportFormats.readings.timestampColumn
                });

                logMessage('info', 'Readings export completed successfully', {
                    sheet: sheetName,
                    asset,
                    rows: rows.length,
                    columns: headers.length
                });
            });

            return true;

        } catch (error) {
            logMessage('error', 'Readings export failed', {
                instance: instanceName,
                asset,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Get selected asset from UI elements
     * @returns {string} Selected asset name
     */
    getSelectedAsset() {
        const assetSelect = elements.assetSelect();
        const assetInput = elements.asset();
        
        const selectedAsset = assetSelect?.value || assetInput?.value?.trim() || '';
        return selectedAsset;
    }

    /**
     * Get export parameters from UI
     * @returns {Object} Export parameters with validation
     */
    getExportParameters() {
        const params = {
            datapoint: elements.datapoint()?.value?.trim() || '',
            limit: Math.max(1, Math.min(10000, parseInt(elements.limit()?.value || '100', 10))),
            skip: Math.max(0, parseInt(elements.skip()?.value || '0', 10)),
            seconds: parseInt(elements.seconds()?.value || '-1', 10),
            minutes: parseInt(elements.minutes()?.value || '-1', 10),
            hours: parseInt(elements.hours()?.value || '-1', 10),
            previous: parseInt(elements.previous()?.value || '-1', 10)
        };

        // Validation
        const timeParams = [params.seconds, params.minutes, params.hours].filter(p => p > 0);
        const errors = [];
        
        if (timeParams.length > 1) {
            errors.push('Use only one time window parameter (seconds, minutes, or hours)');
        }

        return {
            valid: errors.length === 0,
            errors,
            data: params
        };
    }

    /**
     * Prepare status data for export
     * @param {Object} instance - Instance metadata
     * @param {Object} ping - Ping result
     * @param {Object} stats - Statistics result
     * @param {Object} assets - Assets result
     * @returns {Array} Formatted status data
     */
    prepareStatusData(instance, ping, stats, assets) {
        const instanceName = getDisplayName(instance);
        const timestamp = new Date().toISOString();
        
        const data = [
            ['Instance', instanceName],
            ['URL', instance.url],
            ['Timestamp', timestamp],
            ['', ''], // Separator
            ['PING', this.formatResultData(ping)],
            ['', ''], // Separator  
            ['STATISTICS', this.formatResultData(stats)],
            ['', ''], // Separator
            ['ASSETS', this.formatResultData(assets)]
        ];

        return data;
    }

    /**
     * Format result data for display
     * @param {Object} result - Promise settled result
     * @returns {string} Formatted data
     */
    formatResultData(result) {
        if (result.status === 'fulfilled') {
            try {
                return JSON.stringify(result.value, null, 2);
            } catch (error) {
                return String(result.value);
            }
        } else {
            return `Error: ${result.reason?.message || 'Unknown error'}`;
        }
    }

    /**
     * Flatten readings data for Excel export
     * @param {Array} readings - Array of reading objects
     * @returns {Object} Object with headers and rows arrays
     */
    flattenReadings(readings) {
        if (!Array.isArray(readings) || readings.length === 0) {
            return { headers: ['No Data'], rows: [['No readings found']] };
        }

        // Collect all unique datapoints across all readings
        const datapointSet = new Set();
        readings.forEach(reading => {
            if (reading.reading && typeof reading.reading === 'object') {
                Object.keys(reading.reading).forEach(key => datapointSet.add(key));
            }
        });

        const datapoints = Array.from(datapointSet).sort();
        const headers = ['timestamp', 'asset_code', ...datapoints];

        // Convert readings to rows
        const rows = readings.map(reading => {
            const row = [
                reading.user_ts || reading.timestamp || '',
                reading.asset_code || reading.asset || '',
                ...datapoints.map(dp => {
                    const value = reading.reading?.[dp];
                    return value !== undefined ? value : '';
                })
            ];
            return row;
        });

        return { headers, rows };
    }

    /**
     * Fetch ping data for status export
     * @returns {Promise<Object>} Ping data
     */
    async fetchPingData() {
        if (window.foglampPingSmart) {
            return await window.foglampPingSmart();
        } else if (window.smartManager) {
            return await window.smartManager.foglampPing();
        } else {
            throw new Error('Ping function not available');
        }
    }

    /**
     * Fetch statistics data for status export
     * @returns {Promise<Object>} Statistics data
     */
    async fetchStatisticsData() {
        if (window.foglampStatisticsSmart) {
            return await window.foglampStatisticsSmart();
        } else if (window.smartManager) {
            return await window.smartManager.foglampStatistics();
        } else {
            throw new Error('Statistics function not available');
        }
    }

    /**
     * Fetch assets data for status export
     * @returns {Promise<Array>} Assets data
     */
    async fetchAssetsData() {
        if (window.foglampAssetsSmart) {
            return await window.foglampAssetsSmart();
        } else if (window.smartManager) {
            return await window.smartManager.foglampAssets();
        } else {
            throw new Error('Assets function not available');
        }
    }

    /**
     * Fetch readings data for export
     * @param {string} asset - Asset name
     * @param {Object} params - Export parameters
     * @returns {Promise<Array>} Readings data
     */
    async fetchReadingsData(asset, params) {
        if (window.foglampAssetReadingsSmart) {
            return await window.foglampAssetReadingsSmart(
                asset,
                params.datapoint || undefined,
                params.limit,
                params.skip,
                params.seconds > 0 ? params.seconds : undefined,
                params.minutes > 0 ? params.minutes : undefined,
                params.hours > 0 ? params.hours : undefined,
                params.previous > 0 ? params.previous : undefined
            );
        } else if (window.smartManager) {
            return await window.smartManager.foglampAssetReadings(asset, params);
        } else {
            throw new Error('Asset readings function not available');
        }
    }

    /**
     * Calculate Excel column letter for index
     * @param {number} colIndex - 0-based column index
     * @returns {string} Excel column letter
     */
    getExcelColumnLetter(colIndex) {
        return getColumnLetter(colIndex);
    }

    /**
     * Clear worksheet cache
     * @param {string} name - Optional worksheet name to clear, clears all if not provided
     */
    clearWorksheetCache(name = null) {
        if (name) {
            this.worksheetCache.delete(name);
        } else {
            this.worksheetCache.clear();
        }
    }

    /**
     * Get Excel integration statistics
     * @returns {Object} Integration statistics
     */
    getIntegrationStats() {
        return {
            cachedWorksheets: this.worksheetCache.size,
            exportFormats: Object.keys(this.exportFormats),
            isExcelAvailable: typeof Excel !== 'undefined' && typeof Excel.run === 'function'
        };
    }

    /**
     * Initialize Excel integration
     */
    initialize() {
        // Check if Excel API is available
        if (typeof Excel === 'undefined' || typeof Excel.run !== 'function') {
            console.warn('Excel API not available - Excel integration features disabled');
            return false;
        }

        // Clear any cached worksheets on initialization
        this.clearWorksheetCache();

        console.log('✅ Excel integration system initialized');
        return true;
    }
}

// Create singleton instance
export const excelIntegrationManager = new ExcelIntegrationManager();

// Export individual methods for backward compatibility
export const ensureWorksheet = (context, name) => excelIntegrationManager.ensureWorksheet(context, name);
export const handleExportStatus = () => excelIntegrationManager.handleExportStatus();
export const handleExportReadings = () => excelIntegrationManager.handleExportReadings();

// Export singleton as default
export default excelIntegrationManager;

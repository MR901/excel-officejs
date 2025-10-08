/**
 * Excel Integration for FogLAMP DataLink
 * Handles Excel worksheet operations, data export, and formatting
 */

import { getActiveInstanceWithMeta, getInstances } from '../core/storage.js';
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
                sheetSuffix: 'Status',  // Simplified for Excel sheet name compliance
                dateFormat: '[$-en-US]mm/dd/yyyy hh:mm:ss AM/PM',
                headers: ['Type', 'Data']
            },
            readings: {
                sheetSuffix: 'data',  // Simplified for Excel sheet name compliance  
                dateFormat: '[$-en-US]mm/dd/yyyy hh:mm:ss AM/PM',
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
        // Do NOT cache sheet objects across contexts; reacquire each time
        const sheets = context.workbook.worksheets;
        let sheet;
        try {
            sheet = sheets.getItem(name);
            sheet.load("name");
            await context.sync();
        } catch (_e) {
            sheet = sheets.add(name);
            await context.sync();
        }
        try { sheet.activate(); } catch (_e) {}
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
        
        // Ensure rectangular data (all rows equal length)
        const targetColCount = Math.max(
            headers.length,
            rows.reduce((max, r) => Math.max(max, Array.isArray(r) ? r.length : 0), 0)
        );
        const normalizedRows = this.normalizeRowsForExcel(rows, targetColCount);

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
            if (normalizedRows.length > 0) {
                const dataRange = startRange
                    .getOffsetRange(currentRow, 0)
                    .getResizedRange(normalizedRows.length - 1, Math.max(1, targetColCount) - 1);

                dataRange.values = normalizedRows;

                if (dataFormat) {
                    this.formatDataRows(dataRange, { ...options, headers, rowsCount: normalizedRows.length });
                }
            }

            // Auto-fit columns if requested
            if (autoFit) {
                const totalCols = Math.max(headers.length, targetColCount);
                if (totalCols > 0) {
                    const autoFitRange = startRange.getResizedRange(
                        Math.max(0, (headers.length > 0 ? 1 : 0) + normalizedRows.length - 1),
                        totalCols - 1
                    );
                    autoFitRange.format.autofitColumns();
                }
            }

            await context.sync();
            
        } catch (error) {
            logMessage('error', 'Failed to write table to Excel', { 
                error: error.message,
                rowCount: normalizedRows.length,
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

        // Apply number format only to the timestamp column if provided
        if (options.timestampColumn && Array.isArray(options.headers)) {
            const tsIndex = options.headers.indexOf(options.timestampColumn);
            if (tsIndex >= 0) {
                const tsRange = dataRange.getColumn(tsIndex);
                const fmt = this.exportFormats.readings.dateFormat;
                const count = Math.max(1, Number(options.rowsCount) || 1);
                // numberFormat expects a 2D array of size [rows][1]
                const fmtMatrix = Array(count).fill([fmt]);
                tsRange.numberFormat = fmtMatrix;
            }
        }

        // Subtle borders for readability
        format.borders.getItem('InsideHorizontal').style = 'Continuous';
        format.borders.getItem('InsideHorizontal').color = '#D1D5DB';
    }

    /**
     * Export status data to formatted Excel sheet
     * @returns {Promise<boolean>} Success status
     */
    async handleExportStatus() {
        const instanceUrls = getInstances();
        if (!instanceUrls || instanceUrls.length === 0) {
            logMessage('warn', 'Export Status: no instances registered');
            return false;
        }

        const sheetName = 'Status';

        try {
            logMessage('info', 'Starting multi-instance status export', { instances: instanceUrls.length, sheet: sheetName });

            // Fetch ping, statistics, assets for each instance in parallel
            const perInstanceResults = await Promise.all(
                instanceUrls.map(async (url) => {
                    const [pingRes, statsRes, assetsRes] = await Promise.allSettled([
                        window.FogLAMP.api.pingForUrl(url),
                        window.FogLAMP.api.statisticsForUrl(url),
                        window.FogLAMP.api.assetsForUrl(url)
                    ]);

                    const ping = pingRes.status === 'fulfilled' ? pingRes.value : null;
                    const stats = statsRes.status === 'fulfilled' ? statsRes.value : null;
                    const assets = assetsRes.status === 'fulfilled' ? assetsRes.value : null;

                    // Build quick lookup maps
                    const statsMap = new Map();
                    if (Array.isArray(stats)) {
                        for (const item of stats) {
                            if (item && item.key != null) statsMap.set(String(item.key).toUpperCase(), item.value);
                        }
                    }

                    const assetsMap = new Map();
                    if (Array.isArray(assets)) {
                        for (const a of assets) {
                            if (a && a.assetCode != null) assetsMap.set(String(a.assetCode), a.count);
                        }
                    }

                    return { url, ping, statsMap, assetsMap };
                })
            );

            const nowDate = new Date();
            const colCount = instanceUrls.length + 2; // A: Section, B: Field, C..: instances
            const NA = 'NA';

            const boolStr = (v) => (v === true ? 'TRUE' : v === false ? 'FALSE' : NA);
            const arrStr = (arr) => {
                if (!Array.isArray(arr) || arr.length === 0) return NA;
                // Prefix with apostrophe to force text in Excel and avoid formula issues
                return `'` + `- ${arr.join('\n- ')}`;
            };
            const getPingField = (inst, field) => {
                const p = inst.ping || {};
                switch (field) {
                    case 'Uptime': return p.uptime ?? NA;
                    case 'DataRead': return p.dataRead ?? NA;
                    case 'DataSent': return p.dataSent ?? NA;
                    case 'DataPurge': return p.dataPurged ?? NA;
                    case 'Authentication Optional': return boolStr(p.authenticationOptional);
                    case 'Service Name': return p.serviceName ?? NA;
                    case 'Hostname': return p.hostName ?? NA;
                    case 'IP Addresses': return arrStr(p.ipAddresses);
                    case 'Health': return p.health ?? NA;
                    case 'Safe Mode': return boolStr(p.safeMode);
                    case 'Version': return p.version ?? NA;
                    case 'Alerts': return p.alerts ?? NA;
                    default: return NA;
                }
            };

            const statsKeys = ['BUFFERED', 'DISCARDED', 'PURGED', 'READINGS', 'UNSENT', 'UNSNPURGED'];

            // Build rows
            const rows = [];
            // Header timestamp
            const tsRow = rows.length; rows.push(['Last Updated  at Timestamp', '', nowDate, ...Array(Math.max(0, colCount - 3)).fill('')]);
            // Spacer
            const spacer1Row = rows.length; rows.push(Array(colCount).fill(''));
            // Instance SNo.
            const instanceSnoRow = rows.length; rows.push(['Instance SNo.', '', ...instanceUrls.map((_, i) => i + 1)]);
            // Instance URL
            const instanceUrlRow = rows.length; rows.push(['Instance URL', '', ...instanceUrls]);
            // Spacer
            const spacer2Row = rows.length; rows.push(Array(colCount).fill(''));

            // Ping block
            const pingFields = ['Uptime', 'DataRead', 'DataSent', 'DataPurge', 'Authentication Optional', 'Service Name', 'Hostname', 'IP Addresses', 'Health', 'Safe Mode', 'Version', 'Alerts'];
            const pingStartRow = rows.length;
            pingFields.forEach((field, idx) => {
                const values = perInstanceResults.map(inst => getPingField(inst, field));
                rows.push([idx === 0 ? 'Ping' : '', field, ...values]);
            });
            const pingEndRow = rows.length - 1;
            // Spacer
            const spacer3Row = rows.length; rows.push(Array(colCount).fill(''));

            // Statistics block
            const statsStartRow = rows.length;
            statsKeys.forEach((key, idx) => {
                const values = perInstanceResults.map(inst => {
                    const v = inst.statsMap.get(key);
                    return v == null ? NA : v;
                });
                rows.push([idx === 0 ? 'Statistics' : '', key, ...values]);
            });
            const statsEndRow = rows.length - 1;
            // Spacer
            const spacer4Row = rows.length; rows.push(Array(colCount).fill(''));

            // Assets block
            const allAssetNames = new Set();
            for (const inst of perInstanceResults) {
                for (const name of inst.assetsMap.keys()) allAssetNames.add(name);
            }
            const assetNames = Array.from(allAssetNames).sort((a, b) => a.localeCompare(b));
            // Header for assets section
            const assetsHeaderRow = rows.length; rows.push(['Assets', 'Asset Name / Counts', ...Array(instanceUrls.length).fill('')]);
            const assetStartRow = rows.length;
            assetNames.forEach((name) => {
                const values = perInstanceResults.map(inst => {
                    const v = inst.assetsMap.get(name);
                    return v == null ? NA : v;
                });
                rows.push(['', name, ...values]);
            });
            const assetEndRow = rows.length - 1;

            // Normalize and write to sheet
            const normalized = this.normalizeRowsForExcel(rows, colCount);

            await Excel.run(async (context) => {
                const sheet = await this.ensureWorksheet(context, sheetName);
                // Clear a safe bounding area without relying on isNullObject (compat-safe)
                try {
                    const clearRows = Math.max(normalized.length + 50, 200);
                    const clearCols = Math.max(colCount + 5, 10);
                    const clearRange = sheet.getRangeByIndexes(0, 0, clearRows, clearCols);
                    clearRange.clear();
                await context.sync();
                } catch (_e) {}

                const range = sheet.getRangeByIndexes(0, 0, normalized.length, colCount);
                range.values = normalized;
                    await context.sync();
                    // Apply date number format to the single timestamp cell (column C) in header row
                    try {
                        const tsCell = sheet.getRangeByIndexes(tsRow, 2, 1, 1);
                        tsCell.numberFormat = [[this.exportFormats.status.dateFormat]];
                    } catch (_e) {}

                // Formatting and merging for readability
                try {
                    // Timestamp row light background and merge A1:B1
                    const tsRange = sheet.getRangeByIndexes(tsRow, 0, 1, colCount);
                    tsRange.format.fill.color = '#F3F4F6';
                    tsRange.format.font.bold = true;
                    tsRange.format.horizontalAlignment = 'Center';
                    tsRange.format.verticalAlignment = 'Center';
                    const tsLabel = sheet.getRangeByIndexes(tsRow, 0, 1, 2);
                    tsLabel.merge(false);

                    // Merge A:B for Instance SNo. and Instance URL, apply black bg and white text
                    const snoLabel = sheet.getRangeByIndexes(instanceSnoRow, 0, 1, 2);
                    snoLabel.merge(false);
                    snoLabel.format.fill.color = '#000000';
                    snoLabel.format.font.color = '#FFFFFF';
                    snoLabel.format.font.bold = true;
                    snoLabel.format.horizontalAlignment = 'Center';
                    snoLabel.format.verticalAlignment = 'Center';
                    const urlLabel = sheet.getRangeByIndexes(instanceUrlRow, 0, 1, 2);
                    urlLabel.merge(false);
                    urlLabel.format.fill.color = '#000000';
                    urlLabel.format.font.color = '#FFFFFF';
                    urlLabel.format.font.bold = true;
                    urlLabel.format.horizontalAlignment = 'Center';
                    urlLabel.format.verticalAlignment = 'Center';

                    // Ping section: merge label in column A, color blue; color field names in B
                    if (pingEndRow >= pingStartRow) {
                        const pingLabel = sheet.getRangeByIndexes(pingStartRow, 0, (pingEndRow - pingStartRow + 1), 1);
                        pingLabel.merge(false);
                        pingLabel.format.fill.color = '#0078D4';
                        pingLabel.format.font.color = '#FFFFFF';
                        pingLabel.format.font.bold = true;
                        pingLabel.format.horizontalAlignment = 'Center';
                        pingLabel.format.verticalAlignment = 'Center';
                        const pingFieldsCol = sheet.getRangeByIndexes(pingStartRow, 1, (pingEndRow - pingStartRow + 1), 1);
                        pingFieldsCol.format.fill.color = '#EEF2FF';
                        pingFieldsCol.format.font.bold = true;
                    }

                    // Statistics section: merge label in column A, color green; color field names in B
                    if (statsEndRow >= statsStartRow) {
                        const statsLabel = sheet.getRangeByIndexes(statsStartRow, 0, (statsEndRow - statsStartRow + 1), 1);
                        statsLabel.merge(false);
                        statsLabel.format.fill.color = '#22C55E';
                        statsLabel.format.font.color = '#FFFFFF';
                        statsLabel.format.font.bold = true;
                        statsLabel.format.horizontalAlignment = 'Center';
                        statsLabel.format.verticalAlignment = 'Center';
                        const statsFieldsCol = sheet.getRangeByIndexes(statsStartRow, 1, (statsEndRow - statsStartRow + 1), 1);
                        statsFieldsCol.format.fill.color = '#ECFDF5';
                        statsFieldsCol.format.font.bold = true;
                    }

                    // Assets section: merge label in column A across header + asset rows, color orange
                    const assetsLabelRows = (assetEndRow >= assetsHeaderRow) ? (assetEndRow - assetsHeaderRow + 1) : 1;
                    const assetsLabel = sheet.getRangeByIndexes(assetsHeaderRow, 0, assetsLabelRows, 1);
                    assetsLabel.merge(false);
                    assetsLabel.format.fill.color = '#F59E0B';
                    assetsLabel.format.font.color = '#FFFFFF';
                    assetsLabel.format.font.bold = true;
                    assetsLabel.format.horizontalAlignment = 'Center';
                    assetsLabel.format.verticalAlignment = 'Center';
                    // Asset name column B background
                    if (assetEndRow >= assetStartRow) {
                        const assetNameCol = sheet.getRangeByIndexes(assetStartRow, 1, (assetEndRow - assetStartRow + 1), 1);
                        assetNameCol.format.fill.color = '#FFF7ED';
                        assetNameCol.format.font.bold = true;
                    }

                    // Add thin borders to data area for readability
                    const dataArea = sheet.getRangeByIndexes(0, 0, normalized.length, colCount);
                    dataArea.format.borders.getItem('InsideHorizontal').style = 'Continuous';
                    dataArea.format.borders.getItem('InsideHorizontal').color = '#E5E7EB';
                    dataArea.format.borders.getItem('InsideVertical').style = 'Continuous';
                    dataArea.format.borders.getItem('InsideVertical').color = '#E5E7EB';

                    // Alignment rules
                    // Column B vertical middle
                    const colB = sheet.getRangeByIndexes(0, 1, normalized.length, 1);
                    colB.format.verticalAlignment = 'Center';
                    // Columns C.. align center + middle
                    if (colCount > 2) {
                        const valueCols = sheet.getRangeByIndexes(0, 2, normalized.length, colCount - 2);
                        valueCols.format.horizontalAlignment = 'Center';
                        valueCols.format.verticalAlignment = 'Center';
                    }

                    // Column widths (convert Excel default units → points)
                    // Approximate: 1 Excel char ~ 7 px, 1 pt ~ 1.333 px → ~5.3 pt per unit
                    const POINTS_PER_EXCEL_CHAR = 5.3;
                    const widthA = Math.round(10 * POINTS_PER_EXCEL_CHAR);
                    const widthB = Math.round(18 * POINTS_PER_EXCEL_CHAR);
                    const widthOther = 21.5 * POINTS_PER_EXCEL_CHAR; // value columns at 21.5 units
                    // Column A: 10 units
                    sheet.getRangeByIndexes(0, 0, 1, 1).getEntireColumn().format.columnWidth = widthA;
                    // Column B: 18 units
                    sheet.getRangeByIndexes(0, 1, 1, 1).getEntireColumn().format.columnWidth = widthB;
                    // Columns C..: 18 units
                    for (let c = 2; c < colCount; c++) {
                        sheet.getRangeByIndexes(0, c, 1, 1).getEntireColumn().format.columnWidth = widthOther;
                    }

                    // Auto-fit all row heights for the written range
                    const allRowsRange = sheet.getRangeByIndexes(0, 0, normalized.length, colCount);
                    allRowsRange.format.autofitRows();
                } catch (fmtError) {
                    console.warn('Formatting error (non-fatal):', fmtError);
                }

                await context.sync();

                logMessage('info', 'Multi-instance status export done', { sheet: sheetName, instances: instanceUrls.length, rows: normalized.length, columns: colCount });
            });

            return true;

        } catch (error) {
            logMessage('error', 'Status export failed', { error: error.message });
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

        const exportParams = this.getExportParameters();
        const outputTypeLocal = exportParams?.data?.outputType || 'raw';
        const asset = this.getSelectedAsset();
        if (outputTypeLocal !== 'combined') {
            if (!asset) {
                logMessage('warn', 'Export Readings: no asset specified');
                return false;
            }
        }

        // Use previously fetched exportParams
        if (!exportParams.valid) {
            logMessage('warn', 'Export Readings: invalid parameters', exportParams.errors);
            if (window.FogLAMP?.errors) {
                await window.FogLAMP.errors.showError('Invalid parameters', exportParams.errors.join('\n'));
            }
            return false;
        }

        // Build readings sheet name: <host/displayname up to 20><'>'><asset up to 10>
        const buildReadingsSheetName = () => {
            const invalid = /[\\\/\?\*\[\]:]/g; // Excel disallowed chars
            // Prefer hostName; else derive hostname from URL; else fallback to URL
            let leftRaw = activeInstance.hostName || getDisplayName(activeInstance) || '';
            if (!leftRaw) {
                try {
                    leftRaw = new URL(activeInstance.url).hostname;
                } catch (_e) {
                    leftRaw = activeInstance.url || 'instance';
                }
            }
            const otLocal = exportParams?.data?.outputType || 'raw';
            const rightRaw = otLocal === 'combined' ? 'data-summary' : (asset || 'asset');
            const right = rightRaw.replace(invalid, '-');
            // Ensure right side remains intact within 31-char limit
            const maxLeftLen = Math.max(1, 31 - 1 - right.length); // 1 for '>'
            const left = (leftRaw || 'instance').replace(invalid, '-').substring(0, maxLeftLen);
            const name = `${left}>${right}`;
            return name || 'Readings';
        };
        const sheetName = buildReadingsSheetName();

        try {
            logMessage('info', 'Starting minimal readings export', { 
                instance: activeInstance.url,
                asset,
                sheet: sheetName,
                outputType: exportParams.data.outputType,
                mode: exportParams.data.mode,
                params: exportParams.data
            });

            // Build table based on outputType
            let headers, rows;
            // Hoisted vars used later for formatting combined output
            let assetsCount = 0;
            let oldestRowIndex = -1;
            let newestRowIndex = -1;
            const ot = exportParams.data.outputType || 'raw';
            if (ot === 'combined') {
                // Build upgraded combined output across ALL assets for the active instance
                // Table 1: Assets-wise summary (vertical blocks per asset)
                // Table 2: Asset & datapoint wise summary (tabular)
                const instanceName = getDisplayName(activeInstance);
                const baseUrl = activeInstance?.url || null;

                // Fetch asset list for ACTIVE INSTANCE ONLY to avoid data leaks
                let allAssets = [];
                try {
                    if (baseUrl && window.FogLAMP?.api?.assetsForUrl) {
                        allAssets = await window.FogLAMP.api.assetsForUrl(baseUrl);
                    } else if (window.FogLAMP?.api?.assets) {
                        allAssets = await window.FogLAMP.api.assets();
                    }
                } catch (_e) {}
                const assetEntries = Array.isArray(allAssets) ? allAssets : [];

                // Prepare per-asset timespan and summary in parallel
                const perAssetData = await Promise.all(assetEntries.map(async (a) => {
                    const assetName = (typeof a === 'string') ? a : (a.assetCode || a.asset || a.name || '');
                    const readingCount = a.count || 0;
                    let timespan = null;
                    let summary = null;
                    try {
                        if (baseUrl && window.FogLAMP?.api?.readingsTimespanForUrl) {
                            timespan = await window.FogLAMP.api.readingsTimespanForUrl(baseUrl, assetName, null, {});
                        } else {
                            timespan = await window.FogLAMP.api.readingsTimespan(assetName, null, {});
                        }
                    } catch (_e) {}
                    try {
                        if (baseUrl && window.FogLAMP?.api?.readingsSummaryForUrl) {
                            summary = await window.FogLAMP.api.readingsSummaryForUrl(baseUrl, assetName, null, {});
                        } else {
                            summary = await window.FogLAMP.api.readingsSummary(assetName, null, {});
                        }
                    } catch (_e) {}
                    return { assetName, readingCount, timespan, summary };
                }));

                // Compose rows
                headers = [];
                rows = [];

                // Instance header
                rows.push(['Instance Name:', instanceName]);
                rows.push([]);

                // Table 1 label
                rows.push(['Table1: Assets-wise summary']);

                // Per-asset horizontal summary rows
                const toDate = (ts) => {
                    if (ts == null || ts === '') return '';
                    let d = null;
                    if (typeof ts === 'string') {
                        d = this.parseFoglampTimestamp(ts) || new Date(ts);
                    } else if (typeof ts === 'number') {
                        // Handle common numeric timestamp encodings
                        // 1) Microseconds since epoch (e.g., 1.6e15) → ms
                        // 2) Milliseconds since epoch (>1e12 but <1e15) → ms
                        // 3) Seconds since epoch (~1e9..1e10) → *1000
                        // 4) Excel serial date (e.g., 45936.32) → convert from OADate to Date
                        if (ts > 1e14) {
                            // Likely microseconds
                            d = new Date(Math.round(ts / 1000));
                        } else if (ts > 1e12) {
                            // Likely milliseconds
                            d = new Date(ts);
                        } else if (ts > 1e9) {
                            // Likely seconds
                            d = new Date(ts * 1000);
                        } else if (ts > 25569 && ts < 100000) {
                            // Looks like an Excel serial date already
                            const ms = (ts - 25569) * 86400000;
                            d = new Date(ms);
                        } else {
                            // Fallback best effort
                            d = new Date(ts);
                        }
                    } else if (typeof ts === 'object') {
                        // Support nested timestamp containers
                        const inner = ts.timestamp || ts.user_ts || ts.ts || ts.time || ts.date || '';
                        if (inner) return toDate(inner);
                        return '';
                    }
                    if (!(d instanceof Date) || isNaN(d.getTime())) return '';
                    return this.convertDateToOADate(d);
                };

                const sNoRow = ['SNo.', ...perAssetData.map((_, idx) => idx + 1)];
                const assetsRow = ['Assets', ...perAssetData.map((entry) => entry.assetName)];
                const readingsRow = ['Readings', ...perAssetData.map((entry) => entry.readingCount)];
                assetsCount = perAssetData.length;
                oldestRowIndex = rows.length + 3; // sNoRow(0), assetsRow(1), readingsRow(2), then oldest at 3
                newestRowIndex = rows.length + 4; // newest follows oldest
                // Helper to robustly extract oldest/newest timestamp from varying API shapes
                const extractTimestamp = (node, which) => {
                    const obj = Array.isArray(node) ? (node[0] || {}) : (node || {});
                    const keys = which === 'oldest'
                        ? ['oldest', 'start', 'first', 'minimum', 'min', 'earliest', 'from', 'oldestTimestamp']
                        : ['newest', 'end', 'last', 'maximum', 'max', 'latest', 'to', 'newestTimestamp'];
                    for (const k of keys) {
                        if (obj && Object.prototype.hasOwnProperty.call(obj, k)) {
                            const v = obj[k];
                            if (v && typeof v === 'object') {
                                const inner = v.timestamp || v.user_ts || v.ts || v.time || v.date || '';
                                if (inner) return toDate(inner);
                            } else if (v != null && v !== '') {
                                return toDate(v);
                            }
                        }
                    }
                    // Fallback: sometimes timestamp fields are at the top level
                    if (obj && typeof obj === 'object') {
                        const fallback = obj.timestamp || obj.user_ts || obj.ts || obj.time || obj.date || '';
                        if (fallback) return toDate(fallback);
                    }
                    return '';
                };

                const oldestRow = ['Oldest Reading Timestamp:', ...perAssetData.map((entry) => extractTimestamp(entry.timespan, 'oldest'))];
                const newestRow = ['Newest Reading Timestamp:', ...perAssetData.map((entry) => extractTimestamp(entry.timespan, 'newest'))];

                rows.push(sNoRow);
                rows.push(assetsRow);
                rows.push(readingsRow);
                rows.push(oldestRow);
                rows.push(newestRow);
                rows.push([]);

                // Table 2 label
                rows.push([]);
                rows.push(['Table2: Asset & datapoint wise summary']);
                // Header for table 2
                rows.push(['SNo.', 'Asset', 'Datapoint', 'Min', 'Max', 'Average']);

                // Data rows for table 2
                let serial = 1;
                perAssetData.forEach((entry) => {
                    // Normalize summary into a mapping { dpName: {min,max,average} }
                    let mapping = {};
                    if (Array.isArray(entry.summary)) {
                        // Some FogLAMP deployments return an array of single-key objects per datapoint
                        // Merge them to a single mapping
                        mapping = entry.summary.reduce((acc, obj) => {
                            if (obj && typeof obj === 'object') {
                                Object.keys(obj).forEach((k) => { acc[k] = obj[k]; });
                            }
                            return acc;
                        }, {});
                    } else if (entry.summary && typeof entry.summary === 'object') {
                        const looksLikeStats = ['min','max','average','minimum','maximum','avg']
                            .some(k => Object.prototype.hasOwnProperty.call(entry.summary, k));
                        mapping = looksLikeStats ? {} : entry.summary;
                    }
                    const keys = Object.keys(mapping).sort((a, b) => a.localeCompare(b));
                    keys.forEach((dp) => {
                        const node = mapping[dp] || {};
                        const minVal = node.min ?? node.minimum ?? '';
                        const maxVal = node.max ?? node.maximum ?? '';
                        const avgVal = node.average ?? node.avg ?? '';
                        rows.push([serial++, entry.assetName, dp, minVal, maxVal, avgVal]);
                    });
                });
            } else {
                // Fetch readings only for non-combined outputs
                const readings = await this.fetchReadingsData(asset, exportParams.data);
                if (!readings || readings.length === 0) {
                    logMessage('warn', 'No readings data found for export', { asset });
                    return false;
                }
                if (ot === 'summary') {
                    const t = this.buildSummaryTable(readings, asset, exportParams.data.datapoint);
                    headers = t.headers; rows = t.rows;
                } else if (ot === 'timespan') {
                    const t = this.buildTimespanTable(readings, asset, exportParams.data.datapoint);
                    headers = t.headers; rows = t.rows;
                } else {
                    const t = this.buildSimpleReadings(readings, asset, exportParams.data.datapoint);
                    headers = t.headers; rows = t.rows;
                }
            }

            // Determine target column count and normalize rows to avoid Excel range mismatch
            const targetColCount = Math.max(
                Array.isArray(headers) ? headers.length : 0,
                Array.isArray(rows) && rows.length > 0 ? rows.reduce((max, r) => Math.max(max, Array.isArray(r) ? r.length : 1), 0) : 0
            );
            const normalizedRows = this.normalizeRowsForExcel(rows, Math.max(1, targetColCount));
            const normalizedHeader = (Array.isArray(headers) && headers.length > 0)
                ? this.normalizeRowsForExcel([headers], Math.max(1, targetColCount))[0]
                : null;

            await Excel.run(async (context) => {
                const sheet = await this.ensureWorksheet(context, sheetName);
                // Clear a safe bounding area without relying on isNullObject (compat-safe)
                try {
                    const clearRows = Math.max(normalizedRows.length + 50, 200);
                    const clearCols = Math.max(Math.max(headers.length || 0, targetColCount) + 5, 10);
                    const clearRange = sheet.getRangeByIndexes(0, 0, clearRows, clearCols);
                    clearRange.clear();
                await context.sync();
                } catch (_e) {}

                // Determine start rows based on output type (offset for RAW)
                const isRawOutput = (ot === 'raw');
                const headerRowIndex = isRawOutput ? 13 : 0; // 0-based → Row 14
                const dataStartRowIndex = isRawOutput
                    ? 14 // 0-based → Row 15
                    : ((Array.isArray(headers) && headers.length > 0) ? 1 : 0);

                // Write headers
                if (Array.isArray(headers) && headers.length > 0) {
                    const headerRange = sheet.getRangeByIndexes(headerRowIndex, 0, 1, Math.max(1, targetColCount));
                    headerRange.values = [normalizedHeader];
                    // Header styling
                    headerRange.format.fill.color = '#E6F2FF';
                    headerRange.format.font.bold = true;
                    headerRange.format.horizontalAlignment = 'Center';
                    headerRange.format.verticalAlignment = 'Center';
                }

                // Write rows
                if (normalizedRows && normalizedRows.length > 0) {
                    const dataRange = sheet.getRangeByIndexes(dataStartRowIndex, 0, normalizedRows.length, Math.max(1, targetColCount));
                    dataRange.values = normalizedRows;
                    // Apply timestamp format only when the first header is explicitly 'Timestamp'
                    try {
                        if (Array.isArray(headers) && headers.length > 0 && String(headers[0]).toLowerCase() === 'timestamp') {
                            const tsRange = sheet.getRangeByIndexes(dataStartRowIndex, 0, normalizedRows.length, 1);
                            const fmt = this.exportFormats.readings.dateFormat;
                            const fmtMatrix = Array(normalizedRows.length).fill([fmt]);
                            tsRange.numberFormat = fmtMatrix;
                        }
                        // For combined output, format the row cells for oldest/newest timestamps as dates
                        if (ot === 'combined' && assetsCount > 0) {
                            const fmt = this.exportFormats.readings.dateFormat;
                            const oldestRowAbs = dataStartRowIndex + oldestRowIndex;
                            const newestRowAbs = dataStartRowIndex + newestRowIndex;
                            const fmtRow = [Array(assetsCount).fill(fmt)];
                            const oldestRange = sheet.getRangeByIndexes(oldestRowAbs, 1, 1, assetsCount);
                            const newestRange = sheet.getRangeByIndexes(newestRowAbs, 1, 1, assetsCount);
                            oldestRange.numberFormat = fmtRow;
                            newestRange.numberFormat = fmtRow;
                        }
                    } catch (_e) {}
                }

                // Apply requested formatting for combined export
                if (ot === 'combined') {
                    try {
                        const totalCols = Math.max(1, targetColCount);

                        // Helpers to find rows by content
                        const findRowIndexByFirstCell = (text) => {
                            if (!Array.isArray(normalizedRows)) return -1;
                            const needle = String(text).trim();
                            return normalizedRows.findIndex(r => Array.isArray(r) && String(r[0]).trim() === needle);
                        };

                        // Locate key rows by their first-cell labels
                        const instanceRowRel = findRowIndexByFirstCell('Instance Name:');
                        const table1RowRel = findRowIndexByFirstCell('Table1: Assets-wise summary');
                        const table2LabelRowRel = findRowIndexByFirstCell('Table2: Asset & datapoint wise summary');
                        const table1SnoRel = findRowIndexByFirstCell('SNo.');
                        const table1AssetsRel = findRowIndexByFirstCell('Assets');
                        const table1ReadingsRel = findRowIndexByFirstCell('Readings');
                        const table1OldestRel = findRowIndexByFirstCell('Oldest Reading Timestamp:');
                        const table1NewestRel = findRowIndexByFirstCell('Newest Reading Timestamp:');

                        const toAbs = (rel) => (rel >= 0 ? dataStartRowIndex + rel : -1);
                        const instanceLabelRowAbs = toAbs(instanceRowRel);
                        const table1LabelRowAbs = toAbs(table1RowRel);
                        const table2LabelRowAbs = toAbs(table2LabelRowRel);

                        // Table2 header is the row immediately after the Table2 label
                        const table2HeaderRowAbs = table2LabelRowAbs >= 0 ? (table2LabelRowAbs + 1) : -1;

                        // 1) White font on black background for label rows (Instance, Table1, Table2)
                        const blackLabelRows = [instanceLabelRowAbs, table1LabelRowAbs].concat(table2LabelRowAbs >= 0 ? [table2LabelRowAbs] : []);
                        for (const row of blackLabelRows) {
                            if (row < 0) continue;
                            const rng = sheet.getRangeByIndexes(row, 0, 1, totalCols);
                            rng.format.fill.color = '#000000';
                            rng.format.font.color = '#FFFFFF';
                            rng.format.font.bold = true;
                            rng.format.horizontalAlignment = 'Center';
                            rng.format.verticalAlignment = 'Center';
                        }

                        // 1a) Override alignment for instance name cell (column B) to Left
                        if (instanceLabelRowAbs >= 0) {
                            const instanceNameCell = sheet.getRangeByIndexes(instanceLabelRowAbs, 1, 1, 1);
                            instanceNameCell.format.horizontalAlignment = 'Left';
                        }

                        // 1b) Center + middle align values in Table1 (Rows 4-8, Col B..last)
                        const table1StartAbs = toAbs(table1SnoRel);
                        const table1EndAbs = toAbs(table1NewestRel);
                        if (table1StartAbs >= 0 && table1EndAbs >= table1StartAbs && totalCols > 1) {
                            const table1ValuesRng = sheet.getRangeByIndexes(
                                table1StartAbs,
                                1,
                                (table1EndAbs - table1StartAbs + 1),
                                totalCols - 1
                            );
                            table1ValuesRng.format.horizontalAlignment = 'Center';
                            table1ValuesRng.format.verticalAlignment = 'Center';
                        }

                        // 1c) Center + middle align values in Table2 (Row 13..end, Col A..last)
                        const table2DataStartAbs = table2HeaderRowAbs >= 0 ? (table2HeaderRowAbs + 1) : -1;
                        const totalRowsAbs = dataStartRowIndex + (normalizedRows?.length || 0);
                        if (table2DataStartAbs >= 0 && table2DataStartAbs < totalRowsAbs && totalCols > 0) {
                            const table2ValuesRng = sheet.getRangeByIndexes(
                                table2DataStartAbs,
                                0,
                                totalRowsAbs - table2DataStartAbs,
                                totalCols
                            );
                            table2ValuesRng.format.horizontalAlignment = 'Center';
                            table2ValuesRng.format.verticalAlignment = 'Center';
                        }

                        // 2) Blue background for Table1 label cells in column A
                        const table1BlueRowsAbs = [
                            toAbs(table1SnoRel),
                            toAbs(table1AssetsRel),
                            toAbs(table1ReadingsRel),
                            toAbs(table1OldestRel),
                            toAbs(table1NewestRel)
                        ];
                        for (const row of table1BlueRowsAbs) {
                            if (row < 0) continue;
                            const cell = sheet.getRangeByIndexes(row, 0, 1, 1);
                            cell.format.fill.color = '#0078D4';
                            cell.format.font.bold = true;
                            cell.format.font.color = '#000000'; // keep default dark for data, label stays readable
                        }

                        // 3) Green background for Table2 header row (first 6 columns)
                        if (table2HeaderRowAbs >= 0) {
                            const width = Math.min(totalCols, 6);
                            const headerRng = sheet.getRangeByIndexes(table2HeaderRowAbs, 0, 1, width);
                            headerRng.format.fill.color = '#22C55E';
                            headerRng.format.font.bold = true;
                            headerRng.format.horizontalAlignment = 'Center';
                            headerRng.format.verticalAlignment = 'Center';
                        }
                    } catch (_e) {}
                }

                // Freeze panes: keep top 14 rows frozen for RAW so only readings scroll
                try {
                    if (isRawOutput) {
                        sheet.freezePanes.freezeRows(14);
                    }
                } catch (_e) {}

                // Column widths for Get Readings sheet
                try {
                    const POINTS_PER_EXCEL_CHAR = 5.3;
                    const colAWidth = Math.round(26 * POINTS_PER_EXCEL_CHAR);
                    const colBWidth = Math.round(11 * POINTS_PER_EXCEL_CHAR);
                    sheet.getRangeByIndexes(0, 0, 1, 1).getEntireColumn().format.columnWidth = colAWidth;
                    sheet.getRangeByIndexes(0, 1, 1, 1).getEntireColumn().format.columnWidth = colBWidth;
                    // Override: Set Column B and Column C width to 17.50 units
                    const width175 = Math.round(17.5 * POINTS_PER_EXCEL_CHAR);
                    sheet.getRangeByIndexes(0, 1, 1, 1).getEntireColumn().format.columnWidth = width175; // Column B
                    sheet.getRangeByIndexes(0, 2, 1, 1).getEntireColumn().format.columnWidth = width175; // Column C
				} catch (_e) {}

				// Insert a 2D line chart for RAW readings over frozen rows (1-13)
				// X axis: Column A (Timestamp) starting from data row; Y axis: Columns C..last
				try {
					if (isRawOutput && Array.isArray(normalizedRows) && normalizedRows.length > 0 && Math.max(1, targetColCount) > 2) {
						// Remove existing chart if present to avoid duplicates on repeated exports
						try {
							const existingChart = sheet.charts.getItemOrNullObject('RawReadingsChart');
							existingChart.load('name');
							await context.sync();
							if (!existingChart.isNullObject) {
								existingChart.delete();
								await context.sync();
							}
						} catch (_e) {}

						const totalCols = Math.max(1, targetColCount);
						const seriesStartCol = 2; // Column C
						const seriesCols = Math.max(0, totalCols - seriesStartCol);
						if (seriesCols > 0) {
							// Include header row for series names + all data rows
							const seriesRange = sheet.getRangeByIndexes(headerRowIndex, seriesStartCol, (normalizedRows.length + 1), seriesCols);
							const chart = sheet.charts.add(Excel.ChartType.line, seriesRange, Excel.ChartSeriesBy.columns);
							chart.name = 'RawReadingsChart';

							// Set categories from Timestamp column (A) for all series
							const categoriesRange = sheet.getRangeByIndexes(dataStartRowIndex, 0, normalizedRows.length, 1);
						try { chart.axes.categoryAxis.setCategoryNames(categoriesRange); } catch (_e) {}

						// Ensure the horizontal axis treats categories as a time series
						try { chart.axes.categoryAxis.categoryType = Excel.ChartAxisCategoryType.timeSeries; } catch (_e) {}
						
						// Adapt axis scale/format to the data span (seconds → minutes → hours → days)
						try {
							// Extract OADate timestamps from the first column of written rows
							const tsValues = Array.isArray(normalizedRows)
								? normalizedRows
									.map(r => (Array.isArray(r) ? r[0] : null))
									.filter(v => typeof v === 'number' && isFinite(v))
								: [];
							if (tsValues.length >= 2) {
								const minOA = Math.min(...tsValues);
								const maxOA = Math.max(...tsValues);
								const totalSeconds = Math.max(1, (maxOA - minOA) * 86400);
								const approxTicks = 8; // aim ~8-10 ticks for readability
								const niceStep = (target) => {
									const t = Math.max(1, target);
									const p = Math.pow(10, Math.floor(Math.log10(t)));
									const n = t / p;
									let s = 1;
									if (n <= 1) s = 1; else if (n <= 2) s = 2; else if (n <= 5) s = 5; else s = 10;
									return Math.max(1, Math.round(s * p));
								};
								let baseUnit = Excel.ChartAxisTimeUnit.seconds;
								let majorScale = Excel.ChartAxisTimeUnit.seconds;
								let majorUnit = 1;
								let axisFormat = '[$-en-US]hh:mm:ss';
								if (totalSeconds <= 5 * 60) { // ≤ 5 minutes
									baseUnit = Excel.ChartAxisTimeUnit.seconds;
									majorScale = Excel.ChartAxisTimeUnit.seconds;
									majorUnit = niceStep(Math.round(totalSeconds / approxTicks));
									axisFormat = '[$-en-US]hh:mm:ss';
								} else if (totalSeconds <= 2 * 60 * 60) { // ≤ 2 hours
									baseUnit = Excel.ChartAxisTimeUnit.minutes;
									majorScale = Excel.ChartAxisTimeUnit.minutes;
									majorUnit = niceStep(Math.round((totalSeconds / 60) / approxTicks));
									axisFormat = '[$-en-US]hh:mm';
								} else if (totalSeconds <= 2 * 24 * 60 * 60) { // ≤ 2 days
									baseUnit = Excel.ChartAxisTimeUnit.hours;
									majorScale = Excel.ChartAxisTimeUnit.hours;
									majorUnit = niceStep(Math.round((totalSeconds / 3600) / approxTicks));
									axisFormat = '[$-en-US]mm/dd hh:mm';
								} else { // > 2 days
									baseUnit = Excel.ChartAxisTimeUnit.days;
									majorScale = Excel.ChartAxisTimeUnit.days;
									majorUnit = Math.max(1, Math.round((totalSeconds / 86400) / approxTicks));
									axisFormat = '[$-en-US]mm/dd/yyyy';
								}

								// Apply adaptive axis configuration (best-effort; API support varies)
								try { chart.axes.categoryAxis.baseTimeUnit = baseUnit; } catch (_e) {}
								try { chart.axes.categoryAxis.majorUnitScale = majorScale; } catch (_e) {}
								try { chart.axes.categoryAxis.majorUnit = majorUnit; } catch (_e) {}
								try { chart.axes.categoryAxis.numberFormat = axisFormat; } catch (_e) {}
								// Ensure full-span coverage if supported
								try { chart.axes.categoryAxis.minimum = minOA; } catch (_e) {}
								try { chart.axes.categoryAxis.maximum = maxOA; } catch (_e) {}
							}
						} catch (_e) {}

							// Legend to the right as requested
							try { chart.legend.position = Excel.ChartLegendPosition.right; } catch (_e) {}

							// Position chart within frozen header area (rows 1-13)
							try { chart.setPosition('A1', 'H13'); } catch (_e) {}
						}
					}
				} catch (_e) {}

                await context.sync();
                logMessage('info', 'Minimal readings export done', { sheet: sheetName, rows: normalizedRows.length, columns: Math.max(1, targetColCount) });
            });

            return true;

        } catch (error) {
            logMessage('error', 'Readings export failed', {
                instance: activeInstance.url,
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
        const modeEl = document.querySelector('input[name="fl-mode"]:checked');
        const mode = modeEl ? modeEl.value : 'latest';
        const otEl = document.querySelector('input[name="fl-ot"]:checked');
        const outputType = otEl ? otEl.value : 'raw';

        const params = {
            datapoint: elements.datapoint()?.value?.trim() || '',
            limit: Math.max(1, Math.min(10000, parseInt(elements.limit()?.value || '100', 10))),
            skip: Math.max(0, parseInt(elements.skip()?.value || '0', 10)),
            seconds: -1,
            minutes: -1,
            hours: -1,
            previous: -1,
            mode,
            outputType
        };

        const errors = [];
        
        if (mode === 'latest') {
            // latest uses limit/skip only
            // Ensure time-based params are not set
            params.seconds = -1; params.minutes = -1; params.hours = -1; params.previous = -1;
        } else if (mode === 'window') {
            const secs = parseInt(elements.seconds()?.value || '0', 10);
            const mins = parseInt(elements.minutes()?.value || '0', 10);
            const hrs = parseInt(elements.hours()?.value || '0', 10);
            const chosen = [secs > 0, mins > 0, hrs > 0].filter(Boolean).length;
            if (chosen !== 1) {
                errors.push('Select exactly one time window: seconds OR minutes OR hours');
            } else {
                params.seconds = secs > 0 ? secs : -1;
                params.minutes = mins > 0 ? mins : -1;
                params.hours = hrs > 0 ? hrs : -1;
            }
        } else if (mode === 'previous') {
            const prev = parseInt(elements.previous()?.value || '0', 10);
            if (prev <= 0) {
                errors.push('Provide a positive value for previous');
            } else {
                params.previous = prev;
            }
            // Require one time unit when previous is used
            const secs = parseInt(elements.seconds()?.value || '0', 10);
            const mins = parseInt(elements.minutes()?.value || '0', 10);
            const hrs = parseInt(elements.hours()?.value || '0', 10);
            const chosen = [secs > 0, mins > 0, hrs > 0].filter(Boolean).length;
            if (chosen !== 1) {
                errors.push('Previous requires one time unit: seconds OR minutes OR hours');
            } else {
                params.seconds = secs > 0 ? secs : -1;
                params.minutes = mins > 0 ? mins : -1;
                params.hours = hrs > 0 ? hrs : -1;
            }
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
                const jsonString = JSON.stringify(result.value, null, 2);
                // Excel has a cell limit of ~32,767 characters
                if (jsonString.length > 30000) {
                    return this.truncateForExcel(jsonString, 30000);
                }
                return jsonString;
            } catch (error) {
                const stringValue = String(result.value);
                return stringValue.length > 30000 ? 
                       this.truncateForExcel(stringValue, 30000) : 
                       stringValue;
            }
        } else {
            return `Error: ${result.reason?.message || 'Unknown error'}`;
        }
    }

    /**
     * Create Excel-safe sheet name with intelligent truncation
     * @param {string} instanceName - Instance name
     * @param {string} suffix - Sheet suffix (may contain dynamic parts like asset names)
     * @returns {string} Safe sheet name
     */
    createSafeSheetName(instanceName, suffix) {
        // Excel sheet name restrictions:
        // - Max 31 characters
        // - Cannot contain: \ / ? * [ ] :
        // - Cannot be empty
        
        const invalidChars = /[\\\/\?\*\[\]:]/g;
        const cleanInstanceName = instanceName.replace(invalidChars, '-');
        const cleanSuffix = suffix.replace(invalidChars, '-');
        
        // Create name with format: "InstanceName-Suffix"
        const fullName = `${cleanInstanceName}-${cleanSuffix}`;
        
        // If it fits, return as is
        if (fullName.length <= 31) {
            return fullName;
        }
        
        // Intelligent truncation for long names
        // For asset readings: "instance-assetname-data" format
        // For status: "instance-Status" format
        
        if (cleanSuffix.includes('-data')) {
            // Asset readings format: prioritize showing some of both instance and asset
            const parts = cleanSuffix.split('-data');
            const assetPart = parts[0]; // The asset name part
            
            // Reserve space: 8 chars for instance, 1 for hyphen, up to 18 for asset, 1 hyphen, 4 for "data"
            const maxInstanceLength = Math.max(6, Math.min(12, Math.floor((31 - 6) * 0.4))); // 6-12 chars
            const maxAssetLength = 31 - maxInstanceLength - 6; // remaining space minus "-" and "-data"
            
            const truncatedInstance = cleanInstanceName.substring(0, maxInstanceLength);
            const truncatedAsset = assetPart.substring(0, maxAssetLength);
            
            return `${truncatedInstance}-${truncatedAsset}-data`;
            
        } else {
            // Status or other formats: prioritize suffix, truncate instance name
            const maxInstanceLength = 31 - cleanSuffix.length - 1; // -1 for hyphen
            
            if (maxInstanceLength > 0) {
                return `${cleanInstanceName.substring(0, maxInstanceLength)}-${cleanSuffix}`;
            }
            
            // If suffix is extremely long, truncate both intelligently
            const maxInstanceLength2 = Math.max(4, Math.floor((31 - 1) * 0.3)); // At least 4 chars, up to 30% of space
            const maxSuffixLength = 31 - maxInstanceLength2 - 1;
            
            return `${cleanInstanceName.substring(0, maxInstanceLength2)}-${cleanSuffix.substring(0, maxSuffixLength)}`;
        }
    }

    /**
     * Validate data for Excel compatibility
     * @param {Array} data - Data array to validate
     * @returns {boolean} Whether data is valid
     */
    validateDataForExcel(data) {
        if (!Array.isArray(data)) {
            logMessage('error', 'Excel validation: Data is not an array', { dataType: typeof data });
            return false;
        }
        
        // Check each row
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            if (!Array.isArray(row)) {
                logMessage('error', 'Excel validation: Row is not an array', { rowIndex: i, rowType: typeof row });
                return false;
            }
            
            // Check each cell in the row
            for (let j = 0; j < row.length; j++) {
                const cell = row[j];
                
                // Convert null/undefined to empty string
                if (cell === null || cell === undefined) {
                    row[j] = '';
                    continue;
                }
                
                // Convert to string if not already
                if (typeof cell !== 'string' && typeof cell !== 'number' && typeof cell !== 'boolean') {
                    row[j] = String(cell);
                }
                
                // Check for extremely long strings
                if (typeof row[j] === 'string' && row[j].length > 32000) {
                    row[j] = this.truncateForExcel(row[j], 30000);
                }
            }
        }
        
        return true;
    }

    /**
     * Ensure all rows have equal column count and primitive values only
     * @param {Array} rows - Original rows
     * @param {number} colCount - Target column count
     * @returns {Array} Normalized rows
     */
    normalizeRowsForExcel(rows, colCount) {
        if (!Array.isArray(rows) || rows.length === 0) return [];
        return rows.map((row) => {
            const out = Array.isArray(row) ? [...row] : [String(row ?? '')];
            // Coerce each cell to acceptable types and truncate long strings
            for (let i = 0; i < out.length; i++) {
                const cell = out[i];
                if (cell === null || cell === undefined) {
                    out[i] = '';
                } else if (typeof cell === 'string' || typeof cell === 'number' || typeof cell === 'boolean') {
                    out[i] = cell;
                } else if (cell instanceof Date) {
                    // Preserve Date objects so Excel can render native dates with numberFormat
                    out[i] = this.convertDateToOADate(cell);
                } else {
                    out[i] = String(cell);
                }
                if (typeof out[i] === 'string' && out[i].length > 32000) {
                    out[i] = this.truncateForExcel(out[i], 30000);
                }
            }
            // Pad or trim to target column count
            if (out.length < colCount) {
                while (out.length < colCount) out.push('');
            } else if (out.length > colCount) {
                out.length = colCount;
            }
            return out;
        });
    }

    /**
     * Truncate string for Excel compatibility
     * @param {string} str - String to truncate
     * @param {number} maxLength - Maximum length
     * @returns {string} Truncated string
     */
    truncateForExcel(str, maxLength = 30000) {
        if (!str || str.length <= maxLength) return str;
        
        const truncated = str.substring(0, maxLength - 50);
        return truncated + '\n\n... [Data truncated for Excel compatibility]';
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
     * Build simple readings table
     * - If a datapoint is specified or only one datapoint exists, use that single datapoint column
     * - Otherwise include all datapoints as columns
     * Columns: Timestamp, Asset Name, <datapoint(s)>
     * Timestamp is preserved as provided by FogLAMP (no reformatting)
     */
    buildSimpleReadings(readings, asset, datapoint = null) {
        if (!Array.isArray(readings) || readings.length === 0) {
            return { headers: ['No Data'], rows: [['No readings found']] };
        }

        // Collect datapoints present
        const dpSet = new Set();
        for (const r of readings) {
            if (r && r.reading && typeof r.reading === 'object') {
                for (const k of Object.keys(r.reading)) dpSet.add(k);
            }
        }
        const dpProvided = datapoint && String(datapoint).trim() !== '' ? String(datapoint).trim() : null;
        const dpList = Array.from(dpSet);

        // Choose datapoint strategy
        if (dpProvided || dpList.length === 1) {
            const dpKey = dpProvided || dpList[0];
            const headers = ['Timestamp', 'Asset Name', dpKey];
            const rows = readings.map(r => {
                const ts = r.user_ts || r.timestamp || '';
                const asDate = this.parseFoglampTimestamp(ts) || (ts ? new Date(ts) : null);
                const tsCell = (asDate instanceof Date && !isNaN(asDate.getTime())) ? this.convertDateToOADate(asDate) : '';
                return [
                    tsCell,
                    asset,
                    r.reading && Object.prototype.hasOwnProperty.call(r.reading, dpKey) ? r.reading[dpKey] : ''
                ];
            });
            return { headers, rows };
        }

        // Multiple datapoints, include all
        const headers = ['Timestamp', 'Asset Name', ...dpList];
        const rows = readings.map(r => {
            const ts = r.user_ts || r.timestamp || '';
            const asDate = this.parseFoglampTimestamp(ts) || (ts ? new Date(ts) : null);
            const tsCell = (asDate instanceof Date && !isNaN(asDate.getTime())) ? this.convertDateToOADate(asDate) : '';
            return [
                tsCell,
                asset,
                ...dpList.map(k => (r.reading && Object.prototype.hasOwnProperty.call(r.reading, k) ? r.reading[k] : ''))
            ];
        });
        return { headers, rows };
    }

    /**
     * Build summary table: min/max/average for datapoint
     * @param {Object|Array} summary - API returns object like { dp: { min, max, average } }
     */
    buildSummaryTable(summary, asset, datapoint) {
        try {
            let chosenDatapoint = datapoint || '';
            let node = null;

            // Accept both array and object forms
            if (Array.isArray(summary)) {
                // Expect first element to be an object mapping dpName -> stats
                const first = summary[0] || {};
                if (chosenDatapoint && first && Object.prototype.hasOwnProperty.call(first, chosenDatapoint)) {
                    node = first[chosenDatapoint];
                } else {
                    const keys = Object.keys(first);
                    if (keys.length > 0) {
                        chosenDatapoint = chosenDatapoint || keys[0];
                        node = first[chosenDatapoint];
                    }
                }
            } else if (summary && typeof summary === 'object') {
                // Two possibilities:
                // 1) summary is the stats object { min, max, average }
                // 2) summary is a mapping { dpName: { min, max, average } }
                const looksLikeStats = ['min','max','average','minimum','maximum','avg'].some(k => Object.prototype.hasOwnProperty.call(summary, k));
                if (looksLikeStats) {
                    node = summary;
                } else if (chosenDatapoint && Object.prototype.hasOwnProperty.call(summary, chosenDatapoint)) {
                    node = summary[chosenDatapoint];
                } else {
                    const keys = Object.keys(summary);
                    if (keys.length > 0) {
                        chosenDatapoint = chosenDatapoint || keys[0];
                        node = summary[chosenDatapoint];
                    }
                }
            }

            const minVal = node ? (node.min ?? node.minimum ?? '') : '';
            const maxVal = node ? (node.max ?? node.maximum ?? '') : '';
            const avgVal = node ? (node.average ?? node.avg ?? '') : '';

            return {
                headers: ['Asset', 'Datapoint', 'Min', 'Max', 'Average'],
                rows: [[asset, chosenDatapoint, minVal, maxVal, avgVal]]
            };
        } catch (_e) {
            return { headers: ['No Data'], rows: [['No summary available']] };
        }
    }

    /**
     * Build timespan table: oldest/newest timestamps
     * @param {Object|Array} tsData - API returns object with oldest/newest
     */
    buildTimespanTable(tsData, asset, datapoint) {
        try {
            // Handle either object or array (single item)
            const obj = Array.isArray(tsData) ? (tsData[0] || {}) : (tsData || {});
            const oldest = obj.oldest ?? '';
            const newest = obj.newest ?? '';
            return {
                headers: ['Asset', 'Datapoint', 'Oldest', 'Newest'],
                rows: [[asset, datapoint || '', oldest, newest]]
            };
        } catch (_e) {
            return { headers: ['No Data'], rows: [['No timespan available']] };
        }
    }

    /**
     * Derive timespan (oldest/newest) from raw readings
     * @param {Array} readings
     * @returns {{oldest: string, newest: string}}
     */
    deriveTimespanFromReadings(readings) {
        if (!Array.isArray(readings) || readings.length === 0) {
            return { oldest: '', newest: '' };
        }
        let oldestStr = '', newestStr = '';
        let oldestTime = Number.POSITIVE_INFINITY;
        let newestTime = Number.NEGATIVE_INFINITY;
        for (const r of readings) {
            const tsStr = (r && (r.user_ts || r.timestamp)) ? (r.user_ts || r.timestamp) : '';
            if (!tsStr) continue;
            const d = this.parseFoglampTimestamp(tsStr) || new Date(tsStr);
            const t = d instanceof Date && !isNaN(d.getTime()) ? d.getTime() : null;
            if (t == null) continue;
            if (t < oldestTime) { oldestTime = t; oldestStr = tsStr; }
            if (t > newestTime) { newestTime = t; newestStr = tsStr; }
        }
        return { oldest: oldestStr, newest: newestStr };
    }

    /**
     * Derive summary (min/max/average) for a datapoint from raw readings
     * @param {Array} readings
     * @param {string|null} datapoint
     * @returns {Object} Shape compatible with buildSummaryTable input
     */
    deriveSummaryFromReadings(readings, datapoint = null) {
        if (!Array.isArray(readings) || readings.length === 0) {
            return {};
        }
        // Choose datapoint: prefer provided, else first numeric key encountered
        let chosen = datapoint && String(datapoint).trim() !== '' ? String(datapoint).trim() : null;
        if (!chosen) {
            for (const r of readings) {
                const obj = r && r.reading && typeof r.reading === 'object' ? r.reading : null;
                if (!obj) continue;
                for (const k of Object.keys(obj)) {
                    const v = obj[k];
                    if (typeof v === 'number' && isFinite(v)) { chosen = k; break; }
                }
                if (chosen) break;
            }
        }
        if (!chosen) {
            return {};
        }
        let count = 0;
        let minVal = Number.POSITIVE_INFINITY;
        let maxVal = Number.NEGATIVE_INFINITY;
        let sum = 0;
        for (const r of readings) {
            const obj = r && r.reading && typeof r.reading === 'object' ? r.reading : null;
            if (!obj || !Object.prototype.hasOwnProperty.call(obj, chosen)) continue;
            const v = obj[chosen];
            if (typeof v !== 'number' || !isFinite(v)) continue;
            if (v < minVal) minVal = v;
            if (v > maxVal) maxVal = v;
            sum += v;
            count += 1;
        }
        if (count === 0) {
            return {};
        }
        const average = sum / count;
        return { [chosen]: { min: minVal, max: maxVal, average } };
    }

    /**
     * Parse FogLAMP timestamp (e.g., "YYYY-MM-DD HH:MM:SS.micros") to JS Date (UTC)
     * Returns null if parsing fails
     */
    parseFoglampTimestamp(ts) {
        if (!ts || typeof ts !== 'string') return null;
        const m = ts.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/);
        if (!m) return null;
        const year = parseInt(m[1], 10);
        const month = parseInt(m[2], 10) - 1;
        const day = parseInt(m[3], 10);
        const hour = parseInt(m[4], 10);
        const minute = parseInt(m[5], 10);
        const second = parseInt(m[6], 10);
        const frac = m[7] || '0';
        const ms = Math.round(parseInt(frac.padEnd(6, '0').slice(0, 6), 10) / 1000); // microseconds -> ms
        const d = new Date(Date.UTC(year, month, day, hour, minute, second, ms));
        return isNaN(d.getTime()) ? null : d;
    }

    /**
     * Build rows using the requested template
     * Headers: Timestamp, Asset Name, Datapoint 1 Name, Datapoint 2 Name, Datapoint 3 Name
     * Row: [mm:ss.t, asset, i%2, cycle(A/B/C), value]
     * @param {Array} readings - readings array from API
     * @param {string} asset - asset name to populate
     * @param {string|null} datapoint - optional datapoint to select
     * @returns {{headers: string[], rows: any[][]}}
     */
    buildTemplateReadings(readings, asset, datapoint = null) {
        if (!Array.isArray(readings) || readings.length === 0) {
            return { headers: ['No Data'], rows: [['No readings found']] };
        }

        const headers = ['Timestamp', 'Asset Name', 'Datapoint 1 Name', 'Datapoint 2 Name', 'Datapoint 3 Name'];

        // Determine datapoint key
        let dpKey = datapoint && String(datapoint).trim() !== '' ? datapoint.trim() : null;
        if (!dpKey) {
            const sample = readings.find(r => r && r.reading && typeof r.reading === 'object' && Object.keys(r.reading).length > 0);
            dpKey = sample ? Object.keys(sample.reading)[0] : null;
        }

        const abc = ['A', 'B', 'C'];

        const rows = readings.map((r, idx) => {
            const ts = r.user_ts || r.timestamp || '';
            const formattedTs = this.formatShortTimestamp(ts);
            const dpValue = dpKey && r.reading ? (r.reading[dpKey] ?? '') : '';
            const parity = idx % 2; // 0/1 alternating
            const cycle = abc[idx % 3];
            return [formattedTs, asset, parity, cycle, dpValue];
        });

        return { headers, rows };
    }

    /**
     * Format timestamp like mm:ss.t (tenths)
     * Accepts FogLAMP timestamps like "YYYY-MM-DD HH:MM:SS.micros" or ISO strings
     * @param {string} ts
     * @returns {string}
     */
    formatShortTimestamp(ts) {
        if (!ts || typeof ts !== 'string') return String(ts || '');
        // Try parse FogLAMP format first
        const m = ts.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/);
        if (m) {
            const mm = parseInt(m[5], 10) || 0; // minutes
            const ss = parseInt(m[6], 10) || 0; // seconds
            const frac = m[7] || '0';
            // Convert fractional seconds (microseconds or milliseconds) to milliseconds
            const micros = parseInt(frac.padEnd(6, '0').slice(0, 6), 10) || 0;
            const ms = Math.round(micros / 1000);
            const tenths = Math.round(ms / 100); // 0-10
            const minuteStr = String(mm).padStart(2, '0');
            const secondStr = String(ss).padStart(2, '0');
            return `${minuteStr}:${secondStr}.${tenths}`;
        }
        // Fallback: try Date parsing
        const d = new Date(ts);
        if (!isNaN(d.getTime())) {
            const minuteStr = String(d.getMinutes()).padStart(2, '0');
            const secondStr = String(d.getSeconds()).padStart(2, '0');
            const tenths = Math.round(d.getMilliseconds() / 100);
            return `${minuteStr}:${secondStr}.${tenths}`;
        }
        // Last resort: return as-is
        return ts;
    }

    /**
     * Fetch ping data - STREAMLINED: Single API path only
     * @returns {Promise<Object>} Ping data
     */
    async fetchPingData() {
        return await window.FogLAMP.api.ping();
    }

    /**
     * Fetch statistics data - STREAMLINED: Single API path only
     * @returns {Promise<Object>} Statistics data
     */
    async fetchStatisticsData() {
        return await window.FogLAMP.api.statistics();
    }

    /**
     * Fetch assets data - STREAMLINED: Single API path only
     * @returns {Promise<Array>} Assets data
     */
    async fetchAssetsData() {
        return await window.FogLAMP.api.assets();
    }

    /**
     * Fetch readings data for export
     * @param {string} asset - Asset name
     * @param {Object} params - Export parameters
     * @returns {Promise<Array>} Readings data
     */
    async fetchReadingsData(asset, params) {
        const datapoint = params.datapoint && params.datapoint.trim() !== '' ? params.datapoint : null;
        // Route based on output type
        const ot = params.outputType || 'raw';
        if (ot === 'summary') {
            // Build summary-safe params: no limit/skip; include time window/previous only
            const summaryParams = {};
            if (params.mode === 'window') {
                if (params.seconds && params.seconds > 0) summaryParams.seconds = params.seconds;
                if (params.minutes && params.minutes > 0) summaryParams.minutes = params.minutes;
                if (params.hours && params.hours > 0) summaryParams.hours = params.hours;
            } else if (params.mode === 'previous') {
                if (params.previous && params.previous > 0) summaryParams.previous = params.previous;
                if (params.seconds && params.seconds > 0) summaryParams.seconds = params.seconds;
                if (params.minutes && params.minutes > 0) summaryParams.minutes = params.minutes;
                if (params.hours && params.hours > 0) summaryParams.hours = params.hours;
            }
            const activeInstance = getActiveInstanceWithMeta();
            const baseUrl = activeInstance?.url;
            // Summary API is asset-level (not datapoint-level)
            if (baseUrl && window.FogLAMP?.api?.readingsSummaryForUrl) {
                return await window.FogLAMP.api.readingsSummaryForUrl(baseUrl, asset, null, summaryParams);
            }
            return await window.FogLAMP.api.readingsSummary(asset, null, summaryParams);
        } else if (ot === 'timespan') {
            // Timespan endpoint should not receive limit/skip or time window params
            const activeInstance = getActiveInstanceWithMeta();
            const baseUrl = activeInstance?.url;
            // Time span API is asset-level (not datapoint-level)
            if (baseUrl && window.FogLAMP?.api?.readingsTimespanForUrl) {
                return await window.FogLAMP.api.readingsTimespanForUrl(baseUrl, asset, null, {});
            }
            return await window.FogLAMP.api.readingsTimespan(asset, null, {});
        }

        // Default: raw readings
        // Prefer smart manager if available for web, else unified API
        const rawParams = {};
        if (params.mode === 'latest') {
            if (params.limit && params.limit > 0) rawParams.limit = params.limit;
            if (params.skip && params.skip > 0) rawParams.skip = params.skip;
        } else if (params.mode === 'window') {
            if (params.seconds && params.seconds > 0) rawParams.seconds = params.seconds;
            if (params.minutes && params.minutes > 0) rawParams.minutes = params.minutes;
            if (params.hours && params.hours > 0) rawParams.hours = params.hours;
            // Respect limit in window mode if provided
            if (params.limit && params.limit > 0) rawParams.limit = params.limit;
            if (params.skip && params.skip > 0) rawParams.skip = params.skip;
        } else if (params.mode === 'previous') {
            if (params.previous && params.previous > 0) rawParams.previous = params.previous;
            if (params.seconds && params.seconds > 0) rawParams.seconds = params.seconds;
            if (params.minutes && params.minutes > 0) rawParams.minutes = params.minutes;
            if (params.hours && params.hours > 0) rawParams.hours = params.hours;
            // Respect limit/skip in previous mode as well
            if (params.limit && params.limit > 0) rawParams.limit = params.limit;
            if (params.skip && params.skip > 0) rawParams.skip = params.skip;
        }

        // Diagnostic log for raw readings request
        try {
            logMessage('info', 'Readings request (raw)', {
                asset,
                datapoint: datapoint || '(all)',
                mode: params.mode,
                rawParams
            });
        } catch (_e) {}

        // Prefer targeting the active instance explicitly to avoid cross-instance selection
        const activeInstance = getActiveInstanceWithMeta();
        const baseUrl = activeInstance?.url;
        if (baseUrl && window.FogLAMP?.api?.readingsForUrl) {
            try {
                try { logMessage('debug', 'Using FogLAMP.api.readingsForUrl with active instance', { baseUrl }); } catch (_e) {}
                return await window.FogLAMP.api.readingsForUrl(baseUrl, asset, datapoint, rawParams);
            } catch (_primaryError) {
                try { logMessage('warn', 'Primary readingsForUrl failed, falling back to smart transport', { baseUrl }); } catch (_e) {}
                // Fall through to smartManager/unified fallbacks below
            }
        }

        if (window.smartManager && typeof window.smartManager.foglampReadings === 'function') {
            try { logMessage('debug', 'Using smartManager.foglampReadings transport'); } catch (_e) {}
            return await window.smartManager.foglampReadings(asset, datapoint, rawParams);
        } else if (typeof window.foglampAssetReadingsSmart === 'function') {
            try { logMessage('debug', 'Using legacy window.foglampAssetReadingsSmart transport'); } catch (_e) {}
            return await window.foglampAssetReadingsSmart(
                asset,
                datapoint,
                rawParams.limit,
                rawParams.skip,
                rawParams.seconds,
                rawParams.minutes,
                rawParams.hours,
                rawParams.previous
            );
        }
        try { logMessage('debug', 'Using unified FogLAMP.api.readings transport'); } catch (_e) {}
        return await window.FogLAMP.api.readings(asset, datapoint, rawParams);
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
     * Convert a JavaScript Date to Excel OLE Automation date (number of days since 1899-12-30)
     * Excel stores dates as serial numbers where the integer part is days and the
     * fractional part is the time of day.
     * @param {Date} date
     * @returns {number}
     */
    convertDateToOADate(date) {
        if (!(date instanceof Date) || isNaN(date.getTime())) return '';
        // 25569 is the number of days between 1899-12-30 and 1970-01-01
        return date.getTime() / 86400000 + 25569;
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

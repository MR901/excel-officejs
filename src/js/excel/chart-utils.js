/**
 * Excel Chart Utilities for Office.js
 * Reusable chart creation and management functions
 */

/**
 * Convert Excel OLE Automation Date (OADate) to JavaScript Date
 * @param {number} oaDate - Excel serial date number
 * @returns {Date} JavaScript Date object
 */
export function oaDateToJSDate(oaDate) {
    // 25569 is the number of days between 1899-12-30 and 1970-01-01
    return new Date((oaDate - 25569) * 86400000);
}

/**
 * Convert JavaScript Date to Excel OLE Automation Date
 * @param {Date} date - JavaScript Date object
 * @returns {number} Excel serial date number
 */
export function jsDateToOADate(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return null;
    return date.getTime() / 86400000 + 25569;
}

/**
 * Format OADate to display string for chart labels
 * @param {number} oaDate - Excel serial date
 * @param {string} format - Format type: 'datetime', 'date', 'time'
 * @returns {string} Formatted date string
 */
export function formatOADateLabel(oaDate, format = 'datetime') {
    const date = oaDateToJSDate(oaDate);
    if (!(date instanceof Date) || isNaN(date.getTime())) return '';
    
    const pad = (n) => String(n).padStart(2, '0');
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const yyyy = date.getFullYear();
    let hrs = date.getHours();
    const ampm = hrs >= 12 ? 'PM' : 'AM';
    let h12 = hrs % 12;
    if (h12 === 0) h12 = 12;
    const hh = pad(h12);
    const mi = pad(date.getMinutes());
    const ss = pad(date.getSeconds());
    
    switch (format) {
        case 'datetime':
            return `${mm}/${dd}/${yyyy} ${hh}:${mi}:${ss} ${ampm}`;
        case 'date':
            return `${mm}/${dd}/${yyyy}`;
        case 'time':
            return `${hh}:${mi}:${ss} ${ampm}`;
        default:
            return `${mm}/${dd}/${yyyy} ${hh}:${mi}:${ss} ${ampm}`;
    }
}

/**
 * Convert array of OADate values to formatted label strings
 * @param {Array} rows - Array of row arrays where first column contains OADates
 * @param {number} columnIndex - Column index containing dates (default: 0)
 * @param {string} format - Format type for labels
 * @returns {Array<Array<string>>} Array of label strings in Excel format [[label], [label], ...]
 */
export function convertRowsToDateLabels(rows, columnIndex = 0, format = 'datetime') {
    if (!Array.isArray(rows)) return [];
    
    return rows.map(row => {
        const value = Array.isArray(row) ? row[columnIndex] : '';
        
        if (typeof value === 'number' && isFinite(value)) {
            return [formatOADateLabel(value, format)];
        } else if (value instanceof Date) {
            return [formatOADateLabel(jsDateToOADate(value), format)];
        }
        
        return [String(value ?? '')];
    });
}

/**
 * Remove existing chart by name if it exists
 * @param {Object} sheet - Excel worksheet object
 * @param {string} chartName - Name of the chart to remove
 * @param {Object} context - Excel context object
 * @returns {Promise<boolean>} True if chart was removed, false if not found
 */
export async function removeChartIfExists(sheet, chartName, context) {
    try {
        const existingChart = sheet.charts.getItemOrNullObject(chartName);
        existingChart.load('name');
        await context.sync();
        
        if (!existingChart.isNullObject) {
            existingChart.delete();
            await context.sync();
            return true;
        }
    } catch (error) {
        console.warn(`Failed to remove chart ${chartName}:`, error.message);
    }
    return false;
}

/**
 * Parse an Excel A1-style cell reference into 0-based row/column indices.
 * @param {string} cellRef - e.g., "A1", "H13"
 * @returns {{rowIndex: number, colIndex: number}}
 */
function parseCellRef(cellRef) {
    const m = String(cellRef || '').trim().match(/^([A-Za-z]+)(\d+)$/);
    if (!m) return { rowIndex: 0, colIndex: 0 };
    const colLetters = m[1].toUpperCase();
    const rowIndex = Math.max(0, parseInt(m[2], 10) - 1);
    let colIndex = 0;
    for (let i = 0; i < colLetters.length; i++) {
        colIndex = colIndex * 26 + (colLetters.charCodeAt(i) - 64);
    }
    colIndex -= 1;
    return { rowIndex, colIndex };
}

/**
 * Resize the chart to span exactly from startCell to endCell by computing
 * aggregate column widths and row heights in points, then applying width/height.
 * This is a reliable fallback when setPosition's end anchor isn't honored by host.
 * @param {Object} sheet - Excel worksheet
 * @param {Object} chart - Excel chart
 * @param {Object} context - Excel context
 * @param {string} startCell - e.g., "A1"
 * @param {string} endCell - e.g., "H13"
 */
async function resizeChartToCellSpan(sheet, chart, context, startCell, endCell) {
    try {
        const { rowIndex: rowStart, colIndex: colStart } = parseCellRef(startCell);
        const { rowIndex: rowEnd, colIndex: colEnd } = parseCellRef(endCell);

        if (rowEnd < rowStart || colEnd < colStart) return;

        // Load widths for columns [colStart..colEnd]
        const colFormats = [];
        for (let c = colStart; c <= colEnd; c++) {
            const fmt = sheet.getRangeByIndexes(0, c, 1, 1).getEntireColumn().format;
            fmt.load('columnWidth');
            colFormats.push(fmt);
        }

        // Load heights for rows [rowStart..rowEnd]
        const rowFormats = [];
        for (let r = rowStart; r <= rowEnd; r++) {
            const fmt = sheet.getRangeByIndexes(r, 0, 1, 1).getEntireRow().format;
            fmt.load('rowHeight');
            rowFormats.push(fmt);
        }

        await context.sync();

        // Sum up widths/heights; use safe fallbacks when values are not numbers
        let totalWidth = 0;
        for (const fmt of colFormats) {
            const w = typeof fmt.columnWidth === 'number' && isFinite(fmt.columnWidth) ? fmt.columnWidth : 64; // ~default
            totalWidth += w;
        }

        let totalHeight = 0;
        for (const fmt of rowFormats) {
            const h = typeof fmt.rowHeight === 'number' && isFinite(fmt.rowHeight) ? fmt.rowHeight : 15; // ~default
            totalHeight += h;
        }

        // Apply computed dimensions (points)
        try { chart.width = Math.max(50, Math.round(totalWidth)); } catch (_e) {}
        try { chart.height = Math.max(50, Math.round(totalHeight)); } catch (_e) {}

        await context.sync();
    } catch (error) {
        console.warn('Failed to resize chart to cell span:', error.message);
    }
}

/**
 * Configuration options for chart creation
 * @typedef {Object} ChartConfig
 * @property {string} name - Unique chart name (required)
 * @property {string} type - Chart type: 'line', 'column', 'bar', 'pie', etc. (default: 'line')
 * @property {boolean} showTitle - Show chart title (default: false)
 * @property {string} title - Chart title text
 * @property {string} legendPosition - Legend position: 'Right', 'Left', 'Top', 'Bottom', 'None' (default: 'Right')
 * @property {boolean} legendVisible - Show legend (default: true)
 * @property {boolean} legendOverlay - Overlay legend on chart (default: false)
 * @property {string} position - Position string like 'A1:H13' or object {startCell: 'A1', endCell: 'H13'}
 * @property {Object} categoryAxis - Category axis configuration
 * @property {string} categoryAxis.type - Axis type: 'textAxis', 'dateAxis', 'automatic' (default: 'textAxis')
 * @property {Array<Array<string>>} categoryAxis.labels - Custom labels as 2D array [[label1], [label2], ...]
 * @property {Object} categoryAxis.range - Range object for category data
 * @property {boolean} removeExisting - Remove existing chart with same name (default: true)
 */

/**
 * Create an Excel chart with comprehensive configuration options
 * Uses Office.js Excel API for maximum compatibility
 * 
 * @param {Object} sheet - Excel worksheet object
 * @param {Object} context - Excel context object
 * @param {Object} dataRange - Excel range object containing the data (series)
 * @param {Excel.ChartSeriesBy} seriesBy - How to interpret data: Excel.ChartSeriesBy.columns or Excel.ChartSeriesBy.rows
 * @param {ChartConfig} config - Chart configuration options
 * @returns {Promise<Object>} Created Excel chart object
 * 
 * @example
 * // Create a line chart for time series data
 * const dataRange = sheet.getRangeByIndexes(headerRow, 2, rowCount, colCount - 2);
 * const categoryRange = sheet.getRangeByIndexes(dataRow, 0, rowCount, 1);
 * const categoryLabels = convertRowsToDateLabels(normalizedRows, 0, 'datetime');
 * 
 * const chart = await createExcelChart(sheet, context, dataRange, Excel.ChartSeriesBy.columns, {
 *     name: 'RawReadingsChart',
 *     type: 'line',
 *     showTitle: false,
 *     legendPosition: 'Right',
 *     position: { startCell: 'A1', endCell: 'H13' },
 *     categoryAxis: {
 *         type: 'textAxis',
 *         labels: categoryLabels
 *     }
 * });
 */
export async function createExcelChart(sheet, context, dataRange, seriesBy, config = {}) {
    // Validate required parameters
    if (!sheet || !context || !dataRange) {
        throw new Error('Missing required parameters: sheet, context, and dataRange are required');
    }
    
    // Set defaults
    const {
        name = `Chart_${Date.now()}`,
        type = 'line',
        showTitle = false,
        title = '',
        legendPosition = 'Right',
        legendVisible = true,
        legendOverlay = false,
        position = null,
        categoryAxis = {},
        removeExisting = true
    } = config;
    
    try {
        // Step 1: Remove existing chart if requested
        if (removeExisting && name) {
            await removeChartIfExists(sheet, name, context);
        }
        
        // Step 2: Map chart type string to Excel enum
        let chartType;
        const typeMap = {
            'line': Excel.ChartType.line,
            'column': Excel.ChartType.columnClustered,
            'bar': Excel.ChartType.barClustered,
            'pie': Excel.ChartType.pie,
            'area': Excel.ChartType.area,
            'scatter': Excel.ChartType.xyscatter,
            'columnStacked': Excel.ChartType.columnStacked,
            'barStacked': Excel.ChartType.barStacked
        };
        chartType = typeMap[type] || Excel.ChartType.line;
        
        // Step 3: Create the chart
        const chart = sheet.charts.add(chartType, dataRange, seriesBy);
        chart.name = name;
        await context.sync();
        
        // Step 4: Configure title
        try {
            chart.title.visible = showTitle;
            if (showTitle && title) {
                chart.title.text = title;
            }
        } catch (error) {
            console.warn('Failed to configure chart title:', error.message);
        }
        
        // Step 5: Configure legend
        try {
            chart.legend.visible = legendVisible;
            chart.legend.overlay = legendOverlay;
            
            // Try both casing variants for maximum compatibility
            try {
                chart.legend.position = legendPosition;
            } catch (e1) {
                try {
                    chart.legend.position = legendPosition.toLowerCase();
                } catch (e2) {
                    console.warn('Failed to set legend position:', legendPosition);
                }
            }
        } catch (error) {
            console.warn('Failed to configure chart legend:', error.message);
        }
        
        // Step 6: Configure category axis
        if (categoryAxis) {
            try {
                const { type: axisType = 'textAxis', labels = null, range = null } = categoryAxis;
                
                // Set category axis type
                if (axisType) {
                    const axisTypeMap = {
                        'textAxis': Excel.ChartAxisCategoryType.textAxis,
                        'dateAxis': Excel.ChartAxisCategoryType.dateAxis,
                        'automatic': Excel.ChartAxisCategoryType.automatic
                    };
                    const categoryType = axisTypeMap[axisType] || Excel.ChartAxisCategoryType.textAxis;
                    
                    try {
                        chart.axes.categoryAxis.categoryType = categoryType;
                    } catch (error) {
                        console.warn('Failed to set category axis type:', error.message);
                    }
                }
                
                // Set custom labels or range
                if (labels && Array.isArray(labels)) {
                    try {
                        chart.axes.categoryAxis.setCategoryNames(labels);
                    } catch (error) {
                        console.warn('Failed to set custom category labels:', error.message);
                    }
                } else if (range) {
                    try {
                        chart.axes.categoryAxis.setCategoryNames(range);
                    } catch (error) {
                        console.warn('Failed to set category range:', error.message);
                    }
                }
            } catch (error) {
                console.warn('Failed to configure category axis:', error.message);
            }
        }
        
        // Step 7: Position the chart and enforce desired span
        let startCellForSizing = null;
        let endCellForSizing = null;
        if (position) {
            try {
                if (typeof position === 'string') {
                    // Format: "A1:H13" - split into start and end
                    const [start, end] = position.split(':');
                    if (start && end) {
                        const startRange = sheet.getRange(start.trim());
                        const endRange = sheet.getRange(end.trim());
                        chart.setPosition(startRange, endRange);
                        startCellForSizing = start.trim();
                        endCellForSizing = end.trim();
                    } else if (start) {
                        const startRange = sheet.getRange(start.trim());
                        chart.setPosition(startRange);
                        startCellForSizing = start.trim();
                    }
                } else if (position.startCell && position.endCell) {
                    // Object format: { startCell: 'A1', endCell: 'H13' }
                    const startRange = sheet.getRange(String(position.startCell).trim());
                    const endRange = sheet.getRange(String(position.endCell).trim());
                    chart.setPosition(startRange, endRange);
                    startCellForSizing = String(position.startCell).trim();
                    endCellForSizing = String(position.endCell).trim();
                } else if (position.startCell) {
                    const startRange = sheet.getRange(String(position.startCell).trim());
                    chart.setPosition(startRange);
                    startCellForSizing = String(position.startCell).trim();
                }
            } catch (error) {
                console.warn('Failed to position chart:', error.message);
            }
        }

        // Enforce width/height based on cell span if both corners are provided
        if (startCellForSizing && endCellForSizing) {
            await resizeChartToCellSpan(sheet, chart, context, startCellForSizing, endCellForSizing);
        }
        
        // Step 8: Re-assert legend and category axis settings after positioning
        // (some Excel versions reset these when setPosition is called)
        try {
            chart.legend.visible = legendVisible;
            chart.legend.overlay = legendOverlay;
            try {
                chart.legend.position = legendPosition;
            } catch (e1) {
                try {
                    chart.legend.position = legendPosition.toLowerCase();
                } catch (e2) {
                    // Silent fail - already warned above
                }
            }
        } catch (error) {
            // Silent fail - non-critical
        }
        
        // Re-assert category axis after positioning (critical for timestamp labels)
        if (categoryAxis) {
            try {
                const axisTypeMap = {
                    'textAxis': Excel.ChartAxisCategoryType.textAxis,
                    'dateAxis': Excel.ChartAxisCategoryType.dateAxis,
                    'automatic': Excel.ChartAxisCategoryType.automatic
                };
                const reAxisType = axisTypeMap[categoryAxis.type || 'textAxis'] || Excel.ChartAxisCategoryType.textAxis;
                try { chart.axes.categoryAxis.categoryType = reAxisType; } catch (_e) {}

                if (categoryAxis.labels && Array.isArray(categoryAxis.labels)) {
                    chart.axes.categoryAxis.setCategoryNames(categoryAxis.labels);
                } else if (categoryAxis.range) {
                    chart.axes.categoryAxis.setCategoryNames(categoryAxis.range);
                }
            } catch (error) {
                console.warn('Failed to re-assert category axis after positioning:', error.message);
            }
        }
        
        await context.sync();
        
        return chart;
        
    } catch (error) {
        console.error('Failed to create Excel chart:', error);
        throw new Error(`Chart creation failed: ${error.message}`);
    }
}

/**
 * Create a time series line chart with formatted timestamp labels
 * Convenience wrapper around createExcelChart for common use case
 * 
 * @param {Object} sheet - Excel worksheet object
 * @param {Object} context - Excel context object
 * @param {Object} config - Chart configuration
 * @param {string} config.name - Chart name
 * @param {number} config.headerRowIndex - Row index of header row (0-based)
 * @param {number} config.dataStartRowIndex - Row index of first data row (0-based)
 * @param {number} config.seriesStartCol - Column index where series data starts (0-based, e.g., 2 for column C)
 * @param {number} config.totalCols - Total number of columns
 * @param {Array} config.normalizedRows - Data rows for label extraction
 * @param {string} config.position - Chart position string (default: 'A1:H13')
 * @param {string} config.title - Optional chart title
 * @param {string} config.legendPosition - Legend position (default: 'Right')
 * @param {string} config.dateFormat - Date format: 'datetime', 'date', 'time' (default: 'datetime')
 * @returns {Promise<Object>} Created chart object
 */
export async function createTimeSeriesChart(sheet, context, config) {
    const {
        name,
        headerRowIndex,
        dataStartRowIndex,
        seriesStartCol,
        totalCols,
        normalizedRows,
        position = 'A1:H13',
        title = null,
        legendPosition = 'Right',
        dateFormat = 'datetime'
    } = config;
    
    // Calculate series columns
    const seriesCols = Math.max(0, totalCols - seriesStartCol);
    if (seriesCols === 0) {
        throw new Error('No series columns available for chart');
    }
    
    // Define data range (includes header row for series names)
    const rowCount = normalizedRows.length;
    const seriesRange = sheet.getRangeByIndexes(
        headerRowIndex,
        seriesStartCol,
        rowCount + 1, // +1 for header
        seriesCols
    );
    
    // Convert timestamp column to formatted labels
    const categoryLabels = convertRowsToDateLabels(normalizedRows, 0, dateFormat);
    
    // Create the chart
    return await createExcelChart(sheet, context, seriesRange, Excel.ChartSeriesBy.columns, {
        name,
        type: 'line',
        showTitle: title !== null,
        title: title || '',
        legendPosition,
        legendVisible: true,
        legendOverlay: false,
        position,
        categoryAxis: {
            type: 'textAxis',
            labels: categoryLabels
        },
        removeExisting: true
    });
}


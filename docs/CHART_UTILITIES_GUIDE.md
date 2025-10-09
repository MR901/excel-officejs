# Chart Utilities Developer Guide

## Overview

The `chart-utils.js` module provides reusable utilities for creating and managing Excel charts using Office.js APIs. This guide shows you how to use these utilities in your FogLAMP DataLink add-in.

---

## Quick Start

### Import the Utilities

```javascript
import { 
    createExcelChart, 
    createTimeSeriesChart,
    formatOADateLabel,
    jsDateToOADate,
    oaDateToJSDate,
    removeChartIfExists
} from './excel/chart-utils.js';
```

---

## Core Functions

### 1. `createExcelChart()` - General Purpose Chart Creation

The most flexible function for creating any type of Excel chart.

#### Signature:
```javascript
await createExcelChart(sheet, context, dataRange, seriesBy, config)
```

#### Parameters:
- **sheet**: Excel worksheet object
- **context**: Excel context object from `Excel.run()`
- **dataRange**: Excel range containing the data (series)
- **seriesBy**: `Excel.ChartSeriesBy.columns` or `Excel.ChartSeriesBy.rows`
- **config**: Configuration object (see below)

#### Configuration Object:
```javascript
{
    // Required
    name: 'UniqueChartName',           // Unique identifier
    
    // Chart Type
    type: 'line',                      // 'line', 'column', 'bar', 'pie', 'area', 'scatter'
    
    // Title
    showTitle: false,                  // Show/hide title
    title: 'My Chart Title',           // Title text (if showTitle is true)
    
    // Legend
    legendPosition: 'Right',           // 'Right', 'Left', 'Top', 'Bottom', 'None'
    legendVisible: true,               // Show/hide legend
    legendOverlay: false,              // Overlay legend on chart area
    
    // Positioning
    position: 'A1:L13',               // String format
    // OR
    position: {                        // Object format
        startCell: 'A1',
        endCell: 'L13'
    },
    
    // Category Axis
    categoryAxis: {
        type: 'textAxis',              // 'textAxis', 'dateAxis', 'automatic'
        labels: [[...], [...], ...],   // Custom labels (2D array)
        // OR
        range: rangeObject             // Excel range for categories
    },
    
    // Management
    removeExisting: true               // Auto-remove existing chart with same name
}
```

#### Example 1: Basic Line Chart
```javascript
await Excel.run(async (context) => {
    const sheet = context.workbook.worksheets.getActiveWorksheet();
    
    // Data in B1:D10 (including header)
    const dataRange = sheet.getRange('B1:D10');
    
    const chart = await createExcelChart(
        sheet,
        context,
        dataRange,
        Excel.ChartSeriesBy.columns,
        {
            name: 'SalesChart',
            type: 'line',
            showTitle: true,
            title: 'Monthly Sales',
            legendPosition: 'Right',
            position: 'F2:M15'
        }
    );
    
    console.log('Chart created:', chart.name);
});
```

#### Example 2: Bar Chart with Custom Categories
```javascript
await Excel.run(async (context) => {
    const sheet = context.workbook.worksheets.getActiveWorksheet();
    
    const dataRange = sheet.getRange('B2:B10'); // Single series data
    const categoryLabels = [
        ['Q1'], ['Q2'], ['Q3'], ['Q4']
    ];
    
    await createExcelChart(
        sheet,
        context,
        dataRange,
        Excel.ChartSeriesBy.columns,
        {
            name: 'QuarterlyChart',
            type: 'bar',
            showTitle: true,
            title: 'Quarterly Performance',
            categoryAxis: {
                type: 'textAxis',
                labels: categoryLabels
            },
            position: 'D1:K10'
        }
    );
});
```

---

### 2. `createTimeSeriesChart()` - Time Series Convenience Function

Specialized function for creating line charts with timestamp data. Perfect for readings export.

#### Signature:
```javascript
await createTimeSeriesChart(sheet, context, config)
```

#### Configuration Object:
```javascript
{
    // Required
    name: 'ChartName',                // Chart identifier
    headerRowIndex: 0,                // Row index of headers (0-based)
    dataStartRowIndex: 1,             // Row index of first data row (0-based)
    seriesStartCol: 2,                // Column index where series start (0-based)
    totalCols: 10,                    // Total number of columns
    normalizedRows: [...],            // Array of data rows
    
    // Optional
    position: 'A1:L13',              // Chart position (default: 'A1:L13')
    title: 'Readings Over Time',     // Chart title (null = no title)
    legendPosition: 'Right',         // Legend position (default: 'Right')
    dateFormat: 'datetime'           // 'datetime', 'date', 'time' (default: 'datetime')
}
```

#### Example: Readings Export Chart
```javascript
await Excel.run(async (context) => {
    const sheet = await ensureWorksheet(context, 'ReadingsData');
    
    // Assuming data structure:
    // Row 0: Headers ['Timestamp', 'Asset', 'Temp', 'Pressure', 'Flow']
    // Rows 1+: Data values
    
    const normalizedRows = [
        [45123.5, 'Pump1', 72.5, 14.7, 25.3],
        [45123.51, 'Pump1', 73.1, 14.8, 25.5],
        // ... more rows
    ];
    
    await createTimeSeriesChart(sheet, context, {
        name: 'ReadingsChart',
        headerRowIndex: 0,         // Headers in row 0
        dataStartRowIndex: 1,      // Data starts at row 1
        seriesStartCol: 2,         // Series start at column C (index 2)
        totalCols: 5,              // 5 columns total
        normalizedRows,            // Data rows
        position: 'A1:L13',       // Chart over rows 1-13
        title: null,               // No title
        legendPosition: 'Right',
        dateFormat: 'datetime'     // Full date/time labels
    });
});
```

---

## Date/Time Utilities

### `jsDateToOADate(date)`

Convert JavaScript Date to Excel OLE Automation Date (serial number).

```javascript
const jsDate = new Date('2025-10-09T14:30:00');
const oaDate = jsDateToOADate(jsDate);
console.log(oaDate); // 45936.604166666664

// Use in Excel cells
sheet.getRange('A1').values = [[oaDate]];
sheet.getRange('A1').numberFormat = [['mm/dd/yyyy hh:mm:ss']];
```

### `oaDateToJSDate(oaDate)`

Convert Excel OLE Automation Date to JavaScript Date.

```javascript
const oaDate = 45936.604166666664;
const jsDate = oaDateToJSDate(oaDate);
console.log(jsDate); // Date object: 2025-10-09T14:30:00
```

### `formatOADateLabel(oaDate, format)`

Format OADate as string for display/labels.

```javascript
const oaDate = 45936.604166666664;

const datetime = formatOADateLabel(oaDate, 'datetime');
// "10/09/2025 02:30:00 PM"

const dateOnly = formatOADateLabel(oaDate, 'date');
// "10/09/2025"

const timeOnly = formatOADateLabel(oaDate, 'time');
// "02:30:00 PM"
```

### `convertRowsToDateLabels(rows, columnIndex, format)`

Convert array of rows to formatted date labels for charts.

```javascript
const dataRows = [
    [45936.5, 'Pump1', 72.5],
    [45936.6, 'Pump1', 73.1],
    [45936.7, 'Pump1', 72.8]
];

const labels = convertRowsToDateLabels(dataRows, 0, 'datetime');
// [
//   ['10/09/2025 12:00:00 PM'],
//   ['10/09/2025 02:24:00 PM'],
//   ['10/09/2025 04:48:00 PM']
// ]

// Use in chart configuration
const config = {
    categoryAxis: {
        type: 'textAxis',
        labels: labels
    }
};
```

---

## Chart Management

### `removeChartIfExists(sheet, chartName, context)`

Safely remove a chart if it exists.

```javascript
await Excel.run(async (context) => {
    const sheet = context.workbook.worksheets.getActiveWorksheet();
    
    const wasRemoved = await removeChartIfExists(sheet, 'OldChart', context);
    
    if (wasRemoved) {
        console.log('Chart removed successfully');
    } else {
        console.log('Chart did not exist');
    }
});
```

---

## Advanced Examples

### Example 1: Multi-Series Line Chart with Custom Styling

```javascript
await Excel.run(async (context) => {
    const sheet = context.workbook.worksheets.getActiveWorksheet();
    
    // Prepare data
    // A: Timestamps, B: Asset, C: Temp, D: Pressure, E: Flow
    const headers = ['Timestamp', 'Asset', 'Temperature', 'Pressure', 'Flow'];
    const dataRows = [
        [45936.5, 'Pump1', 72.5, 14.7, 25.3],
        [45936.6, 'Pump1', 73.1, 14.8, 25.5],
        // ... more rows
    ];
    
    // Write to sheet
    sheet.getRange('A1:E1').values = [headers];
    sheet.getRange(`A2:E${dataRows.length + 1}`).values = dataRows;
    
    // Create chart with series C, D, E
    const seriesRange = sheet.getRange(`C1:E${dataRows.length + 1}`);
    
    const labels = convertRowsToDateLabels(dataRows, 0, 'time');
    
    await createExcelChart(
        sheet,
        context,
        seriesRange,
        Excel.ChartSeriesBy.columns,
        {
            name: 'SensorReadings',
            type: 'line',
            showTitle: true,
            title: 'Sensor Readings Over Time',
            legendPosition: 'Bottom',
            categoryAxis: {
                type: 'textAxis',
                labels: labels
            },
            position: 'G2:O15'
        }
    );
    
    await context.sync();
});
```

### Example 2: Conditional Chart Creation

```javascript
async function createChartIfDataAvailable(sheet, context, dataRows) {
    // Only create chart if we have enough data
    if (!Array.isArray(dataRows) || dataRows.length < 2) {
        console.log('Insufficient data for chart');
        return null;
    }
    
    // Determine number of series (exclude timestamp and asset columns)
    const seriesCount = dataRows[0].length - 2;
    
    if (seriesCount < 1) {
        console.log('No series data available');
        return null;
    }
    
    try {
        return await createTimeSeriesChart(sheet, context, {
            name: 'ConditionalChart',
            headerRowIndex: 0,
            dataStartRowIndex: 1,
            seriesStartCol: 2,
            totalCols: dataRows[0].length,
            normalizedRows: dataRows,
            position: 'A1:L13',
            title: `Data Chart (${seriesCount} series)`,
            legendPosition: 'Right'
        });
    } catch (error) {
        console.error('Chart creation failed:', error);
        return null;
    }
}
```

### Example 3: Dynamic Chart Type Selection

```javascript
async function createChartByType(sheet, context, chartType, dataRange) {
    const chartConfigs = {
        line: {
            type: 'line',
            title: 'Trend Analysis',
            legendPosition: 'Right'
        },
        column: {
            type: 'column',
            title: 'Comparison View',
            legendPosition: 'Top'
        },
        bar: {
            type: 'bar',
            title: 'Horizontal Comparison',
            legendPosition: 'Bottom'
        },
        pie: {
            type: 'pie',
            title: 'Distribution',
            legendPosition: 'Right'
        }
    };
    
    const config = chartConfigs[chartType] || chartConfigs.line;
    
    return await createExcelChart(
        sheet,
        context,
        dataRange,
        Excel.ChartSeriesBy.columns,
        {
            name: `DynamicChart_${chartType}`,
            ...config,
            showTitle: true,
            position: 'F2:M15',
            removeExisting: true
        }
    );
}

// Usage
await Excel.run(async (context) => {
    const sheet = context.workbook.worksheets.getActiveWorksheet();
    const dataRange = sheet.getRange('A1:D10');
    
    await createChartByType(sheet, context, 'column', dataRange);
});
```

---

## Error Handling

### Recommended Pattern

```javascript
async function safeChartCreation() {
    try {
        await Excel.run(async (context) => {
            const sheet = context.workbook.worksheets.getActiveWorksheet();
            const dataRange = sheet.getRange('A1:D10');
            
            try {
                await createExcelChart(
                    sheet,
                    context,
                    dataRange,
                    Excel.ChartSeriesBy.columns,
                    {
                        name: 'SafeChart',
                        type: 'line',
                        position: 'F2:M15'
                    }
                );
                
                console.log('✅ Chart created successfully');
                
            } catch (chartError) {
                console.warn('⚠️ Chart creation failed (non-critical):', chartError.message);
                // Continue with other operations...
            }
            
            await context.sync();
        });
    } catch (error) {
        console.error('❌ Excel operation failed:', error);
    }
}
```

---

## Best Practices

### 1. Always Use Unique Chart Names
```javascript
// Good ✅
const chartName = `ReadingsChart_${Date.now()}`;

// Or use asset/instance specific names
const chartName = `${assetName}_${instanceId}_Chart`;
```

### 2. Remove Old Charts Before Creating New Ones
```javascript
// Automatic with removeExisting: true (default)
await createExcelChart(sheet, context, dataRange, seriesBy, {
    name: 'MyChart',
    removeExisting: true  // ✅ Default behavior
});
```

### 3. Handle Chart Failures Gracefully
```javascript
// Charts are optional - don't break the entire export
try {
    await createTimeSeriesChart(sheet, context, config);
} catch (error) {
    console.warn('Chart creation failed (non-critical):', error.message);
    // Continue with data export
}
```

### 4. Use Appropriate Date Formats
```javascript
// For dense data (many points)
dateFormat: 'time'       // "02:30:00 PM"

// For daily data
dateFormat: 'date'       // "10/09/2025"

// For general use
dateFormat: 'datetime'   // "10/09/2025 02:30:00 PM"
```

### 5. Position Charts Carefully
```javascript
// Over frozen panes (good for dashboards)
position: 'A1:L13'

// Below data (good for reports)
position: 'A20:L35'

// To the right (good for wide data)
position: 'G1:N15'
```

---

## Troubleshooting

### Chart Not Appearing
- Verify data range is valid
- Check that series columns exist
- Ensure position doesn't overlap data
- Verify chart name is unique

### Labels Not Formatting
- Ensure timestamps are OADate format (numbers, not strings)
- Check `dateFormat` parameter is valid
- Verify normalizedRows has data in first column

### Legend Issues
- Try both 'Right' and 'right' (capitalization)
- Set `legendOverlay: false` for visibility
- Position chart with enough space for legend

### Chart Disappears After Sync
- Re-assert legend/title settings after `setPosition()`
- Use `removeExisting: true` to avoid conflicts

---

## Migration Guide

### From Old Inline Code:

**Before:**
```javascript
// 70+ lines of inline chart code
const chart = sheet.charts.add(Excel.ChartType.line, seriesRange, Excel.ChartSeriesBy.columns);
chart.name = 'MyChart';
// ... lots of configuration ...
```

**After:**
```javascript
// Clean utility call
await createTimeSeriesChart(sheet, context, {
    name: 'MyChart',
    headerRowIndex: 0,
    dataStartRowIndex: 1,
    seriesStartCol: 2,
    totalCols: 10,
    normalizedRows: dataRows,
    position: 'A1:L13'
});
```

---

## Support

For issues or questions:
1. Check this guide
2. Review `CODE_REVIEW_SUMMARY.md`
3. Inspect `src/js/excel/chart-utils.js` source code
4. Check Office.js documentation: https://learn.microsoft.com/en-us/office/dev/add-ins/

---

**Version**: 1.0  
**Last Updated**: October 9, 2025


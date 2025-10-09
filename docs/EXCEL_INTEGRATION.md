# Excel Integration

The Excel integration manages worksheet operations, data export, formatting, and chart creation using Office.js.

## Initialization

- The integration initializes via `window.FogLAMP.excel.initialize()` during app startup.
- If Excel APIs are unavailable (non-Excel host), features are disabled gracefully.

## Key Responsibilities

- Ensure and activate target worksheets
- Write tabular data with header/data formatting
- Auto-fit columns and apply number formats
- Build well-structured status and readings sheets
- Optionally create time-series charts

## Core Methods (selected)

### `ensureWorksheet(context, name)` → worksheet
Create if missing, activate if present.

### `writeTable(startRange, rows, headers?, options?)`
Writes a table beginning at `startRange`.
- `options.headerFormat` (default true)
- `options.dataFormat` (default true)
- `options.autoFit` (default true)

### `formatHeaders(headerRange)` and `formatDataRows(dataRange, options)`
Applies consistent styling and date/number formats for readability.

### `handleExportStatus()` → Promise<boolean>
Builds a status sheet summarizing ping, statistics, and assets for all registered instances.

### `handleExportReadings()` → Promise<boolean>
Builds a readings sheet with timestamp and datapoint columns based on UI-selected parameters.

## Chart Utilities

Use the helper from `excel/chart-utils.js` to add a time-series chart after writing readings:

```javascript
await createTimeSeriesChart(sheet, context, {
  name: 'ReadingsChart',
  headerRowIndex: 0,
  dataStartRowIndex: 1,
  seriesStartCol: 2,
  totalCols: totalColumnCount,
  normalizedRows: dataRows,
  position: 'A1:L13',
  title: null,
  legendPosition: 'Right',
  dateFormat: 'datetime'
});
```

See: [Chart Utilities Developer Guide](./CHART_UTILITIES_GUIDE.md).

## Best Practices

- Gate all Excel code behind `Excel.run()` and batch mutations before `context.sync()`.
- Keep worksheet object usage within the same `context`; reacquire on new runs.
- Use explicit number formats for timestamp columns.
- Prefer chart names that are unique per sheet.

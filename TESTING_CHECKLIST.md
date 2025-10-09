# Testing Checklist for Excel Integration Refactoring

## Pre-Testing Setup

- [ ] Clear Excel cache: `%LOCALAPPDATA%\Microsoft\Office\16.0\Wef\` (Windows)
- [ ] Clear browser cache (for Excel Web)
- [ ] Restart Excel application
- [ ] Ensure add-in loads without errors

---

## Unit Tests (Chart Utilities)

### Date Conversion Functions

- [ ] **`jsDateToOADate()`**
  - [ ] Valid JavaScript Date → Correct OADate number
  - [ ] Invalid date → Returns null
  - [ ] Edge case: Unix epoch (1970-01-01)
  - [ ] Edge case: Recent date (2025-10-09)

- [ ] **`oaDateToJSDate()`**
  - [ ] Valid OADate → Correct JavaScript Date
  - [ ] Edge case: 1 (1899-12-31)
  - [ ] Edge case: 25569 (1970-01-01)
  - [ ] Edge case: 45936 (2025-10-09)

- [ ] **`formatOADateLabel()`**
  - [ ] Format: 'datetime' → "MM/DD/YYYY HH:MM:SS AM/PM"
  - [ ] Format: 'date' → "MM/DD/YYYY"
  - [ ] Format: 'time' → "HH:MM:SS AM/PM"
  - [ ] Invalid OADate → Empty string

- [ ] **`convertRowsToDateLabels()`**
  - [ ] Empty array → Empty array
  - [ ] Array with valid OADates → Formatted labels
  - [ ] Array with mixed types → Handles gracefully
  - [ ] Custom column index → Extracts correct column

---

## Integration Tests (Chart Creation)

### Basic Chart Creation

- [ ] **Line Chart**
  - [ ] Creates with valid data range
  - [ ] Displays correct title
  - [ ] Legend appears in correct position
  - [ ] Chart positioned correctly

- [ ] **Column Chart**
  - [ ] Creates with valid configuration
  - [ ] Vertical bars display correctly
  - [ ] Categories labeled properly

- [ ] **Bar Chart**
  - [ ] Creates horizontal bars
  - [ ] Legend and title work

### Time Series Chart Creation

- [ ] **Standard Configuration**
  - [ ] Creates with normalizedRows data
  - [ ] Timestamp labels formatted correctly
  - [ ] Multiple series display correctly
  - [ ] Legend shows series names

- [ ] **Edge Cases**
  - [ ] Empty data → No crash, graceful handling
  - [ ] Single row → Handles appropriately
  - [ ] Single series → Creates chart
  - [ ] Many series (10+) → All display correctly

### Chart Management

- [ ] **Remove Existing Chart**
  - [ ] `removeChartIfExists()` removes existing chart
  - [ ] Returns true when chart found
  - [ ] Returns false when chart not found
  - [ ] No error when chart doesn't exist

- [ ] **Chart Recreation**
  - [ ] Creating chart with same name removes old one
  - [ ] `removeExisting: true` works correctly
  - [ ] `removeExisting: false` allows duplicates

---

## End-to-End Tests (Excel Integration)

### Export Status

- [ ] **Single Instance**
  - [ ] Status export works without errors
  - [ ] Sheet created with correct name
  - [ ] Data formatted correctly
  - [ ] No chart (status exports don't use charts)

- [ ] **Multiple Instances**
  - [ ] All instances included
  - [ ] Columns align correctly
  - [ ] Formatting applied properly

### Export Readings (RAW)

- [ ] **Basic Export**
  - [ ] Data exports to sheet
  - [ ] Headers in row 14
  - [ ] Data starts in row 15
  - [ ] Top 14 rows frozen

- [ ] **Chart Creation**
  - [ ] Chart appears in rows 1-13
  - [ ] Timestamp axis displays correctly
  - [ ] All series (columns C+) plotted
  - [ ] Legend on right side
  - [ ] No chart title

- [ ] **Multiple Exports**
  - [ ] Second export removes old chart
  - [ ] Second export creates new chart
  - [ ] No duplicate charts
  - [ ] No memory leaks

- [ ] **Edge Cases**
  - [ ] Single datapoint → Chart or no chart (acceptable either way)
  - [ ] Two datapoints → Chart displays
  - [ ] Many datapoints (1000+) → Performance acceptable
  - [ ] No series columns → No chart (graceful)

### Export Readings (Other Types)

- [ ] **Summary Export**
  - [ ] No chart created (correct behavior)
  - [ ] Data displays correctly

- [ ] **Timespan Export**
  - [ ] No chart created (correct behavior)
  - [ ] Data displays correctly

- [ ] **Combined Export**
  - [ ] No chart created (correct behavior)
  - [ ] Tables formatted properly

---

## Cross-Platform Testing

### Excel Desktop (Windows)

- [ ] Add-in loads
- [ ] Export Status works
- [ ] Export Readings (RAW) works
- [ ] Chart displays correctly
- [ ] Legend and formatting correct
- [ ] No console errors

### Excel Desktop (Mac)

- [ ] Add-in loads
- [ ] Export Status works
- [ ] Export Readings (RAW) works
- [ ] Chart displays correctly
- [ ] Legend and formatting correct
- [ ] No console errors

### Excel Web (Chrome)

- [ ] Add-in loads
- [ ] Export Status works
- [ ] Export Readings (RAW) works
- [ ] Chart displays correctly
- [ ] Legend and formatting correct
- [ ] No console errors

### Excel Web (Edge)

- [ ] Add-in loads
- [ ] Export Status works
- [ ] Export Readings (RAW) works
- [ ] Chart displays correctly
- [ ] Legend and formatting correct
- [ ] No console errors

### Excel Web (Firefox)

- [ ] Add-in loads
- [ ] Export Status works
- [ ] Export Readings (RAW) works
- [ ] Chart displays correctly
- [ ] Legend and formatting correct
- [ ] No console errors

### Excel Web (Safari)

- [ ] Add-in loads
- [ ] Export Status works
- [ ] Export Readings (RAW) works
- [ ] Chart displays correctly
- [ ] Legend and formatting correct
- [ ] No console errors

---

## Performance Tests

### Large Datasets

- [ ] **1000 rows**
  - [ ] Export completes in reasonable time (< 5s)
  - [ ] Chart renders correctly
  - [ ] Labels readable

- [ ] **5000 rows**
  - [ ] Export completes (< 15s)
  - [ ] Chart renders (labels may overlap - acceptable)
  - [ ] No crashes

- [ ] **10000 rows**
  - [ ] Export completes (< 30s)
  - [ ] Chart renders
  - [ ] Performance acceptable

### Multiple Series

- [ ] **5 series**
  - [ ] All plot correctly
  - [ ] Legend shows all

- [ ] **10 series**
  - [ ] All plot correctly
  - [ ] Legend readable

- [ ] **20+ series**
  - [ ] All plot (legend may be crowded - acceptable)
  - [ ] No errors

---

## Error Handling Tests

### Invalid Inputs

- [ ] **Null/Undefined Data**
  - [ ] No crash
  - [ ] Graceful error message
  - [ ] Export continues (chart skipped)

- [ ] **Invalid Range**
  - [ ] Error caught
  - [ ] Logged appropriately
  - [ ] No crash

- [ ] **Invalid Chart Type**
  - [ ] Falls back to 'line'
  - [ ] Chart still created

### Network Issues

- [ ] **API Timeout**
  - [ ] Error handled
  - [ ] User notified
  - [ ] No chart (expected)

- [ ] **Partial Data**
  - [ ] Exports what's available
  - [ ] Chart with available data
  - [ ] Warning logged

---

## Regression Tests

### Existing Functionality

- [ ] **Instance Management**
  - [ ] Add instance works
  - [ ] Remove instance works
  - [ ] Set active works
  - [ ] Ping works

- [ ] **Asset Selection**
  - [ ] Asset dropdown populates
  - [ ] Asset selection persists
  - [ ] Asset filter works

- [ ] **Console Logging**
  - [ ] Logs display
  - [ ] Levels work (info, warn, error)
  - [ ] Clear console works

- [ ] **UI Elements**
  - [ ] All buttons clickable
  - [ ] Form inputs work
  - [ ] Radio buttons work
  - [ ] Badges update

---

## Code Quality Checks

### Static Analysis

- [ ] **Linter**
  - [ ] No ESLint errors
  - [ ] No warnings (or acceptable warnings)

- [ ] **TypeScript/JSDoc**
  - [ ] All functions documented
  - [ ] Types correct
  - [ ] No JSDoc errors

### Code Review

- [ ] **imports**
  - [ ] All imports resolve
  - [ ] No circular dependencies
  - [ ] No unused imports

- [ ] **Exports**
  - [ ] All exports used
  - [ ] Default export correct
  - [ ] Named exports correct

- [ ] **Console Logs**
  - [ ] No `console.log` in production code
  - [ ] `console.warn` used appropriately
  - [ ] `console.error` for errors only

---

## Documentation Tests

- [ ] **Code Comments**
  - [ ] All functions have JSDoc
  - [ ] Complex logic explained
  - [ ] Examples provided

- [ ] **External Docs**
  - [ ] README.md up to date
  - [ ] CHART_UTILITIES_GUIDE.md accurate
  - [ ] CODE_REVIEW_SUMMARY.md complete

---

## User Acceptance Tests

### Real-World Scenarios

- [ ] **Scenario 1: Single Instance Dashboard**
  1. Add FogLAMP instance
  2. Set active
  3. Export Status
  4. Select asset
  5. Export RAW readings
  6. Verify chart appears
  - [ ] ✅ All steps work smoothly

- [ ] **Scenario 2: Multiple Instance Comparison**
  1. Add 3 FogLAMP instances
  2. Export Status (all instances)
  3. Verify multi-instance sheet
  - [ ] ✅ Data from all instances present

- [ ] **Scenario 3: Time Series Analysis**
  1. Select asset with time-series data
  2. Configure time window (last 1 hour)
  3. Export RAW readings
  4. Inspect chart
  - [ ] ✅ Chart shows trend over time

- [ ] **Scenario 4: Repeated Exports**
  1. Export RAW readings
  2. Wait 5 minutes
  3. Export again (same asset)
  4. Verify old chart replaced
  - [ ] ✅ Only one chart present

---

## Sign-Off

### Test Lead
- **Name**: ___________________
- **Date**: ___________________
- **Signature**: ___________________

### Developer
- **Name**: ___________________
- **Date**: ___________________
- **Signature**: ___________________

### Product Owner
- **Name**: ___________________
- **Date**: ___________________
- **Signature**: ___________________

---

## Notes

Use this space for additional observations, issues found, or recommendations:

```
[Notes here]
```

---

**Version**: 1.0  
**Test Suite**: Excel Integration Refactoring  
**Created**: October 9, 2025


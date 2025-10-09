# API Reference

This document describes the JavaScript APIs available in the FogLAMP DataLink add-in.

## Global Namespace

All functionality is accessible via the `window.FogLAMP` object:

```javascript
window.FogLAMP = {
  api,        // FogLAMP REST API calls
  storage,    // Instance management
  excel,      // Excel exports
  errors,     // Error handling
  badges,     // Status badges
  instances,  // Instance list UI
  ping,       // Connectivity operations
  console,    // Logging
  utils       // Utilities
}
```

---

## Core API Calls (`window.FogLAMP.api`)

All methods auto-detect platform and use proxy when appropriate. `*ForUrl` variants target a specific base URL.

### `ping()` → object
Test connectivity and get basic server info for the active instance.

### `pingForUrl(baseUrl)` → object
Same as `ping` but for the specified instance.

### `statistics()` → array
Return detailed server statistics for the active instance.

### `statisticsForUrl(baseUrl)` → array
Statistics for a specific instance.

### `assets()` → array<string>
List available assets for the active instance.

### `assetsForUrl(baseUrl)` → array<string>
Assets for a specific instance.

### `readings(asset, datapoint?, params?)` → array<object>
Fetch time-series readings for an asset on the active instance.

Params:
- `limit`, `skip`
- `seconds`, `minutes`, `hours`, `previous`

### `readingsForUrl(baseUrl, asset, datapoint?, params?)` → array<object>
Fetch readings for an asset on the specified instance.

---

## Instance Management (`window.FogLAMP.storage`)

- `getInstances()` → string[]
- `addInstance(url, options?)` → Promise<void>
- `removeInstance(url)` → void
- `getActiveInstance()` → string | null
- `setActiveInstance(url)` → void
- `getInstanceMeta(url)` / `updateInstanceMeta(url, updates)` → object / void
- `getActiveInstanceWithMeta()` → object | null

---

## Excel Integration (`window.FogLAMP.excel`)

- `handleExportStatus()` → Promise<boolean>
  - Creates a formatted sheet with ping, statistics, and assets across registered instances.
- `handleExportReadings()` → Promise<boolean>
  - Creates a formatted data sheet for selected asset/datapoint.

See also: [Chart Utilities Developer Guide](./CHART_UTILITIES_GUIDE.md).

---

## UI Modules

- `window.FogLAMP.badges.updateOverviewBadges()` → void
- `window.FogLAMP.instances.renderInstanceList()` → void

---

## Error Handling (`window.FogLAMP.errors`)

- `showError(title, message, context?)` → Promise<void>
- `handleApiError(operation, error, context?)` → Promise<void>

---

## Logging

- `window.logMessage(level, message, context?)` → void
  - Levels: `info`, `warn`, `error`.

---

## Utilities (`window.FogLAMP.utils`)

- `getDisplayName(url, meta)` → string
- `isValidUrl(url)` → boolean
- `debounce(fn, wait)` → function
- `formatTimestamp(isoString)` → string

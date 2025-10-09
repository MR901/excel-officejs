# Architecture Overview

This document explains the structure of the FogLAMP DataLink Excel add-in and how its modules interact.

## Initialization and Bootstrap

- The entrypoint is `src/js/main.js`, which constructs a `FogLAMPDataLink` application class and initializes modules when the DOM is ready.
- Office.js readiness is respected via `Office.onReady()` before initializing subsystems.
- A global organized namespace `window.FogLAMP` exposes modules during the transition to full modular usage.

## Core Modules

- `core/api-manager.js`:
  - Unified API backbone. Detects platform (Excel Desktop/Web), integrates with proxy when available.
  - Public methods: `ping()`, `pingForUrl(baseUrl)`, `statistics()`, `statisticsForUrl(baseUrl)`, `assets()`, `assetsForUrl(baseUrl)`, `readings(asset, datapoint?, params?)`, `readingsForUrl(baseUrl, asset, datapoint?, params?)`.
  - Implements Smart Manager → Direct call fallback with timeouts and contextual error handling.
- `core/storage.js`:
  - Persists instance URLs and metadata in `localStorage`.
  - Helpers: `getInstances()`, `addInstance(url, options)`, `removeInstance(url)`, `setActiveInstance(url)`, `getActiveInstanceWithMeta()`, etc.
- `core/error-handler.js`:
  - Office.js-compliant dialogs, `handleApiError()` for context-aware guidance.
- `ui/console.js`:
  - Draggable console, `logMessage(level, message, details)` and helpers.
- `ui/badges.js`:
  - Environment, connectivity, and proxy status badges.
- `ui/instances.js`:
  - Instance list rendering and controls.
- `events/handlers.js`:
  - Wires UI events to actions (add instance, refresh connections, etc.).
- `excel/integration.js`:
  - Excel worksheet operations, formatted exports for status and readings.
- `excel/chart-utils.js`:
  - Reusable chart creation utilities and date conversions.

## Data Flow

1. User adds/selects an instance (UI → `storage`).
2. Actions invoke API calls (`api-manager`), optionally via proxy.
3. Results update UI and metadata (`ui/*`, `storage`).
4. Exports write to Excel (`excel/integration`) and can create charts (`excel/chart-utils`).

## Office.js Practices

- Use `Office.onReady()` gate before initialization.
- Batch operations; avoid `context.sync()` in tight loops.
- Treat charts as optional; errors should not block data export.

## Proxy Awareness

- When `window.smartManager` is present, proxy availability is auto-detected and used for private networks or web contexts.
- Fallback to direct API when proxy is unavailable.

## Public Surface (selected)

- `window.FogLAMP.api`: API methods listed above.
- `window.FogLAMP.excel`: `handleExportStatus()`, `handleExportReadings()`.
- `window.FogLAMP.instances`: instance list UI (render, actions).
- `window.logMessage(level, message, details)`: unified logging to the console panel.

## Sheets and Exports

- Status export: multi-section sheet containing ping, statistics, and assets per instance.
- Readings export: timestamp + datapoint columns; optional time-series chart via `createTimeSeriesChart`.

# UI Modules and Events

This guide describes the UI components, their responsibilities, and key entry points.

## Console (`ui/console.js`)

- Draggable console panel with live logs
- `logMessage(level, message, details)`
- `clearConsole()`, `setConsoleHeight(height)`

## Badges (`ui/badges.js`)

- Environment (Desktop/Web), Connectivity, and Proxy status
- `updateOverviewBadges()`
- `updateConnectionStatus()`

## Instance List (`ui/instances.js`)

- Renders instance cards and controls
- `renderInstanceList()`
- `editInstanceName(url, el)`

## Event Handlers (`events/handlers.js`)

- Centralized user interaction wiring
- `initialize()` sets up listeners and readings controls
- `handleAddInstance()` with validation and feedback flow
- `handleUpdateConnections()` performs environment re-detect, proxy check, and bulk pings

## Patterns

- Always update badges and instance list after storage changes
- Use `logMessage()` to provide user-visible progress and troubleshooting details

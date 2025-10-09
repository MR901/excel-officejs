# User Guide

## Installation

1. Download `manifest.xml`.
2. Open Excel (Desktop or Web).
3. Insert → Get Add-ins → Upload My Add-in.
4. Select `manifest.xml`.
5. Open the taskpane from the FogLAMP DataLink ribbon.

## Managing Instances

### Add Instance

1. Open the taskpane.
2. Enter FogLAMP URL: `http://192.168.1.100:8081`.
3. Click "Add".

Valid URL formats:
- `http://192.168.1.100:8081`
- `https://foglamp.example.com`
- `192.168.1.100:8081` (auto-adds `http://`)

Invalid example:
- `192.168.1.100` (missing port)

### Set Active Instance

Click "Set Active" on an instance. All operations use the active instance.

### Ping Instance

Click "Ping" to test connectivity. Status indicators:
- 🟢 Green: Reachable (< 500ms)
- 🟡 Yellow: Slow (500–2000ms)
- 🔴 Red: Unreachable or error

### Remove Instance

Click "Remove" → confirm to delete.

## Exporting Data

### Export Status

1. Set an instance as active.
2. Click "Export Status to Sheet".
3. A new sheet is created with:
   - Ping info (uptime, response time)
   - Statistics (readings collected, stored, etc.)
   - Available assets

Sheet name: `Status`.

### Export Asset Readings

1. Select asset from dropdown (or type name).
2. Configure parameters:
   - Limit: Max readings (default: 100)
   - Time window: seconds/minutes/hours
   - Datapoint: Optional key
   - Skip: Pagination
3. Click "Get Readings".
4. A new sheet is created with timestamp + datapoint columns.

Default sheet name suffix: `data`.

Example (last hour temperature):
- Asset: `temperature_sensor`
- Limit: `1000`
- Hours: `1`

## Status Badges

Three badges show system status:
- Environment: 🖥️ Desktop or 🌐 Web
- Connectivity: 🟢 All / 🟡 Partial / 🔴 None
- Proxy: 🔗 Available or ❌ No Proxy

## Refresh Connections

Click "Refresh Connections" to:
- Re-detect environment (Desktop/Web)
- Check proxy availability
- Ping all instances
- Update status badges

## Excel Web + Private Networks

Problem: Excel Web cannot access private IPs (192.168.x.x, 10.x.x.x) directly due to browser security.

Solution: Use the proxy server.

1. Start the proxy on your local machine:
   ```bash
   node proxy_server.js
   ```
2. Click "Refresh Connections" in the add-in.
3. Proxy badge should show: 🔗 Proxy Available.

All requests will automatically route through the proxy when appropriate.

## Console

The draggable console shows real-time logs:
- 🔵 INFO: Normal operations
- 🟡 WARN: Warnings
- 🔴 ERROR: Errors

Controls:
- Drag resizer to adjust height
- Click "Clear" to clear logs
- "LIVE" badge indicates real-time logging

## Common Tasks

### Monitor Multiple Sites
1. Add site instances
2. Click "Refresh Connections" periodically
3. Check Connectivity badge for overall health
4. Export status for details

### Analyze Asset Data
1. Set target instance as active
2. Export asset readings with a time window
3. Use Excel charts/pivots for analysis

## Troubleshooting

- Can't add instance:
  - Ensure URL includes port (e.g., `http://192.168.1.100:8081`)
  - Verify FogLAMP server is running
  - Test with: `curl http://192.168.1.100:8081/foglamp/ping`
- Ping fails:
  - Check network connectivity
  - For Excel Web: Start proxy server
  - Verify FogLAMP REST API is enabled
- Export fails:
  - Set an instance as active first
  - Verify instance is reachable (Ping)
  - Check console logs for specifics
- Proxy not detected:
  - Ensure proxy runs on localhost:3001
  - Check firewall for port 3001
  - Restart proxy after changing instance URLs

## Data Persistence

- Instance URLs and metadata are stored in browser localStorage
- Settings are device-specific
- Data persists across sessions
- Clear data: in browser console run `localStorage.clear()`

## Keyboard Shortcuts

- F12: Open browser console
- Ctrl+Shift+R: Hard refresh (clear cache)

==========
User Guide
==========

Installation
============

1. Download ``manifest.xml``
2. Open Excel (Desktop or Web)
3. Insert → Get Add-ins → Upload My Add-in
4. Select ``manifest.xml``
5. Find add-in in "FogLAMP DataLink" ribbon tab

Managing Instances
==================

Add Instance
------------

1. Open taskpane (click "FogLAMP Console" in ribbon)
2. Enter FogLAMP URL: ``http://192.168.1.100:8081``
3. Click "Add"

**URL Formats**::

   http://192.168.1.100:8081      ✓ Correct
   https://foglamp.example.com    ✓ Correct
   192.168.1.100:8081            ✓ Auto-adds http://
   192.168.1.100                 ✗ Missing port

Set Active Instance
-------------------

Click "Set Active" on an instance. All operations use the active instance.

Ping Instance
-------------

Click "Ping" to test connectivity. Status indicators:

* 🟢 Green: Reachable (< 500ms)
* 🟡 Yellow: Slow (500-2000ms)
* 🔴 Red: Unreachable or error

Remove Instance
---------------

Click "Remove" → Confirm to delete.

Exporting Data
==============

Export Status
-------------

1. Set an instance as active
2. Click "Export Status to Sheet"
3. New sheet created with:
   
   * Ping info (uptime, response time)
   * Statistics (readings collected, stored, etc.)
   * Available assets

**Sheet Name**: ``Status_<hostname>``

Export Asset Readings
---------------------

1. Select asset from dropdown (or type name)
2. Configure parameters:
   
   * **Limit**: Max readings (default: 100)
   * **Time window**: Recent data (seconds/minutes/hours)
   * **Datapoint**: Optional, specific reading key
   * **Skip**: For pagination

3. Click "Get Readings"
4. New sheet created with timestamp + datapoint columns

**Sheet Name**: ``Readings_<asset>``

**Example - Last hour of temperature data**::

   Asset: temperature_sensor
   Limit: 1000
   Hours: 1

Status Badges
=============

Three badges show system status:

**Environment**: 🖥️ Desktop or 🌐 Web

**Connectivity**: 
   * 🟢 All reachable
   * 🟡 Partial
   * 🔴 None reachable

**Proxy**: 🔗 Available or ❌ No Proxy

Refresh Connections
===================

Click "Refresh Connections" to:

* Re-detect environment (Desktop/Web)
* Check proxy availability  
* Ping all instances
* Update status badges

Excel Web + Private Networks
=============================

**Problem**: Excel Web can't access private IPs (192.168.x.x, 10.x.x.x) due to browser security.

**Solution**: Use proxy server.

1. **Start Proxy** (on local machine, same network as FogLAMP)::

     node proxy_server.js

2. **Refresh** in add-in
   
   Proxy badge should show: 🔗 Proxy Available

3. **Use normally**
   
   All requests automatically route through proxy

Console
=======

Draggable console at bottom shows real-time logs:

* 🔵 **INFO**: Normal operations
* 🟡 **WARN**: Warnings
* 🔴 **ERROR**: Errors

**Controls**:

* Drag resizer bar to adjust height
* Click "Clear" to clear logs
* "LIVE" badge indicates real-time logging

Common Tasks
============

Monitor Multiple Sites
----------------------

1. Add all site instances
2. Click "Refresh Connections" periodically
3. Check Connectivity badge for overall health
4. Export status for detailed investigation

Analyze Asset Data
------------------

1. Set target instance as active
2. Export asset readings with time window
3. Use Excel charts/pivot tables for analysis

Troubleshooting
===============

Can't Add Instance
------------------

* Check URL includes port: ``http://192.168.1.100:8081``
* Verify FogLAMP server is running
* Test with: ``curl http://192.168.1.100:8081/foglamp/ping``

Ping Fails
----------

* Check network connectivity
* For Excel Web: Start proxy server
* Verify FogLAMP REST API is enabled

Export Fails
------------

* Set instance as active first
* Verify instance is reachable (click Ping)
* Check console logs for specific error

Proxy Not Detected
------------------

* Ensure proxy runs on localhost:3001
* Check no firewall blocking port 3001
* Restart proxy if you changed instance URLs

Data Persistence
================

* Instance URLs stored in browser localStorage
* Settings are device-specific (not synced)
* Data persists across sessions
* Clear data: Browser console → ``localStorage.clear()``

Keyboard Shortcuts
==================

* **F12**: Open browser console (debugging)
* **Ctrl+Shift+R**: Hard refresh (clear cache)

Tips
====

* Start with small limits (100-500) when testing exports
* Use time windows instead of huge limits for recent data
* Monitor console for warnings about slow responses
* Close unused Excel sheets after export for performance
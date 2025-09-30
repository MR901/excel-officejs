==============
API Reference
==============

This document describes the JavaScript APIs available in the FogLAMP DataLink add-in.

Global Namespace
================

All add-in functionality is accessible via ``window.FogLAMP`` object:

.. code-block:: javascript

   window.FogLAMP = {
       api         // API calls to FogLAMP servers
       storage     // Instance management
       excel       // Excel export functions
       errors      // Error handling
       badges      // Status badge updates
       instances   // Instance list UI
       ping        // Connectivity testing
       console     // Logging functions
       utils       // Utility functions
   }

Core API Calls (window.FogLAMP.api)
====================================

Methods for communicating with FogLAMP servers.

ping()
------

Test connectivity and get basic server info.

.. code-block:: javascript

   const result = await window.FogLAMP.api.ping();

**Returns**::

   {
       uptime: 12345,
       dataRead: 98765,
       dataSent: 45678,
       serviceName: "FogLAMP",
       hostName: "foglamp-server"
   }

**Throws**: Error if server unreachable

statistics()
------------

Get detailed server statistics.

.. code-block:: javascript

   const stats = await window.FogLAMP.api.statistics();

**Returns**: Array of statistic objects

**Example**::

   [
       { key: "READINGS", value: "12345", description: "Total readings" },
       { key: "PURGED", value: "500", description: "Purged readings" }
   ]

assets()
--------

Get list of available assets.

.. code-block:: javascript

   const assetList = await window.FogLAMP.api.assets();

**Returns**: Array of asset names (strings)

**Example**::

   ["temperature_sensor", "humidity_sensor", "pressure_sensor"]

readings(asset, datapoint, params)
----------------------------------

Get time-series readings for an asset.

.. code-block:: javascript

   const data = await window.FogLAMP.api.readings(
       "temperature_sensor",  // asset name (required)
       null,                  // specific datapoint (optional)
       {
           limit: 100,        // max readings
           skip: 0,           // pagination offset
           seconds: 3600      // time window
       }
   );

**Parameters**:

* ``asset`` (string, required): Asset name
* ``datapoint`` (string, optional): Specific reading key, null for all
* ``params`` (object, optional): Query parameters

**Params Object**::

   {
       limit: number,     // Max readings (default: 100)
       skip: number,      // Pagination offset (default: 0)
       seconds: number,   // Recent seconds
       minutes: number,   // Recent minutes
       hours: number,     // Recent hours
       previous: number   // Historical lookback
   }

**Returns**: Array of reading objects

**Example**::

   [
       {
           timestamp: "2024-01-15T10:30:00.000Z",
           reading: { temperature: 25.5, humidity: 60 }
       },
       { ... }
   ]

Instance Management (window.FogLAMP.storage)
=============================================

Methods for managing FogLAMP server instances.

getInstances()
--------------

Get all registered instance URLs.

.. code-block:: javascript

   const urls = window.FogLAMP.storage.getInstances();

**Returns**: Array of URLs (strings)

addInstance(url, customName)
-----------------------------

Add a new FogLAMP instance.

.. code-block:: javascript

   await window.FogLAMP.storage.addInstance(
       "http://192.168.1.100:8081",
       "Production Server"  // optional custom name
   );

**Parameters**:

* ``url`` (string, required): FogLAMP server URL
* ``customName`` (string, optional): Display name

**URL Formats Accepted**:

* ``192.168.1.100:8081`` → Auto-adds http://
* ``http://192.168.1.100:8081``
* ``https://foglamp.example.com``

removeInstance(url)
-------------------

Remove an instance from the list.

.. code-block:: javascript

   window.FogLAMP.storage.removeInstance("http://192.168.1.100:8081");

getActiveInstance()
-------------------

Get the currently active instance URL.

.. code-block:: javascript

   const activeUrl = window.FogLAMP.storage.getActiveInstance();

**Returns**: String (URL) or null if none active

setActiveInstance(url)
----------------------

Set an instance as active (all API calls use this).

.. code-block:: javascript

   window.FogLAMP.storage.setActiveInstance("http://192.168.1.100:8081");

getInstanceMeta(url)
--------------------

Get metadata for an instance.

.. code-block:: javascript

   const meta = window.FogLAMP.storage.getInstanceMeta("http://192.168.1.100:8081");

**Returns**::

   {
       customName: "Production Server",
       lastStatus: "success",           // "success" | "error"
       lastPingMs: 45,                  // response time
       lastCheckedAt: "2024-01-15...",  // ISO timestamp
       hostName: "foglamp-prod",
       lastError: null                  // or error message
   }

updateInstanceMeta(url, meta)
-----------------------------

Update metadata for an instance.

.. code-block:: javascript

   window.FogLAMP.storage.updateInstanceMeta(
       "http://192.168.1.100:8081",
       {
           lastStatus: "success",
           lastPingMs: 42,
           lastCheckedAt: new Date().toISOString(),
           hostName: "foglamp-prod"
       }
   );

Excel Integration (window.FogLAMP.excel)
=========================================

Methods for exporting data to Excel sheets.

handleExportStatus()
--------------------

Export comprehensive status to a formatted Excel sheet.

.. code-block:: javascript

   await window.FogLAMP.excel.handleExportStatus();

**Creates Sheet With**:

* Instance information
* Ping results (uptime, response time)
* Server statistics
* Available assets list

**Sheet Name**: ``Status_<hostname>`` (e.g., "Status_192.168.1.100")

handleExportReadings()
----------------------

Export asset readings to a formatted data table.

.. code-block:: javascript

   await window.FogLAMP.excel.handleExportReadings();

**Reads Parameters From UI**:

* Asset name
* Datapoint (optional)
* Limit, skip, time windows

**Creates Sheet With**:

* Timestamp column
* Datapoint columns (one per reading key)
* Professional formatting

**Sheet Name**: ``Readings_<asset>`` (e.g., "Readings_temperature_sensor")

Logging (window.logMessage)
============================

Universal logging function (also in console).

.. code-block:: javascript

   window.logMessage(level, message, contextData);

**Parameters**:

* ``level`` (string): "info", "warn", or "error"
* ``message`` (string): Log message text
* ``contextData`` (object, optional): Additional context

**Example**:

.. code-block:: javascript

   window.logMessage('info', 'Fetching data', { asset: 'temp_sensor' });
   window.logMessage('warn', 'Slow response', { pingMs: 1500 });
   window.logMessage('error', 'Connection failed', { error: err.message });

**Output**: Logs appear in the console panel with color-coding

Badge Updates (window.FogLAMP.badges)
======================================

updateOverviewBadges()
----------------------

Update all status badges (environment, connectivity, proxy).

.. code-block:: javascript

   window.FogLAMP.badges.updateOverviewBadges();

**Badges Updated**:

* **Environment**: 🖥️ Desktop or 🌐 Web
* **Connectivity**: 🟢 All / 🟡 Partial / 🔴 None
* **Proxy**: 🔗 Available or ❌ No Proxy

**When to Call**:

* After adding/removing instances
* After ping operations
* After proxy server starts/stops

Instance List UI (window.FogLAMP.instances)
============================================

renderInstanceList()
--------------------

Re-render the instance list UI.

.. code-block:: javascript

   window.FogLAMP.instances.renderInstanceList();

**Updates**:

* Instance cards with status
* Action buttons (Set Active, Ping, Remove)
* Empty state if no instances

**When to Call**:

* After adding/removing instances
* After updating metadata
* After setting active instance

Connectivity (window.FogLAMP.ping)
===================================

pingInstance(url)
-----------------

Ping a specific instance and update metadata.

.. code-block:: javascript

   const result = await window.FogLAMP.ping.pingInstance("http://192.168.1.100:8081");

**Returns**::

   {
       url: "http://192.168.1.100:8081",
       success: true,
       pingMs: 45,
       hostName: "foglamp-prod",
       timestamp: "2024-01-15T10:30:00.000Z",
       data: { /* ping response */ }
   }

**Side Effects**:

* Updates instance metadata
* Updates UI badges
* Logs result to console

Error Handling (window.FogLAMP.errors)
=======================================

showError(title, message, context)
-----------------------------------

Display user-friendly error dialog.

.. code-block:: javascript

   await window.FogLAMP.errors.showError(
       'Connection Error',
       'Failed to reach FogLAMP server',
       { url: 'http://192.168.1.100:8081' }
   );

**Parameters**:

* ``title`` (string): Error title
* ``message`` (string): User-friendly message
* ``context`` (object, optional): Additional context

**Behavior**:

* Shows Office.js native dialog (if available)
* Falls back to alert() if dialogs not supported
* Auto-closes after 5 seconds

handleApiError(operation, error, context)
------------------------------------------

Handle API errors with contextual messages.

.. code-block:: javascript

   try {
       await window.FogLAMP.api.ping();
   } catch (error) {
       await window.FogLAMP.errors.handleApiError(
           'ping operation',
           error,
           { url: activeUrl }
       );
   }

**Provides Context-Specific Guidance**:

* Network errors → Check connectivity
* CORS errors → Use proxy server
* 404 errors → Check FogLAMP configuration
* Timeouts → Check server performance

Utility Functions (window.FogLAMP.utils)
=========================================

getDisplayName(url, meta)
--------------------------

Get display name for an instance.

.. code-block:: javascript

   const name = window.FogLAMP.utils.getDisplayName(
       "http://192.168.1.100:8081",
       { customName: "Production Server" }
   );
   // Returns: "Production Server"

**Returns**: Custom name if set, otherwise URL

isValidUrl(url)
---------------

Validate URL format.

.. code-block:: javascript

   const valid = window.FogLAMP.utils.isValidUrl("http://192.168.1.100:8081");

**Returns**: boolean

debounce(func, wait)
--------------------

Create debounced function.

.. code-block:: javascript

   const debouncedSearch = window.FogLAMP.utils.debounce(searchFunction, 300);

formatTimestamp(isoString)
---------------------------

Format ISO timestamp to readable string.

.. code-block:: javascript

   const formatted = window.FogLAMP.utils.formatTimestamp("2024-01-15T10:30:00.000Z");
   // Returns: "2m ago" or "10:30 AM"

Common Patterns
===============

Complete Export Workflow
-------------------------

.. code-block:: javascript

   // 1. Add instance
   await window.FogLAMP.storage.addInstance("http://192.168.1.100:8081", "My Server");
   
   // 2. Set as active
   window.FogLAMP.storage.setActiveInstance("http://192.168.1.100:8081");
   
   // 3. Test connection
   const pingResult = await window.FogLAMP.ping.pingInstance("http://192.168.1.100:8081");
   
   // 4. Export status
   if (pingResult.success) {
       await window.FogLAMP.excel.handleExportStatus();
   }

Manual Data Fetch and Process
------------------------------

.. code-block:: javascript

   try {
       // Fetch assets
       const assets = await window.FogLAMP.api.assets();
       
       // Fetch readings for first asset
       const readings = await window.FogLAMP.api.readings(assets[0], null, {
           limit: 50,
           hours: 1
       });
       
       // Process readings
       readings.forEach(r => {
           console.log(r.timestamp, r.reading);
       });
       
   } catch (error) {
       await window.FogLAMP.errors.handleApiError('data fetch', error);
   }

Custom UI Updates
-----------------

.. code-block:: javascript

   // After bulk operations
   async function refreshAll() {
       // Ping all instances
       const instances = window.FogLAMP.storage.getInstances();
       for (const url of instances) {
           await window.FogLAMP.ping.pingInstance(url);
       }
       
       // Update UI
       window.FogLAMP.badges.updateOverviewBadges();
       window.FogLAMP.instances.renderInstanceList();
   }

Notes for Developers
====================

**Proxy Handling**
   The API manager automatically detects and routes through proxy when available. You don't need to handle this manually.

**Error Handling**
   Always wrap API calls in try/catch and use ``window.FogLAMP.errors`` for user-friendly feedback.

**Active Instance**
   All API methods (``ping``, ``statistics``, ``assets``, ``readings``) use the currently active instance. Set it first with ``setActiveInstance()``.

**Metadata Updates**
   Ping operations automatically update instance metadata. Manual updates are rarely needed.

**UI Synchronization**
   After storage changes (add/remove/set active), call ``renderInstanceList()`` and ``updateOverviewBadges()`` to sync UI.

# FogLAMP Data Link - Smart Excel Add-in

![Screenshot](/screenshot.png?raw=true)

An intelligent Office.js Excel add-in that connects to FogLAMP instances with automatic environment detection and smart connection management.

## ✨ **Smart Features**

- 🧠 **Auto-detects** Excel Desktop vs Web environment
- 🔄 **Intelligent connection** management with fallback
- 🌐 **Works in both** Excel Desktop and Excel Web
- 🚀 **Zero configuration** for basic setup
- 📊 **Real-time connection status** indicators

## 🚀 **Quick Start**

1. **Load the add-in** by sideloading `manifest.xml` in Excel
2. **Check "Connection Status"** - shows available FogLAMP instances automatically
3. **Use all features** - they automatically use the best connection method

## 📁 **Key Files**

- `manifest.xml` - Office add-in manifest
- `taskpane.html` - Main add-in interface with smart connection logic
- `smart-connection.js` - Intelligent connection manager  
- `simple-proxy.js` - Proxy server for Excel Web remote access
- `commands.html` - Office.js command functions

## 🔧 **For Remote FogLAMP Access in Excel Web**

If using Excel Web and need to access remote FogLAMP instances:

```bash
# Start the proxy server
node simple-proxy.js

# Then click "Refresh Connections" in the add-in
```

See `USAGE.md` for detailed instructions.

## 📖 **Documentation**

- `USAGE.md` - Complete user guide
- [Office.js documentation](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/test-debug-office-add-ins#sideload-an-office-add-in-for-testing) - For add-in installation


# FogLAMP Data Link - Excel Add-in

![Workflow](/docs/images/workflow.png?raw=true)

A Microsoft Excel add-in for supporting access to FogLAMP data. Provides seamless data management, real-time monitoring, and professional Excel exports.

## **Key Features**

- **Unified API Backbone** - Single consistent pathway for all FogLAMP API calls
- **Cross-Platform** - Works on Excel Desktop (Windows/Mac) and Excel Web
- **Smart Connectivity** - Automatic proxy handling for private networks
- **Formatted Exports** - Formatted Excel sheets with status and asset data
- **Office.js Compliant** - 100% following Microsoft best practices

## **Quick Start**

1. **Load the add-in** by sideloading `manifest.xml` in Excel
2. **Add FogLAMP instance** - Enter URL (e.g., `https://127.0.0.1:1995`, `http://192.168.1.100:8081`)
3. **Set active** and **Ping** to verify connectivity
4. **Export data** - Click "Export Status to Sheet" or configure asset readings

## **Excel Web with Private Networks**

For Excel Web accessing private network instances (192.168.x.x, 10.x.x.x):

```bash
# Start the proxy server on your local machine
node proxy_server.js

# Then click "Refresh Connections" in the add-in
# Proxy badge should show: 🔗 Proxy Available
```

## **Deployment**

**Option 1: GitHub Pages** (Easiest)
1. Enable GitHub Pages in repository settings
2. Update all URLs in `manifest.xml` to point to GitHub Pages
3. Distribute `manifest.xml` to users

**Option 2: Internal Server**
1. Upload files to your web server (HTTPS required)
2. Update URLs in `manifest.xml`
3. Set up centralized Office Add-in catalog (optional)

**Users install by**: Insert → Get Add-ins → Upload My Add-in → Select manifest.xml

## **Common Issues**

**Add-in won't load**
- Clear Office cache: `%LOCALAPPDATA%\Microsoft\Office\16.0\Wef\` (Windows)
- Verify URLs in manifest.xml are accessible

**Can't add instance**
- Check URL format: `http://192.168.1.100:8081` (must include port)
- Verify FogLAMP server is running
- Test with: `curl http://192.168.1.100:8081/foglamp/ping`

**Ping fails (Excel Web)**
- Start proxy server: `node proxy_server.js`
- Click "Refresh Connections"

**Export fails**
- Click "Set Active" on an instance first
- Verify instance is reachable (green status)


## **Project Structure**

```
excel-officejs/
├── docs/                  # Documentation (Markdown)
├── src/js/                # Modular JavaScript code
│   ├── core/              # Core functionality (API, storage, config)
│   ├── ui/                # UI components (badges, console, instances)
│   ├── excel/             # Excel integration
│   ├── events/            # Event handlers
│   ├── assets/            # Asset management
│   └── instances/         # Instance management
├── manifest.xml           # Office add-in manifest
├── taskpane.html          # Taskpane UI
├── smart-connection.js    # Smart connection manager
└── proxy_server.js        # Proxy server for Excel Web
```

## **Architecture**

**Organized Namespace**:
```javascript
window.FogLAMP = {
    api, storage, excel, errors,
    badges, instances, ping, console, utils
}
```

**Single API Backbone**:
All FogLAMP API calls use one consistent pathway with automatic proxy detection.

**Office.js Best Practices**:
- Office.onReady() initialization
- No context.sync() in loops
- Native error dialogs
- Professional sheet formatting

## **Testing**

Zero linting errors, full manual test coverage:
- Instance management (add, remove, set active, ping)
- Connectivity (refresh, proxy detection, badge updates)
- Excel exports (status, asset readings)
- Error handling (Office.js dialogs)

## **Requirements**

- Microsoft Excel 2016+ or Office 365
- ExcelApi 1.7+, DialogApi 1.1+
- Node.js 14+ (for proxy server)

## **Security**

- No embedded API keys
- SSL ready (HTTPS for production)
- Input validation
- Local storage only

## **Documentation**

- **[Docs Index](docs/README.md)** – Start here
- **[User Guide](docs/USER_GUIDE.md)** – Installation, usage, common tasks
- **[Architecture Overview](docs/ARCHITECTURE.md)** – How it’s organized
- **[Excel Integration](docs/EXCEL_INTEGRATION.md)** – Exports, formatting, charts
- **[API Reference](docs/API_REFERENCE.md)** – JavaScript APIs
- **[UI Modules and Events](docs/UI.md)** – UI surfaces and events
- **[Chart Utilities Guide](docs/CHART_UTILITIES_GUIDE.md)** – Developer guide for charts




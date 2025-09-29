# FogLAMP Excel Add-in - Smart Connection Guide

Your Excel add-in now **automatically detects** your environment and uses the best connection method!

## 🚀 **How It Works**

### **Excel Desktop** 📱
- ✅ **All registered FogLAMP instances work directly**
- ✅ **No proxy setup required**
- ✅ Register your instances: http://127.0.0.1:8081, http://192.168.0.208:8081, etc.

### **Excel Web** 🌐  
- ✅ **Localhost instances work directly** (http://127.0.0.1:8081)
- ⚠️ **Remote instances need proxy server** (http://192.168.0.x:8081)

## 📋 **Quick Start**

1. **Load the add-in** in Excel (Desktop or Web)
2. **Register your FogLAMP instances** using "Register FogLAMP Instance":
   - Add: `http://127.0.0.1:8081` (local instance)
   - Add: `http://192.168.0.208:8081` (remote instance)
   - Add any other FogLAMP URLs you need
3. **Check "Connection Status"** section - it shows:
   - Your environment (Desktop/Web)
   - Available registered instances
   - Connection guidance if needed

## 🛠️ **For Remote Instances in Excel Web**

If you see: *"X remote instances need proxy server"*

### **Steps:**
1. **Download** `simple-proxy.js` (from this repository)
2. **Run the proxy:**
   ```bash
   node simple-proxy.js
   ```
3. **Click "Refresh Connections"** in the add-in
4. **All instances should now be available!** ✅

### **Proxy Server Details:**
- **Port:** 3001
- **Configuration:** Dynamic (auto-configured from your registered instances)
- **Example URLs:**
  - `localhost:3001/local` → 127.0.0.1:8081
  - `localhost:3001/192-168-0-208` → 192.168.0.208:8081  
  - `localhost:3001/192-168-0-136` → 192.168.0.136:8081

## 🎯 **Connection Status Colors**

| Color | Status | Meaning |
|-------|---------|---------|
| 🟢 **Green** | *(all connected)* | All FogLAMP instances accessible |
| 🟠 **Orange** | *(partial)* | Some instances accessible |
| 🔴 **Red** | *(connection issues)* | No instances accessible |

## 📖 **How to Use**

1. **Connection Status** shows what's available
2. **Register instances** (add-in auto-discovers them)
3. **Select active instance** from the list
4. **Use all features** (Ping, Status, Readings) - they automatically use the best connection

## 🔧 **Troubleshooting**

### **No instances detected:**
- Check if FogLAMP services are running
- For Excel Web: Try running the proxy server
- Click "Refresh Connections"

### **Proxy not working:**
- Make sure Node.js is installed
- Check if port 3001 is available
- Restart the proxy: `Ctrl+C` then `node simple-proxy.js`

### **Still having issues:**
- Use Excel Desktop (bypasses all network restrictions)
- Check FogLAMP CORS settings
- Verify FogLAMP instances are accessible via `curl`

## 🎉 **Benefits**

- ✅ **No manual configuration** needed
- ✅ **Works in both Excel Desktop and Web**  
- ✅ **Automatic fallback** to available instances
- ✅ **Clear status indicators**
- ✅ **User-friendly guidance**

The add-in is now **smart** and handles different environments automatically! 🧠

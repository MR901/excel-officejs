# FogLAMP Quick Reference Guide

## 🚀 Common Commands

### Check Status
```bash
# Quick health check
curl http://localhost:8081/foglamp/ping | python3 -m json.tool

# Detailed status
export PATH=$PATH:/usr/local/foglamp/bin
foglamp status
```

### Start/Stop/Restart
```bash
export PATH=$PATH:/usr/local/foglamp/bin

# Start
foglamp start

# Stop
foglamp stop

# Restart (if having issues)
foglamp stop && sleep 3 && foglamp start
```

### Check Services
```bash
# List all services
curl http://localhost:8081/foglamp/service | python3 -m json.tool

# Check processes
ps aux | grep foglamp | grep -v grep
```

## 🏥 Health Status Meanings

- **🟢 GREEN** - All systems operational
- **🟡 AMBER** - Some non-critical issues (can still use)
- **🔴 RED** - Critical services down (needs attention)

## 🔧 Troubleshooting

### Issue: "Health is red"
**Cause:** Failed or unresponsive services

**Solution:**
```bash
# 1. Check which services failed
curl http://localhost:8081/foglamp/service | python3 -m json.tool

# 2. Remove failed service (replace SERVICE_NAME)
curl -X DELETE http://localhost:8081/foglamp/service/SERVICE_NAME

# 3. Restart FogLAMP
export PATH=$PATH:/usr/local/foglamp/bin
foglamp stop && sleep 3 && foglamp start

# 4. Verify health
curl http://localhost:8081/foglamp/ping | python3 -m json.tool
```

### Issue: "Connection refused"
**Cause:** FogLAMP not running

**Solution:**
```bash
export PATH=$PATH:/usr/local/foglamp/bin
foglamp start
```

### Issue: "Port 8081 in use"
**Cause:** Another process using the port

**Solution:**
```bash
# Find process using port 8081
sudo lsof -i :8081

# Or
sudo netstat -tulpn | grep 8081
```

## 🌐 Excel Add-in Connection

### Local Connection
```
http://localhost:8081
http://127.0.0.1:8081
```

### Network Connection
```
http://192.168.1.40:8081  (your machine's IP)
```

### Test Endpoints Manually
```bash
# Ping
curl http://localhost:8081/foglamp/ping

# Statistics
curl http://localhost:8081/foglamp/statistics

# Assets
curl http://localhost:8081/foglamp/asset
```

## 🔍 Useful Information Queries

### System Info
```bash
curl -s http://localhost:8081/foglamp/ping | \
  python3 -c "import sys, json; d=json.load(sys.stdin); \
  print(f'Health: {d[\"health\"]}'); \
  print(f'Uptime: {d[\"uptime\"]}s'); \
  print(f'Version: {d[\"version\"]}'); \
  print(f'Host: {d[\"hostName\"]}'); \
  print(f'IPs: {d[\"ipAddresses\"]}')"
```

### Data Statistics
```bash
curl -s http://localhost:8081/foglamp/ping | \
  python3 -c "import sys, json; d=json.load(sys.stdin); \
  print(f'Data Read: {d[\"dataRead\"]}'); \
  print(f'Data Sent: {d[\"dataSent\"]}'); \
  print(f'Data Purged: {d[\"dataPurged\"]}')"
```

## 🛠️ Auto-start FogLAMP on Boot

```bash
# Enable systemd service
sudo systemctl enable foglamp

# Check if enabled
sudo systemctl is-enabled foglamp
```

## 📦 Log Locations

```bash
# FogLAMP logs
/usr/local/foglamp/data/logs/

# View recent logs
tail -f /usr/local/foglamp/data/logs/foglamp.log
```

---

**Last Updated:** September 30, 2025
**FogLAMP Version:** 3.1.0

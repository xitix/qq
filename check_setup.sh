#!/bin/bash

echo "=========================================="
echo "Meteo MQTT Dashboard - Diagnostic"
echo "=========================================="
echo ""

# 1. Verifică sensors.db
echo "📊 Baza de date:"
if [ -f /root/sensors.db ]; then
    SIZE=$(ls -lh /root/sensors.db | awk '{print $5}')
    echo "✅ sensors.db există: $SIZE"
    TABLES=$(sqlite3 /root/sensors.db ".tables" 2>/dev/null)
    if [ -n "$TABLES" ]; then
        echo "✅ Tabele: $TABLES"
        COUNT=$(sqlite3 /root/sensors.db "SELECT COUNT(*) FROM sensor_readings;" 2>/dev/null)
        echo "✅ Citiri totale: $COUNT"
    else
        echo "❌ Nu s-au găsit tabele în DB"
    fi
else
    echo "❌ sensors.db NU există în /root/"
fi
echo ""

# 2. Verifică mqtt_logger.py
echo "📡 MQTT Logger:"
if pgrep -f "mqtt_logger.py" > /dev/null; then
    echo "✅ mqtt_logger.py rulează"
    PID=$(pgrep -f "mqtt_logger.py")
    echo "   PID: $PID"
else
    echo "❌ mqtt_logger.py NU rulează"
    echo "   Pornește cu: python3 /root/mqtt_logger.py &"
fi
echo ""

# 3. Verifică web_server.py
echo "🌐 Web Server:"
if pgrep -f "web_server.py" > /dev/null; then
    echo "✅ web_server.py rulează"
    PID=$(pgrep -f "web_server.py")
    echo "   PID: $PID"
    
    # Testează API
    echo ""
    echo "🔌 Test API:"
    STATUS=$(curl -s http://localhost:8080/api/status 2>/dev/null)
    if [ -n "$STATUS" ]; then
        echo "✅ API răspunde:"
        echo "   $STATUS" | jq . 2>/dev/null || echo "   $STATUS"
    else
        echo "❌ API nu răspunde la http://localhost:8080/api/status"
    fi
else
    echo "❌ web_server.py NU rulează"
    echo "   Pornește cu: python3 /root/web_server.py &"
fi
echo ""

# 4. Verifică dashboard
echo "📱 Dashboard:"
if [ -d /root/meteo-dashboard/dist ]; then
    echo "✅ Dashboard build există"
    if [ -f /root/meteo-dashboard/dist/index.html ]; then
        echo "✅ index.html există"
    else
        echo "❌ index.html lipsește"
    fi
else
    echo "❌ Dashboard build NU există"
    echo "   Rulează: cd /root/meteo-dashboard && npm run build"
fi
echo ""

# 5. Verifică Mosquitto
echo "📨 Mosquitto:"
if pgrep -f "mosquitto" > /dev/null; then
    echo "✅ Mosquitto rulează"
else
    echo "⚠️  Mosquitto nu pare să ruleze"
fi
echo ""

echo "=========================================="
echo "Accesează dashboard-ul la:"
echo "http://192.168.0.122:8080"
echo "=========================================="

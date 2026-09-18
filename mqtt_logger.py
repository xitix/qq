#!/usr/bin/env python3
"""
MQTT Logger pentru Meteo MQTT
Ascultă mesajele de la RTL_433 prin OMG și le scrie în sensors.db

Topic format:
    home/OMG_lilygo_rtl_433_ESP_OOK/RTL_433toMQTT/{model}/{subtype}/{id}

Exemplu payload:
{
  "model": "Fineoffset-WHx080",
  "subtype": 0,
  "id": 241,
  "battery_ok": 1,
  "temperature_C": 13.6,
  "humidity": 95,
  "wind_dir_deg": 135,
  "wind_avg_km_h": 0,
  "wind_max_km_h": 0,
  "rain_mm": 39.9,
  "mic": "CRC",
  "protocol": "Fine Offset Electronics WH1080/WH3080 Weather Station",
  "rssi": -64,
  "duration": 184000
}

Rulează ca serviciu systemd:
    sudo systemctl start mqtt_logger
    sudo systemctl enable mqtt_logger
"""

import paho.mqtt.client as mqtt
import sqlite3
import json
import os
import sys
from datetime import datetime
import time

# Configurare
MQTT_BROKER = 'localhost'  # sau IP-ul broker-ului MQTT
MQTT_PORT = 1883
MQTT_TOPIC = 'home/OMG_lilygo_rtl_433_ESP_OOK/RTL_433toMQTT/+'
DB_PATH = '/root/sensors.db'

def init_database():
    """Inițializează baza de date cu tabelele necesare"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Tabela pentru citirile senzorilor
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sensor_readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            model TEXT,
            device_id TEXT NOT NULL,
            temperature REAL,
            humidity REAL,
            wind_avg REAL,
            wind_max REAL,
            wind_dir REAL,
            rain REAL,
            battery TEXT,
            rssi INTEGER,
            protocol TEXT
        )
    ''')
    
    # Index pentru query-uri rapide
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_device_timestamp 
        ON sensor_readings(device_id, timestamp)
    ''')
    
    conn.commit()
    conn.close()
    print(f"✅ Database initialized: {DB_PATH}")

def save_reading(data):
    """Salvează o citire în baza de date"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        # Extrage datele din payload
        model = data.get('model', 'Unknown')
        device_id = str(data.get('id', 'unknown'))
        temperature = data.get('temperature_C')
        humidity = data.get('humidity')
        wind_avg = data.get('wind_avg_km_h')
        wind_max = data.get('wind_max_km_h')
        wind_dir = data.get('wind_dir_deg')
        rain = data.get('rain_mm')
        battery = 'ok' if data.get('battery_ok') == 1 else 'low'
        rssi = data.get('rssi')
        protocol = data.get('protocol')
        
        cursor.execute('''
            INSERT INTO sensor_readings 
            (timestamp, model, device_id, temperature, humidity, 
             wind_avg, wind_max, wind_dir, rain, battery, rssi, protocol)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (timestamp, model, device_id, temperature, humidity,
              wind_avg, wind_max, wind_dir, rain, battery, rssi, protocol))
        
        conn.commit()
        conn.close()
        
        print(f"✅ Saved: {model} ID:{device_id} T:{temperature}°C H:{humidity}% "
              f"Wind:{wind_avg}km/h Rain:{rain}mm @ {timestamp}")
        
    except Exception as e:
        print(f"❌ Error saving reading: {e}")

def on_connect(client, userdata, flags, rc):
    """Callback când se conectează la MQTT"""
    if rc == 0:
        print(f"✅ Connected to MQTT broker: {MQTT_BROKER}:{MQTT_PORT}")
        client.subscribe(MQTT_TOPIC)
        print(f"📡 Subscribed to: {MQTT_TOPIC}")
    else:
        print(f"❌ Connection failed with code: {rc}")

def on_message(client, userdata, msg):
    """Callback când primește un mesaj MQTT"""
    try:
        payload = json.loads(msg.payload.decode())
        print(f"\n📨 Received message on topic: {msg.topic}")
        print(f"   Payload: {json.dumps(payload, indent=2)}")
        
        # Salvează în baza de date
        save_reading(payload)
        
    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON: {e}")
    except Exception as e:
        print(f"❌ Error processing message: {e}")

def on_disconnect(client, userdata, rc):
    """Callback când se deconectează"""
    if rc != 0:
        print(f"⚠️ Unexpected disconnection (rc={rc}), reconnecting...")
        time.sleep(5)
        try:
            client.reconnect()
        except:
            pass

def main():
    """Funcția principală"""
    print("=" * 60)
    print("MQTT Logger for Meteo Dashboard")
    print("=" * 60)
    
    # Inițializează baza de date
    init_database()
    
    # Configurează clientul MQTT
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message
    client.on_disconnect = on_disconnect
    
    # Conectează la broker
    print(f"\n🔌 Connecting to MQTT broker: {MQTT_BROKER}:{MQTT_PORT}")
    try:
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
    except Exception as e:
        print(f"❌ Failed to connect: {e}")
        sys.exit(1)
    
    # Rulează bucla principală
    print("\n🚀 Starting MQTT listener...")
    try:
        client.loop_forever()
    except KeyboardInterrupt:
        print("\n\n👋 Shutting down...")
        client.disconnect()

if __name__ == '__main__':
    main()

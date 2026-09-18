#!/usr/bin/env python3
from flask import Flask, send_from_directory, jsonify, request
from flask_cors import CORS
import sqlite3
import os
import json
from datetime import datetime, timedelta

app = Flask(__name__, static_folder='dist', static_url_path='')
CORS(app)

DB_PATH = '/root/sensors.db'

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def parse_topic(topic):
    """Parse topic MQTT pentru a extrage model și ID senzor
    Format: home/OMG_lilygo_rtl_433_ESP_OOK/RTL_433toMQTT/{model}/{subtype}/{id}
    """
    try:
        parts = topic.split('/')
        if len(parts) >= 6:
            model = parts[3]  # Nexus-TH, Fineoffset-WHx080, etc.
            subtype = parts[4]  # 0, 1, etc.
            sensor_id = parts[5]  # 58, 241, etc.
            return model, subtype, sensor_id
    except:
        pass
    return None, None, None

def discover_sensors():
    """Descoperă toți senzorii unici din tabela readings"""
    if not os.path.exists(DB_PATH):
        return []
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Obține toate topic-urile unice
        cursor.execute("SELECT DISTINCT topic FROM readings")
        topics = [row[0] for row in cursor.fetchall()]
        
        sensors = {}
        
        for topic in topics:
            model, subtype, sensor_id = parse_topic(topic)
            if not model or not sensor_id:
                continue
            
            # Creează un key unic pentru senzor
            sensor_key = f"{model}_{sensor_id}"
            
            if sensor_key not in sensors:
                # Obține ultima citire pentru acest senzor
                cursor.execute(
                    "SELECT * FROM readings WHERE topic LIKE ? ORDER BY timestamp DESC LIMIT 1",
                    (f'%/{model}/%/{sensor_id}',)
                )
                last_row = cursor.fetchone()
                
                if last_row:
                    # Parse payload JSON
                    try:
                        payload = json.loads(last_row['payload'])
                    except:
                        payload = {}
                    
                    # Detectează metrics disponibile din payload
                    metrics = []
                    if 'temperature_C' in payload: metrics.append('temperature')
                    if 'humidity' in payload: metrics.append('humidity')
                    if 'rain_mm' in payload: metrics.append('rain')
                    if 'wind_avg_km_h' in payload: metrics.append('wind')
                    if 'battery_ok' in payload: metrics.append('battery')
                    
                    # Numără total citiri pentru acest senzor
                    cursor.execute(
                        "SELECT COUNT(*) as count FROM readings WHERE topic LIKE ?",
                        (f'%/{model}/%/{sensor_id}',)
                    )
                    total = cursor.fetchone()['count']
                    
                    sensors[sensor_key] = {
                        'id': sensor_key,
                        'device_id': sensor_id,
                        'name': f"{model} - ID {sensor_id}",
                        'model': model,
                        'subtype': subtype,
                        'last_update': last_row['timestamp'],
                        'total_readings': total,
                        'battery': 'ok' if payload.get('battery_ok') == 1 else 'low',
                        'metrics': metrics,
                        'rssi': payload.get('rssi'),
                        'protocol': payload.get('protocol'),
                    }
        
        conn.close()
        
        # Sortează după last_update (cei mai recenți primii)
        return sorted(sensors.values(), key=lambda x: x['last_update'], reverse=True)
    
    except Exception as e:
        print(f"Error discovering sensors: {e}")
        return []

def get_sensor_readings(sensor_id, hours=24):
    """Obține citirile pentru un senzor specific"""
    if not os.path.exists(DB_PATH):
        return []
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Parse sensor_id (format: model_deviceid)
        parts = sensor_id.rsplit('_', 1)
        if len(parts) != 2:
            return []
        
        model, device_id = parts
        
        # Calculează timestamp-ul de început
        cutoff = (datetime.now() - timedelta(hours=hours)).strftime('%Y-%m-%d %H:%M:%S')
        
        # Obține citirile
        cursor.execute(
            "SELECT timestamp, payload FROM readings WHERE topic LIKE ? AND timestamp >= ? ORDER BY timestamp ASC",
            (f'%/{model}/%/{device_id}', cutoff)
        )
        
        readings = []
        for row in cursor.fetchall():
            try:
                payload = json.loads(row['payload'])
                
                reading = {
                    'timestamp': row['timestamp'],
                }
                
                # Extrage câmpurile din payload
                if 'temperature_C' in payload:
                    reading['temperature'] = payload['temperature_C']
                if 'humidity' in payload:
                    reading['humidity'] = payload['humidity']
                if 'rain_mm' in payload:
                    reading['rain_mm'] = payload['rain_mm']
                if 'wind_avg_km_h' in payload:
                    reading['wind_avg_kmh'] = payload['wind_avg_km_h']
                if 'wind_max_km_h' in payload:
                    reading['wind_max_kmh'] = payload['wind_max_km_h']
                if 'wind_dir_deg' in payload:
                    reading['wind_dir_deg'] = payload['wind_dir_deg']
                if 'battery_ok' in payload:
                    reading['battery'] = 'ok' if payload['battery_ok'] == 1 else 'low'
                
                readings.append(reading)
            except:
                continue
        
        conn.close()
        return readings
    
    except Exception as e:
        print(f"Error getting readings: {e}")
        return []

@app.route('/api/status')
def api_status():
    if not os.path.exists(DB_PATH):
        return jsonify({'loaded': False, 'error': 'DB not found', 'tables': [], 'sensor_count': 0})
    
    sensors = discover_sensors()
    return jsonify({
        'loaded': True,
        'error': None,
        'tables': ['readings'],
        'sensor_count': len(sensors)
    })

@app.route('/api/sensors')
def api_sensors():
    sensors = discover_sensors()
    return jsonify({'sensors': sensors, 'count': len(sensors)})

@app.route('/api/all')
def api_all():
    sensors = discover_sensors()
    readings = {}
    for s in sensors:
        readings[s['id']] = get_sensor_readings(s['id'], 168)  # 7 zile
    return jsonify({'sensors': sensors, 'readings': readings})

@app.route('/api/sensor/<sensor_id>')
def api_sensor(sensor_id):
    hours = int(request.args.get('hours', 24))
    readings = get_sensor_readings(sensor_id, hours)
    return jsonify(readings)

@app.route('/')
def index():
    return send_from_directory('dist', 'index.html')

@app.route('/assets/<path:filename>')
def assets(filename):
    return send_from_directory('dist/assets', filename)

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('dist', path)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=False, threaded=True)

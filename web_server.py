#!/usr/bin/env python3
"""
Web Server pentru Meteo MQTT Dashboard
Servește dashboard-ul React și API pentru datele din sensors.db

Rulează pe Orange Pi Zero:
    python3 web_server.py

Accesează dashboard-ul la:
    http://192.168.0.122:8080
"""

from flask import Flask, send_from_directory, jsonify, send_file, request
from flask_cors import CORS
import sqlite3
import os
import json
from datetime import datetime, timedelta
from pathlib import Path

app = Flask(__name__, static_folder='meteo-dashboard/dist', static_url_path='')
CORS(app)  # Permite CORS pentru toate rutele

# Calea către baza de date
DB_PATH = '/root/sensors.db'
DASHBOARD_PATH = '/root/meteo-dashboard/dist'

def get_db_connection():
    """Creează conexiune la baza de date"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def discover_sensors():
    """Descoperă toți senzorii din baza de date cu detalii complete"""
    if not os.path.exists(DB_PATH):
        return []
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Obține tabelele
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        
        sensors = []
        
        for table in tables:
            # Verifică dacă tabela are coloanele necesare
            cursor.execute(f"PRAGMA table_info({table})")
            columns = [row[1] for row in cursor.fetchall()]
            
            # Caută coloane specifice
            id_col = None
            for col in columns:
                if col.lower() in ['id', 'device_id', 'sensor_id']:
                    id_col = col
                    break
            
            if not id_col:
                continue
            
            # Obține ID-urile unice ale senzorilor
            cursor.execute(f"SELECT DISTINCT {id_col} FROM {table}")
            sensor_ids = [row[0] for row in cursor.fetchall()]
            
            for sensor_id in sensor_ids:
                # Obține statistici complete
                cursor.execute(f"""
                    SELECT 
                        MIN(timestamp) as first_seen,
                        MAX(timestamp) as last_update,
                        COUNT(*) as total_readings,
                        AVG(temperature) as avg_temp,
                        AVG(humidity) as avg_humidity
                    FROM {table} 
                    WHERE {id_col} = ?
                """, (sensor_id,))
                stats = cursor.fetchone()
                
                # Obține ultima citire pentru detalii
                cursor.execute(f"""
                    SELECT * FROM {table} 
                    WHERE {id_col} = ? 
                    ORDER BY timestamp DESC 
                    LIMIT 1
                """, (sensor_id,))
                last_reading = cursor.fetchone()
                
                if last_reading:
                    # Detectează metrics disponibile
                    metrics = []
                    if 'temperature' in columns or 'temp' in columns:
                        metrics.append('temperature')
                    if 'humidity' in columns or 'humid' in columns:
                        metrics.append('humidity')
                    if 'rain' in columns:
                        metrics.append('rain')
                    if 'wind_avg' in columns or 'wind_speed' in columns:
                        metrics.append('wind')
                    if 'wind_dir' in columns:
                        metrics.append('wind_dir')
                    if 'battery' in columns:
                        metrics.append('battery')
                    
                    # Generează nume descriptiv
                    model = last_reading.get('model', 'Unknown')
                    device_name = f"{model} - ID {sensor_id}"
                    
                    sensors.append({
                        'id': f"{table}_{sensor_id}",
                        'device_id': str(sensor_id),
                        'name': device_name,
                        'model': model,
                        'table': table,
                        'first_seen': stats['first_seen'] if stats else '',
                        'last_update': stats['last_update'] if stats else '',
                        'total_readings': stats['total_readings'] if stats else 0,
                        'avg_temperature': round(stats['avg_temp'], 1) if stats and stats['avg_temp'] else None,
                        'avg_humidity': round(stats['avg_humidity'], 1) if stats and stats['avg_humidity'] else None,
                        'battery': last_reading.get('battery', 'ok'),
                        'metrics': metrics,
                        'rssi': last_reading.get('rssi'),
                        'protocol': last_reading.get('protocol'),
                    })
        
        conn.close()
        
        # Sortează după last_update (cei mai recenți primii)
        sensors.sort(key=lambda x: x['last_update'], reverse=True)
        
        return sensors
    except Exception as e:
        print(f"Error discovering sensors: {e}")
        return []

def get_sensor_readings(sensor_id, hours=24):
    """Obține citirile pentru un senzor"""
    if not os.path.exists(DB_PATH):
        return []
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Parsează sensor_id (format: table_sensorid)
        parts = sensor_id.split('_', 1)
        if len(parts) != 2:
            return []
        
        table, device_id = parts
        
        # Obține citirile din ultimele X ore
        cutoff = datetime.now() - timedelta(hours=hours)
        cutoff_str = cutoff.strftime('%Y-%m-%d %H:%M:%S')
        
        cursor.execute(f"""
            SELECT * FROM {table}
            WHERE id = ? AND timestamp >= ?
            ORDER BY timestamp ASC
        """, (device_id, cutoff_str))
        
        readings = []
        for row in cursor.fetchall():
            reading = {
                'timestamp': row['timestamp'],
            }
            
            # Adaugă câmpurile disponibile
            if 'temperature' in row.keys():
                reading['temperature'] = row['temperature']
            if 'humidity' in row.keys():
                reading['humidity'] = row['humidity']
            if 'rain' in row.keys():
                reading['rain_mm'] = row['rain']
            if 'wind_avg' in row.keys():
                reading['wind_avg_kmh'] = row['wind_avg']
            if 'wind_max' in row.keys():
                reading['wind_max_kmh'] = row['wind_max']
            if 'wind_dir' in row.keys():
                reading['wind_dir_deg'] = row['wind_dir']
            if 'battery' in row.keys():
                reading['battery'] = row['battery']
            
            readings.append(reading)
        
        conn.close()
        return readings
    except Exception as e:
        print(f"Error getting readings for {sensor_id}: {e}")
        return []

# ============ API ENDPOINTS ============

@app.route('/api/status')
def api_status():
    """Statusul API și al bazei de date"""
    if not os.path.exists(DB_PATH):
        return jsonify({
            'loaded': False,
            'error': 'Database not found',
            'tables': [],
            'sensor_count': 0,
        })
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Obține tabelele
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        
        # Numără senzorii
        sensors = discover_sensors()
        
        conn.close()
        
        return jsonify({
            'loaded': True,
            'error': None,
            'tables': tables,
            'sensor_count': len(sensors),
        })
    except Exception as e:
        return jsonify({
            'loaded': False,
            'error': str(e),
            'tables': [],
            'sensor_count': 0,
        })

@app.route('/api/sensors')
def api_sensors():
    """Lista completă a senzorilor disponibili în DB pentru selecție"""
    sensors = discover_sensors()
    return jsonify({
        'sensors': sensors,
        'count': len(sensors),
    })

@app.route('/api/all')
def api_all():
    """Toate datele: senzori + readings"""
    sensors = discover_sensors()
    
    readings = {}
    for sensor in sensors:
        sensor_readings = get_sensor_readings(sensor['id'], hours=168)  # 7 zile
        readings[sensor['id']] = sensor_readings
    
    return jsonify({
        'sensors': sensors,
        'readings': readings,
    })

@app.route('/api/latest')
def api_latest():
    """Ultimele citiri pentru fiecare senzor"""
    sensors = discover_sensors()
    
    latest = {}
    for sensor in sensors:
        sensor_readings = get_sensor_readings(sensor['id'], hours=1)
        if sensor_readings:
            latest[sensor['id']] = sensor_readings[-1]
    
    return jsonify(latest)

@app.route('/api/sensor/<sensor_id>')
def api_sensor(sensor_id):
    """Istoricul pentru un senzor specific"""
    hours = int(request.args.get('hours', 24))
    readings = get_sensor_readings(sensor_id, hours)
    return jsonify(readings)

# ============ SERVE DASHBOARD ============

@app.route('/')
def index():
    """Servește dashboard-ul"""
    return send_from_directory(DASHBOARD_PATH, 'index.html')

@app.route('/assets/<path:filename>')
def assets(filename):
    """Servește fișierele statice ale dashboard-ului"""
    return send_from_directory(os.path.join(DASHBOARD_PATH, 'assets'), filename)

@app.route('/<path:path>')
def static_files(path):
    """Servește alte fișiere statice"""
    return send_from_directory(DASHBOARD_PATH, path)

if __name__ == '__main__':
    print("=" * 60)
    print("Meteo MQTT Dashboard Server")
    print("=" * 60)
    print(f"Dashboard: http://0.0.0.0:8080")
    print(f"Database: {DB_PATH}")
    print(f"DB exists: {os.path.exists(DB_PATH)}")
    print("=" * 60)
    
    app.run(
        host='0.0.0.0',
        port=8080,
        debug=False,
        threaded=True
    )

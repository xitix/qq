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
CORRECTIONS_PATH = '/root/meteo-dashboard/sensor_corrections.json'

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def load_corrections():
    """Încarcă corecțiile per senzor din fișierul JSON"""
    if os.path.exists(CORRECTIONS_PATH):
        try:
            with open(CORRECTIONS_PATH, 'r') as f:
                return json.load(f)
        except:
            pass
    return {}

def save_corrections(corrections):
    """Salvează corecțiile în fișierul JSON"""
    with open(CORRECTIONS_PATH, 'w') as f:
        json.dump(corrections, f, indent=2)

def parse_topic(topic):
    parts = topic.split('/')
    if len(parts) >= 6:
        return parts[3], parts[4], parts[5]
    return None, None, None

def apply_rain_correction(sensor_id, raw_rain_mm, corrections):
    """
    Aplică corecția pentru ploaie.
    
    Logica:
    - offset = valoarea eronată de bază (ex: 39.9)
    - Dacă raw >= offset → delta = raw - offset (ploaie nouă)
    - Dacă raw < offset → senzorul a fost resetat → noul offset = raw, delta = 0
    - Dacă raw == offset → delta = 0 (fără ploaie nouă)
    
    Returnează (delta, new_offset)
    """
    correction = corrections.get(sensor_id, {})
    offset = correction.get('rain_offset', None)
    
    if offset is None or raw_rain_mm is None:
        return raw_rain_mm, offset
    
    if raw_rain_mm >= offset:
        # Valoare normală - calculează delta
        delta = round(raw_rain_mm - offset, 1)
        return delta, offset
    else:
        # Senzorul a fost resetat (valoarea a scăzut sub offset)
        # Noul offset devine valoarea curentă
        new_offset = raw_rain_mm
        # Actualizează offset-ul în corecții
        if sensor_id not in corrections:
            corrections[sensor_id] = {}
        corrections[sensor_id]['rain_offset'] = new_offset
        save_corrections(corrections)
        print(f"🔄 Rain sensor reset detected for {sensor_id}: new offset = {new_offset}")
        return 0, new_offset

def discover_sensors():
    if not os.path.exists(DB_PATH):
        return []
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT DISTINCT topic FROM readings")
        topics = [row[0] for row in cursor.fetchall()]
        sensors = {}
        for topic in topics:
            model, subtype, sensor_id = parse_topic(topic)
            if not model or not sensor_id:
                continue
            sensor_key = f"{model}_{sensor_id}"
            if sensor_key not in sensors:
                cursor.execute(
                    "SELECT * FROM readings WHERE topic LIKE ? ORDER BY timestamp DESC LIMIT 1",
                    (f'%/{model}/%/{sensor_id}',)
                )
                last_row = cursor.fetchone()
                if last_row:
                    try:
                        payload = json.loads(last_row['payload'])
                    except:
                        payload = {}
                    metrics = []
                    if 'temperature_C' in payload: metrics.append('temperature')
                    if 'humidity' in payload: metrics.append('humidity')
                    if 'pressure_hPa' in payload or 'pressure' in payload: metrics.append('pressure')
                    if 'rain_mm' in payload: metrics.append('rain')
                    if 'wind_avg_km_h' in payload: metrics.append('wind')
                    if 'battery_ok' in payload: metrics.append('battery')
                    cursor.execute(
                        "SELECT COUNT(*) as count FROM readings WHERE topic LIKE ?",
                        (f'%/{model}/%/{sensor_id}',)
                    )
                    total = cursor.fetchone()['count']
                    
                    # Încarcă corecțiile pentru acest senzor
                    corrections = load_corrections()
                    correction_info = corrections.get(sensor_key, {})
                    
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
                        'corrections': correction_info,
                    }
        conn.close()
        return sorted(sensors.values(), key=lambda x: x['last_update'], reverse=True)
    except Exception as e:
        print(f"Error: {e}")
        return []

def get_sensor_readings(sensor_id, hours=24):
    if not os.path.exists(DB_PATH):
        return []
    try:
        conn = get_db()
        cursor = conn.cursor()
        parts = sensor_id.rsplit('_', 1)
        if len(parts) != 2:
            return []
        model, device_id = parts
        cutoff = (datetime.now() - timedelta(hours=hours)).strftime('%Y-%m-%d %H:%M:%S')
        cursor.execute(
            "SELECT timestamp, payload FROM readings WHERE topic LIKE ? AND timestamp >= ? ORDER BY timestamp ASC",
            (f'%/{model}/%/{device_id}', cutoff)
        )
        
        corrections = load_corrections()
        rain_offset = corrections.get(sensor_id, {}).get('rain_offset', None)
        
        readings = []
        for row in cursor.fetchall():
            try:
                payload = json.loads(row['payload'])
                reading = {'timestamp': row['timestamp']}
                
                # Temperatură
                if 'temperature_C' in payload:
                    temp = payload['temperature_C']
                    # Validare: temperatură rezonabilă (-50°C la +60°C)
                    if -50 <= temp <= 60:
                        reading['temperature'] = temp
                    else:
                        reading['temperature'] = temp
                        reading['temperature_warning'] = 'value_out_of_range'
                
                # Umiditate
                if 'humidity' in payload:
                    hum = payload['humidity']
                    # Validare: umiditate rezonabilă (0% la 100%)
                    if 0 <= hum <= 100:
                        # Verifică dacă e o valoare suspectă (prea mică pentru interior/exterior)
                        if hum < 15:
                            reading['humidity'] = hum
                            reading['humidity_warning'] = 'suspiciously_low'
                        else:
                            reading['humidity'] = hum
                    else:
                        reading['humidity'] = hum
                        reading['humidity_warning'] = 'value_out_of_range'
                
                # Presiune (pentru BMP280)
                if 'pressure_hPa' in payload:
                    reading['pressure_hpa'] = payload['pressure_hPa']
                elif 'pressure' in payload:
                    reading['pressure_hpa'] = payload['pressure']
                
                # Aplică corecția pentru ploaie
                if 'rain_mm' in payload:
                    raw_rain = payload['rain_mm']
                    if rain_offset is not None:
                        corrected, rain_offset = apply_rain_correction(sensor_id, raw_rain, corrections)
                        reading['rain_mm'] = corrected
                        reading['rain_raw'] = raw_rain  # păstrează și valoarea brută pentru debug
                    else:
                        reading['rain_mm'] = raw_rain
                
                if 'wind_avg_km_h' in payload: reading['wind_avg_kmh'] = payload['wind_avg_km_h']
                if 'wind_max_km_h' in payload: reading['wind_max_kmh'] = payload['wind_max_km_h']
                if 'wind_dir_deg' in payload: reading['wind_dir_deg'] = payload['wind_dir_deg']
                if 'battery_ok' in payload: reading['battery'] = 'ok' if payload['battery_ok'] == 1 else 'low'
                readings.append(reading)
            except:
                continue
        conn.close()
        return readings
    except Exception as e:
        print(f"Error: {e}")
        return []

@app.route('/api/status')
def api_status():
    if not os.path.exists(DB_PATH):
        return jsonify({'loaded': False, 'error': 'DB not found', 'tables': [], 'sensor_count': 0})
    sensors = discover_sensors()
    return jsonify({'loaded': True, 'error': None, 'tables': ['readings'], 'sensor_count': len(sensors)})

@app.route('/api/sensors')
def api_sensors():
    sensors = discover_sensors()
    return jsonify({'sensors': sensors, 'count': len(sensors)})

@app.route('/api/all')
def api_all():
    sensors = discover_sensors()
    readings = {}
    for s in sensors:
        readings[s['id']] = get_sensor_readings(s['id'], 168)
    return jsonify({'sensors': sensors, 'readings': readings})

@app.route('/api/sensor/<sensor_id>')
def api_sensor(sensor_id):
    hours = int(request.args.get('hours', 24))
    readings = get_sensor_readings(sensor_id, hours)
    return jsonify(readings)

# ===== Endpoint-uri pentru gestionarea corecțiilor =====

@app.route('/api/corrections', methods=['GET'])
def get_corrections():
    """Returnează toate corecțiile configurate"""
    corrections = load_corrections()
    return jsonify(corrections)

@app.route('/api/corrections/<sensor_id>/rain_offset', methods=['POST'])
def set_rain_offset(sensor_id):
    """
    Setează offset-ul pentru ploaie al unui senzor.
    
    Body JSON: {"offset": 39.9}
    
    Logica:
    - Toate valorile viitoare vor fi afișate ca delta = raw - offset
    - Dacă raw < offset (senzor resetat), offset-ul se actualizează automat
    """
    data = request.get_json()
    if not data or 'offset' not in data:
        return jsonify({'error': 'Missing "offset" field'}), 400
    
    offset = float(data['offset'])
    corrections = load_corrections()
    
    if sensor_id not in corrections:
        corrections[sensor_id] = {}
    
    corrections[sensor_id]['rain_offset'] = offset
    corrections[sensor_id]['rain_offset_set_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    save_corrections(corrections)
    
    return jsonify({
        'sensor_id': sensor_id,
        'rain_offset': offset,
        'message': f'Rain offset set to {offset} for {sensor_id}. Values will be shown as delta.'
    })

@app.route('/api/corrections/<sensor_id>/rain_offset', methods=['DELETE'])
def clear_rain_offset(sensor_id):
    """Șterge offset-ul pentru ploaie (revino la valorile brute)"""
    corrections = load_corrections()
    if sensor_id in corrections and 'rain_offset' in corrections[sensor_id]:
        del corrections[sensor_id]['rain_offset']
        if 'rain_offset_set_at' in corrections[sensor_id]:
            del corrections[sensor_id]['rain_offset_set_at']
        if not corrections[sensor_id]:
            del corrections[sensor_id]
        save_corrections(corrections)
    return jsonify({'message': f'Rain offset cleared for {sensor_id}'})

@app.route('/api/corrections/<sensor_id>/rain_offset/auto', methods=['POST'])
def auto_set_rain_offset(sensor_id):
    """
    Auto-detectează offset-ul din ultima valoare raportată.
    Util când știi că ultima valoare e eronată.
    """
    if not os.path.exists(DB_PATH):
        return jsonify({'error': 'DB not found'}), 404
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        parts = sensor_id.rsplit('_', 1)
        if len(parts) != 2:
            return jsonify({'error': 'Invalid sensor_id format'}), 400
        model, device_id = parts
        
        cursor.execute(
            "SELECT payload FROM readings WHERE topic LIKE ? ORDER BY timestamp DESC LIMIT 1",
            (f'%/{model}/%/{device_id}',)
        )
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return jsonify({'error': 'No readings found'}), 404
        
        payload = json.loads(row['payload'])
        if 'rain_mm' not in payload:
            return jsonify({'error': 'Sensor does not report rain'}), 400
        
        offset = payload['rain_mm']
        corrections = load_corrections()
        if sensor_id not in corrections:
            corrections[sensor_id] = {}
        corrections[sensor_id]['rain_offset'] = offset
        corrections[sensor_id]['rain_offset_set_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        save_corrections(corrections)
        
        return jsonify({
            'sensor_id': sensor_id,
            'rain_offset': offset,
            'message': f'Auto-detected rain offset: {offset} (from last reading)'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

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

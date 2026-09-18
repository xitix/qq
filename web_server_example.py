#!/usr/bin/env python3
"""
Web server pentru Meteo MQTT Dashboard
Servește dashboard-ul React și sensors.db

Instalare:
    pip3 install flask

Utilizare:
    python3 web_server.py
    
Sau integrare în web_server.py existent - adaugă ruta /sensors.db
"""

from flask import Flask, send_from_directory, send_file, jsonify
import os
import sqlite3
from datetime import datetime

app = Flask(__name__, static_folder='meteo-dashboard/dist', static_url_path='')

# Calea către baza de date
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sensors.db')

# Ruta principală - servește dashboard-ul
@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

# Servește sensors.db pentru dashboard
@app.route('/sensors.db')
def serve_db():
    """
    Servește sensors.db ca fișier static.
    Dashboard-ul va face fetch la această rută.
    """
    if os.path.exists(DB_PATH):
        response = send_file(
            DB_PATH,
            mimetype='application/octet-stream',
            as_attachment=False
        )
        # Permite CORS dacă e necesar
        response.headers['Access-Control-Allow-Origin'] = '*'
        return response
    else:
        return jsonify({'error': 'Database not found'}), 404

# API opțional: returnează informații despre DB
@app.route('/api/db-info')
def db_info():
    """
    Returnează informații despre baza de date.
    Util pentru debugging.
    """
    if not os.path.exists(DB_PATH):
        return jsonify({'error': 'Database not found'}), 404
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Obține tabelele
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        
        # Obține dimensiunea fișierului
        size = os.path.getsize(DB_PATH)
        
        # Obține ultima modificare
        mtime = os.path.getmtime(DB_PATH)
        last_modified = datetime.fromtimestamp(mtime).isoformat()
        
        conn.close()
        
        return jsonify({
            'tables': tables,
            'size_bytes': size,
            'size_mb': round(size / 1024 / 1024, 2),
            'last_modified': last_modified,
            'path': DB_PATH
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# API opțional: returnează datele ultimilor senzori
@app.route('/api/latest')
def latest_readings():
    """
    Returnează ultimele citiri pentru fiecare senzor.
    Util pentru actualizări rapide fără a reîncărca tot DB.
    """
    if not os.path.exists(DB_PATH):
        return jsonify({'error': 'Database not found'}), 404
    
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Obține tabelele
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        
        results = {}
        
        for table in tables:
            try:
                # Încearcă să obții ultimele citiri
                # Presupunem că există o coloană timestamp/time
                cursor.execute(f"""
                    SELECT * FROM {table} 
                    ORDER BY rowid DESC 
                    LIMIT 10
                """)
                rows = cursor.fetchall()
                if rows:
                    results[table] = [dict(row) for row in rows]
            except:
                continue
        
        conn.close()
        return jsonify(results)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Servește fișierele statice ale dashboard-ului
@app.route('/assets/<path:filename>')
def assets(filename):
    return send_from_directory(
        os.path.join(app.static_folder, 'assets'),
        filename
    )

# Catch-all pentru alte rute
@app.route('/<path:path>')
def static_files(path):
    return send_from_directory(app.static_folder, path)

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

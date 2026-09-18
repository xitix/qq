# Configurare pentru Orange Pi Zero

## Structura proiectului pe server

```
/root/
├── meteo-dashboard/          ← Dashboard React (acest proiect)
│   ├── dist/                 ← Build-ul pentru producție
│   └── ...
├── sensors.db                ← Baza de date SQLite
├── mqtt_logger.py            ← Scrie date MQTT în sensors.db
├── web_server.py             ← Server web (trebuie modificat)
└── ...
```

## Pasul 1: Modifică `web_server.py`

Adaugă suport pentru servirea `sensors.db` ca fișier static.

### Exemplu pentru Flask:

```python
from flask import Flask, send_from_directory, send_file
import os

app = Flask(__name__, static_folder='meteo-dashboard/dist')

# Servește dashboard-ul
@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

# Servește fișierele statice ale dashboard-ului
@app.route('/assets/<path:filename>')
def assets(filename):
    return send_from_directory(os.path.join(app.static_folder, 'assets'), filename)

# IMPORTANT: Servește sensors.db pentru dashboard
@app.route('/sensors.db')
def serve_db():
    db_path = os.path.join(os.path.dirname(__file__), 'sensors.db')
    if os.path.exists(db_path):
        return send_file(db_path, mimetype='application/octet-stream')
    return 'Database not found', 404

# Servește alte fișiere statice dacă e nevoie
@app.route('/<path:path>')
def static_files(path):
    return send_from_directory(app.static_folder, path)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=False)
```

### Exemplu pentru Python simplu (http.server):

```python
import http.server
import socketserver
import os

PORT = 8080
DIRECTORY = "meteo-dashboard/dist"
DB_PATH = "sensors.db"

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def do_GET(self):
        # Servește sensors.db la cerere
        if self.path == '/sensors.db':
            if os.path.exists(DB_PATH):
                self.send_response(200)
                self.send_header('Content-type', 'application/octet-stream')
                self.send_header('Content-Length', str(os.path.getsize(DB_PATH)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                with open(DB_PATH, 'rb') as f:
                    self.wfile.write(f.read())
            else:
                self.send_error(404, 'Database not found')
        else:
            super().do_GET()

with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
    print(f"Serving at port {PORT}")
    httpd.serve_forever()
```

## Pasul 2: Copiază build-ul dashboard-ului

```bash
# În folderul meteo-dashboard
cd ~/meteo-dashboard
npm run build

# Copiază dist/ în locația corectă (dacă e nevoie)
# De obicei web_server.py servește direct din dist/
```

## Pasul 3: Configurează polling automat

Dashboard-ul va reîncărca automat `sensors.db` la fiecare 30 de secunde pentru a prelua datele noi de la MQTT.

## Testare

1. Pornește `mqtt_logger.py` (dacă nu rulează deja)
2. Pornește `web_server.py`
3. Deschide browser-ul la `http://192.168.0.122:8080`
4. Statusul ar trebui să arate "🟢 DB Conectat"
5. Datele se vor actualiza automat la fiecare 30 de secunde

## Troubleshooting

### Dashboard nu găsește sensors.db
- Verifică că `web_server.py` servește corect `/sensors.db`
- Testează în browser: `http://192.168.0.122:8080/sensors.db` (ar trebui să descarce fișierul)
- Verifică permisiunile: `chmod 644 sensors.db`

### CORS errors
- Asigură-te că `web_server.py` trimite header-ul `Access-Control-Allow-Origin: *`
- Sau servește dashboard-ul de pe același server (recomandat)

### Datele nu se actualizează
- Verifică că `mqtt_logger.py` rulează și scrie în `sensors.db`
- Verifică logs: `tail -f mqtt.log`
- Reîncarcă pagina manual sau așteaptă polling-ul automat (30s)

## Structura bazei de date

Dashboard-ul detectează automat tabelele cu coloane specifice:
- `timestamp` / `time` / `date` (obligatoriu)
- `temperature` / `temp`
- `humidity` / `humid`
- `rain` / `rain_mm`
- `wind_avg` / `wind_speed`
- `wind_max` / `wind_gust`
- `wind_dir` / `direction`
- `battery` / `batt`
- `sensor_id` / `device_id` / `id` (pentru multi-senzor)

## Optimizare

Pentru performanță mai bună:
- Limitează dimensiunea `sensors.db` la < 50 MB
- Șterge datele vechi periodic:
  ```sql
  DELETE FROM readings WHERE timestamp < datetime('now', '-30 days');
  ```
- Adaugă index pe coloana `timestamp` pentru query-uri rapide

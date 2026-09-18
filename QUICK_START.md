# Ghid Rapid - Configurare pe Orange Pi Zero

## Ce ai deja pe server:
```
/root/
├── meteo-dashboard/          ← Dashboard React
├── sensors.db                ← Baza de date (scrisă de mqtt_logger.py)
├── mqtt_logger.py            ← Scrie date MQTT → DB
├── web_server.py             ← Server web (trebuie modificat)
└── ...
```

## Ce trebuie să faci:

### 1. Modifică `web_server.py` pentru a servi `sensors.db`

Deschide `web_server.py` și **adaugă** această rută:

```python
@app.route('/sensors.db')
def serve_db():
    db_path = '/root/sensors.db'  # sau calea corectă
    if os.path.exists(db_path):
        return send_file(db_path, mimetype='application/octet-stream')
    return 'Database not found', 404
```

**Nu uita** să imporți `send_file` și `os`:
```python
from flask import Flask, send_file
import os
```

### 2. Testează că DB este accesibil

```bash
# Pornește web_server.py
python3 web_server.py

# În alt terminal, testează:
curl -I http://localhost:8080/sensors.db
```

Ar trebui să vezi `HTTP/1.0 200 OK`

### 3. Deschide dashboard-ul

```
http://192.168.0.122:8080
```

Statusul ar trebui să arate: **🟢 DB Conectat** cu numărul de tabele.

### 4. Verifică că datele se actualizează

Dashboard-ul reîncarcă automat `sensors.db` la fiecare **30 de secunde**.

Vei vedea în header:
```
🟢 DB Conectat • X tabele • Actualizat: 22:30:15
```

---

## Exemplu complet `web_server.py`

Dacă vrei să înlocuiești complet `web_server.py`, folosește `web_server_example.py`:

```bash
# Backup la vechiul web_server.py
cp web_server.py web_server.py.backup

# Copiază exemplul
cp ~/meteo-dashboard/web_server_example.py web_server.py

# Pornește serverul
python3 web_server.py
```

---

## Verificare rapidă

```bash
# 1. Verifică că mqtt_logger.py rulează
ps aux | grep mqtt_logger

# 2. Verifică că sensors.db se actualizează
ls -lh sensors.db
# Ar trebui să vezi că se modifică la fiecare few seconds/minutes

# 3. Verifică că web_server.py servește DB
curl http://localhost:8080/sensors.db -o /tmp/test.db
ls -lh /tmp/test.db
# Ar trebui să aibă aceeași dimensiune ca sensors.db

# 4. Verifică conținutul DB
sqlite3 sensors.db ".tables"
sqlite3 sensors.db "SELECT COUNT(*) FROM readings;"
```

---

## Troubleshooting

### "DB Conectat" nu apare
- Verifică că `web_server.py` servește `/sensors.db`
- Testează: `curl http://192.168.0.122:8080/sensors.db`
- Verifică permisiunile: `chmod 644 sensors.db`

### Datele nu se actualizează
- Verifică că `mqtt_logger.py` rulează
- Verifică logs: `tail -f mqtt.log`
- Reîncarcă pagina manual (Ctrl+Shift+R)

### Dashboard arată "Mod Demo"
- Înseamnă că `sensors.db` nu este găsit
- Verifică calea în `web_server.py`
- Asigură-te că fișierul există: `ls -lh /root/sensors.db`

### CORS errors în browser
- Asigură-te că dashboard-ul și DB sunt servite de pe același server
- Sau adaugă header CORS în `web_server.py`:
  ```python
  response.headers['Access-Control-Allow-Origin'] = '*'
  ```

---

## Optimizare

### Reduce dimensiunea DB
```bash
# Șterge date mai vechi de 30 de zile
sqlite3 sensors.db "DELETE FROM readings WHERE timestamp < datetime('now', '-30 days');"

# Compactează DB
sqlite3 sensors.db "VACUUM;"
```

### Cron job pentru curățare
```bash
# Editează crontab
crontab -e

# Adaugă (rulează la fiecare zi la 3 AM)
0 3 * * * sqlite3 /root/sensors.db "DELETE FROM readings WHERE timestamp < datetime('now', '-30 days');" && sqlite3 /root/sensors.db "VACUUM;"
```

---

## Structura așteptată a bazei de date

Dashboard-ul detectează automat tabelele cu aceste coloane:

**Obligatoriu:**
- `timestamp` / `time` / `date`

**Opțional (detectate automat):**
- `temperature` / `temp`
- `humidity` / `humid`
- `rain` / `rain_mm`
- `wind_avg` / `wind_speed`
- `wind_max` / `wind_gust`
- `wind_dir` / `direction`
- `battery` / `batt`
- `sensor_id` / `device_id` / `id`

---

## Succes! 🎉

După configurare, vei avea:
- ✅ Dashboard accesibil la `http://192.168.0.122:8080`
- ✅ Date actualizate automat la fiecare 30 de secunde
- ✅ Grafice interactive pentru toți senzorii
- ✅ Fără nevoie de refresh manual

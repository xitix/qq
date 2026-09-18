# Instrucțiuni pentru Orange Pi

## Problema
Dashboard-ul cere endpoint-uri API care nu există în `api_server.py`:
- `/api/status` → 404
- `/api/sensors` → 404  
- `/api/all` → 404

## Soluția

### 1. Backup la api_server.py existent
```bash
cp /root/meteo-dashboard/api_server.py /root/meteo-dashboard/api_server.py.backup
```

### 2. Înlocuiește cu web_server.py
```bash
cp /root/meteo-dashboard/web_server.py /root/meteo-dashboard/api_server.py
```

### 3. Verifică căile în api_server.py
Deschide `/root/meteo-dashboard/api_server.py` și asigură-te că:
```python
DB_PATH = '/root/sensors.db'
DASHBOARD_PATH = '/root/meteo-dashboard/dist'
```

### 4. Repornește serviciul
```bash
sudo systemctl restart meteo-api.service
```

### 5. Verifică că funcționează
```bash
# Verifică status
sudo systemctl status meteo-api.service

# Testează API
curl http://localhost:8080/api/status

# Ar trebui să vezi JSON cu:
# {
#   "loaded": true,
#   "tables": ["sensor_readings"],
#   "sensor_count": 2
# }
```

### 6. Reîncarcă dashboard-ul
Deschide `http://192.168.0.122:8080` și ar trebui să vezi:
- 🟢 DB Conectat
- Lista de senzori din dropdown
- Datele reale din sensors.db

## Dacă nu funcționează

Verifică logs:
```bash
sudo journalctl -u meteo-api.service -f
```

Vezi erorile și trimite-le pentru debugging.

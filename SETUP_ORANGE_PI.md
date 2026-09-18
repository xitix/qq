# Meteo MQTT Dashboard - Setup pe Orange Pi Zero

## Arhitectura Corectă

```
┌─────────────────────────────────────────────────────────────┐
│                    Orange Pi Zero (192.168.0.122)           │
│                                                              │
│  ┌──────────────┐      ┌──────────────┐      ┌───────────┐ │
│  │ OMG Gateway  │─────▶│ Mosquitto    │─────▶│mqtt_logger│ │
│  │ 192.168.0.28 │ MQTT │   MQTT       │      │   .py     │ │
│  │ RTL_433      │      │  Broker      │      └─────┬─────┘ │
│  └──────────────┘      └──────────────┘            │       │
│                                                     ▼       │
│                                              ┌───────────┐ │
│                                              │sensors.db │ │
│                                              │  SQLite   │ │
│                                              └─────┬─────┘ │
│                                                    │       │
│                                                    ▼       │
│                                              ┌───────────┐ │
│                                              │web_server │ │
│                                              │   .py     │ │
│                                              │  :8080    │ │
│                                              └─────┬─────┘ │
└────────────────────────────────────────────────────┼────────┘
                                                     │
                                                     │ HTTP/JSON
                                                     ▼
                                              ┌─────────────┐
                                              │  Browser    │
                                              │  Dashboard  │
                                              └─────────────┘
```

## Fluxul Datelor

1. **OMG Gateway** (LilyGo ESP32 cu RTL_433) citește senzorii și publică pe MQTT
2. **Mosquitto** primește mesajele
3. **mqtt_logger.py** ascultă MQTT și scrie în `sensors.db`
4. **web_server.py** servește dashboard-ul + API JSON din `sensors.db`
5. **Browser** accesează dashboard-ul și face polling la API la fiecare 30s

## Instalare

### 1. Clonează/Descarcă dashboard-ul pe Orange Pi

```bash
cd /root
git clone <repo-url> meteo-dashboard
cd meteo-dashboard
npm install
npm run build
```

### 2. Instalează dependențele Python

```bash
pip3 install flask flask-cors paho-mqtt
```

### 3. Configurează mqtt_logger.py

Editează `/root/mqtt_logger.py` și ajustează:

```python
MQTT_BROKER = 'localhost'  # sau IP-ul broker-ului MQTT
MQTT_PORT = 1883
MQTT_TOPIC = 'home/OMG_lilygo_rtl_433_ESP_OOK/RTL_433toMQTT/+'
DB_PATH = '/root/sensors.db'
```

### 4. Configurează web_server.py

Editează `/root/web_server.py` și ajustează căile:

```python
DB_PATH = '/root/sensors.db'
DASHBOARD_PATH = '/root/meteo-dashboard/dist'
```

### 5. Pornește serviciile

```bash
# mqtt_logger.py (scrie datele în DB)
python3 /root/mqtt_logger.py &

# web_server.py (servește dashboard + API)
python3 /root/web_server.py &
```

### 6. Configurează ca servicii systemd (opțional, recomandat)

Creează `/etc/systemd/system/mqtt-logger.service`:

```ini
[Unit]
Description=MQTT Logger for Meteo Dashboard
After=network.target mosquitto.service

[Service]
Type=simple
User=root
WorkingDirectory=/root
ExecStart=/usr/bin/python3 /root/mqtt_logger.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Creează `/etc/systemd/system/meteo-web.service`:

```ini
[Unit]
Description=Meteo MQTT Dashboard Web Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root
ExecStart=/usr/bin/python3 /root/web_server.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Activează serviciile:

```bash
sudo systemctl daemon-reload
sudo systemctl enable mqtt-logger
sudo systemctl enable meteo-web
sudo systemctl start mqtt-logger
sudo systemctl start meteo-web
```

## Verificare

```bash
# Verifică că mqtt_logger rulează
sudo systemctl status mqtt-logger

# Verifică că web_server rulează
sudo systemctl status meteo-web

# Verifică logs
sudo journalctl -u mqtt-logger -f
sudo journalctl -u meteo-web -f

# Testează API
curl http://localhost:8080/api/status
curl http://localhost:8080/api/all
```

## Acces Dashboard

Deschide browser-ul la:
```
http://192.168.0.122:8080
```

Dashboard-ul va:
1. Se conecta la API-ul de pe Orange Pi
2. Descoperi automat senzorii din `sensors.db`
3. Afișa datele în timp real
4. Actualiza automat la fiecare 30 de secunde

## API Endpoints

| Endpoint | Descriere |
|----------|-----------|
| `GET /api/status` | Status DB + număr senzori |
| `GET /api/all` | Toți senzorii + toate readings (7 zile) |
| `GET /api/latest` | Ultima citire pentru fiecare senzor |
| `GET /api/sensor/{id}?hours=24` | Istoric pentru un senzor |

## Structura Bazei de Date

Tabela `sensor_readings`:

| Coloană | Tip | Descriere |
|---------|-----|-----------|
| id | INTEGER | Primary key |
| timestamp | TEXT | Data/ora citirii |
| model | TEXT | Model senzor (ex: Fineoffset-WHx080) |
| device_id | TEXT | ID dispozitiv (ex: 241) |
| temperature | REAL | Temperatură (°C) |
| humidity | REAL | Umiditate (%) |
| wind_avg | REAL | Vânt mediu (km/h) |
| wind_max | REAL | Vânt maxim (km/h) |
| wind_dir | REAL | Direcție vânt (grade) |
| rain | REAL | Ploaie (mm) |
| battery | TEXT | Status baterie (ok/low) |
| rssi | INTEGER | Putere semnal |
| protocol | TEXT | Protocol RTL_433 |

## Topic MQTT

Format: `home/OMG_lilygo_rtl_433_ESP_OOK/RTL_433toMQTT/{model}/{subtype}/{id}`

Exemplu payload:
```json
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
  "rssi": -64,
  "protocol": "Fine Offset Electronics WH1080/WH3080 Weather Station"
}
```

## Troubleshooting

### Dashboard arată "Mod Demo"
- Verifică că `web_server.py` rulează: `sudo systemctl status meteo-web`
- Testează API: `curl http://localhost:8080/api/status`
- Verifică logs: `sudo journalctl -u meteo-web -f`

### Nu apar date noi
- Verifică că `mqtt_logger.py` rulează: `sudo systemctl status mqtt-logger`
- Verifică că Mosquitto rulează: `sudo systemctl status mosquitto`
- Verifică logs mqtt_logger: `sudo journalctl -u mqtt-logger -f`
- Testează manual: `mosquitto_sub -v -t 'home/OMG_lilygo_rtl_433_ESP_OOK/RTL_433toMQTT/+'`

### DB nu se actualizează
- Verifică permisiuni: `ls -la /root/sensors.db`
- Verifică că mqtt_logger poate scrie: `chmod 666 /root/sensors.db`

### Dashboard nu se încarcă
- Verifică că `dist/` există: `ls /root/meteo-dashboard/dist/`
- Verifică că web_server servește corect: `curl http://localhost:8080/`

## Mentenanță

### Curățare date vechi

```bash
# Șterge date mai vechi de 30 zile
sqlite3 /root/sensors.db "DELETE FROM sensor_readings WHERE timestamp < datetime('now', '-30 days');"

# Compactează DB
sqlite3 /root/sensors.db "VACUUM;"
```

### Cron job automat

```bash
crontab -e
# Adaugă (rulează zilnic la 3 AM):
0 3 * * * sqlite3 /root/sensors.db "DELETE FROM sensor_readings WHERE timestamp < datetime('now', '-30 days');" && sqlite3 /root/sensors.db "VACUUM;"
```

## Succes! 🎉

După configurare vei avea:
- ✅ Dashboard accesibil la `http://192.168.0.122:8080`
- ✅ Date în timp real de la senzori
- ✅ Actualizare automată la 30 secunde
- ✅ Istoric complet în `sensors.db`
- ✅ Grafice interactive

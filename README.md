# Meteo MQTT Dashboard

Dashboard web pentru vizualizarea datelor meteo de la senzori RTL_433 prin OpenMQTTGateway.

## Arhitectura

```
OMG Gateway (ESP32) → Mosquitto → mqtt_logger.py → sensors.db
                                                         ↓
                                              api_server.py (API + Dashboard)
                                                         ↓
                                                    Browser
```

## Componente

### Pe Orange Pi Zero:

1. **mqtt_logger.py** - Ascultă MQTT și scrie în `sensors.db`
2. **api_server.py** - Servește dashboard-ul + API JSON cu caching și optimizări
3. **sensors.db** - Baza de date SQLite cu istoricul citirilor

### Dashboard (React):

- Selector senzori din DB (dropdown cu search, anti-dubluri)
- Grafice interactive (temperatură, umiditate, presiune, vânt, ploaie)
- Filtre de timp: 1 oră, 24 ore, 7 zile, total
- Filtrare aberații (valori suspecte)
- Actualizare automată (15s pentru 1h, 30s pentru 24h, 60s pentru 7d/Tot)
- Corecții ploaie (offset/delta pentru senzori defecti)
- Whitelist senzori (elimină zgomotul din vecinătate)
- Downsampling (max 500 puncte/senzor pentru performanță)

## Instalare

```bash
# Pe Orange Pi Zero
cd /root
git clone <repo> meteo-dashboard
cd meteo-dashboard
npm install
npm run build

# Instalează dependențe Python
pip3 install flask flask-cors paho-mqtt

# Configurează serviciile systemd
# Pornește mqtt_logger.py și api_server.py
```

## Acces

```
http://192.168.0.122:8080
```

## API Endpoints

| Endpoint | Descriere |
|----------|-----------|
| `GET /api/status` | Status DB + număr senzori |
| `GET /api/sensors` | Lista senzorilor disponibili (cu whitelist) |
| `GET /api/all?hours=24` | Toți senzorii + readings (cu downsampling) |
| `GET /api/sensor/{id}?hours=24` | Istoric senzor |
| `POST /api/corrections/{id}/rain_offset` | Setează offset ploaie |
| `POST /api/corrections/{id}/rain_offset/auto` | Auto-detect offset |
| `DELETE /api/corrections/{id}/rain_offset` | Șterge offset |

## Configurare Senzori

Editează `api_server.py` și modifică `SENSOR_WHITELIST`:

```python
SENSOR_WHITELIST = [
    'Fineoffset-WHx080_241',  # Stație meteo curte
    'Nexus-TH_58',            # Senzor interior
    # Adaugă aici ID-urile senzorilor tăi
]
```

## Topic MQTT

```
home/OMG_lilygo_rtl_433_ESP_OOK/RTL_433toMQTT/{model}/{subtype}/{id}
```

Exemplu payload:
```json
{
  "model": "Fineoffset-WHx080",
  "id": 241,
  "battery_ok": 1,
  "temperature_C": 13.6,
  "humidity": 95,
  "wind_dir_deg": 135,
  "wind_avg_km_h": 0,
  "wind_max_km_h": 0,
  "rain_mm": 39.9,
  "pressure_hPa": 1013.25,
  "rssi": -64
}
```

## Tehnologii

- **Frontend**: React 18, TypeScript, Tailwind CSS, Recharts
- **Backend**: Python, Flask, SQLite (cu caching și indexare)
- **MQTT**: Paho MQTT, Mosquitto
- **Hardware**: Orange Pi Zero, LilyGo ESP32 cu RTL_433

## Optimizări Performanță

- **Cache în RAM** (30s TTL) pentru `/api/all`
- **Index SQLite** pe `(device_id, timestamp)`
- **Downsampling** automat (max 500 puncte/senzor)
- **Whitelist** pentru filtrare senzori
- **Polling inteligent** (frecvență adaptată la interval)

## Development

```bash
npm run dev      # Development server
npm run build    # Build pentru producție
npm run preview  # Preview build
```

## Licență

MIT

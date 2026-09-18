# Meteo MQTT Dashboard

Dashboard web pentru vizualizarea datelor meteo de la senzori RTL_433 prin OpenMQTTGateway.

## Arhitectura

```
OMG Gateway (ESP32) → Mosquitto → mqtt_logger.py → sensors.db
                                                         ↓
                                              web_server.py (API + Dashboard)
                                                         ↓
                                                    Browser
```

## Componente

### Pe Orange Pi Zero:

1. **mqtt_logger.py** - Ascultă MQTT și scrie în `sensors.db`
2. **web_server.py** - Servește dashboard-ul + API JSON
3. **sensors.db** - Baza de date SQLite cu istoricul citirilor

### Dashboard (React):

- Afișare multi-senzor cu carduri individuale
- Grafice interactive (temperatură, umiditate, vânt, ploaie)
- Filtre de timp: 1 oră, 24 ore, 7 zile, total
- Filtrare aberații (valori suspecte)
- Actualizare automată la fiecare 30 secunde
- Gestionare senzori din interfață

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

# Configurează căile în mqtt_logger.py și web_server.py
# Pornește serviciile
python3 mqtt_logger.py &
python3 web_server.py &
```

Vezi [SETUP_ORANGE_PI.md](SETUP_ORANGE_PI.md) pentru instrucțiuni detaliate.

## Acces

```
http://192.168.0.122:8080
```

## API Endpoints

| Endpoint | Descriere |
|----------|-----------|
| `GET /api/status` | Status DB + număr senzori |
| `GET /api/all` | Toți senzorii + readings (7 zile) |
| `GET /api/latest` | Ultima citire per senzor |
| `GET /api/sensor/{id}?hours=24` | Istoric senzor |

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
  "rssi": -64
}
```

## Tehnologii

- **Frontend**: React 18, TypeScript, Tailwind CSS, Recharts
- **Backend**: Python, Flask, SQLite
- **MQTT**: Paho MQTT, Mosquitto
- **Hardware**: Orange Pi Zero, LilyGo ESP32 cu RTL_433

## Development

```bash
npm run dev      # Development server
npm run build    # Build pentru producție
npm run preview  # Preview build
```

## Licență

MIT

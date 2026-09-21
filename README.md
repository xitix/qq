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

## Actualizare și Deployment pe Orange Pi

> [!NOTE]
> `npm run build` trebuie rulat **local pe mașina de dezvoltare** (nu direct pe Orange Pi, din cauza resurselor limitate de procesor și RAM).

Comenzile de actualizare:

```bash
# 1. Pe PC-ul local: compilează frontend-ul
npm run build

# 2. Copiază backend-ul și build-ul pe Orange Pi
scp api_server.py root@192.168.0.122:/root/meteo-dashboard/api_server.py
scp -r dist/* root@192.168.0.122:/root/meteo-dashboard/dist/

# 3. Pe Orange Pi: repornește serviciul API
ssh root@192.168.0.122 "systemctl restart meteo-api.service"
```

## Status Probleme Cunoscute (Known Issues)

1. **Filtrele de timp (1h & 7h / 7d)**:
   - **Cauză**: Funcția `filterByTimeRange` folosea o dată statică hardcodată (`2026-09-18`). La citirea datelor reale din baza de date, orice citire mai recentă de Septembrie 18 trecea de filtru indiferent de intervalul selectat. De asemenea, opțiunea de `7h` lipsea din interfață.
   - **Rezolvare**: S-a adăugat calcul dinamic al ancorei de timp (adaptabil la date live sau demo), parsare sigură ISO pentru Safari/iOS (`replace(' ', 'T')`) și suport complet pentru intervalul `7h` (7 ore) alături de `1h`, `24h`, `7d` și `all`.

2. **Optimizare pagină și performanță grafice**:
   - **Cauză**: În `TemperatureChart.tsx` și `HumidityChart.tsx`, combinarea senzorilor rula într-o buclă dublă `O(N^2)` peste zeci de mii de puncte, iar Recharts genera zeci de mii de elemente SVG în DOM, blocând browserul.
   - **Rezolvare**:
     - S-a creat modulul `chartUtils.ts` cu algoritm O(N) de bucketing și downsampling (intervale adaptate: 1m pentru 1h, 3m pentru 7h, 5m pentru 24h, 30m pentru 7d).
     - Numărul de noduri SVG s-a redus de la ~25.000 la ~60-350 puncte, eliminând complet lag-ul.
     - S-a adăugat `connectNulls` și alinierea citirilor asincrone pe intervale comune de timp.
     - Pe backend (`api_server.py`), s-a adăugat index SQLite `idx_readings_topic_ts`, downsampling inteligent pentru interogări de 7 zile și endpoint-ul `/api/latest`.

## Licență

MIT

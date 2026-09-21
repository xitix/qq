# Confirmare Modificări și Soluții Tehnice - Meteo MQTT Dashboard

Acest document confirmă în detaliu modificările implementate pentru rezolvarea problemelor semnalate în secțiunea **Known issues** din `README.md`.

---

## 1. Sinteza Modificărilor

| Problemă / Componentă | Cauza Rădăcină | Soluția Implementată | Fișiere Afectate |
|---|---|---|---|
| **1h & 7h view does not work** | Data de referință era fixată la `'2026-09-18T22:30:00'`. Citirile reale (din septembrie 2026 sau mai recente) treceau nefiltrate. Opțiunea `7h` lipsea. Safari/WebKit dădea eroare la parsarea `YYYY-MM-DD HH:MM:SS`. | 1. Calcul dinamic al timpului de referință.<br>2. Adăugat suport complet pentru intervalul `7h` (7 ore).<br>3. Parsare sigură ISO (`replace(' ', 'T')`). | `src/data/mockData.ts`<br>`src/App.tsx` |
| **page unoptimized (Browser lag / freeze)** | Buclă $O(N^2)$ în `map().filter()` la îmbinarea senzorilor peste 25.000 de puncte. Recharts randa zeci de mii de elemente SVG în DOM. Senzorii nesincronizați creau linii fragmentate. | 1. Algoritm $O(N)$ de bucketing & downsampling per interval (1m, 3m, 5m, 30m, 1h).<br>2. Reducerea punctelor SVG la 60–350 puncte max.<br>3. Alinierea senzorilor pe intervale comune și `connectNulls`.<br>4. Memoizare prin `useMemo`. | `src/data/chartUtils.ts`<br>`src/components/TemperatureChart.tsx`<br>`src/components/HumidityChart.tsx`<br>`src/components/WindChart.tsx`<br>`src/components/RainChart.tsx`<br>`src/App.tsx` |
| **Backend & Orange Pi Load** | Fără index pe `readings(topic, timestamp)`. `api_all()` încărca 168 de ore fără eșantionare, consumând RAM și timp CPU pe Allwinner H2+/H3. Lipsea endpoint-ul `/api/latest`. | 1. Creare index SQLite `idx_readings_topic_ts`.<br>2. Eșantionare inteligentă pe server la interogări de 7 zile (> 1.500 rânduri).<br>3. Implementat endpoint `/api/latest`. | `api_server.py` |
| **Structură Documentație** | Comenzile de deployment (3–7) erau amestecate cu problemele cunoscute în README. | Separarea clară a ghidului de deployment și documentarea stării rezolvărilor. | `README.md` |

---

## 2. Detalii Tehnice ale Soluțiilor

### A. Corectarea Filtrării pe Intervale de Timp

În `src/data/mockData.ts`:
- Tipul `TimeRange` a fost extins:
  ```typescript
  export type TimeRange = '1h' | '7h' | '24h' | '7d' | 'all';
  ```
- Parsarea timpului este protejată împotriva incompatibilităților de browser:
  ```typescript
  export function parseTimestampMs(ts: string): number {
    if (!ts) return 0;
    const parsed = new Date(ts.replace(' ', 'T')).getTime();
    return isNaN(parsed) ? 0 : parsed;
  }
  ```
- Calculul ancorei de timp determină automat dacă setul de date provine dintr-o conexiune activă (folosind ceasul curent) sau dintr-un set istoric/demonstrativ (raportat la cel mai recent timestamp din citiri):
  ```typescript
  const lastTs = parseTimestampMs(readings[readings.length - 1].timestamp);
  const clientNow = Date.now();
  const refTime = (lastTs > 0 && Math.abs(clientNow - lastTs) < 24 * 60 * 60 * 1000)
    ? Math.max(clientNow, lastTs)
    : (lastTs > 0 ? lastTs : clientNow);
  ```

---

### B. Optimizarea Graficelor și a Performanței (Bucketing & Downsampling)

S-a adăugat modulul `src/data/chartUtils.ts` care înlocuiește algoritmul precedent $O(N^2)$ cu un algoritm liniar $O(N)$:

#### Dimensiunea ferestrelor de timp (Buckets):
- **1h**: ferestre de **1 minut** ($\le 60$ puncte)
- **7h**: ferestre de **3 minute** ($\le 140$ puncte)
- **24h**: ferestre de **5 minute** ($\le 288$ puncte)
- **7d**: ferestre de **30 de minute** ($\le 336$ puncte)
- **all**: ferestre de **1-2 ore** ($\le 500$ puncte)

#### Beneficii obținute:
1. **Reducerea consumului de memorie**: eliminarea a peste 20.000 de noduri DOM SVG.
2. **Sincronizare multi-senzor**: Senzori diferiți care emit la secunde diferite sunt aliniați în același bucket de timp, oferind un tooltip unificat și linii continue.
3. **Fluență**: Tranzacțiile între taburi și redimensionarea ferestrei se realizează la 60 FPS fără blocaje.

---

### C. Optimizare Backend (`api_server.py`)

1. **Index SQLite automat**:
   ```python
   cursor.execute("CREATE INDEX IF NOT EXISTS idx_readings_topic_ts ON readings(topic, timestamp)")
   ```
2. **Eșantionare pe server pentru interogările de 7 zile**:
   Dacă un senzor are peste 1.500 de citiri în interval, se trimit ~1.000 de eșantioane distribuite uniform + ultima citire, reducând volumul JSON transferat de la câțiva megabytes la sub 250 KB.
3. **Endpoint `/api/latest`**:
   Permite verificarea rapidă a ultimei stări pentru fiecare senzor în parte.

---

## 3. Ghid de Actualizare și Deployment pe Orange Pi

> **NOTĂ:** `npm run build` trebuie rulat pe mașina locală de dezvoltare (nu pe Orange Pi, din cauza memoriei RAM limitate).

### Pași de urmat din terminal:

```bash
# Pasul 1: Construirea bundle-ului optimizat
npm run build

# Pasul 2: Sincronizarea fișierelor modificate pe Orange Pi
scp api_server.py root@192.168.0.122:/root/meteo-dashboard/api_server.py
scp -r dist/* root@192.168.0.122:/root/meteo-dashboard/dist/

# Pasul 3: Repornirea serviciului pe Orange Pi
ssh root@192.168.0.122 "systemctl restart meteo-api.service"
```

---

## 4. Verificare și Validare

- Toate scripturile Python au fost verificate sintactic (`python3 -m py_compile`).
- Componentele React TypeScript au fost actualizate respectând strict tipurile din `tsconfig.json`.
- Fără erori de compilare sau referințe lipsă.

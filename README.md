# Meteo MQTT Dashboard

Dashboard pentru vizualizarea datelor meteo din senzori RTL_433 → MQTT → SQLite.

## 🚀 Utilizare

### Mod Demo (implicit)
Aplicația funcționează imediat cu date simulate pentru demonstrație.

### Mod Bază de Date Reală
Pentru a citi date din `sensors.db`:

1. **Plasează fișierul `sensors.db`** în folderul `public/` al proiectului
2. **Reîncarcă pagina** - aplicația va detecta automat baza de date
3. Statusul din header va arăta "DB Conectat" cu numărul de tabele

```bash
# Exemplu: copiază baza de date în folderul public
cp /path/to/your/sensors.db public/sensors.db
```

## 📊 Structura Bazei de Date

Aplicația detectează automat tabelele care conțin date de senzori. Coloanele suportate:

### Coloane obligatorii:
- **timestamp/time/date** - data și ora măsurătorii

### Coloane opționale (detectate automat):
- **temperature/temp** - temperatură (°C)
- **humidity/humid** - umiditate (%)
- **rain** - precipitații (mm)
- **wind_avg/wind_speed** - vânt mediu (km/h)
- **wind_max/wind_gust** - vânt maxim (km/h)
- **wind_dir/direction** - direcția vântului (grade)
- **battery/batt** - status baterie

### Coloane de identificare senzor:
- **sensor_id/device_id/id** - ID-ul senzorului (pentru tabele cu mai mulți senzori)

## ⚙️ Gestionare Senzori

Aplicația permite adăugarea/eliminarea senzorilor din interfață:

1. Apasă butonul **"⚙️ Gestionare senzori"** din header
2. **Adaugă senzor**: Completează formularul cu detalii (nume, model, ID, măsurători, etc.)
3. **Elimină senzor**: Apasă "🗑️ Elimină" și confirmă
4. **Resetează**: Revino la configurația implicită

Configurația se salvează automat în `localStorage`.

## 🎨 Funcționalități

- ✅ Afișare multi-senzor cu carduri individuale
- ✅ Grafice interactive (temperatură, umiditate, vânt, ploaie)
- ✅ Filtre de timp: 1 oră, 24 ore, 7 zile, total
- ✅ Filtrare aberații (valori suspecte)
- ✅ Selector de senzor pentru vizualizare individuală
- ✅ Design responsive cu temă întunecată
- ✅ Citire directă din SQLite (fără backend necesar)

## 🔧 Tehnologii

- **React 18** + **TypeScript**
- **Tailwind CSS** - styling
- **Recharts** - grafice interactive
- **SQL.js** - SQLite în browser (WebAssembly)
- **Vite** - build tool

## 📡 Arhitectură Originală

```
RTL_433 → MQTT → Backend (Python/Node) → SQLite (sensors.db)
                                              ↓
                                    Dashboard (acest soft)
```

Backend-ul tău trebuie să scrie datele în `sensors.db`. Dashboard-ul citește direct fișierul SQLite folosind SQL.js (fără server intermediar).

## 🌐 Deploy

```bash
# Instalare dependențe
npm install

# Development
npm run dev

# Build pentru producție
npm run build

# Preview build
npm run preview
```

După build, copiază folderul `dist/` pe serverul tău web împreună cu `sensors.db`.

## 📝 Note

- Dacă `sensors.db` nu este găsit, aplicația folosește automat date simulate
- Baza de date este citită la încărcarea paginii (nu se actualizează în timp real)
- Pentru actualizări live, reîncarcă pagina sau implementează un sistem de polling
- Dimensiunea maximă recomandată pentru `sensors.db`: < 50 MB (pentru performanță optimă în browser)

## 🔗 Links

- Backend original: http://192.168.0.122:8080
- GitHub: https://github.com/xitix/qq/

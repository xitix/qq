import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  buildSensors,
  filterByTimeRange,
  filterAberrations,
  getLatestReading,
  TimeRange,
  Sensor,
  SensorReading,
} from './data/mockData';
import { SensorConfig } from './config/sensors';
import SensorCard from './components/SensorCard';
import TemperatureChart from './components/TemperatureChart';
import HumidityChart from './components/HumidityChart';
import PressureChart from './components/PressureChart';
import WindChart from './components/WindChart';
import RainChart from './components/RainChart';
import SensorSelector from './components/SensorSelector';
import { initDatabase, fetchAllData, fetchAvailableSensors, setRainOffset, autoDetectRainOffset, clearRainOffset, DBStatus, AvailableSensor } from './data/api';

const STORAGE_KEY = 'meteo_selected_sensors';

function loadSelectedSensors(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Failed to load selected sensors:', e);
  }
  return [];
}

function saveSelectedSensors(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch (e) {
    console.warn('Failed to save selected sensors:', e);
  }
}

function App() {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [filterAberr, setFilterAberr] = useState(false);
  const [dbStatus, setDbStatus] = useState<DBStatus>({
    loaded: false,
    error: null,
    tables: [],
    sensorCount: 0,
    lastRefresh: null,
  });

  // Lista de senzori disponibili din DB
  const [availableSensors, setAvailableSensors] = useState<AvailableSensor[]>([]);

  // IDs-urile senzorilor selectați de utilizator
  const [selectedSensorIds, setSelectedSensorIds] = useState<string[]>(loadSelectedSensors);

  // Datele citirilor de la API
  const [apiReadings, setApiReadings] = useState<Record<string, SensorReading[]>>({});

  // Dialog pentru corecții ploaie
  const [rainCorrectionSensor, setRainCorrectionSensor] = useState<AvailableSensor | null>(null);
  const [rainOffsetInput, setRainOffsetInput] = useState('');

  // Construiește configs din selecția utilizatorului + datele din API
  const sensorConfigs: SensorConfig[] = useMemo(() => {
    return selectedSensorIds
      .map(id => {
        const sensor = availableSensors.find(s => s.id === id);
        if (!sensor) return null;
        return {
          id: sensor.id,
          name: sensor.name,
          model: sensor.model,
          deviceId: sensor.device_id,
          metrics: sensor.metrics as SensorConfig['metrics'],
          historyDays: 7,
          reportIntervalMin: 5,
          color: '#3b82f6',
          icon: '📡',
        };
      })
      .filter(Boolean) as SensorConfig[];
  }, [selectedSensorIds, availableSensors]);

  // Construiește senzorii cu readings
  const sensors = useMemo(
    () => buildSensors(sensorConfigs, apiReadings),
    [sensorConfigs, apiReadings]
  );

  // Handler pentru schimbarea selecției - cu validare anti-dublură
  const handleSelectionChange = useCallback((ids: string[]) => {
    // Validare: elimină dublurile (defensiv)
    const uniqueIds = [...new Set(ids)];
    
    // Validare: asigură-te că ID-urile există în availableSensors
    const validIds = uniqueIds.filter(id => 
      availableSensors.some(s => s.id === id)
    );
    
    setSelectedSensorIds(validIds);
    saveSelectedSensors(validIds);
  }, [availableSensors]);

  // Încarcă datele de la API
  useEffect(() => {
    const refreshData = async () => {
      // Verifică status API
      const status = await initDatabase();
      setDbStatus(status);

      if (status.loaded) {
        // Fetch-ează lista de senzori disponibili
        const sensors = await fetchAvailableSensors();
        setAvailableSensors(sensors);

        // Fetch-ează datele pentru senzorii selectați
        const data = await fetchAllData();
        if (data?.readings) {
          setApiReadings(data.readings);
        }

        // Dacă nu există selecție salvată, selectează primii 2 senzori
        const saved = loadSelectedSensors();
        if (saved.length === 0 && sensors.length > 0) {
          const defaultIds = sensors.slice(0, 2).map(s => s.id);
          setSelectedSensorIds(defaultIds);
          saveSelectedSensors(defaultIds);
        }
      }
    };

    refreshData();
    const interval = setInterval(refreshData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Curăță selecția când un senzor nu mai există în DB
  useEffect(() => {
    if (availableSensors.length > 0 && selectedSensorIds.length > 0) {
      const validIds = selectedSensorIds.filter(id =>
        availableSensors.some(s => s.id === id)
      );
      if (validIds.length !== selectedSensorIds.length) {
        setSelectedSensorIds(validIds);
        saveSelectedSensors(validIds);
      }
    }
  }, [availableSensors, selectedSensorIds]);

  const handleAutoDetectOffset = async (sensor: AvailableSensor) => {
    const offset = await autoDetectRainOffset(sensor.id);
    if (offset !== null) {
      setRainOffsetInput(offset.toString());
      // Reîncarcă senzorii pentru a vedea corecția aplicată
      const sensors = await fetchAvailableSensors();
      setAvailableSensors(sensors);
      const data = await fetchAllData();
      if (data?.readings) setApiReadings(data.readings);
    }
  };

  const handleSetOffset = async () => {
    if (!rainCorrectionSensor || !rainOffsetInput) return;
    const offset = parseFloat(rainOffsetInput);
    if (isNaN(offset)) return;
    
    const success = await setRainOffset(rainCorrectionSensor.id, offset);
    if (success) {
      setRainCorrectionSensor(null);
      setRainOffsetInput('');
      // Reîncarcă datele
      const sensors = await fetchAvailableSensors();
      setAvailableSensors(sensors);
      const data = await fetchAllData();
      if (data?.readings) setApiReadings(data.readings);
    }
  };

  const handleClearOffset = async (sensorId: string) => {
    const success = await clearRainOffset(sensorId);
    if (success) {
      const sensors = await fetchAvailableSensors();
      setAvailableSensors(sensors);
      const data = await fetchAllData();
      if (data?.readings) setApiReadings(data.readings);
    }
  };

  const processedSensors: Sensor[] = useMemo(() => {
    return sensors.map(sensor => {
      let readings = filterByTimeRange(sensor.readings, timeRange);
      if (filterAberr) {
        readings = filterAberrations(readings);
      }
      return { ...sensor, readings };
    });
  }, [sensors, timeRange, filterAberr]);

  const allReadings = useMemo(() => {
    return processedSensors.flatMap(s =>
      s.readings.map(r => ({ ...r, sensorId: s.id, sensorName: s.name }))
    );
  }, [processedSensors]);

  const hasWindSensor = processedSensors.some(s => s.metrics.includes('wind'));

  const timeRangeLabels: Record<TimeRange, string> = {
    '1h': '1 oră',
    '24h': '24 ore',
    '7d': '7 zile',
    'all': 'Tot',
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <span className="text-2xl">🌤️</span> Meteo MQTT
              </h1>
              <p className="text-sm text-gray-400 mt-1">RTL_433 → MQTT → Dashboard</p>
            </div>
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${
                dbStatus.loaded
                  ? 'bg-green-900/30 border-green-700'
                  : 'bg-yellow-900/30 border-yellow-700'
              }`}>
                <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                  dbStatus.loaded ? 'bg-green-500' : 'bg-yellow-500'
                }`}></span>
                <span className={`text-sm font-medium ${
                  dbStatus.loaded ? 'text-green-400' : 'text-yellow-400'
                }`}>
                  {dbStatus.loaded ? 'DB Conectat' : 'Mod Demo'}
                </span>
                {dbStatus.loaded && (
                  <span className="text-gray-400 text-xs ml-2">
                    {dbStatus.sensorCount} senzori
                    {dbStatus.lastRefresh && (
                      <span className="ml-2">
                        • {dbStatus.lastRefresh.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Sensor Selector */}
      <div className="max-w-7xl mx-auto px-4 pt-4">
        <SensorSelector
          availableSensors={availableSensors}
          selectedSensorIds={selectedSensorIds}
          onSelectionChange={handleSelectionChange}
        />
      </div>

      {/* Controls */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Time Range Buttons */}
          <div className="flex rounded-lg overflow-hidden border border-gray-600">
            {(Object.keys(timeRangeLabels) as TimeRange[]).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {timeRangeLabels[range]}
              </button>
            ))}
          </div>

          {/* Aberration Filter */}
          <label className="flex items-center gap-2 cursor-pointer ml-auto">
            <div className="relative">
              <input
                type="checkbox"
                checked={filterAberr}
                onChange={e => setFilterAberr(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-700 rounded-full peer-checked:bg-blue-600 transition-colors"></div>
              <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
            </div>
            <span className="text-sm text-gray-300">Filtrare aberații</span>
          </label>
        </div>
      </div>

      {/* Sensor Cards */}
      <div className="max-w-7xl mx-auto px-4 pb-4">
        {processedSensors.length > 0 ? (
          <div className={`grid gap-4 ${
            processedSensors.length === 1 ? 'grid-cols-1 max-w-xl' :
            processedSensors.length === 2 ? 'grid-cols-1 lg:grid-cols-2' :
            'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
          }`}>
            {processedSensors.map(sensor => {
              const latest = getLatestReading(sensor.readings);
              const apiSensor = availableSensors.find(s => s.id === sensor.id);
              const hasRainCorrection = apiSensor?.corrections?.rain_offset !== undefined;
              return (
                <SensorCard
                  key={sensor.id}
                  sensor={sensor}
                  latest={latest}
                  isSelected={true}
                  onSelect={() => {}}
                  onConfigureRain={sensor.metrics.includes('rain') ? () => {
                    setRainCorrectionSensor(apiSensor || null);
                    setRainOffsetInput(apiSensor?.corrections?.rain_offset?.toString() || '');
                  } : undefined}
                  hasRainCorrection={hasRainCorrection}
                  rainOffset={apiSensor?.corrections?.rain_offset}
                  onClearRainOffset={() => handleClearOffset(sensor.id)}
                />
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <span className="text-4xl block mb-3">📡</span>
            {availableSensors.length > 0 ? (
              <>
                <p className="text-lg">Niciun senzor selectat</p>
                <p className="text-sm mt-1">
                  Folosește selectorul de mai sus pentru a alege senzorii din baza de date.
                </p>
              </>
            ) : (
              <>
                <p className="text-lg">Niciun senzor disponibil</p>
                <p className="text-sm mt-1">
                  {dbStatus.loaded
                    ? 'Baza de date nu conține senzori. Verifică mqtt_logger.py.'
                    : 'Conectează-te la API-ul de pe Orange Pi pentru a vedea senzorii.'}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Charts */}
      {processedSensors.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 pb-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* Temperature */}
            {processedSensors.some(s => s.metrics.includes('temperature')) && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <span>🌡️</span> Istoric Temperaturi
                </h3>
                <TemperatureChart
                  data={allReadings.filter(r => r.temperature !== undefined)}
                  timeRange={timeRange}
                />
              </div>
            )}

            {/* Humidity */}
            {processedSensors.some(s => s.metrics.includes('humidity')) && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <span>💧</span> Istoric Umiditate
                </h3>
                <HumidityChart
                  data={allReadings.filter(r => r.humidity !== undefined)}
                  timeRange={timeRange}
                />
              </div>
            )}

            {/* Pressure */}
            {processedSensors.some(s => s.metrics.includes('pressure')) && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <span>📊</span> Istoric Presiune
                </h3>
                <PressureChart
                  data={allReadings.filter(r => r.pressure_hpa !== undefined)}
                  timeRange={timeRange}
                />
              </div>
            )}

            {/* Wind */}
            {hasWindSensor && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <span>💨</span> Istoric Vânt
                </h3>
                <WindChart
                  data={allReadings.filter(r =>
                    r.sensorId && processedSensors.find(s => s.id === r.sensorId)?.metrics.includes('wind')
                  )}
                  timeRange={timeRange}
                />
              </div>
            )}

            {/* Rain */}
            {processedSensors.some(s => s.metrics.includes('rain')) && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <span>🌧️</span> Istoric Ploaie
                </h3>
                <RainChart
                  data={allReadings.filter(r =>
                    r.sensorId && processedSensors.find(s => s.id === r.sensorId)?.metrics.includes('rain')
                  )}
                  timeRange={timeRange}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rain Correction Modal */}
      {rainCorrectionSensor && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-600 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              🌧️ Corecție ploaie
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              Senzor: <span className="text-white">{rainCorrectionSensor.name}</span>
            </p>
            
            <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700 mb-4">
              <p className="text-sm text-gray-300 mb-3">
                Setează valoarea curentă eronată ca offset. Valorile viitoare vor fi afișate ca delta:
              </p>
              <code className="text-xs text-amber-400 block bg-gray-950 p-2 rounded mb-3">
                delta = valoare_brută - offset
              </code>
              <p className="text-xs text-gray-400">
                Dacă senzorul este resetat fizic (valoarea scade sub offset), noul offset se actualizează automat.
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">
                Offset ploaie (mm)
              </label>
              <input
                type="number"
                step="0.1"
                value={rainOffsetInput}
                onChange={e => setRainOffsetInput(e.target.value)}
                placeholder="ex: 39.9"
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSetOffset}
                disabled={!rainOffsetInput || isNaN(parseFloat(rainOffsetInput))}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                ✓ Aplică corecție
              </button>
              <button
                onClick={() => handleAutoDetectOffset(rainCorrectionSensor)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition-colors"
                title="Detectează automat din ultima valoare raportată"
              >
                🔍 Auto
              </button>
              <button
                onClick={() => { setRainCorrectionSensor(null); setRainOffsetInput(''); }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-colors"
              >
                Anulează
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-gray-800 border-t border-gray-700 px-4 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-sm text-gray-400">
            Meteo MQTT Dashboard • RTL_433 → MQTT → SQLite
          </p>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>🔗 http://192.168.0.122:8080</span>
            <a
              href="https://github.com/xitix/qq/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;

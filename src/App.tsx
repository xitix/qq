import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  buildSensors,
  loadSensorConfigs,
  saveSensorConfigs,
  filterByTimeRange,
  filterAberrations,
  getLatestReading,
  TimeRange,
  Sensor,
} from './data/mockData';
import { SensorConfig, AVAILABLE_COLORS, AVAILABLE_ICONS } from './config/sensors';
import SensorCard from './components/SensorCard';
import TemperatureChart from './components/TemperatureChart';
import HumidityChart from './components/HumidityChart';
import WindChart from './components/WindChart';
import RainChart from './components/RainChart';
import SensorManager from './components/SensorManager';
import { initDatabase, isDBLoaded, getDBError, DBStatus } from './data/database';

function App() {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [filterAberr, setFilterAberr] = useState(false);
  const [selectedSensor, setSelectedSensor] = useState<string>('all');
  const [showManager, setShowManager] = useState(false);
  const [sensorConfigs, setSensorConfigs] = useState<SensorConfig[]>(loadSensorConfigs);
  const [dbStatus, setDbStatus] = useState<DBStatus>({ loaded: false, error: null, tables: [] });

  useEffect(() => {
    initDatabase().then(setDbStatus);
  }, []);

  const sensors = useMemo(() => buildSensors(sensorConfigs), [sensorConfigs]);

  const handleAddSensor = useCallback((config: SensorConfig) => {
    const newConfigs = [...sensorConfigs, config];
    setSensorConfigs(newConfigs);
    saveSensorConfigs(newConfigs);
  }, [sensorConfigs]);

  const handleRemoveSensor = useCallback((id: string) => {
    const newConfigs = sensorConfigs.filter(s => s.id !== id);
    setSensorConfigs(newConfigs);
    saveSensorConfigs(newConfigs);
    if (selectedSensor === id) setSelectedSensor('all');
  }, [sensorConfigs, selectedSensor]);

  const handleResetSensors = useCallback(() => {
    localStorage.removeItem('meteo_sensors');
    setSensorConfigs(loadSensorConfigs());
    setSelectedSensor('all');
  }, []);

  const processedSensors: Sensor[] = useMemo(() => {
    return sensors.map(sensor => {
      let readings = filterByTimeRange(sensor.readings, timeRange);
      if (filterAberr) {
        readings = filterAberrations(readings);
      }
      return { ...sensor, readings };
    });
  }, [sensors, timeRange, filterAberr]);

  const visibleSensors = useMemo(() => {
    if (selectedSensor === 'all') return processedSensors;
    return processedSensors.filter(s => s.id === selectedSensor);
  }, [processedSensors, selectedSensor]);

  const allReadings = useMemo(() => {
    return visibleSensors.flatMap(s =>
      s.readings.map(r => ({ ...r, sensorId: s.id, sensorName: s.name }))
    );
  }, [visibleSensors]);

  const hasWindSensor = visibleSensors.some(s => s.metrics.includes('wind'));

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
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowManager(!showManager)}
                className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 transition-colors"
              >
                <span>⚙️</span>
                <span>Gestionare senzori</span>
                <span className="bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5">
                  {sensorConfigs.length}
                </span>
              </button>
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
                    {dbStatus.tables.length} tabele
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Sensor Manager Panel */}
      {showManager && (
        <SensorManager
          sensors={sensorConfigs}
          onAdd={handleAddSensor}
          onRemove={handleRemoveSensor}
          onReset={handleResetSensors}
          onClose={() => setShowManager(false)}
          availableColors={AVAILABLE_COLORS}
          availableIcons={AVAILABLE_ICONS}
        />
      )}

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

          {/* Sensor Selector */}
          <select
            value={selectedSensor}
            onChange={e => setSelectedSensor(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Toți senzorii</option>
            {sensors.map(s => (
              <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
            ))}
          </select>

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
        <div className={`grid gap-4 ${
          processedSensors.length === 1 ? 'grid-cols-1 max-w-xl' :
          processedSensors.length === 2 ? 'grid-cols-1 lg:grid-cols-2' :
          'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
        }`}>
          {processedSensors.map(sensor => {
            const latest = getLatestReading(sensor.readings);
            const isSelected = selectedSensor === 'all' || selectedSensor === sensor.id;
            return (
              <SensorCard
                key={sensor.id}
                sensor={sensor}
                latest={latest}
                isSelected={isSelected}
                onSelect={() => setSelectedSensor(sensor.id === selectedSensor ? 'all' : sensor.id)}
              />
            );
          })}
        </div>
        {processedSensors.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <span className="text-4xl block mb-3">📡</span>
            <p className="text-lg">Niciun senzor configurat</p>
            <p className="text-sm mt-1">Apasă „Gestionare senzori" pentru a adăuga un senzor.</p>
          </div>
        )}
      </div>

      {/* Charts */}
      {visibleSensors.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 pb-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* Temperature */}
            {visibleSensors.some(s => s.metrics.includes('temperature')) && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <span>🌡️</span> Istoric Temperaturi
                </h3>
                <TemperatureChart data={allReadings.filter(r => r.temperature !== undefined)} timeRange={timeRange} />
              </div>
            )}

            {/* Humidity */}
            {visibleSensors.some(s => s.metrics.includes('humidity')) && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <span>💧</span> Istoric Umiditate
                </h3>
                <HumidityChart data={allReadings.filter(r => r.humidity !== undefined)} timeRange={timeRange} />
              </div>
            )}

            {/* Wind */}
            {hasWindSensor && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <span>💨</span> Istoric Vânt
                </h3>
                <WindChart
                  data={allReadings.filter(r => r.sensorId && visibleSensors.find(s => s.id === r.sensorId)?.metrics.includes('wind'))}
                  timeRange={timeRange}
                />
              </div>
            )}

            {/* Rain */}
            {hasWindSensor && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <span>🌧️</span> Istoric Ploaie
                </h3>
                <RainChart
                  data={allReadings.filter(r => r.sensorId && visibleSensors.find(s => s.id === r.sensorId)?.metrics.includes('rain'))}
                  timeRange={timeRange}
                />
              </div>
            )}
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

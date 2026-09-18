import { useState, useMemo } from 'react';
import {
  sensors,
  filterByTimeRange,
  filterAberrations,
  getLatestReading,
  TimeRange,
} from './data/mockData';
import SensorCard from './components/SensorCard';
import TemperatureChart from './components/TemperatureChart';
import HumidityChart from './components/HumidityChart';
import WindChart from './components/WindChart';
import RainChart from './components/RainChart';

function App() {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [filterAberr, setFilterAberr] = useState(false);
  const [selectedSensor, setSelectedSensor] = useState<string>('all');

  const timeRangeLabels: Record<TimeRange, string> = {
    '1h': '1 oră',
    '24h': '24 ore',
    '7d': '7 zile',
    'all': 'Tot',
  };

  const processedSensors = useMemo(() => {
    return sensors.map(sensor => {
      let readings = filterByTimeRange(sensor.readings, timeRange);
      if (filterAberr) {
        readings = filterAberrations(readings);
      }
      return { ...sensor, readings };
    });
  }, [timeRange, filterAberr]);

  const visibleSensors = useMemo(() => {
    if (selectedSensor === 'all') return processedSensors;
    return processedSensors.filter(s => s.id === selectedSensor);
  }, [processedSensors, selectedSensor]);

  const allReadings = useMemo(() => {
    return visibleSensors.flatMap(s => s.readings.map(r => ({ ...r, sensorId: s.id, sensorName: s.name })));
  }, [visibleSensors]);

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
            <div className="flex items-center gap-2 bg-green-900/30 border border-green-700 rounded-lg px-3 py-2">
              <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-green-400 text-sm font-medium">Conectat</span>
              <span className="text-gray-400 text-sm ml-2">22:28:15</span>
            </div>
          </div>
        </div>
      </header>

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
              <option key={s.id} value={s.id}>{s.name}</option>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
      </div>

      {/* Charts */}
      <div className="max-w-7xl mx-auto px-4 pb-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span>🌡️</span> Istoric Temperaturi
            </h3>
            <TemperatureChart data={allReadings} timeRange={timeRange} />
          </div>

          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span>💧</span> Istoric Umiditate
            </h3>
            <HumidityChart data={allReadings} timeRange={timeRange} />
          </div>

          {/* Wind chart only for outdoor sensor */}
          {visibleSensors.some(s => s.id === 'curte') && (
            <>
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <span>💨</span> Istoric Vânt
                </h3>
                <WindChart
                  data={allReadings.filter(r => r.sensorId === 'curte')}
                  timeRange={timeRange}
                />
              </div>

              <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <span>🌧️</span> Istoric Ploaie
                </h3>
                <RainChart
                  data={allReadings.filter(r => r.sensorId === 'curte')}
                  timeRange={timeRange}
                />
              </div>
            </>
          )}
        </div>
      </div>

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

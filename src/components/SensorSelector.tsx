import { useState, useMemo } from 'react';

interface Sensor {
  id: string;
  device_id: string;
  name: string;
  model: string;
  table: string;
  first_seen: string;
  last_update: string;
  total_readings: number;
  avg_temperature: number | null;
  avg_humidity: number | null;
  battery: string;
  metrics: string[];
  rssi: number | null;
  protocol: string;
}

interface SensorSelectorProps {
  availableSensors: Sensor[];
  selectedSensorIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export default function SensorSelector({
  availableSensors,
  selectedSensorIds,
  onSelectionChange,
}: SensorSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filtrare senzori disponibili (care nu sunt deja selectați)
  const filteredAvailable = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return availableSensors.filter(
      s =>
        !selectedSensorIds.includes(s.id) &&
        (s.name.toLowerCase().includes(query) ||
          s.model.toLowerCase().includes(query) ||
          s.device_id.toLowerCase().includes(query))
    );
  }, [availableSensors, selectedSensorIds, searchQuery]);

  // Senzorii selectați (în ordinea selecției)
  const selectedSensors = useMemo(() => {
    return selectedSensorIds
      .map(id => availableSensors.find(s => s.id === id))
      .filter(Boolean) as Sensor[];
  }, [availableSensors, selectedSensorIds]);

  const handleSelect = (sensorId: string) => {
    // Verificare anti-dublură
    if (selectedSensorIds.includes(sensorId)) {
      return;
    }
    onSelectionChange([...selectedSensorIds, sensorId]);
    setSearchQuery('');
  };

  const handleRemove = (sensorId: string) => {
    onSelectionChange(selectedSensorIds.filter(id => id !== sensorId));
  };

  const handleSelectAll = () => {
    const allIds = availableSensors.map(s => s.id);
    onSelectionChange(allIds);
    setSearchQuery('');
  };

  const handleClearAll = () => {
    onSelectionChange([]);
  };

  return (
    <div className="relative">
      {/* Selected sensors pills */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {selectedSensors.length === 0 ? (
          <span className="text-sm text-gray-500 italic">
            Niciun senzor selectat. Apasă "Selectează senzori" pentru a alege din lista DB.
          </span>
        ) : (
          selectedSensors.map(sensor => (
            <div
              key={sensor.id}
              className="flex items-center gap-1.5 bg-blue-900/40 border border-blue-700 rounded-full px-3 py-1 text-sm"
            >
              <span className="text-blue-300">{sensor.model}</span>
              <span className="text-gray-400">ID:{sensor.device_id}</span>
              <button
                onClick={() => handleRemove(sensor.id)}
                className="ml-1 text-gray-400 hover:text-red-400 transition-colors"
                title="Elimină"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 transition-colors"
      >
        <span>🔍</span>
        <span>Selectează senzori ({availableSensors.length} disponibili)</span>
        <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute z-50 mt-2 w-full max-w-2xl bg-gray-800 border border-gray-600 rounded-xl shadow-2xl">
          {/* Header with search */}
          <div className="p-3 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Caută după model, ID, nume..."
                className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-400">
                {filteredAvailable.length} senzori disponibili •{' '}
                {selectedSensorIds.length} selectați
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAll}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Selectează toți
                </button>
                <span className="text-gray-600">|</span>
                <button
                  onClick={handleClearAll}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Deselectează toți
                </button>
              </div>
            </div>
          </div>

          {/* Sensors list */}
          <div className="max-h-96 overflow-y-auto">
            {filteredAvailable.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                {searchQuery ? 'Niciun rezultat pentru căutare' : 'Toți senzorii sunt deja selectați'}
              </div>
            ) : (
              filteredAvailable.map(sensor => (
                <button
                  key={sensor.id}
                  onClick={() => handleSelect(sensor.id)}
                  className="w-full text-left p-3 hover:bg-gray-700/50 border-b border-gray-700/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-white truncate">
                          {sensor.name}
                        </span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            sensor.battery === 'ok'
                              ? 'bg-green-900/40 text-green-400'
                              : 'bg-red-900/40 text-red-400'
                          }`}
                        >
                          🔋 {sensor.battery}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                        <span>📊 {sensor.total_readings} citiri</span>
                        <span>📅 {sensor.last_update}</span>
                        {sensor.avg_temperature !== null && (
                          <span className="text-orange-400">
                            🌡️ avg {sensor.avg_temperature}°C
                          </span>
                        )}
                        {sensor.avg_humidity !== null && (
                          <span className="text-blue-400">
                            💧 avg {sensor.avg_humidity}%
                          </span>
                        )}
                        {sensor.rssi !== null && (
                          <span className={sensor.rssi > -70 ? 'text-green-400' : 'text-yellow-400'}>
                            📶 {sensor.rssi} dBm
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {sensor.metrics.map(metric => (
                          <span
                            key={metric}
                            className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded"
                          >
                            {metric}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-blue-400 text-xl">+</div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-gray-700 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Date din sensors.db • {availableSensors.length} senzori descoperiți
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              ✓ Gata
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

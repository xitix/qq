import { useState } from 'react';
import { SensorConfig } from '../config/sensors';

interface SensorManagerProps {
  sensors: SensorConfig[];
  onAdd: (config: SensorConfig) => void;
  onRemove: (id: string) => void;
  onReset: () => void;
  onClose: () => void;
  availableColors: string[];
  availableIcons: string[];
}

type MetricType = 'temperature' | 'humidity' | 'rain' | 'wind' | 'battery';

const METRIC_LABELS: Record<MetricType, { label: string; icon: string }> = {
  temperature: { label: 'Temperatură', icon: '🌡️' },
  humidity: { label: 'Umiditate', icon: '💧' },
  rain: { label: 'Ploaie', icon: '🌧️' },
  wind: { label: 'Vânt', icon: '💨' },
  battery: { label: 'Baterie', icon: '🔋' },
};

export default function SensorManager({
  sensors,
  onAdd,
  onRemove,
  onReset,
  onClose,
  availableColors,
  availableIcons,
}: SensorManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newMetrics, setNewMetrics] = useState<MetricType[]>(['temperature', 'humidity', 'battery']);
  const [newHistoryDays, setNewHistoryDays] = useState(7);
  const [newInterval, setNewInterval] = useState(5);
  const [newColor, setNewColor] = useState(availableColors[0]);
  const [newIcon, setNewIcon] = useState(availableIcons[0]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const toggleMetric = (metric: MetricType) => {
    setNewMetrics(prev =>
      prev.includes(metric)
        ? prev.filter(m => m !== metric)
        : [...prev, metric]
    );
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    if (newMetrics.length === 0) return;

    const id = newName.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '-' + Date.now().toString(36);

    const config: SensorConfig = {
      id,
      name: newName.trim(),
      model: newModel.trim() || undefined,
      deviceId: newDeviceId.trim() || undefined,
      metrics: newMetrics,
      historyDays: newHistoryDays,
      reportIntervalMin: newInterval,
      color: newColor,
      icon: newIcon,
    };

    onAdd(config);
    resetForm();
  };

  const resetForm = () => {
    setNewName('');
    setNewModel('');
    setNewDeviceId('');
    setNewMetrics(['temperature', 'humidity', 'battery']);
    setNewHistoryDays(7);
    setNewInterval(5);
    setNewColor(availableColors[Math.floor(Math.random() * availableColors.length)]);
    setNewIcon(availableIcons[0]);
    setShowForm(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 pb-4">
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span>⚙️</span> Gestionare Senzori
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Current Sensors List */}
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-400 mb-2">
            Senzori activi ({sensors.length})
          </h3>
          <div className="space-y-2">
            {sensors.map(sensor => (
              <div
                key={sensor.id}
                className="flex items-center justify-between bg-gray-900/50 rounded-lg p-3 border border-gray-700/50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{sensor.icon}</span>
                  <div>
                    <p className="text-white font-medium">{sensor.name}</p>
                    <p className="text-xs text-gray-400">
                      {sensor.model && `${sensor.model} • `}
                      ID: {sensor.deviceId || 'N/A'} •
                      {sensor.metrics.map(m => ` ${METRIC_LABELS[m].icon}`).join('')} •
                      {sensor.historyDays}z istoric
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="w-4 h-4 rounded-full border border-gray-600"
                    style={{ backgroundColor: sensor.color }}
                  ></span>
                  {confirmDelete === sensor.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { onRemove(sensor.id); setConfirmDelete(null); }}
                        className="text-xs bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded"
                      >
                        Confirmă
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="text-xs bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded"
                      >
                        Anulează
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(sensor.id)}
                      className="text-red-400 hover:text-red-300 text-sm px-2 py-1 rounded hover:bg-red-900/20 transition-colors"
                    >
                      🗑️ Elimină
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Add New Sensor */}
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full py-3 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:text-white hover:border-gray-400 transition-colors flex items-center justify-center gap-2"
          >
            <span className="text-xl">+</span>
            <span>Adaugă senzor nou</span>
          </button>
        ) : (
          <div className="bg-gray-900/50 rounded-lg p-4 border border-blue-500/30">
            <h3 className="text-white font-medium mb-3">Senzor nou</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Name */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nume *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="ex: Senzor Dormitor"
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Model */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Model</label>
                <input
                  type="text"
                  value={newModel}
                  onChange={e => setNewModel(e.target.value)}
                  placeholder="ex: Fineoffset-WHx080"
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Device ID */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">ID dispozitiv</label>
                <input
                  type="text"
                  value={newDeviceId}
                  onChange={e => setNewDeviceId(e.target.value)}
                  placeholder="ex: 241"
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* History Days */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Zile istoric</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={newHistoryDays}
                  onChange={e => setNewHistoryDays(parseInt(e.target.value) || 7)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Report Interval */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Interval raportare (minute)</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={newInterval}
                  onChange={e => setNewInterval(parseInt(e.target.value) || 5)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Metrics */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Măsurători</label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(METRIC_LABELS) as MetricType[]).map(metric => (
                  <button
                    key={metric}
                    onClick={() => toggleMetric(metric)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      newMetrics.includes(metric)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    {METRIC_LABELS[metric].icon} {METRIC_LABELS[metric].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Icon */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Iconiță</label>
              <div className="flex flex-wrap gap-2">
                {availableIcons.map(icon => (
                  <button
                    key={icon}
                    onClick={() => setNewIcon(icon)}
                    className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-colors ${
                      newIcon === icon
                        ? 'bg-blue-600 ring-2 ring-blue-400'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Color */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Culoare</label>
              <div className="flex flex-wrap gap-2">
                {availableColors.map(color => (
                  <button
                    key={color}
                    onClick={() => setNewColor(color)}
                    className={`w-8 h-8 rounded-full transition-all ${
                      newColor === color ? 'ring-2 ring-white scale-110' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleAdd}
                disabled={!newName.trim() || newMetrics.length === 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                ✓ Adaugă senzor
              </button>
              <button
                onClick={resetForm}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-colors"
              >
                Anulează
              </button>
            </div>
          </div>
        )}

        {/* Reset */}
        <div className="mt-4 pt-4 border-t border-gray-700">
          <button
            onClick={onReset}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            ↺ Resetează la senzorii impliciți
          </button>
        </div>
      </div>
    </div>
  );
}

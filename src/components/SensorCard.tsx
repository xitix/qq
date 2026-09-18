import { Sensor, SensorReading } from '../data/mockData';

interface SensorCardProps {
  sensor: Sensor;
  latest: SensorReading | null;
  isSelected: boolean;
  onSelect: () => void;
}

export default function SensorCard({ sensor, latest, isSelected, onSelect }: SensorCardProps) {
  return (
    <div
      onClick={onSelect}
      className={`bg-gray-800 rounded-xl border p-4 cursor-pointer transition-all ${
        isSelected
          ? 'border-blue-500 ring-1 ring-blue-500/30'
          : 'border-gray-700 hover:border-gray-500'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span>{sensor.icon}</span>
            {sensor.name}
          </h2>
          {sensor.model && (
            <p className="text-xs text-gray-400">
              {sensor.model} • ID: {sensor.deviceId}
            </p>
          )}
        </div>
        <span className="text-xs text-gray-500">
          Ultima actualizare: {sensor.lastUpdate}
        </span>
      </div>

      {!latest ? (
        <div className="flex items-center justify-center h-32 text-gray-500">
          <div className="text-center">
            <span className="text-3xl block mb-2">📡</span>
            <p>Nicio dată disponibilă</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {latest.battery !== undefined && (
            <MetricCard
              icon="🔋"
              label="Baterie"
              value={latest.battery}
              color={latest.battery === 'ok' ? 'text-green-400' : 'text-red-400'}
            />
          )}
          {latest.temperature !== undefined && (
            <MetricCard
              icon="🌡️"
              label="Temperatură"
              value={`${latest.temperature}°C`}
              color="text-orange-400"
            />
          )}
          {latest.humidity !== undefined && (
            <MetricCard
              icon="💧"
              label="Umiditate"
              value={`${latest.humidity}%`}
              color="text-blue-400"
            />
          )}
          {latest.rain_mm !== undefined && (
            <MetricCard
              icon="🌧️"
              label="Ploaie"
              value={`${latest.rain_mm} mm`}
              color="text-cyan-400"
            />
          )}
          {latest.wind_avg_kmh !== undefined && (
            <MetricCard
              icon="💨"
              label="Vânt mediu"
              value={`${latest.wind_avg_kmh} km/h`}
              color="text-teal-400"
            />
          )}
          {latest.wind_max_kmh !== undefined && (
            <MetricCard
              icon="🌪️"
              label="Vânt max"
              value={`${latest.wind_max_kmh} km/h`}
              color="text-purple-400"
            />
          )}
          {latest.wind_dir_deg !== undefined && (
            <MetricCard
              icon="🧭"
              label="Dir. vânt"
              value={`${latest.wind_dir_deg}°`}
              color="text-indigo-400"
            />
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-sm">{icon}</span>
        <span className="text-xs text-gray-400 truncate">{label}</span>
      </div>
      <p className={`${color} font-bold text-lg`}>{value}</p>
    </div>
  );
}

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TimeRange } from '../data/mockData';
import { downsample } from '../utils/downsample';

interface ChartDataPoint {
  timestamp: string;
  wind_avg_kmh?: number;
  wind_max_kmh?: number;
  wind_dir_deg?: number;
}

interface WindChartProps {
  data: ChartDataPoint[];
  timeRange: TimeRange;
}

function formatTimestamp(ts: string, range: TimeRange): string {
  const date = new Date(ts);
  if (range === '1h') {
    return date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  }
  if (range === '24h') {
    return date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  }
  if (range === '7d') {
    return date.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' }) + ' ' +
      date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' });
}

function getTickInterval(range: TimeRange, dataLength: number): number {
  if (dataLength <= 5) return 0;
  if (range === '1h') return Math.max(1, Math.floor(dataLength / 6));
  if (range === '24h') return Math.max(1, Math.floor(dataLength / 8));
  if (range === '7d') return Math.max(1, Math.floor(dataLength / 7));
  return Math.max(1, Math.floor(dataLength / 10));
}

export default function WindChart({ data, timeRange }: WindChartProps) {
  // Aplică downsampling pentru performanță
  const downsampledData = downsample(data);
  const windData = downsampledData.filter(d => d.wind_avg_kmh !== undefined);
  
  if (windData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Nicio dată pentru intervalul selectat
      </div>
    );
  }

  const interval = getTickInterval(timeRange, windData.length);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={windData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="timestamp"
          tickFormatter={(ts) => formatTimestamp(ts, timeRange)}
          stroke="#6b7280"
          fontSize={11}
          interval={interval}
          angle={-30}
          textAnchor="end"
          height={60}
        />
        <YAxis
          stroke="#6b7280"
          fontSize={11}
          domain={['auto', 'auto']}
          label={{ value: 'km/h', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '8px',
            color: '#f3f4f6',
          }}
          labelFormatter={(label) => `Timp: ${label}`}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="wind_avg_kmh"
          name="Vânt mediu"
          stroke="#14b8a6"
          strokeWidth={2}
          dot={windData.length < 30}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="wind_max_kmh"
          name="Vânt maxim"
          stroke="#a855f7"
          strokeWidth={1.5}
          strokeDasharray="5 5"
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

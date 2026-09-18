import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TimeRange } from '../data/mockData';

interface ChartDataPoint {
  timestamp: string;
  rain_mm?: number;
}

interface RainChartProps {
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

export default function RainChart({ data, timeRange }: RainChartProps) {
  const rainData = data.filter(d => d.rain_mm !== undefined && d.rain_mm > 0);
  
  if (rainData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <span className="text-3xl block mb-2">☀️</span>
          <p>Nu au fost înregistrate precipitații</p>
        </div>
      </div>
    );
  }

  const interval = getTickInterval(timeRange, rainData.length);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={rainData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="rainGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.8} />
            <stop offset="100%" stopColor="#0891b2" stopOpacity={0.4} />
          </linearGradient>
        </defs>
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
          label={{ value: 'mm', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '8px',
            color: '#f3f4f6',
          }}
          labelFormatter={(label) => `Timp: ${label}`}
          formatter={(value: number) => [`${value} mm`, 'Precipitații']}
        />
        <Bar
          dataKey="rain_mm"
          fill="url(#rainGradient)"
          radius={[4, 4, 0, 0]}
          name="Ploaie"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

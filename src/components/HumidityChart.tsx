import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TimeRange } from '../data/mockData';

interface ChartDataPoint {
  timestamp: string;
  humidity?: number;
  sensorId?: string;
  sensorName?: string;
}

interface HumidityChartProps {
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

const defaultColors = ['#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#3b82f6'];

export default function HumidityChart({ data, timeRange }: HumidityChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Nicio dată pentru intervalul selectat
      </div>
    );
  }

  const sensorIds = [...new Set(data.map(d => d.sensorId).filter(Boolean))] as string[];

  if (sensorIds.length === 1) {
    const sensorData = data.map(d => ({
      timestamp: d.timestamp,
      value: d.humidity,
    }));

    const interval = getTickInterval(timeRange, sensorData.length);

    return (
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={sensorData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="humGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
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
            domain={[0, 100]}
            label={{ value: '%', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#f3f4f6',
            }}
            labelFormatter={(label) => `Timp: ${label}`}
            formatter={(value: number) => [`${value}%`, 'Umiditate']}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#06b6d4"
            strokeWidth={2}
            fill="url(#humGradient)"
            dot={data.length < 30}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // Multiple sensors
  const allTimestamps = [...new Set(data.map(d => d.timestamp))].sort();
  const combinedData = allTimestamps.map(ts => {
    const point: Record<string, string | number | undefined> = { timestamp: ts };
    data.filter(d => d.timestamp === ts).forEach(d => {
      if (d.sensorId) {
        point[d.sensorId] = d.humidity;
      }
    });
    return point;
  });

  const interval = getTickInterval(timeRange, combinedData.length);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={combinedData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
          domain={[0, 100]}
          label={{ value: '%', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
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
        {sensorIds.map((id, idx) => {
          const color = defaultColors[idx % defaultColors.length];
          const name = data.find(d => d.sensorId === id)?.sensorName || id;
          return (
            <Area
              key={id}
              type="monotone"
              dataKey={id}
              name={name}
              stroke={color}
              strokeWidth={2}
              fillOpacity={0.15}
              fill={color}
            />
          );
        })}
      </AreaChart>
    </ResponsiveContainer>
  );
}

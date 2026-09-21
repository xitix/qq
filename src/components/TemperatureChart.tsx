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

interface ChartDataPoint {
  timestamp: string;
  temperature?: number;
  sensorId?: string;
  sensorName?: string;
}

interface TemperatureChartProps {
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

// Colors will be determined from data
const defaultColors = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

// Downsampling pentru performanță - limitează punctele afișate
function downsample<T>(data: T[], maxPoints: number = 300): T[] {
  if (data.length <= maxPoints) return data;
  const step = Math.ceil(data.length / maxPoints);
  return data.filter((_, i) => i % step === 0);
}

export default function TemperatureChart({ data, timeRange }: TemperatureChartProps) {
  // Aplică downsampling pentru performanță
  const chartData = downsample(data);
  
  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Nicio dată pentru intervalul selectat
      </div>
    );
  }

  // Group data by sensor
  const sensorIds = [...new Set(chartData.map(d => d.sensorId))];
  
  // For single sensor, show simple line chart
  if (sensorIds.length === 1) {
    const sensorData = chartData.map(d => ({
      timestamp: d.timestamp,
      value: d.temperature,
    }));

    const interval = getTickInterval(timeRange, sensorData.length);

    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={sensorData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
            label={{ value: '°C', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#f3f4f6',
            }}
            labelFormatter={(label) => `Timp: ${label}`}
            formatter={(value: number) => [`${value}°C`, 'Temperatură']}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={defaultColors[0]}
            strokeWidth={2}
            dot={chartData.length < 30}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // For multiple sensors, overlay lines
  const allTimestamps = [...new Set(chartData.map(d => d.timestamp))].sort();
  const combinedData = allTimestamps.map(ts => {
    const point: Record<string, string | number | undefined> = { timestamp: ts };
    chartData.filter(d => d.timestamp === ts).forEach(d => {
      if (d.sensorId) {
        point[d.sensorId] = d.temperature;
      }
    });
    return point;
  });

  const interval = getTickInterval(timeRange, combinedData.length);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={combinedData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
          label={{ value: '°C', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
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
        {sensorIds.map((id, idx) => (
          <Line
            key={id}
            type="monotone"
            dataKey={id}
            name={chartData.find(d => d.sensorId === id)?.sensorName || id}
            stroke={defaultColors[idx % defaultColors.length]}
            strokeWidth={2}
            dot={combinedData.length < 30}
            activeDot={{ r: 4 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

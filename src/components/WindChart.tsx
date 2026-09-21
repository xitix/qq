import { useMemo } from 'react';
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
import {
  bucketWindData,
  formatTimestamp,
  getTickInterval,
} from '../data/chartUtils';

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

export default function WindChart({ data, timeRange }: WindChartProps) {
  const windData = useMemo(() => {
    const raw = data.filter(d => d.wind_avg_kmh !== undefined || d.wind_max_kmh !== undefined);
    return bucketWindData(raw, timeRange);
  }, [data, timeRange]);

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
          labelFormatter={(label) => `Timp: ${formatTimestamp(String(label), timeRange)}`}
          formatter={(value: any, name: any) => [`${value} km/h`, name]}
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
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="wind_max_kmh"
          name="Rafală maximă"
          stroke="#a855f7"
          strokeWidth={1.5}
          strokeDasharray="5 5"
          dot={false}
          activeDot={{ r: 4 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

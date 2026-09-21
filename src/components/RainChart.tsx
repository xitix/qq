import { useMemo } from 'react';
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
import {
  bucketRainData,
  formatTimestamp,
  getTickInterval,
} from '../data/chartUtils';

interface ChartDataPoint {
  timestamp: string;
  rain_mm?: number;
}

interface RainChartProps {
  data: ChartDataPoint[];
  timeRange: TimeRange;
}

export default function RainChart({ data, timeRange }: RainChartProps) {
  const rainData = useMemo(() => {
    const raw = data.filter(d => d.rain_mm !== undefined && d.rain_mm > 0);
    return bucketRainData(raw, timeRange);
  }, [data, timeRange]);

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
          labelFormatter={(label) => `Timp: ${formatTimestamp(String(label), timeRange)}`}
          formatter={(value: any) => [`${value} mm`, 'Precipitații']}
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

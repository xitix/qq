import { useMemo } from 'react';
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
import {
  bucketMultiSensorMetric,
  formatTimestamp,
  getTickInterval,
} from '../data/chartUtils';

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

const defaultColors = ['#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#3b82f6'];

export default function HumidityChart({ data, timeRange }: HumidityChartProps) {
  const { combinedData, sensorIds, sensorNames } = useMemo(() => {
    const raw = data.map(d => ({
      timestamp: d.timestamp,
      sensorId: d.sensorId,
      sensorName: d.sensorName,
      value: d.humidity,
    }));
    const { combinedData, sensorIds } = bucketMultiSensorMetric(raw, timeRange);

    const names: Record<string, string> = {};
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      if (d.sensorId && d.sensorName) {
        names[d.sensorId] = d.sensorName;
      }
    }
    return { combinedData, sensorIds, sensorNames: names };
  }, [data, timeRange]);

  if (combinedData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Nicio dată pentru intervalul selectat
      </div>
    );
  }

  const interval = getTickInterval(timeRange, combinedData.length);
  const isSingle = sensorIds.length <= 1;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={combinedData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="humGradientSingle" x1="0" y1="0" x2="0" y2="1">
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
          labelFormatter={(label) => `Timp: ${formatTimestamp(String(label), timeRange)}`}
          formatter={(value: any, name: any) => [
            `${value}%`,
            sensorNames[String(name)] || (isSingle ? 'Umiditate' : name),
          ]}
        />
        {!isSingle && <Legend />}
        {sensorIds.map((id, idx) => {
          const color = defaultColors[idx % defaultColors.length];
          return (
            <Area
              key={id}
              type="monotone"
              dataKey={id}
              name={sensorNames[id] || id}
              stroke={color}
              strokeWidth={2}
              fillOpacity={isSingle ? 0.3 : 0.15}
              fill={isSingle ? 'url(#humGradientSingle)' : color}
              connectNulls
            />
          );
        })}
      </AreaChart>
    </ResponsiveContainer>
  );
}

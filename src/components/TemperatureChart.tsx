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
  bucketMultiSensorMetric,
  formatTimestamp,
  getTickInterval,
} from '../data/chartUtils';

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

const defaultColors = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function TemperatureChart({ data, timeRange }: TemperatureChartProps) {
  const { combinedData, sensorIds, sensorNames } = useMemo(() => {
    const raw = data.map(d => ({
      timestamp: d.timestamp,
      sensorId: d.sensorId,
      sensorName: d.sensorName,
      value: d.temperature,
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
          labelFormatter={(label) => `Timp: ${formatTimestamp(String(label), timeRange)}`}
          formatter={(value: any, name: any) => [
            `${value}°C`,
            sensorNames[String(name)] || (isSingle ? 'Temperatură' : name),
          ]}
        />
        {!isSingle && <Legend />}
        {sensorIds.map((id, idx) => (
          <Line
            key={id}
            type="monotone"
            dataKey={id}
            name={sensorNames[id] || id}
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

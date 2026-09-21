import { TimeRange } from './mockData';

export interface ChartPoint {
  timestamp: string;
  [key: string]: string | number | undefined;
}

/**
 * Parses timestamp safely across all browsers (including Safari/iOS).
 * Replaces space with 'T' for ISO-8601 parsing.
 */
export function parseDate(ts: string): Date {
  if (!ts) return new Date();
  return new Date(ts.replace(' ', 'T'));
}

export function parseTimestampMs(ts: string): number {
  if (!ts) return 0;
  const ms = new Date(ts.replace(' ', 'T')).getTime();
  return isNaN(ms) ? 0 : ms;
}

/**
 * Returns the bucket interval in milliseconds based on time range.
 */
export function getBucketIntervalMs(range: TimeRange, dataLength: number): number {
  switch (range) {
    case '1h':
      return 60 * 1000; // 1 minute buckets (max ~60 points)
    case '7h':
      return 3 * 60 * 1000; // 3 minute buckets (max ~140 points)
    case '24h':
      return 5 * 60 * 1000; // 5 minute buckets (max ~288 points)
    case '7d':
      return 30 * 60 * 1000; // 30 minute buckets (max ~336 points)
    case 'all':
      return dataLength > 2000 ? 2 * 60 * 60 * 1000 : 60 * 60 * 1000; // 1-2 hour buckets
    default:
      return 5 * 60 * 1000;
  }
}

/**
 * Formats a timestamp for chart XAxis based on time range.
 */
export function formatTimestamp(ts: string, range: TimeRange): string {
  const date = parseDate(ts);
  if (isNaN(date.getTime())) return ts;

  if (range === '1h' || range === '7h' || range === '24h') {
    return date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  }
  if (range === '7d') {
    return date.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' }) + ' ' +
      date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' });
}

/**
 * Calculates optimal tick interval for XAxis so labels don't collide.
 */
export function getTickInterval(range: TimeRange, dataLength: number): number {
  if (dataLength <= 6) return 0;
  if (range === '1h') return Math.max(1, Math.floor(dataLength / 6));
  if (range === '7h') return Math.max(1, Math.floor(dataLength / 7));
  if (range === '24h') return Math.max(1, Math.floor(dataLength / 8));
  if (range === '7d') return Math.max(1, Math.floor(dataLength / 7));
  return Math.max(1, Math.floor(dataLength / 10));
}

export interface RawMetricReading {
  timestamp: string;
  sensorId?: string;
  sensorName?: string;
  value?: number;
}

/**
 * High performance O(N) multi-sensor bucketing and downsampling.
 * Groups readings into time buckets, computes average per sensor,
 * and aligns multiple sensors on identical timestamps.
 */
export function bucketMultiSensorMetric(
  data: RawMetricReading[],
  range: TimeRange
): { combinedData: ChartPoint[]; sensorIds: string[] } {
  if (!data || data.length === 0) {
    return { combinedData: [], sensorIds: [] };
  }

  // Extract unique sensorIds in order of appearance
  const sensorIdSet = new Set<string>();
  for (let i = 0; i < data.length; i++) {
    if (data[i].sensorId) {
      sensorIdSet.add(data[i].sensorId!);
    }
  }
  const sensorIds = Array.from(sensorIdSet);

  const bucketMs = getBucketIntervalMs(range, data.length);

  // Map: bucketKey -> { bucketTs, sensors: { [sensorId]: { sum, count } } }
  const buckets = new Map<number, { bucketTs: string; sensors: Record<string, { sum: number; count: number }> }>();

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (item.value === undefined || isNaN(item.value)) continue;

    const tsMs = parseTimestampMs(item.timestamp);
    if (tsMs === 0) continue;

    // Round to bucket interval
    const bucketKey = Math.floor(tsMs / bucketMs) * bucketMs;

    let bucket = buckets.get(bucketKey);
    if (!bucket) {
      const bucketDate = new Date(bucketKey);
      const isoStr = bucketDate.getFullYear() + '-' +
        String(bucketDate.getMonth() + 1).padStart(2, '0') + '-' +
        String(bucketDate.getDate()).padStart(2, '0') + ' ' +
        String(bucketDate.getHours()).padStart(2, '0') + ':' +
        String(bucketDate.getMinutes()).padStart(2, '0') + ':00';

      bucket = { bucketTs: isoStr, sensors: {} };
      buckets.set(bucketKey, bucket);
    }

    const sId = item.sensorId || 'default';
    if (!bucket.sensors[sId]) {
      bucket.sensors[sId] = { sum: item.value, count: 1 };
    } else {
      bucket.sensors[sId].sum += item.value;
      bucket.sensors[sId].count += 1;
    }
  }

  // Sort bucket keys chronologically
  const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b);

  const combinedData: ChartPoint[] = sortedKeys.map(k => {
    const b = buckets.get(k)!;
    const point: ChartPoint = { timestamp: b.bucketTs };
    for (const [sId, agg] of Object.entries(b.sensors)) {
      point[sId] = Math.round((agg.sum / agg.count) * 10) / 10;
    }
    return point;
  });

  return { combinedData, sensorIds };
}

export interface WindChartPoint {
  timestamp: string;
  wind_avg_kmh?: number;
  wind_max_kmh?: number;
  wind_dir_deg?: number;
  [key: string]: any;
}

/**
 * Downsamples wind data into time buckets, preserving max gusts and average speed.
 */
export function bucketWindData(
  data: WindChartPoint[],
  range: TimeRange
): WindChartPoint[] {
  if (!data || data.length === 0) return [];
  const bucketMs = getBucketIntervalMs(range, data.length);

  const buckets = new Map<number, {
    bucketTs: string;
    sumAvg: number;
    countAvg: number;
    maxGust: number;
    lastDir?: number;
  }>();

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    const tsMs = parseTimestampMs(item.timestamp);
    if (tsMs === 0) continue;

    const bucketKey = Math.floor(tsMs / bucketMs) * bucketMs;
    let bucket = buckets.get(bucketKey);
    if (!bucket) {
      const bucketDate = new Date(bucketKey);
      const isoStr = bucketDate.getFullYear() + '-' +
        String(bucketDate.getMonth() + 1).padStart(2, '0') + '-' +
        String(bucketDate.getDate()).padStart(2, '0') + ' ' +
        String(bucketDate.getHours()).padStart(2, '0') + ':' +
        String(bucketDate.getMinutes()).padStart(2, '0') + ':00';

      bucket = { bucketTs: isoStr, sumAvg: 0, countAvg: 0, maxGust: 0, lastDir: item.wind_dir_deg };
      buckets.set(bucketKey, bucket);
    }

    if (item.wind_avg_kmh !== undefined) {
      bucket.sumAvg += item.wind_avg_kmh;
      bucket.countAvg += 1;
    }
    if (item.wind_max_kmh !== undefined) {
      bucket.maxGust = Math.max(bucket.maxGust, item.wind_max_kmh);
    }
    if (item.wind_dir_deg !== undefined) {
      bucket.lastDir = item.wind_dir_deg;
    }
  }

  const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b);
  return sortedKeys.map(k => {
    const b = buckets.get(k)!;
    return {
      timestamp: b.bucketTs,
      wind_avg_kmh: b.countAvg > 0 ? Math.round((b.sumAvg / b.countAvg) * 10) / 10 : 0,
      wind_max_kmh: Math.round(b.maxGust * 10) / 10,
      wind_dir_deg: b.lastDir,
    };
  });
}

export interface RainChartPoint {
  timestamp: string;
  rain_mm?: number;
}

/**
 * Downsamples rain data into time buckets, preserving max accumulated precipitation.
 */
export function bucketRainData(
  data: RainChartPoint[],
  range: TimeRange
): RainChartPoint[] {
  if (!data || data.length === 0) return [];
  const bucketMs = getBucketIntervalMs(range, data.length);

  const buckets = new Map<number, { bucketTs: string; maxRain: number }>();

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (item.rain_mm === undefined) continue;
    const tsMs = parseTimestampMs(item.timestamp);
    if (tsMs === 0) continue;

    const bucketKey = Math.floor(tsMs / bucketMs) * bucketMs;
    let bucket = buckets.get(bucketKey);
    if (!bucket) {
      const bucketDate = new Date(bucketKey);
      const isoStr = bucketDate.getFullYear() + '-' +
        String(bucketDate.getMonth() + 1).padStart(2, '0') + '-' +
        String(bucketDate.getDate()).padStart(2, '0') + ' ' +
        String(bucketDate.getHours()).padStart(2, '0') + ':' +
        String(bucketDate.getMinutes()).padStart(2, '0') + ':00';

      bucket = { bucketTs: isoStr, maxRain: item.rain_mm };
      buckets.set(bucketKey, bucket);
    } else {
      bucket.maxRain = Math.max(bucket.maxRain, item.rain_mm);
    }
  }

  const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b);
  return sortedKeys.map(k => {
    const b = buckets.get(k)!;
    return {
      timestamp: b.bucketTs,
      rain_mm: b.maxRain,
    };
  });
}

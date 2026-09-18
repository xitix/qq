import { SensorConfig, DEFAULT_SENSORS } from '../config/sensors';

export interface SensorReading {
  timestamp: string;
  temperature?: number;
  humidity?: number;
  rain_mm?: number;
  wind_avg_kmh?: number;
  wind_max_kmh?: number;
  wind_dir_deg?: number;
  battery?: string;
}

export interface Sensor {
  id: string;
  name: string;
  model?: string;
  deviceId?: string;
  lastUpdate: string;
  color: string;
  icon: string;
  metrics: string[];
  readings: SensorReading[];
}

export type TimeRange = '1h' | '24h' | '7d' | 'all';

// Generate readings based on sensor config
function generateReadings(config: SensorConfig): SensorReading[] {
  const readings: SensorReading[] = [];
  const now = new Date('2026-09-18T22:30:00');
  const startDate = new Date(now.getTime() - config.historyDays * 24 * 60 * 60 * 1000);
  
  let current = new Date(startDate);
  
  while (current <= now) {
    const hour = current.getHours();
    const reading: SensorReading = {
      timestamp: current.toISOString().replace('T', ' ').substring(0, 19),
    };
    
    if (config.metrics.includes('temperature')) {
      // Outdoor: bigger variation, indoor: smaller
      const isOutdoor = config.metrics.includes('wind');
      const baseTemp = isOutdoor 
        ? 14 + 6 * Math.sin((hour - 6) * Math.PI / 12)
        : 22 + 2 * Math.sin((hour - 8) * Math.PI / 12);
      const variance = isOutdoor ? 3 : 1;
      reading.temperature = Math.round((baseTemp + (Math.random() - 0.5) * variance) * 10) / 10;
    }
    
    if (config.metrics.includes('humidity')) {
      const isOutdoor = config.metrics.includes('wind');
      const baseHumidity = isOutdoor
        ? 75 - 20 * Math.sin((hour - 6) * Math.PI / 12)
        : 50 + 5 * Math.sin((hour - 10) * Math.PI / 12);
      const variance = isOutdoor ? 10 : 5;
      reading.humidity = Math.round(baseHumidity + (Math.random() - 0.5) * variance);
      reading.humidity = Math.max(30, Math.min(100, reading.humidity));
    }
    
    if (config.metrics.includes('wind')) {
      reading.wind_avg_kmh = Math.round(Math.random() * 15 * 10) / 10;
      reading.wind_max_kmh = Math.round((reading.wind_avg_kmh + Math.random() * 10) * 10) / 10;
      reading.wind_dir_deg = Math.round(Math.random() * 360);
    }
    
    if (config.metrics.includes('rain')) {
      reading.rain_mm = Math.random() > 0.85 ? Math.round(Math.random() * 2 * 10) / 10 : 0;
    }
    
    if (config.metrics.includes('battery')) {
      reading.battery = Math.random() > 0.05 ? 'ok' : 'low';
    }
    
    readings.push(reading);
    
    const interval = config.reportIntervalMin + Math.floor(Math.random() * (config.reportIntervalMin * 0.5));
    current = new Date(current.getTime() + interval * 60 * 1000);
  }
  
  return readings;
}

export function buildSensors(configs: SensorConfig[]): Sensor[] {
  const now = new Date('2026-09-18T22:30:00');
  
  return configs.map(config => {
    const readings = generateReadings(config);
    const lastReading = readings[readings.length - 1];
    const lastUpdate = lastReading?.timestamp || now.toISOString().replace('T', ' ').substring(0, 19);
    
    return {
      id: config.id,
      name: config.name,
      model: config.model,
      deviceId: config.deviceId,
      lastUpdate,
      color: config.color,
      icon: config.icon,
      metrics: config.metrics,
      readings,
    };
  });
}

// Load sensor configs from localStorage or use defaults
export function loadSensorConfigs(): SensorConfig[] {
  try {
    const stored = localStorage.getItem('meteo_sensors');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load sensor configs:', e);
  }
  return DEFAULT_SENSORS;
}

export function saveSensorConfigs(configs: SensorConfig[]): void {
  try {
    localStorage.setItem('meteo_sensors', JSON.stringify(configs));
  } catch (e) {
    console.warn('Failed to save sensor configs:', e);
  }
}

export function filterByTimeRange(readings: SensorReading[], range: TimeRange): SensorReading[] {
  const now = new Date('2026-09-18T22:30:00');
  let cutoff: Date;
  
  switch (range) {
    case '1h':
      cutoff = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case '24h':
      cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'all':
      return readings;
  }
  
  return readings.filter(r => new Date(r.timestamp) >= cutoff);
}

export function filterAberrations(readings: SensorReading[]): SensorReading[] {
  if (readings.length < 3) return readings;
  
  return readings.filter((reading, index) => {
    if (index === 0 || index === readings.length - 1) return true;
    
    const prev = readings[index - 1];
    const next = readings[index + 1];
    
    if (reading.temperature !== undefined && prev.temperature !== undefined && next.temperature !== undefined) {
      const avgNeighborTemp = (prev.temperature + next.temperature) / 2;
      if (Math.abs(reading.temperature - avgNeighborTemp) > 10) return false;
    }
    
    if (reading.humidity !== undefined && prev.humidity !== undefined && next.humidity !== undefined) {
      const avgNeighborHum = (prev.humidity + next.humidity) / 2;
      if (Math.abs(reading.humidity - avgNeighborHum) > 40) return false;
    }
    
    return true;
  });
}

export function getLatestReading(readings: SensorReading[]): SensorReading | null {
  if (readings.length === 0) return null;
  return readings[readings.length - 1];
}

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
  readings: SensorReading[];
}

// Generate realistic mock data for the past 7 days
function generateReadings(): SensorReading[] {
  const readings: SensorReading[] = [];
  const now = new Date('2026-09-18T22:27:26');
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  let current = new Date(sevenDaysAgo);
  
  while (current <= now) {
    const hour = current.getHours();
    // Temperature varies: cooler at night, warmer during day
    const baseTemp = 14 + 6 * Math.sin((hour - 6) * Math.PI / 12);
    const temp = Math.round((baseTemp + (Math.random() - 0.5) * 3) * 10) / 10;
    
    // Humidity: higher at night, lower during day
    const baseHumidity = 75 - 20 * Math.sin((hour - 6) * Math.PI / 12);
    const humidity = Math.round(baseHumidity + (Math.random() - 0.5) * 10);
    
    // Wind
    const windAvg = Math.round(Math.random() * 15 * 10) / 10;
    const windMax = Math.round((windAvg + Math.random() * 10) * 10) / 10;
    const windDir = Math.round(Math.random() * 360);
    
    // Rain (occasional)
    const rain = Math.random() > 0.85 ? Math.round(Math.random() * 2 * 10) / 10 : 0;
    
    readings.push({
      timestamp: current.toISOString().replace('T', ' ').substring(0, 19),
      temperature: temp,
      humidity: Math.max(30, Math.min(100, humidity)),
      rain_mm: rain,
      wind_avg_kmh: windAvg,
      wind_max_kmh: windMax,
      wind_dir_deg: windDir,
      battery: 'ok',
    });
    
    // Add reading every 30-60 minutes with some randomness
    const interval = 30 + Math.floor(Math.random() * 30);
    current = new Date(current.getTime() + interval * 60 * 1000);
  }
  
  return readings;
}

// Generate kitchen sensor data (fewer readings, last 3 days only)
function generateKitchenReadings(): SensorReading[] {
  const readings: SensorReading[] = [];
  const now = new Date('2026-09-18T22:25:00');
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  
  let current = new Date(threeDaysAgo);
  
  while (current <= now) {
    const hour = current.getHours();
    // Kitchen is warmer and more stable
    const baseTemp = 22 + 2 * Math.sin((hour - 8) * Math.PI / 12);
    const temp = Math.round((baseTemp + (Math.random() - 0.5) * 1) * 10) / 10;
    
    const baseHumidity = 50 + 5 * Math.sin((hour - 10) * Math.PI / 12);
    const humidity = Math.round(baseHumidity + (Math.random() - 0.5) * 5);
    
    readings.push({
      timestamp: current.toISOString().replace('T', ' ').substring(0, 19),
      temperature: temp,
      humidity: Math.max(30, Math.min(80, humidity)),
      battery: 'ok',
    });
    
    // Kitchen sensor reports every 2-3 minutes
    const interval = 2 + Math.floor(Math.random() * 1);
    current = new Date(current.getTime() + interval * 60 * 1000);
  }
  
  return readings;
}

export const sensors: Sensor[] = [
  {
    id: 'bucatarie',
    name: 'Senzor Bucătărie',
    model: 'Fineoffset-WHx080',
    deviceId: '187',
    lastUpdate: '2026-09-18 22:25:00',
    readings: generateKitchenReadings(),
  },
  {
    id: 'curte',
    name: 'Stație Meteo Curte',
    model: 'Fineoffset-WHx080',
    deviceId: '241',
    lastUpdate: '2026-09-18 22:27:26',
    readings: generateReadings(),
  },
];

export type TimeRange = '1h' | '24h' | '7d' | 'all';

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
    
    // Check temperature aberrations (jump > 10°C from neighbors)
    if (reading.temperature && prev.temperature && next.temperature) {
      const avgNeighborTemp = (prev.temperature + next.temperature) / 2;
      if (Math.abs(reading.temperature - avgNeighborTemp) > 10) return false;
    }
    
    // Check humidity aberrations (jump > 40% from neighbors)
    if (reading.humidity && prev.humidity && next.humidity) {
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

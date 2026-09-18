/**
 * Client API pentru comunicarea cu web_server.py de pe Orange Pi
 * Fetch-ează datele din sensors.db prin endpoint-uri JSON
 */

import { SensorReading } from './mockData';

const API_BASE = window.location.origin; // același server

export interface SensorInfo {
  id: string;
  model: string;
  device_id: string;
  name: string;
  last_update: string;
  battery: string;
  metrics: string[];
}

export interface APIResponse {
  sensors: SensorInfo[];
  readings: Record<string, SensorReading[]>;
  db_size_mb?: number;
  last_modified?: string;
}

export interface DBStatus {
  loaded: boolean;
  error: string | null;
  tables: string[];
  sensorCount: number;
  lastRefresh: Date | null;
}

let lastStatus: DBStatus = {
  loaded: false,
  error: null,
  tables: [],
  sensorCount: 0,
  lastRefresh: null,
};

/**
 * Fetch-ează toate datele de la API
 */
export async function fetchAllData(): Promise<APIResponse | null> {
  try {
    // Cache-busting query param pentru a forța reîncărcarea
    const response = await fetch(`${API_BASE}/api/all?t=${Date.now()}`, {
      cache: 'no-store',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (err) {
    console.error('API fetch error:', err);
    return null;
  }
}

/**
 * Fetch-ează doar ultimile citiri (pentru refresh rapid)
 */
export async function fetchLatest(): Promise<Record<string, SensorReading> | null> {
  try {
    const response = await fetch(`${API_BASE}/api/latest?t=${Date.now()}`, {
      cache: 'no-store',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (err) {
    console.error('Latest fetch error:', err);
    return null;
  }
}

/**
 * Fetch-ează istoricul pentru un senzor specific
 */
export async function fetchSensorHistory(
  sensorId: string,
  hours: number = 24
): Promise<SensorReading[]> {
  try {
    const response = await fetch(
      `${API_BASE}/api/sensor/${sensorId}?hours=${hours}&t=${Date.now()}`,
      { cache: 'no-store' }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (err) {
    console.error('History fetch error:', err);
    return [];
  }
}

export interface AvailableSensor {
  id: string;
  device_id: string;
  name: string;
  model: string;
  table: string;
  first_seen: string;
  last_update: string;
  total_readings: number;
  avg_temperature: number | null;
  avg_humidity: number | null;
  battery: string;
  metrics: string[];
  rssi: number | null;
  protocol: string;
}

/**
 * Fetch-ează lista completă de senzori disponibili în DB
 */
export async function fetchAvailableSensors(): Promise<AvailableSensor[]> {
  try {
    const response = await fetch(`${API_BASE}/api/sensors?t=${Date.now()}`, {
      cache: 'no-store',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return data.sensors || [];
  } catch (err) {
    console.error('Available sensors fetch error:', err);
    return [];
  }
}

/**
 * Inițializează conexiunea cu API-ul
 */
export async function initDatabase(): Promise<DBStatus> {
  try {
    const response = await fetch(`${API_BASE}/api/status?t=${Date.now()}`, {
      cache: 'no-store',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const status = await response.json();
    
    lastStatus = {
      loaded: true,
      error: null,
      tables: status.tables || [],
      sensorCount: status.sensor_count || 0,
      lastRefresh: new Date(),
    };
    
    console.log('✅ API connected:', lastStatus);
    return lastStatus;
  } catch (err) {
    console.warn('⚠️ API not available, using demo mode:', err);
    lastStatus = {
      loaded: false,
      error: err instanceof Error ? err.message : 'API not available',
      tables: [],
      sensorCount: 0,
      lastRefresh: new Date(),
    };
    return lastStatus;
  }
}

export function getStatus(): DBStatus {
  return lastStatus;
}

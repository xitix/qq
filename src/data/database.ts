import initSqlJs, { Database } from 'sql.js';
import { SensorConfig } from '../config/sensors';
import { SensorReading } from './mockData';

let db: Database | null = null;
let dbLoaded = false;
let dbError: string | null = null;

export interface DBStatus {
  loaded: boolean;
  error: string | null;
  tables: string[];
}

let SQLInstance: any = null;

async function getSQL() {
  if (!SQLInstance) {
    SQLInstance = await initSqlJs({
      locateFile: (file: string) => `https://sql.js.org/dist/${file}`,
    });
  }
  return SQLInstance;
}

export async function initDatabase(forceReload = false): Promise<DBStatus> {
  // Skip if already loaded and not forcing reload
  if (dbLoaded && !forceReload) {
    return { loaded: true, error: null, tables: getTables() };
  }

  // Close existing database if reloading
  if (db && forceReload) {
    try {
      db.close();
    } catch (e) {
      // Ignore close errors
    }
    db = null;
    dbLoaded = false;
  }

  try {
    const SQL = await getSQL();

    // Try to load sensors.db from multiple locations
    const paths = [
      '/sensors.db',           // public folder (Vite serves this at root)
      './sensors.db',          // relative to current page
      '../sensors.db',         // parent directory
      'sensors.db',            // same directory
    ];
    
    let response: Response | null = null;
    let lastError: Error | null = null;
    
    for (const path of paths) {
      try {
        response = await fetch(path);
        if (response.ok) {
          console.log(`✅ Found sensors.db at: ${path}`);
          break;
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('Fetch failed');
      }
    }
    
    if (!response || !response.ok) {
      throw new Error(`sensors.db not found in any location (tried: ${paths.join(', ')})`);
    }

    const buffer = await response.arrayBuffer();
    db = new SQL.Database(new Uint8Array(buffer));
    dbLoaded = true;
    dbError = null;

    console.log('✅ sensors.db loaded successfully');
    console.log('Tables:', getTables());

    return { loaded: true, error: null, tables: getTables() };
  } catch (err) {
    console.warn('⚠️ Could not load sensors.db:', err);
    dbError = err instanceof Error ? err.message : 'Unknown error';
    return { loaded: false, error: dbError, tables: [] };
  }
}

function getTables(): string[] {
  if (!db) return [];
  try {
    const result = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    if (result.length === 0) return [];
    return result[0].values.map((row: any[]) => row[0] as string);
  } catch {
    return [];
  }
}

export function getTableSchema(tableName: string): { columns: string[]; rowCount: number } | null {
  if (!db) return null;
  try {
    const result = db.exec(`PRAGMA table_info(${tableName})`);
    if (result.length === 0) return null;
    const columns = result[0].values.map(row => row[1] as string);
    
    const countResult = db.exec(`SELECT COUNT(*) FROM ${tableName}`);
    const rowCount = countResult[0]?.values[0][0] as number || 0;
    
    return { columns, rowCount };
  } catch {
    return null;
  }
}

/**
 * Detect sensor configs from database structure
 */
export function detectSensorsFromDB(): SensorConfig[] {
  if (!db) return [];
  
  const tables = getTables();
  const sensors: SensorConfig[] = [];
  
  // Look for tables that might contain sensor data
  // Common patterns: readings, sensor_data, measurements, or per-sensor tables
  for (const table of tables) {
    const schema = getTableSchema(table);
    if (!schema) continue;
    
    // Check if table has typical sensor columns
    const cols = schema.columns.map(c => c.toLowerCase());
    const hasTimestamp = cols.some(c => c.includes('time') || c.includes('date'));
    const hasSensorId = cols.some(c => c.includes('sensor') || c.includes('id') || c.includes('device'));
    const hasMetrics = cols.some(c => 
      c.includes('temp') || c.includes('humid') || c.includes('rain') || 
      c.includes('wind') || c.includes('battery')
    );
    
    if (hasTimestamp && (hasSensorId || hasMetrics)) {
      // This looks like a sensor data table
      const metrics: SensorConfig['metrics'] = [];
      if (cols.some(c => c.includes('temp'))) metrics.push('temperature');
      if (cols.some(c => c.includes('humid'))) metrics.push('humidity');
      if (cols.some(c => c.includes('rain'))) metrics.push('rain');
      if (cols.some(c => c.includes('wind'))) metrics.push('wind');
      if (cols.some(c => c.includes('batt'))) metrics.push('battery');
      
      if (metrics.length > 0) {
        // Try to find distinct sensor IDs
        const sensorIdCol = schema.columns.find(c => 
          c.toLowerCase().includes('sensor') || c.toLowerCase().includes('device') || c.toLowerCase() === 'id'
        );
        
        if (sensorIdCol) {
          try {
            const result = db.exec(`SELECT DISTINCT ${sensorIdCol} FROM ${table}`);
            if (result.length > 0) {
              for (const row of result[0].values as any[][]) {
                const sensorId = String(row[0]);
                sensors.push({
                  id: `${table}_${sensorId}`,
                  name: `Sensor ${sensorId}`,
                  deviceId: sensorId,
                  metrics,
                  historyDays: 7,
                  reportIntervalMin: 5,
                  color: '#3b82f6',
                  icon: '📡',
                });
              }
            }
          } catch {
            sensors.push({
              id: table,
              name: table,
              metrics,
              historyDays: 7,
              reportIntervalMin: 5,
              color: '#3b82f6',
              icon: '📡',
            });
          }
        } else {
          sensors.push({
            id: table,
            name: table,
            metrics,
            historyDays: 7,
            reportIntervalMin: 5,
            color: '#3b82f6',
            icon: '📡',
          });
        }
      }
    }
  }
  
  return sensors;
}

/**
 * Query readings for a specific sensor from the database
 */
export function queryReadings(
  tableName: string,
  sensorId?: string,
  sensorIdColumn?: string
): SensorReading[] {
  if (!db) return [];
  
  try {
    const schema = getTableSchema(tableName);
    if (!schema) return [];
    
    // Find column names (case-insensitive matching)
    const findCol = (patterns: string[]): string | null => {
      for (const pattern of patterns) {
        const col = schema.columns.find((c: string) => c.toLowerCase().includes(pattern));
        if (col) return col;
      }
      return null;
    };
    
    const timestampCol = findCol(['timestamp', 'time', 'date', 'created']);
    const tempCol = findCol(['temperature', 'temp']);
    const humCol = findCol(['humidity', 'humid']);
    const rainCol = findCol(['rain']);
    const windAvgCol = findCol(['wind_avg', 'wind_speed', 'windspeed']);
    const windMaxCol = findCol(['wind_max', 'wind_gust', 'gust']);
    const windDirCol = findCol(['wind_dir', 'direction', 'bearing']);
    const battCol = findCol(['battery', 'batt']);
    
    if (!timestampCol) return [];
    
    // Build query
    let query = `SELECT * FROM ${tableName}`;
    if (sensorId && sensorIdColumn) {
      query += ` WHERE ${sensorIdColumn} = '${sensorId}'`;
    }
    query += ` ORDER BY ${timestampCol} ASC`;
    
    const result = db.exec(query);
    if (result.length === 0) return [];
    
    const columns = result[0].columns as string[];
    const values = result[0].values as any[][];
    
    const getColIndex = (name: string | null) => {
      if (!name) return -1;
      return columns.findIndex(c => c.toLowerCase() === name.toLowerCase());
    };
    
    const tsIdx = getColIndex(timestampCol);
    const tempIdx = getColIndex(tempCol);
    const humIdx = getColIndex(humCol);
    const rainIdx = getColIndex(rainCol);
    const windAvgIdx = getColIndex(windAvgCol);
    const windMaxIdx = getColIndex(windMaxCol);
    const windDirIdx = getColIndex(windDirCol);
    const battIdx = getColIndex(battCol);
    
    return values.map(row => {
      const reading: SensorReading = {
        timestamp: String(row[tsIdx] || ''),
      };
      
      if (tempIdx >= 0 && row[tempIdx] != null) reading.temperature = Number(row[tempIdx]);
      if (humIdx >= 0 && row[humIdx] != null) reading.humidity = Number(row[humIdx]);
      if (rainIdx >= 0 && row[rainIdx] != null) reading.rain_mm = Number(row[rainIdx]);
      if (windAvgIdx >= 0 && row[windAvgIdx] != null) reading.wind_avg_kmh = Number(row[windAvgIdx]);
      if (windMaxIdx >= 0 && row[windMaxIdx] != null) reading.wind_max_kmh = Number(row[windMaxIdx]);
      if (windDirIdx >= 0 && row[windDirIdx] != null) reading.wind_dir_deg = Number(row[windDirIdx]);
      if (battIdx >= 0 && row[battIdx] != null) reading.battery = String(row[battIdx]);
      
      return reading;
    });
  } catch (err) {
    console.error('Query error:', err);
    return [];
  }
}

/**
 * Execute a raw SQL query (for debugging)
 */
export function rawQuery(sql: string): { columns: string[]; values: any[][] } | null {
  if (!db) return null;
  try {
    const result = db.exec(sql);
    if (result.length === 0) return null;
    return { columns: result[0].columns, values: result[0].values };
  } catch (err) {
    console.error('Raw query error:', err);
    return null;
  }
}

/**
 * Load database from a File object (user upload)
 */
export async function loadDatabaseFromFile(file: File): Promise<DBStatus> {
  try {
    const SQL = await getSQL();
    const buffer = await file.arrayBuffer();
    db = new SQL.Database(new Uint8Array(buffer));
    dbLoaded = true;
    dbError = null;
    
    console.log(`✅ Loaded sensors.db from file: ${file.name}`);
    console.log('Tables:', getTables());
    
    return { loaded: true, error: null, tables: getTables() };
  } catch (err) {
    console.error('Failed to load database from file:', err);
    dbError = err instanceof Error ? err.message : 'Unknown error';
    return { loaded: false, error: dbError, tables: [] };
  }
}

export function isDBLoaded(): boolean {
  return dbLoaded;
}

export function getDBError(): string | null {
  return dbError;
}

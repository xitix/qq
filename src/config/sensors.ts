export interface SensorConfig {
  id: string;
  name: string;
  model?: string;
  deviceId?: string;
  /** Tipuri de măsurători disponibile pentru acest senzor */
  metrics: ('temperature' | 'humidity' | 'rain' | 'wind' | 'battery')[];
  /** Câte zile de istoric generează (pentru demo) */
  historyDays: number;
  /** Interval de raportare în minute */
  reportIntervalMin: number;
  /** Culoare pentru grafice */
  color: string;
  /** Iconiță emoji */
  icon: string;
}

export const DEFAULT_SENSORS: SensorConfig[] = [
  {
    id: 'bucatarie',
    name: 'Senzor Bucătărie',
    model: 'Fineoffset-WHx080',
    deviceId: '187',
    metrics: ['temperature', 'humidity', 'battery'],
    historyDays: 3,
    reportIntervalMin: 2,
    color: '#f59e0b',
    icon: '🍳',
  },
  {
    id: 'curte',
    name: 'Stație Meteo Curte',
    model: 'Fineoffset-WHx080',
    deviceId: '241',
    metrics: ['temperature', 'humidity', 'rain', 'wind', 'battery'],
    historyDays: 7,
    reportIntervalMin: 30,
    color: '#3b82f6',
    icon: '🌤️',
  },
];

/** Culori disponibile pentru senzori noi */
export const AVAILABLE_COLORS = [
  '#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1',
];

/** Iconițe disponibile */
export const AVAILABLE_ICONS = [
  '🌡️', '🏠', '🛏️', '🚿', '🌿', '🏢', '🚗', '🐝',
  '🌤️', '🍳', '📡', '🌍', '🏔️', '🌊', '☀️', '🌙',
];

export type SampleType = 'onion' | 'milk';

export type OnionVerdict = 
  | 'Fresh' 
  | 'Slightly Aged' 
  | 'Moderately Spoiled' 
  | 'Highly Spoiled';

export type MilkVerdict = 
  | 'Fresh' 
  | 'Slightly Sour' 
  | 'Spoiled';

export type Verdict = OnionVerdict | MilkVerdict;

export type TestPhase = 
  | 'idle' 
  | 'evacuating' 
  | 'admitting' 
  | 'sensing' 
  | 'completed' 
  | 'stopped';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface SensorDataPoint {
  time_ms: number;
  MQ135: number;
  MQ137: number;
  TGS2600: number;
  TGS2602: number;
  TGS2620: number;
  temp_c: number;
  rh_pct: number;
}

export interface InspectionRecord {
  id: string;
  timestamp: string; // ISO date string
  sampleType: SampleType;
  sampleLabel: string; // 'Onion (प्याज़)' | 'Milk (दूध)'
  verdict: Verdict;
  confidence: number; // e.g. 96.8
  testType: 'hardware' | 'image';
  // Hardware test specific data
  sensorReadings?: {
    MQ135: number;
    MQ137: number;
    TGS2600: number;
    TGS2602: number;
    TGS2620: number;
  };
  temp_c?: number;
  rh_pct?: number;
  timeSeries?: SensorDataPoint[];
  // Image check specific data
  imagePreviewUrl?: string;
}

export const SAMPLE_OPTIONS: { id: SampleType; label: string; hindi: string; fullLabel: string }[] = [
  { id: 'onion', label: 'Onion', hindi: 'प्याज़', fullLabel: 'Onion (प्याज़)' },
  { id: 'milk', label: 'Milk', hindi: 'दूध', fullLabel: 'Milk (दूध)' }
];

export const SENSOR_KEYS = ['MQ135', 'MQ137', 'TGS2600', 'TGS2602', 'TGS2620'] as const;
export type SensorKey = typeof SENSOR_KEYS[number];

export const SENSOR_COLORS: Record<SensorKey, string> = {
  MQ135: '#14b8a6',   // Teal
  MQ137: '#3b82f6',   // Blue
  TGS2600: '#f59e0b', // Amber
  TGS2602: '#f43f5e', // Rose
  TGS2620: '#a855f7', // Purple
};

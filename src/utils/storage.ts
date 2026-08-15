import { InspectionRecord, SampleType } from '../types';
import { generateRandomCondition, generateTimeSeries } from './simulation';

const STORAGE_KEY = 'freshnose_inspections_archive_v2';
const MIN_SAVED_RECORDS = 30;

function createSeedHistory(): InspectionRecord[] {
  const seeds: InspectionRecord[] = [];
  const now = Date.now();
  const samples: SampleType[] = ['onion', 'milk'];

  // Seed 32 realistic historical records
  for (let i = 0; i < 32; i++) {
    const sampleType = samples[i % 2];
    const cond = generateRandomCondition(sampleType);
    const timeOffsetMs = (i * 3.5 + Math.random() * 2) * 3600 * 1000; // spread over past few days
    const date = new Date(now - timeOffsetMs);
    const isHardware = i % 7 !== 0; // mostly hardware tests

    const timeSeries = isHardware ? generateTimeSeries(cond, 14) : undefined;
    const finalPt = timeSeries ? timeSeries[timeSeries.length - 1] : undefined;

    seeds.push({
      id: `insp_${date.getTime()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: date.toISOString(),
      sampleType,
      sampleLabel: sampleType === 'onion' ? 'Onion (प्याज़)' : 'Milk (दूध)',
      verdict: cond.verdict,
      confidence: cond.confidence,
      testType: isHardware ? 'hardware' : 'image',
      sensorReadings: isHardware && finalPt ? {
        MQ135: finalPt.MQ135,
        MQ137: finalPt.MQ137,
        TGS2600: finalPt.TGS2600,
        TGS2602: finalPt.TGS2602,
        TGS2620: finalPt.TGS2620,
      } : undefined,
      temp_c: cond.temp_c,
      rh_pct: cond.rh_pct,
      timeSeries,
    });
  }

  return seeds.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function loadHistory(): InspectionRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = createSeedHistory();
      saveAllHistory(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as InspectionRecord[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const seeded = createSeedHistory();
      saveAllHistory(seeded);
      return seeded;
    }
    return parsed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (err) {
    console.error('Failed to load history from localStorage', err);
    return createSeedHistory();
  }
}

export function saveRecord(record: InspectionRecord): InspectionRecord[] {
  try {
    const existing = loadHistory();
    // Add to top (most recent first)
    const updated = [record, ...existing.filter(r => r.id !== record.id)];
    
    // Store in localStorage
    saveAllHistory(updated);
    return updated;
  } catch (err) {
    console.error('Failed to save record to localStorage', err);
    return [];
  }
}

export function saveAllHistory(records: InspectionRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    console.error('Failed to persist history to localStorage', err);
  }
}

export function deleteRecord(id: string): InspectionRecord[] {
  try {
    const existing = loadHistory();
    const updated = existing.filter(r => r.id !== id);
    saveAllHistory(updated);
    return updated;
  } catch (err) {
    console.error('Failed to delete record from localStorage', err);
    return [];
  }
}

export function clearHistory(): InspectionRecord[] {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    return [];
  } catch (err) {
    console.error('Failed to clear history from localStorage', err);
    return [];
  }
}

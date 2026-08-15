import { SampleType, Verdict, OnionVerdict, MilkVerdict, SensorDataPoint } from '../types';

export interface SimulatedCondition {
  verdict: Verdict;
  confidence: number;
  // Target plateau ADC values (0-4095) for sensing phase
  targets: {
    MQ135: number;
    MQ137: number;
    TGS2600: number;
    TGS2602: number;
    TGS2620: number;
  };
  // Baseline initial ADC values in clean air/evacuated chamber
  baselines: {
    MQ135: number;
    MQ137: number;
    TGS2600: number;
    TGS2602: number;
    TGS2620: number;
  };
  temp_c: number;
  rh_pct: number;
}

export function generateRandomCondition(sampleType: SampleType): SimulatedCondition {
  const temp_c = Number((23.5 + Math.random() * 2.5).toFixed(1));
  const rh_pct = Number((50 + Math.random() * 15).toFixed(1));

  // Baselines in clean chamber: ~250 - 550 ADC
  const baselines = {
    MQ135: Math.round(320 + Math.random() * 80),
    MQ137: Math.round(280 + Math.random() * 70),
    TGS2600: Math.round(350 + Math.random() * 90),
    TGS2602: Math.round(310 + Math.random() * 80),
    TGS2620: Math.round(290 + Math.random() * 70),
  };

  if (sampleType === 'onion') {
    const verdicts: OnionVerdict[] = ['Fresh', 'Slightly Aged', 'Moderately Spoiled', 'Highly Spoiled'];
    // Weighted random selection
    const r = Math.random();
    let verdict: OnionVerdict;
    let baseConfidence = 91 + Math.random() * 8.5;

    let targets: SimulatedCondition['targets'];

    if (r < 0.35) {
      verdict = 'Fresh';
      targets = {
        MQ135: Math.round(750 + Math.random() * 150),
        MQ137: Math.round(620 + Math.random() * 130),
        TGS2600: Math.round(680 + Math.random() * 140),
        TGS2602: Math.round(790 + Math.random() * 160),
        TGS2620: Math.round(580 + Math.random() * 120),
      };
    } else if (r < 0.65) {
      verdict = 'Slightly Aged';
      targets = {
        MQ135: Math.round(1450 + Math.random() * 220),
        MQ137: Math.round(1350 + Math.random() * 200),
        TGS2600: Math.round(1400 + Math.random() * 230),
        TGS2602: Math.round(1680 + Math.random() * 260),
        TGS2620: Math.round(1250 + Math.random() * 190),
      };
    } else if (r < 0.88) {
      verdict = 'Moderately Spoiled';
      targets = {
        MQ135: Math.round(2380 + Math.random() * 280),
        MQ137: Math.round(2250 + Math.random() * 270),
        TGS2600: Math.round(2310 + Math.random() * 260),
        TGS2602: Math.round(2820 + Math.random() * 310),
        TGS2620: Math.round(2050 + Math.random() * 250),
      };
    } else {
      verdict = 'Highly Spoiled';
      targets = {
        MQ135: Math.round(3450 + Math.random() * 280),
        MQ137: Math.round(3620 + Math.random() * 260),
        TGS2600: Math.round(3280 + Math.random() * 290),
        TGS2602: Math.round(3890 + Math.random() * 150),
        TGS2620: Math.round(3150 + Math.random() * 320),
      };
    }

    return {
      verdict,
      confidence: Number(baseConfidence.toFixed(1)),
      targets,
      baselines,
      temp_c,
      rh_pct,
    };
  } else {
    // Milk
    const r = Math.random();
    let verdict: MilkVerdict;
    let baseConfidence = 92 + Math.random() * 7.5;
    let targets: SimulatedCondition['targets'];

    if (r < 0.45) {
      verdict = 'Fresh';
      targets = {
        MQ135: Math.round(710 + Math.random() * 140),
        MQ137: Math.round(520 + Math.random() * 110),
        TGS2600: Math.round(660 + Math.random() * 130),
        TGS2602: Math.round(710 + Math.random() * 150),
        TGS2620: Math.round(560 + Math.random() * 110),
      };
    } else if (r < 0.78) {
      verdict = 'Slightly Sour';
      targets = {
        MQ135: Math.round(1820 + Math.random() * 240),
        MQ137: Math.round(1380 + Math.random() * 210),
        TGS2600: Math.round(1690 + Math.random() * 230),
        TGS2602: Math.round(2080 + Math.random() * 270),
        TGS2620: Math.round(1510 + Math.random() * 200),
      };
    } else {
      verdict = 'Spoiled';
      targets = {
        MQ135: Math.round(3200 + Math.random() * 310),
        MQ137: Math.round(2850 + Math.random() * 330),
        TGS2600: Math.round(2980 + Math.random() * 300),
        TGS2602: Math.round(3680 + Math.random() * 280),
        TGS2620: Math.round(2780 + Math.random() * 310),
      };
    }

    return {
      verdict,
      confidence: Number(baseConfidence.toFixed(1)),
      targets,
      baselines,
      temp_c,
      rh_pct,
    };
  }
}

/**
 * Calculates sensor value at elapsed time during Sensing phase.
 * First-order exponential response curve: Baseline + (Target - Baseline) * (1 - e^(-t / tau)) + jitter
 */
export function calculateSensorValue(
  baseline: number,
  target: number,
  elapsedSec: number,
  tau: number = 4.0
): number {
  const progress = 1 - Math.exp(-elapsedSec / tau);
  const val = baseline + (target - baseline) * progress;
  // Add small hardware ADC noise (+/- 6 counts)
  const noise = (Math.random() - 0.5) * 12;
  return Math.min(4095, Math.max(0, Math.round(val + noise)));
}

/**
 * Generates full 10Hz time-series data for a completed run.
 * Sensing duration e.g. 14s at 100ms interval (140 points).
 */
export function generateTimeSeries(
  condition: SimulatedCondition,
  sensingDurationSec: number = 14
): SensorDataPoint[] {
  const points: SensorDataPoint[] = [];
  const totalPoints = Math.round(sensingDurationSec * 10);
  const timeStepMs = 100;

  for (let i = 0; i <= totalPoints; i++) {
    const elapsedSec = (i * timeStepMs) / 1000;
    const time_ms = i * timeStepMs;

    points.push({
      time_ms,
      MQ135: calculateSensorValue(condition.baselines.MQ135, condition.targets.MQ135, elapsedSec, 3.8),
      MQ137: calculateSensorValue(condition.baselines.MQ137, condition.targets.MQ137, elapsedSec, 4.2),
      TGS2600: calculateSensorValue(condition.baselines.TGS2600, condition.targets.TGS2600, elapsedSec, 3.5),
      TGS2602: calculateSensorValue(condition.baselines.TGS2602, condition.targets.TGS2602, elapsedSec, 4.0),
      TGS2620: calculateSensorValue(condition.baselines.TGS2620, condition.targets.TGS2620, elapsedSec, 4.5),
      temp_c: condition.temp_c,
      rh_pct: condition.rh_pct,
    });
  }

  return points;
}

export function getVerdictSeverity(verdict: Verdict): {
  color: string;
  bgLight: string;
  bgDark: string;
  borderLight: string;
  borderDark: string;
  badgeBg: string;
  badgeText: string;
  dotColor: string;
} {
  switch (verdict) {
    case 'Fresh':
      return {
        color: '#0d9488', // Teal 600
        bgLight: 'bg-teal-50',
        bgDark: 'dark:bg-teal-950/40',
        borderLight: 'border-teal-200',
        borderDark: 'dark:border-teal-800/60',
        badgeBg: 'bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-300',
        badgeText: 'text-teal-700 dark:text-teal-400',
        dotColor: 'bg-teal-500',
      };
    case 'Slightly Aged':
    case 'Slightly Sour':
      return {
        color: '#d97706', // Amber 600
        bgLight: 'bg-amber-50',
        bgDark: 'dark:bg-amber-950/40',
        borderLight: 'border-amber-200',
        borderDark: 'dark:border-amber-800/60',
        badgeBg: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300',
        badgeText: 'text-amber-700 dark:text-amber-400',
        dotColor: 'bg-amber-500',
      };
    case 'Moderately Spoiled':
      return {
        color: '#ea580c', // Orange 600
        bgLight: 'bg-orange-50',
        bgDark: 'dark:bg-orange-950/40',
        borderLight: 'border-orange-200',
        borderDark: 'dark:border-orange-800/60',
        badgeBg: 'bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-300',
        badgeText: 'text-orange-700 dark:text-orange-400',
        dotColor: 'bg-orange-500',
      };
    case 'Highly Spoiled':
    case 'Spoiled':
      return {
        color: '#dc2626', // Red 600
        bgLight: 'bg-rose-50',
        bgDark: 'dark:bg-rose-950/40',
        borderLight: 'border-rose-200',
        borderDark: 'dark:border-rose-800/60',
        badgeBg: 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300',
        badgeText: 'text-rose-700 dark:text-rose-400',
        dotColor: 'bg-rose-500',
      };
  }
}

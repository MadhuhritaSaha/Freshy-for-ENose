import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Download, CheckCircle2, AlertCircle, Thermometer, Droplets, RefreshCw } from 'lucide-react';
import {
  SampleType,
  TestPhase,
  SensorDataPoint,
  InspectionRecord,
  SENSOR_KEYS,
  SENSOR_COLORS,
  SAMPLE_OPTIONS,
} from '../types';
import {
  SimulatedCondition,
  generateRandomCondition,
  calculateSensorValue,
  getVerdictSeverity,
} from '../utils/simulation';
import { SensorChart } from './SensorChart';
import { downloadRecordCSV } from '../utils/csv';

interface RunTestViewProps {
  selectedSample: SampleType;
  onSaveRecord: (record: InspectionRecord) => void;
}

export const RunTestView: React.FC<RunTestViewProps> = ({
  selectedSample,
  onSaveRecord,
}) => {
  const [phase, setPhase] = useState<TestPhase>('idle');
  const [phaseElapsed, setPhaseElapsed] = useState<number>(0);
  const [activeCondition, setActiveCondition] = useState<SimulatedCondition | null>(null);
  
  // Real-time sensor state
  const [currentReadings, setCurrentReadings] = useState<{
    MQ135: number;
    MQ137: number;
    TGS2600: number;
    TGS2602: number;
    TGS2620: number;
  }>({
    MQ135: 350,
    MQ137: 310,
    TGS2600: 360,
    TGS2602: 330,
    TGS2620: 300,
  });

  const [currentTemp, setCurrentTemp] = useState<number>(24.2);
  const [currentRh, setCurrentRh] = useState<number>(55.0);

  // Time series stream for chart
  const [timeSeries, setTimeSeries] = useState<SensorDataPoint[]>([]);
  const [completedRecord, setCompletedRecord] = useState<InspectionRecord | null>(null);

  const phaseTimerRef = useRef<number | null>(null);
  const sensingIntervalRef = useRef<number | null>(null);

  // Durations (in seconds)
  const EVACUATION_DURATION = 5;
  const HEADSPACE_DURATION = 3;
  const SENSING_DURATION = 14;

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
      if (sensingIntervalRef.current) clearInterval(sensingIntervalRef.current);
    };
  }, []);

  const handleStartTest = () => {
    // Reset any previous state
    if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
    if (sensingIntervalRef.current) clearInterval(sensingIntervalRef.current);

    const condition = generateRandomCondition(selectedSample);
    setActiveCondition(condition);
    setCompletedRecord(null);
    setTimeSeries([]);
    setCurrentTemp(condition.temp_c);
    setCurrentRh(condition.rh_pct);

    // Initial baseline readings
    setCurrentReadings({
      MQ135: condition.baselines.MQ135,
      MQ137: condition.baselines.MQ137,
      TGS2600: condition.baselines.TGS2600,
      TGS2602: condition.baselines.TGS2602,
      TGS2620: condition.baselines.TGS2620,
    });

    // Start Phase 1: Evacuating sensor chamber (5s)
    setPhase('evacuating');
    setPhaseElapsed(0);

    const startTime = Date.now();
    phaseTimerRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      setPhaseElapsed(Math.min(EVACUATION_DURATION, elapsed));

      // Chamber evacuation baseline settling
      setCurrentReadings((prev) => ({
        MQ135: Math.max(200, Math.round(condition.baselines.MQ135 + (Math.random() - 0.5) * 8)),
        MQ137: Math.max(200, Math.round(condition.baselines.MQ137 + (Math.random() - 0.5) * 8)),
        TGS2600: Math.max(200, Math.round(condition.baselines.TGS2600 + (Math.random() - 0.5) * 8)),
        TGS2602: Math.max(200, Math.round(condition.baselines.TGS2602 + (Math.random() - 0.5) * 8)),
        TGS2620: Math.max(200, Math.round(condition.baselines.TGS2620 + (Math.random() - 0.5) * 8)),
      }));

      if (elapsed >= EVACUATION_DURATION) {
        clearInterval(phaseTimerRef.current!);
        startHeadspacePhase(condition);
      }
    }, 100);
  };

  const startHeadspacePhase = (condition: SimulatedCondition) => {
    // Phase 2: Admitting sample headspace (3s)
    setPhase('admitting');
    setPhaseElapsed(0);

    const startTime = Date.now();
    phaseTimerRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      setPhaseElapsed(Math.min(HEADSPACE_DURATION, elapsed));

      if (elapsed >= HEADSPACE_DURATION) {
        clearInterval(phaseTimerRef.current!);
        startSensingPhase(condition);
      }
    }, 100);
  };

  const startSensingPhase = (condition: SimulatedCondition) => {
    // Phase 3: Sensing (14s) with ~4 updates per second (250ms interval) + fine resolution recording
    setPhase('sensing');
    setPhaseElapsed(0);

    const startTime = Date.now();
    const collectedSeries: SensorDataPoint[] = [];

    // Push initial t=0 point
    const initialPt: SensorDataPoint = {
      time_ms: 0,
      MQ135: condition.baselines.MQ135,
      MQ137: condition.baselines.MQ137,
      TGS2600: condition.baselines.TGS2600,
      TGS2602: condition.baselines.TGS2602,
      TGS2620: condition.baselines.TGS2620,
      temp_c: condition.temp_c,
      rh_pct: condition.rh_pct,
    };
    collectedSeries.push(initialPt);
    setTimeSeries([initialPt]);

    sensingIntervalRef.current = window.setInterval(() => {
      const elapsedSec = (Date.now() - startTime) / 1000;
      const currentMs = Math.round(elapsedSec * 1000);
      setPhaseElapsed(Math.min(SENSING_DURATION, elapsedSec));

      // Calculate instantaneous values with exponential rise
      const mq135Val = calculateSensorValue(condition.baselines.MQ135, condition.targets.MQ135, elapsedSec, 3.8);
      const mq137Val = calculateSensorValue(condition.baselines.MQ137, condition.targets.MQ137, elapsedSec, 4.2);
      const tgs2600Val = calculateSensorValue(condition.baselines.TGS2600, condition.targets.TGS2600, elapsedSec, 3.5);
      const tgs2602Val = calculateSensorValue(condition.baselines.TGS2602, condition.targets.TGS2602, elapsedSec, 4.0);
      const tgs2620Val = calculateSensorValue(condition.baselines.TGS2620, condition.targets.TGS2620, elapsedSec, 4.5);

      const latestReadings = {
        MQ135: mq135Val,
        MQ137: mq137Val,
        TGS2600: tgs2600Val,
        TGS2602: tgs2602Val,
        TGS2620: tgs2620Val,
      };

      setCurrentReadings(latestReadings);

      const pt: SensorDataPoint = {
        time_ms: currentMs,
        MQ135: mq135Val,
        MQ137: mq137Val,
        TGS2600: tgs2600Val,
        TGS2602: tgs2602Val,
        TGS2620: tgs2620Val,
        temp_c: condition.temp_c,
        rh_pct: condition.rh_pct,
      };

      collectedSeries.push(pt);
      setTimeSeries([...collectedSeries]);

      if (elapsedSec >= SENSING_DURATION) {
        clearInterval(sensingIntervalRef.current!);
        finishTest(condition, collectedSeries, latestReadings);
      }
    }, 250);
  };

  const finishTest = (
    condition: SimulatedCondition,
    series: SensorDataPoint[],
    finalReadings: {
      MQ135: number;
      MQ137: number;
      TGS2600: number;
      TGS2602: number;
      TGS2620: number;
    }
  ) => {
    setPhase('completed');

    const sampleOpt = SAMPLE_OPTIONS.find((s) => s.id === selectedSample)!;
    const record: InspectionRecord = {
      id: `insp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      sampleType: selectedSample,
      sampleLabel: sampleOpt.fullLabel,
      verdict: condition.verdict,
      confidence: condition.confidence,
      testType: 'hardware',
      sensorReadings: finalReadings,
      temp_c: condition.temp_c,
      rh_pct: condition.rh_pct,
      timeSeries: series,
    };

    setCompletedRecord(record);
    onSaveRecord(record);
  };

  const handleStopTest = () => {
    if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
    if (sensingIntervalRef.current) clearInterval(sensingIntervalRef.current);
    setPhase('stopped');
  };

  const isRunning = phase === 'evacuating' || phase === 'admitting' || phase === 'sensing';

  const severity = completedRecord ? getVerdictSeverity(completedRecord.verdict) : null;
  const sampleLabel = SAMPLE_OPTIONS.find((s) => s.id === selectedSample)?.fullLabel || selectedSample;

  return (
    <div className="space-y-6">
      {/* Test Controls & Status Bar */}
      <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              id="start-test-btn"
              type="button"
              disabled={isRunning}
              onClick={handleStartTest}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white shadow-xs transition-all ${
                isRunning
                  ? 'bg-slate-400 dark:bg-slate-700 cursor-not-allowed opacity-70'
                  : 'bg-teal-600 hover:bg-teal-700 active:scale-[0.99] dark:bg-teal-500 dark:hover:bg-teal-600 cursor-pointer shadow-sm'
              }`}
            >
              {phase === 'completed' || phase === 'stopped' ? (
                <RefreshCw className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
              <span>{phase === 'idle' ? 'Start Test' : 'Run New Test'}</span>
            </button>

            <button
              id="stop-test-btn"
              type="button"
              disabled={!isRunning}
              onClick={handleStopTest}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-all ${
                isRunning
                  ? 'border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 cursor-pointer'
                  : 'border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 bg-slate-50 dark:bg-slate-900 cursor-not-allowed'
              }`}
            >
              <Square className="w-4 h-4 fill-current" />
              <span>Stop</span>
            </button>
          </div>

          {/* Active Phase Badge / Indicator */}
          <div className="flex items-center gap-3 font-mono text-xs">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
              <span className="text-slate-400">Sample:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{sampleLabel}</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
              <Thermometer className="w-3.5 h-3.5 text-slate-500" />
              <span>{currentTemp}°C</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
              <Droplets className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>{currentRh}% RH</span>
            </div>
          </div>
        </div>

        {/* Phase Progress Bar */}
        {isRunning && (
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                </span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {phase === 'evacuating' && 'Phase 1/3: Evacuating sensor chamber...'}
                  {phase === 'admitting' && 'Phase 2/3: Admitting sample headspace...'}
                  {phase === 'sensing' && 'Phase 3/3: Sensing & acquiring multi-sensor response...'}
                </span>
              </div>
              <span className="text-slate-500 font-mono">
                {phase === 'evacuating' && `${phaseElapsed.toFixed(1)}s / ${EVACUATION_DURATION}s`}
                {phase === 'admitting' && `${phaseElapsed.toFixed(1)}s / ${HEADSPACE_DURATION}s`}
                {phase === 'sensing' && `${phaseElapsed.toFixed(1)}s / ${SENSING_DURATION}s`}
              </span>
            </div>

            {/* Stepped progress indicators */}
            <div className="grid grid-cols-3 gap-2">
              <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-100"
                  style={{
                    width:
                      phase === 'evacuating'
                        ? `${(phaseElapsed / EVACUATION_DURATION) * 100}%`
                        : phase === 'admitting' || phase === 'sensing'
                        ? '100%'
                        : '0%',
                  }}
                />
              </div>
              <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-100"
                  style={{
                    width:
                      phase === 'admitting'
                        ? `${(phaseElapsed / HEADSPACE_DURATION) * 100}%`
                        : phase === 'sensing'
                        ? '100%'
                        : '0%',
                  }}
                />
              </div>
              <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-500 transition-all duration-100"
                  style={{
                    width:
                      phase === 'sensing'
                        ? `${(phaseElapsed / SENSING_DURATION) * 100}%`
                        : '0%',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {phase === 'stopped' && (
          <div className="mt-4 p-3 rounded-lg bg-slate-100 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Inspection test cycle stopped manually by user.</span>
          </div>
        )}
      </div>

      {/* 5 Live Numeric Readouts (MQ135, MQ137, TGS2600, TGS2602, TGS2620) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {SENSOR_KEYS.map((sensor) => {
          const val = currentReadings[sensor];
          const pct = ((val / 4095) * 100).toFixed(0);

          return (
            <div
              key={sensor}
              className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-xs transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: SENSOR_COLORS[sensor] }}
                  />
                  <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
                    {sensor}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">{pct}%</span>
              </div>

              <div className="my-2">
                <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 tracking-tight">
                  {val}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  ADC counts (0–4095)
                </div>
              </div>

              {/* Mini level bar */}
              <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-200"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: SENSOR_COLORS[sensor],
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Real-time 5-Trace Sensor Chart */}
      <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Live Sensor Chamber Headspace Traces
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Real-time 10 Hz acquisition from the 5 metal-oxide channels
            </p>
          </div>
          {isRunning && (
            <span className="inline-flex items-center gap-1.5 text-xs text-teal-600 dark:text-teal-400 font-mono font-medium">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
              STREAMING
            </span>
          )}
        </div>

        <SensorChart data={timeSeries} maxTimeSec={SENSING_DURATION} />
      </div>

      {/* Completion Result Card */}
      {completedRecord && severity && (
        <div
          className={`p-6 rounded-xl border ${severity.borderLight} ${severity.borderDark} ${severity.bgLight} ${severity.bgDark} transition-all shadow-xs space-y-4`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 dark:border-slate-800/60">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0 shadow-xs"
                style={{ backgroundColor: severity.color }}
              >
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Inspection Verdict · {completedRecord.sampleLabel}
                </span>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {completedRecord.verdict}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-3.5 py-1.5 rounded-lg bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 text-right shadow-xs">
                <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">
                  Confidence
                </span>
                <span className="text-base font-mono font-bold text-slate-900 dark:text-slate-100">
                  {completedRecord.confidence.toFixed(1)}%
                </span>
              </div>

              <button
                id="download-test-csv-btn"
                type="button"
                onClick={() => downloadRecordCSV(completedRecord)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-300 dark:border-slate-700 shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download CSV</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 rounded-lg bg-white/70 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800/60">
              <span className="text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">Timestamp</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 font-medium">
                {new Date(completedRecord.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-white/70 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800/60">
              <span className="text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">Peak Sensors</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 font-medium">
                MQ135: {completedRecord.sensorReadings?.MQ135} · MQ137: {completedRecord.sensorReadings?.MQ137}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-white/70 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800/60">
              <span className="text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">Ambient Conditions</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 font-medium">
                {completedRecord.temp_c}°C · {completedRecord.rh_pct}% RH
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-white/70 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800/60">
              <span className="text-slate-500 dark:text-slate-400 block mb-0.5 font-medium">Archive Status</span>
              <span className="text-teal-700 dark:text-teal-300 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Saved to History
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

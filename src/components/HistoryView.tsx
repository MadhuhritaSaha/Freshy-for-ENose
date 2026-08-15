import React, { useState } from 'react';
import {
  Download,
  Trash2,
  ChevronRight,
  X,
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  Layers,
  Thermometer,
  Droplets,
  Camera,
  Activity,
  Filter,
} from 'lucide-react';
import { InspectionRecord, SampleType, SENSOR_KEYS, SENSOR_COLORS } from '../types';
import { getVerdictSeverity } from '../utils/simulation';
import { downloadRecordCSV, downloadAllHistoryCSV } from '../utils/csv';
import { SensorChart } from './SensorChart';

interface HistoryViewProps {
  records: InspectionRecord[];
  onClearHistory: () => void;
  onDeleteRecord: (id: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  records,
  onClearHistory,
  onDeleteRecord,
}) => {
  const [selectedRecord, setSelectedRecord] = useState<InspectionRecord | null>(null);
  const [filterSample, setFilterSample] = useState<'all' | SampleType>('all');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const filteredRecords = records.filter((r) => {
    if (filterSample === 'all') return true;
    return r.sampleType === filterSample;
  });

  const handleRecordClick = (rec: InspectionRecord) => {
    setSelectedRecord(rec);
  };

  const handleClearConfirmed = () => {
    onClearHistory();
    setSelectedRecord(null);
    setShowClearConfirm(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions Bar */}
      <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Inspection Archive
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono font-medium">
              {records.length} records stored
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Persistent hardware inspection logs & calibrated image checks
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Sample filter */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
            <button
              id="filter-all-btn"
              type="button"
              onClick={() => setFilterSample('all')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                filterSample === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              All
            </button>
            <button
              id="filter-onion-btn"
              type="button"
              onClick={() => setFilterSample('onion')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                filterSample === 'onion'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Onion
            </button>
            <button
              id="filter-milk-btn"
              type="button"
              onClick={() => setFilterSample('milk')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                filterSample === 'milk'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Milk
            </button>
          </div>

          {/* Export all history CSV */}
          <button
            id="export-all-history-btn"
            type="button"
            disabled={records.length === 0}
            onClick={() => downloadAllHistoryCSV(records)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-300 dark:border-slate-700 shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>Export All (CSV)</span>
          </button>

          {/* Clear history */}
          <button
            id="clear-history-btn"
            type="button"
            disabled={records.length === 0}
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Clear History */}
      {showClearConfirm && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5 text-xs text-rose-800 dark:text-rose-300">
            <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              Are you sure you want to clear all stored inspection records? This action cannot be undone.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              id="confirm-clear-yes"
              type="button"
              onClick={handleClearConfirmed}
              className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Yes, Clear All
            </button>
            <button
              id="confirm-clear-cancel"
              type="button"
              onClick={() => setShowClearConfirm(false)}
              className="px-3 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* History Records List */}
      {filteredRecords.length === 0 ? (
        <div className="p-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <Layers className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            No inspection records found
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {filterSample !== 'all'
              ? `No logs for ${filterSample}. Switch filter or run a new inspection test.`
              : 'Completed hardware test runs and saved image checks will automatically appear here.'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-slate-800/80">
          {filteredRecords.map((rec) => {
            const severity = getVerdictSeverity(rec.verdict);
            const dateObj = new Date(rec.timestamp);
            const formattedDate = dateObj.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            const formattedTime = dateObj.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={rec.id}
                id={`record-item-${rec.id}`}
                onClick={() => handleRecordClick(rec)}
                className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                {/* Left: Info */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0 shadow-xs"
                    style={{ backgroundColor: severity.color }}
                  >
                    {rec.testType === 'hardware' ? (
                      <Activity className="w-4 h-4" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                        {rec.sampleLabel}
                      </span>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${severity.badgeBg}`}
                      >
                        {rec.verdict}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {formattedDate} {formattedTime}
                      </span>
                      <span>·</span>
                      <span>Conf: {rec.confidence.toFixed(1)}%</span>
                      <span>·</span>
                      <span className="capitalize">{rec.testType}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Quick actions & sensor teaser */}
                <div className="flex items-center gap-3 self-end sm:self-center">
                  {rec.sensorReadings && (
                    <div className="hidden md:flex items-center gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1 rounded border border-slate-200/60 dark:border-slate-700/60">
                      <span>MQ135: <strong className="text-slate-800 dark:text-slate-200">{rec.sensorReadings.MQ135}</strong></span>
                      <span>MQ137: <strong className="text-slate-800 dark:text-slate-200">{rec.sensorReadings.MQ137}</strong></span>
                    </div>
                  )}

                  <button
                    id={`download-csv-${rec.id}`}
                    type="button"
                    title="Download 10 Hz CSV"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadRecordCSV(rec);
                    }}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Record Detail Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0 shadow-xs"
                  style={{ backgroundColor: getVerdictSeverity(selectedRecord.verdict).color }}
                >
                  {selectedRecord.testType === 'hardware' ? (
                    <Activity className="w-5 h-5" />
                  ) : (
                    <Camera className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                    Inspection Log · {selectedRecord.id}
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {selectedRecord.sampleLabel}
                  </h3>
                </div>
              </div>

              <button
                id="close-modal-btn"
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Verdict & Meta Grid */}
            <div
              className={`p-4 rounded-xl border ${getVerdictSeverity(selectedRecord.verdict).borderLight} ${getVerdictSeverity(selectedRecord.verdict).borderDark} ${getVerdictSeverity(selectedRecord.verdict).bgLight} ${getVerdictSeverity(selectedRecord.verdict).bgDark} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
            >
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Recorded Verdict
                </span>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {selectedRecord.verdict}
                </div>
              </div>

              <div className="flex items-center gap-3 font-mono text-xs">
                <div className="px-3 py-1.5 rounded-lg bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 shadow-xs">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Confidence</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    {selectedRecord.confidence.toFixed(1)}%
                  </span>
                </div>

                <div className="px-3 py-1.5 rounded-lg bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 shadow-xs">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Method</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-sm uppercase">
                    {selectedRecord.testType}
                  </span>
                </div>
              </div>
            </div>

            {/* Hardware Sensor Readings (If hardware test) */}
            {selectedRecord.testType === 'hardware' && selectedRecord.sensorReadings && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Sensor Chamber Readouts (ADC counts 0–4095)
                  </h4>
                  {selectedRecord.temp_c && (
                    <div className="flex items-center gap-3 text-xs font-mono text-slate-500">
                      <span className="flex items-center gap-1">
                        <Thermometer className="w-3.5 h-3.5" />
                        {selectedRecord.temp_c}°C
                      </span>
                      <span className="flex items-center gap-1">
                        <Droplets className="w-3.5 h-3.5 text-teal-500" />
                        {selectedRecord.rh_pct}% RH
                      </span>
                    </div>
                  )}
                </div>

                {/* 5 sensor cards */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {SENSOR_KEYS.map((s) => (
                    <div
                      key={s}
                      className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: SENSOR_COLORS[s] }}
                        />
                        <span className="text-xs font-mono font-medium text-slate-600 dark:text-slate-400">
                          {s}
                        </span>
                      </div>
                      <div className="text-lg font-mono font-bold text-slate-900 dark:text-slate-100">
                        {selectedRecord.sensorReadings![s]}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Stored Time-Series Chart */}
                {selectedRecord.timeSeries && selectedRecord.timeSeries.length > 0 && (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-2">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      10 Hz Acquired Time-Series Curve
                    </div>
                    <SensorChart data={selectedRecord.timeSeries} height={220} />
                  </div>
                )}
              </div>
            )}

            {/* Image Check Preview (If image test) */}
            {selectedRecord.testType === 'image' && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Image Inspection Record
                </div>
                {selectedRecord.imagePreviewUrl && (
                  <img
                    src={selectedRecord.imagePreviewUrl}
                    alt="Sample inspect"
                    referrerPolicy="no-referrer"
                    className="w-full max-h-56 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                  />
                )}
                <p className="text-xs text-slate-500 italic">
                  Image-based estimate — no sensor data used. For sensor-verified results, run a hardware test.
                </p>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                id="delete-record-btn"
                type="button"
                onClick={() => {
                  onDeleteRecord(selectedRecord.id);
                  setSelectedRecord(null);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Entry</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  id="modal-download-csv-btn"
                  type="button"
                  onClick={() => downloadRecordCSV(selectedRecord)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download 10 Hz CSV</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { SampleType, SAMPLE_OPTIONS } from '../types';

interface SampleSelectorProps {
  selectedSample: SampleType;
  onSelectSample: (sample: SampleType) => void;
  disabled?: boolean;
}

export const SampleSelector: React.FC<SampleSelectorProps> = ({
  selectedSample,
  onSelectSample,
  disabled = false,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
      <div>
        <label
          htmlFor="sample-select-dropdown"
          className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5"
        >
          Select Sample
        </label>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Hardware test protocol calibrated for IIT Mandi sensor chamber profiles
        </p>
      </div>

      <div className="flex items-center gap-3">
        <select
          id="sample-select-dropdown"
          disabled={disabled}
          value={selectedSample}
          onChange={(e) => onSelectSample(e.target.value as SampleType)}
          className="w-full sm:w-64 px-3.5 py-2 text-sm font-medium rounded-lg bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50 dark:focus:ring-teal-400/50 focus:border-teal-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {SAMPLE_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.fullLabel}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

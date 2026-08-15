import React from 'react';
import { Sun, Moon, Laptop, Activity, History, Camera } from 'lucide-react';
import { ThemeMode } from '../types';

interface NavbarProps {
  activeTab: 'test' | 'history' | 'image';
  onSelectTab: (tab: 'test' | 'history' | 'image') => void;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  historyCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  theme,
  onThemeChange,
  historyCount,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 h-14 flex items-center justify-between gap-4">
        {/* Logo & Title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 bg-teal-600 dark:bg-teal-500 rounded-md flex items-center justify-center text-white font-bold text-xs tracking-tight shadow-xs shrink-0">
            FN
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-lg sm:text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                FreshNose
              </span>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border border-teal-200 dark:border-teal-800/80 bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300">
                ESP32 E-Nose
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700/60 text-sm">
          <button
            id="tab-run-test"
            type="button"
            onClick={() => onSelectTab('test')}
            className={`flex items-center gap-1.5 px-4 sm:px-6 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all ${
              activeTab === 'test'
                ? 'bg-white dark:bg-slate-700 shadow-xs text-teal-700 dark:text-teal-300 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
            }`}
          >
            <Activity className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span>Run Test</span>
          </button>

          <button
            id="tab-history"
            type="button"
            onClick={() => onSelectTab('history')}
            className={`flex items-center gap-1.5 px-4 sm:px-6 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all ${
              activeTab === 'history'
                ? 'bg-white dark:bg-slate-700 shadow-xs text-teal-700 dark:text-teal-300 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
            }`}
          >
            <History className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>History</span>
            {historyCount > 0 && (
              <span className="ml-0.5 text-[11px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 font-mono">
                {historyCount}
              </span>
            )}
          </button>

          <button
            id="tab-image-check"
            type="button"
            onClick={() => onSelectTab('image')}
            className={`flex items-center gap-1.5 px-4 sm:px-6 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all ${
              activeTab === 'image'
                ? 'bg-white dark:bg-slate-700 shadow-xs text-teal-700 dark:text-teal-300 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
            }`}
          >
            <Camera className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className="hidden sm:inline">Image Check</span>
            <span className="sm:hidden">Image</span>
          </button>
        </nav>

        {/* Theme Selector Pill (System / Light / Dark) */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-full p-0.5 border border-slate-200 dark:border-slate-700">
          <button
            id="theme-system-btn"
            type="button"
            title="System Theme"
            onClick={() => onThemeChange('system')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full transition-all ${
              theme === 'system'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Laptop className="w-3 h-3" />
            <span className="hidden md:inline">System</span>
          </button>
          <button
            id="theme-light-btn"
            type="button"
            title="Light Theme"
            onClick={() => onThemeChange('light')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full transition-all ${
              theme === 'light'
                ? 'bg-white text-teal-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Sun className="w-3 h-3" />
            <span className="hidden md:inline">Light</span>
          </button>
          <button
            id="theme-dark-btn"
            type="button"
            title="Dark Theme"
            onClick={() => onThemeChange('dark')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full transition-all ${
              theme === 'dark'
                ? 'bg-slate-700 text-teal-300 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Moon className="w-3 h-3" />
            <span className="hidden md:inline">Dark</span>
          </button>
        </div>
      </div>
    </header>
  );
};

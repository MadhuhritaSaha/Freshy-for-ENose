import React, { useState, useEffect } from 'react';
import { SampleType, ThemeMode, InspectionRecord } from './types';
import { Navbar } from './components/Navbar';
import { SampleSelector } from './components/SampleSelector';
import { RunTestView } from './components/RunTestView';
import { HistoryView } from './components/HistoryView';
import { ImageCheckView } from './components/ImageCheckView';
import { Footer } from './components/Footer';
import { loadHistory, saveRecord, clearHistory, deleteRecord } from './utils/storage';

export default function App() {
  const [activeTab, setActiveTab] = useState<'test' | 'history' | 'image'>('test');
  const [selectedSample, setSelectedSample] = useState<SampleType>('onion');
  const [records, setRecords] = useState<InspectionRecord[]>([]);
  const [theme, setTheme] = useState<ThemeMode>('system');

  // Load history from localStorage on initial mount
  useEffect(() => {
    const loaded = loadHistory();
    setRecords(loaded);
  }, []);

  // Theme application logic
  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      if (theme === 'dark') {
        root.classList.add('dark');
      } else if (theme === 'light') {
        root.classList.remove('dark');
      } else {
        // System preference
        if (mediaQuery.matches) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
    };

    applyTheme();

    const handleSystemChange = () => {
      if (theme === 'system') {
        applyTheme();
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [theme]);

  // Handler for adding a new inspection record
  const handleSaveRecord = (record: InspectionRecord) => {
    const updated = saveRecord(record);
    setRecords(updated);
  };

  // Handler for deleting a record
  const handleDeleteRecord = (id: string) => {
    const updated = deleteRecord(id);
    setRecords(updated);
  };

  // Handler for clearing all records
  const handleClearHistory = () => {
    const updated = clearHistory();
    setRecords(updated);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased transition-colors duration-150">
      {/* Top Navbar with Theme Toggle */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        theme={theme}
        onThemeChange={setTheme}
        historyCount={records.length}
      />

      {/* Main App Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Sample Selection Bar (Applicable to Run Test and Image Check) */}
        {activeTab !== 'history' && (
          <SampleSelector
            selectedSample={selectedSample}
            onSelectSample={setSelectedSample}
          />
        )}

        {/* View Routing */}
        {activeTab === 'test' && (
          <RunTestView
            selectedSample={selectedSample}
            onSaveRecord={handleSaveRecord}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            records={records}
            onClearHistory={handleClearHistory}
            onDeleteRecord={handleDeleteRecord}
          />
        )}

        {activeTab === 'image' && (
          <ImageCheckView
            selectedSample={selectedSample}
            onSaveRecord={handleSaveRecord}
          />
        )}
      </main>

      {/* IIT Mandi Footer */}
      <Footer />
    </div>
  );
}

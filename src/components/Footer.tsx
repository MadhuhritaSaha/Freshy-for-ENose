import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/70 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
      <div className="max-w-6xl mx-auto px-4">
        <p>Companion app to the ESP32 E-Nose hardware · CHCI Lab, IIT Mandi</p>
      </div>
    </footer>
  );
};

import React from 'react';

export default function Preloader({ fullscreen = true, label = 'Ładowanie…' }) {
  const containerClass = fullscreen ? 'min-h-screen' : 'min-h-[50vh]';
  return (
    <div className={`grid place-items-center ${containerClass}`}>
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 border-4 border-slate-300 dark:border-slate-600 border-t-transparent rounded-full animate-spin"
          style={{ animationDuration: '0.9s' }}
          aria-label="loading"
        />
        <span className="text-slate-700 dark:text-slate-300">{label}</span>
      </div>
    </div>
  );
}
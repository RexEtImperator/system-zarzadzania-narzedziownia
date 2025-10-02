import React from 'react';

function AnalyticsScreen({ tools, employees }) {
  const totalTools = tools?.length || 0;
  const availableTools = tools?.filter(tool => tool.status === 'dostępne').length || 0;
  const issuedTools = tools?.filter(tool => tool.status === 'wydane').length || 0;
  const totalEmployees = employees?.length || 0;

  return (
    <div className="p-4 lg:p-8 bg-slate-50 dark:bg-slate-900 min-h-screen">
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">Analityka</h1>
        <p className="text-slate-600 dark:text-slate-400">Przegląd statystyk i raportów systemu</p>
      </div>

      {/* Statystyki główne */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Wszystkie narzędzia</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalTools}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🔧</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Dostępne</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{availableTools}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <span className="text-2xl">✅</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Wydane</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{issuedTools}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📤</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Pracownicy</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{totalEmployees}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <span className="text-2xl">👥</span>
            </div>
          </div>
        </div>
      </div>

      {/* Wykresy i dodatkowe statystyki */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Wykorzystanie narzędzi</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">Dostępne</span>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <div 
                    className="bg-green-500 dark:bg-green-400 h-2 rounded-full" 
                    style={{ width: `${totalTools > 0 ? (availableTools / totalTools) * 100 : 0}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{availableTools}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">Wydane</span>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <div 
                    className="bg-orange-500 dark:bg-orange-400 h-2 rounded-full" 
                    style={{ width: `${totalTools > 0 ? (issuedTools / totalTools) * 100 : 0}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{issuedTools}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Ostatnie aktywności</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <span className="text-sm">📊</span>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Raport wygenerowany</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Dzisiaj o 14:30</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <span className="text-sm">✅</span>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Narzędzie zwrócone</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Dzisiaj o 12:15</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                <span className="text-sm">📤</span>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Narzędzie wydane</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Wczoraj o 16:45</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AnalyticsScreen;
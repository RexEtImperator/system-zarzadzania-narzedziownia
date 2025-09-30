import React from 'react';

function AnalyticsScreen({ tools, employees }) {
  const totalTools = tools?.length || 0;
  const availableTools = tools?.filter(tool => tool.status === 'dostępne').length || 0;
  const issuedTools = tools?.filter(tool => tool.status === 'wydane').length || 0;
  const totalEmployees = employees?.length || 0;

  return (
    <div className="p-4 lg:p-8 bg-slate-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 mb-2">Analityka</h1>
        <p className="text-slate-600">Przegląd statystyk i raportów systemu</p>
      </div>

      {/* Statystyki główne */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Wszystkie narzędzia</p>
              <p className="text-2xl font-bold text-slate-900">{totalTools}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🔧</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Dostępne</p>
              <p className="text-2xl font-bold text-green-600">{availableTools}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">✅</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Wydane</p>
              <p className="text-2xl font-bold text-orange-600">{issuedTools}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📤</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Pracownicy</p>
              <p className="text-2xl font-bold text-purple-600">{totalEmployees}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">👥</span>
            </div>
          </div>
        </div>
      </div>

      {/* Wykresy i dodatkowe statystyki */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Wykorzystanie narzędzi</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Dostępne</span>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-slate-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full" 
                    style={{ width: `${totalTools > 0 ? (availableTools / totalTools) * 100 : 0}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium text-slate-900">{availableTools}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Wydane</span>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-slate-200 rounded-full h-2">
                  <div 
                    className="bg-orange-500 h-2 rounded-full" 
                    style={{ width: `${totalTools > 0 ? (issuedTools / totalTools) * 100 : 0}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium text-slate-900">{issuedTools}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Ostatnie aktywności</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-sm">📊</span>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">Raport wygenerowany</p>
                <p className="text-xs text-slate-500">Dzisiaj o 14:30</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-sm">✅</span>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">Narzędzie zwrócone</p>
                <p className="text-xs text-slate-500">Dzisiaj o 12:15</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                <span className="text-sm">📤</span>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">Narzędzie wydane</p>
                <p className="text-xs text-slate-500">Wczoraj o 16:45</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AnalyticsScreen;
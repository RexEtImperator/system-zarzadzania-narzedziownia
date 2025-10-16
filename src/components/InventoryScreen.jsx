import React, { useMemo, useState } from 'react';

function InventoryScreen({ tools = [], user }) {
  const [search, setSearch] = useState('');
  const [onlyConsumables, setOnlyConsumables] = useState(true);
  const [onlyBelowMin, setOnlyBelowMin] = useState(false);

  const filtered = useMemo(() => {
    const term = (search || '').trim().toLowerCase();
    return (tools || [])
      .filter(t => {
        const isCons = !!t.is_consumable;
        if (onlyConsumables && !isCons) return false;
        const min = t.min_stock;
        const qty = t.quantity || 0;
        const belowMin = typeof min === 'number' && min >= 0 ? qty < min : false;
        if (onlyBelowMin && !belowMin) return false;
        if (!term) return true;
        const name = String(t.name || '').toLowerCase();
        const sku = String(t.sku || '').toLowerCase();
        const inv = String(t.inventory_number || '').toLowerCase();
        return name.includes(term) || sku.includes(term) || inv.includes(term);
      })
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }, [tools, search, onlyConsumables, onlyBelowMin]);

  return (
    <div className="p-6 bg-white dark:bg-slate-900 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Inwentaryzacja</h1>
          <p className="text-slate-600 dark:text-slate-400">Przegląd stanów magazynowych i materiałów zużywalnych</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Wyszukaj</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nazwa, SKU lub nr ewidencyjny"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="onlyConsumables"
              type="checkbox"
              checked={onlyConsumables}
              onChange={(e) => setOnlyConsumables(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="onlyConsumables" className="text-sm text-slate-700 dark:text-slate-300">Tylko materiały zużywalne</label>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="onlyBelowMin"
              type="checkbox"
              checked={onlyBelowMin}
              onChange={(e) => setOnlyBelowMin(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="onlyBelowMin" className="text-sm text-slate-700 dark:text-slate-300">Poniżej stanu minimalnego</label>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-200 uppercase tracking-wider">Nazwa</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-200 uppercase tracking-wider">SKU</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-200 uppercase tracking-wider">Ilość</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-200 uppercase tracking-wider">Min</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-200 uppercase tracking-wider">Max</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-200 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
            {filtered.map((t) => {
              const min = typeof t.min_stock === 'number' ? t.min_stock : null;
              const max = typeof t.max_stock === 'number' ? t.max_stock : null;
              const qty = t.quantity || 0;
              const belowMin = min !== null && min >= 0 ? qty < min : false;
              return (
                <tr key={t.id} className={belowMin ? 'bg-red-50/60 dark:bg-red-900/20' : ''}>
                  <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">{t.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{t.sku}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{qty}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{min ?? '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{max ?? '-'}</td>
                  <td className="px-4 py-3 text-sm">
                    {belowMin ? (
                      <span className="inline-flex items-center px-2 py-1 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">Braki</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">OK</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-600 dark:text-slate-400">Brak pozycji do wyświetlenia</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default InventoryScreen;
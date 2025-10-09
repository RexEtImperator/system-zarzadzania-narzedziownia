import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import api from '../api';
import { formatDateOnly } from '../utils/dateUtils';
import { PERMISSIONS, hasPermission } from '../constants';

function AnalyticsScreen({ tools, employees, user }) {
  const totalTools = tools?.length || 0;
  const availableTools = tools?.filter(tool => tool.status === 'dostępne').length || 0;
  const issuedTools = tools?.filter(tool => tool.status === 'wydane').length || 0;
  const totalEmployees = employees?.length || 0;

  const [bhpItems, setBhpItems] = useState([]);
  const [bhpLoading, setBhpLoading] = useState(false);
  const [bhpPermissionDenied, setBhpPermissionDenied] = useState(false);

  const [serviceSummary, setServiceSummary] = useState({ in_service: [], recent_events: [] });
  const [serviceLoading, setServiceLoading] = useState(false);
  const [svcPage, setSvcPage] = useState(1);
  const [eventsPage, setEventsPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Upewnij się, że numer strony jest w zakresie po zmianie danych lub rozmiaru strony
  useEffect(() => {
    const svcTotal = Math.max(1, Math.ceil((serviceSummary.in_service?.length || 0) / pageSize));
    const evTotal = Math.max(1, Math.ceil((serviceSummary.recent_events?.length || 0) / pageSize));
    setSvcPage(p => Math.min(Math.max(1, p), svcTotal));
    setEventsPage(p => Math.min(Math.max(1, p), evTotal));
  }, [serviceSummary, pageSize]);

  const exportServiceHistoryToPDF = () => {
    const stamp = new Date().toLocaleString('pl-PL');
    const inServiceRows = (serviceSummary.in_service || []).map(item => ([
      item.name || '-',
      item.sku || '-',
      (item.service_quantity ?? '-') + ' szt.',
      item.service_order_number || '-',
      item.service_sent_at ? formatDateOnly(item.service_sent_at) : '-'
    ]));
    const recentRows = (serviceSummary.recent_events || []).map(ev => ([
      ev.name || '-',
      ev.sku || '-',
      (ev.action === 'sent' ? 'Wysłano' : 'Odebrano'),
      (ev.quantity ?? '-') + ' szt.',
      ev.order_number || '-',
      ev.created_at ? formatDateOnly(ev.created_at) : '-'
    ]));

    const inServiceTable = `
      <h2>Aktualnie w serwisie</h2>
      <table>
        <thead><tr>
          <th>Narzędzie</th><th>SKU</th><th>Ilość</th><th>Nr zlecenia</th><th>Wysłano</th>
        </tr></thead>
        <tbody>
          ${inServiceRows.map(r => `<tr>${r.map(c => `<td>${String(c)}</td>`).join('')}</tr>`).join('') || '<tr><td colspan="5">Brak danych</td></tr>'}
        </tbody>
      </table>`;

    const recentTable = `
      <h2>Ostatnie zdarzenia</h2>
      <table>
        <thead><tr>
          <th>Narzędzie</th><th>SKU</th><th>Akcja</th><th>Ilość</th><th>Nr zlecenia</th><th>Data</th>
        </tr></thead>
        <tbody>
          ${recentRows.map(r => `<tr>${r.map(c => `<td>${String(c)}</td>`).join('')}</tr>`).join('') || '<tr><td colspan="6">Brak danych</td></tr>'}
        </tbody>
      </table>`;

    const html = `
      <html><head><meta charset=\"utf-8\" />
      <title>Historia serwisowania — Analityka</title>
      <style>
        body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 24px; }
        h1 { font-size: 18px; margin: 0 0 8px; }
        h2 { font-size: 16px; margin: 16px 0 8px; }
        .meta { color: #555; font-size: 12px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        thead th { background: #f3f4f6; color: #111827; text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
        tbody td { padding: 8px; border-bottom: 1px solid #eee; }
        tbody tr:nth-child(even) td { background: #fafafa; }
        @page { size: A4; margin: 12mm; }
      </style>
      </head>
      <body>
        <h1>Historia serwisowania</h1>
        <div class=\"meta\">Wygenerowano: ${stamp}</div>
        ${inServiceTable}
        ${recentTable}
      </body></html>`;

    const w = window.open('', '_blank');
    if (!w) return alert('Pop-up został zablokowany przez przeglądarkę');
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  const downloadBlob = (filename, mime, content) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportServiceHistoryToXLSX = () => {
    const inServiceHeaders = ['Narzędzie', 'SKU', 'Ilość', 'Nr zlecenia', 'Wysłano'];
    const inServiceRows = (serviceSummary.in_service || []).map(item => [
      item.name || '',
      item.sku || '',
      item.service_quantity ?? '',
      item.service_order_number || '',
      item.service_sent_at ? formatDateOnly(item.service_sent_at) : ''
    ]);
    const inServiceAoA = [inServiceHeaders, ...inServiceRows];

    const recentHeaders = ['Narzędzie', 'SKU', 'Akcja', 'Ilość', 'Nr zlecenia', 'Data'];
    const recentRows = (serviceSummary.recent_events || []).map(ev => [
      ev.name || '',
      ev.sku || '',
      ev.action === 'sent' ? 'Wysłano' : 'Odebrano',
      ev.quantity ?? '',
      ev.order_number || '',
      ev.created_at ? formatDateOnly(ev.created_at) : ''
    ]);
    const recentAoA = [recentHeaders, ...recentRows];

    const wb = XLSX.utils.book_new();
    const wsInService = XLSX.utils.aoa_to_sheet(inServiceAoA);
    const wsRecent = XLSX.utils.aoa_to_sheet(recentAoA);
    XLSX.utils.book_append_sheet(wb, wsInService, 'W serwisie');
    XLSX.utils.book_append_sheet(wb, wsRecent, 'Zdarzenia');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    downloadBlob(`historia_serwisu_${stamp}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', wbout);
  };

  useEffect(() => {
    let mounted = true;
    const fetchBhp = async () => {
      try {
        // Jeśli brak uprawnień do BHP, nie wywołuj API i pokaż informację
        if (!hasPermission(user, PERMISSIONS.VIEW_BHP)) {
          if (mounted) {
            setBhpPermissionDenied(true);
            setBhpItems([]);
          }
          return;
        }
        setBhpLoading(true);
        const res = await api.get('/api/bhp');
        if (mounted) {
          setBhpItems(Array.isArray(res) ? res : []);
        }
      } catch (err) {
        if (mounted) {
          setBhpItems([]);
          // Jeśli serwer zwróci forbid, pokaż informację zamiast wylogowania
          if (err?.status === 403) {
            setBhpPermissionDenied(true);
          }
        }
        console.warn('Nie udało się pobrać listy BHP:', err?.message || err);
      } finally {
        if (mounted) setBhpLoading(false);
      }
    };
    fetchBhp();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    const fetchService = async () => {
      try {
        setServiceLoading(true);
        const res = await api.get('/api/service-history/summary');
        if (mounted) {
          setServiceSummary({
            in_service: Array.isArray(res?.in_service) ? res.in_service : [],
            recent_events: Array.isArray(res?.recent_events) ? res.recent_events : []
          });
        }
      } catch (err) {
        if (mounted) {
          setServiceSummary({ in_service: [], recent_events: [] });
        }
        console.warn('Nie udało się pobrać podsumowania serwisu:', err?.message || err);
      } finally {
        if (mounted) setServiceLoading(false);
      }
    };
    fetchService();
    return () => { mounted = false; };
  }, []);

  const parseDateFlexible = (val) => {
    if (!val) return null;
    const str = String(val).trim();
    // ISO lub z czasem: 2024-10-05 lub 2024-10-05 12:00:00
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      const d = new Date(str);
      return isNaN(d.getTime()) ? null : d;
    }
    // Format europejski: dd.mm.yyyy lub dd/mm/yyyy lub dd-mm-yyyy
    const m = str.match(/^(\d{2})[.\/-](\d{2})[.\/-](\d{4})/);
    if (m) {
      const [, dd, mm, yyyy] = m;
      const d = new Date(`${yyyy}-${mm}-${dd}`);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  };

  const getDaysTo = (dateString) => {
    const date = parseDateFlexible(dateString);
    if (!date) return null;
    const now = new Date();
    const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffMs = startOfDate - startOfNow;
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  };

  const inspections = [
    ...(Array.isArray(tools) ? tools.filter(t => !!t.inspection_date).map(t => ({
      id: t.id,
      name: t.name,
      inspection_date: t.inspection_date,
      source: 'tools',
      query: t.sku || t.name || ''
    })) : []),
    ...(Array.isArray(bhpItems) ? bhpItems.filter(b => !!b.inspection_date).map(b => ({
      id: b.id,
      name: [b.inventory_number, b.model].filter(Boolean).join(' '),
      inspection_date: b.inspection_date,
      source: 'bhp',
      query: b.inventory_number || b.model || b.serial_number || ''
    })) : [])
  ];

  const upcomingInspections = inspections
    .map(item => ({ ...item, daysTo: getDaysTo(item.inspection_date) }))
    .filter(x => x.daysTo !== null && x.daysTo >= 0 && x.daysTo <= 30)
    .sort((a, b) => a.daysTo - b.daysTo);

  const overdueInspections = inspections
    .map(item => ({ ...item, daysTo: getDaysTo(item.inspection_date) }))
    .filter(x => x.daysTo !== null && x.daysTo < 0)
    .sort((a, b) => a.daysTo - b.daysTo);

  // Rozdziel przeterminowane na osobne sekcje dla Narzędzi i BHP
  const overdueTools = overdueInspections.filter(x => x.source === 'tools');
  const overdueBhp = overdueInspections.filter(x => x.source === 'bhp');

  return (
   <div className="p-4 lg:p-8 bg-slate-50 dark:bg-slate-900 min-h-screen">
     <div className="mb-8">
       <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">Analityka</h1>
       <p className="text-slate-600 dark:text-slate-400">Przegląd statystyk i raportów systemu</p>
     </div>

     <div className="mt-8">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Nadchodzące przeglądy</h3>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 dark:bg-red-900/30">
                <span className="text-xs font-medium text-red-700 dark:text-red-300">Przeterminowane</span>
                <span className="text-xs font-bold text-red-700 dark:text-red-300">{overdueInspections.length}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Nadchodzące (&lt;30 dni)</span>
                <span className="text-xs font-bold text-amber-700 dark:text-amber-300">{upcomingInspections.length}</span>
              </div>
            </div>
          </div>

          {bhpPermissionDenied && (
            <div className="mb-4 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/40 text-slate-700 dark:text-slate-300">
              Brak uprawnień do sekcji BHP (VIEW_BHP). Wyświetlamy tylko dane z modułu Narzędzia.
            </div>
          )}

          {bhpLoading ? (
            <div className="text-sm text-slate-600 dark:text-slate-400">Ładowanie danych przeglądów...</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="text-md font-semibold text-slate-900 dark:text-slate-100 mb-2">Przeterminowane (Narzędzia)</h4>
                {overdueTools.length === 0 ? (
                  <p className="text-sm text-slate-600 dark:text-slate-400">Brak przeterminowanych przeglądów narzędzi.</p>
                ) : (
                  <ul className="space-y-2">
                    {overdueTools.slice(0, 10).map(item => (
                      <li key={`over-tools-${item.id}`} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.name}</p>
                            <span className="px-2 py-0.5 text-xs rounded-full border bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700">Narzędzia</span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Przegląd: {formatDateOnly(item.inspection_date)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-red-600 dark:text-red-400">{Math.abs(item.daysTo)} dni po terminie</span>
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                const screen = 'tools';
                                const q = item.query || '';
                                window.dispatchEvent(new CustomEvent('navigate', { detail: { screen, q } }));
                              } catch (_) {}
                            }}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Szczegóły
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <h4 className="text-md font-semibold text-slate-900 dark:text-slate-100 mt-6 mb-2">Przeterminowane (BHP)</h4>
                {overdueBhp.length === 0 ? (
                  <p className="text-sm text-slate-600 dark:text-slate-400">Brak przeterminowanych przeglądów BHP.</p>
                ) : (
                  <ul className="space-y-2">
                    {overdueBhp.slice(0, 10).map(item => (
                      <li key={`over-bhp-${item.id}`} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.name}</p>
                            <span className="px-2 py-0.5 text-xs rounded-full border bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700">BHP</span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Przegląd: {formatDateOnly(item.inspection_date)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-red-600 dark:text-red-400">{Math.abs(item.daysTo)} dni po terminie</span>
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                const screen = 'bhp';
                                const q = item.query || '';
                                window.dispatchEvent(new CustomEvent('navigate', { detail: { screen, q } }));
                              } catch (_) {}
                            }}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Szczegóły
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h4 className="text-md font-semibold text-slate-900 dark:text-slate-100 mb-2">Nadchodzące (&lt;30 dni)</h4>
                {upcomingInspections.length === 0 ? (
                  <p className="text-sm text-slate-600 dark:text-slate-400">Brak nadchodzących przeglądów w ciągu 30 dni.</p>
                ) : (
                  <ul className="space-y-2">
                    {upcomingInspections.slice(0, 10).map(item => (
                      <li key={`up-${item.source}-${item.id}`} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.name}</p>
                            <span className={`px-2 py-0.5 text-xs rounded-full border ${item.source === 'bhp' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700'}`}>{item.source === 'bhp' ? 'BHP' : 'Narzędzia'}</span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Przegląd: {formatDateOnly(item.inspection_date)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">za {item.daysTo} dni</span>
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                const screen = item.source === 'bhp' ? 'bhp' : 'tools';
                                const q = item.query || '';
                                window.dispatchEvent(new CustomEvent('navigate', { detail: { screen, q } }));
                              } catch (_) {}
                            }}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Szczegóły
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Osobny kafelek: Historia serwisowania */}
      <div className="mt-8">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Historia serwisowania</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportServiceHistoryToPDF}
                className="px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Eksport PDF
              </button>
              <button
                type="button"
                onClick={exportServiceHistoryToXLSX}
                className="px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Eksport XLSX
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-slate-600 dark:text-slate-400">
              Rozmiar strony:
              <select
                className="ml-2 px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                value={pageSize}
                onChange={e => setPageSize(Number(e.target.value) || 10)}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400">
              Łącznie: {(serviceSummary.in_service?.length || 0) + (serviceSummary.recent_events?.length || 0)} pozycji
            </div>
          </div>

          {serviceLoading ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">Ładowanie danych serwisowych...</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h5 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">W serwisie</h5>
                {serviceSummary.in_service.length === 0 ? (
                  <p className="text-sm text-slate-600 dark:text-slate-400">Brak narzędzi aktualnie w serwisie.</p>
                ) : (
                  <ul className="space-y-2">
                    {(() => {
                      const total = serviceSummary.in_service.length;
                      const start = (svcPage - 1) * pageSize;
                      const end = Math.min(start + pageSize, total);
                      const items = serviceSummary.in_service.slice(start, end);
                      return items.map(item => (
                        <li key={`svc-${item.id}`} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-700">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.name}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">SKU: <span className="font-mono">{item.sku}</span></p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-slate-700 dark:text-slate-200">{item.service_quantity} szt.</p>
                              {item.service_order_number && (
                                <p className="text-xs text-slate-500 dark:text-slate-400">Zlecenie: <span className="font-mono">{item.service_order_number}</span></p>
                              )}
                              {item.service_sent_at && (
                                <p className="text-xs text-slate-500 dark:text-slate-400">Wysłano: {formatDateOnly(item.service_sent_at)}</p>
                              )}
                            </div>
                          </div>
                        </li>
                      ));
                    })()}
                  </ul>
                )}
                {serviceSummary.in_service.length > 0 && (
                  <div className="mt-2 flex items-center justify-between">
                    <button
                      type="button"
                      className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 disabled:opacity-50"
                      onClick={() => setSvcPage(p => Math.max(1, p - 1))}
                      disabled={svcPage <= 1}
                    >
                      Poprzednia
                    </button>
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      Strona {svcPage} z {Math.max(1, Math.ceil(serviceSummary.in_service.length / pageSize))}
                    </span>
                    <button
                      type="button"
                      className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 disabled:opacity-50"
                      onClick={() => setSvcPage(p => Math.min(Math.max(1, Math.ceil(serviceSummary.in_service.length / pageSize)), p + 1))}
                      disabled={svcPage >= Math.ceil(serviceSummary.in_service.length / pageSize)}
                    >
                      Następna
                    </button>
                  </div>
                )}
              </div>
              <div>
                <h5 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">Ostatnie zdarzenia</h5>
                {serviceSummary.recent_events.length === 0 ? (
                  <p className="text-sm text-slate-600 dark:text-slate-400">Brak zdarzeń serwisowych.</p>
                ) : (
                  <ul className="space-y-2">
                    {(() => {
                      const total = serviceSummary.recent_events.length;
                      const start = (eventsPage - 1) * pageSize;
                      const end = Math.min(start + pageSize, total);
                      const items = serviceSummary.recent_events.slice(start, end);
                      return items.map(ev => (
                        <li key={`ev-${ev.id}`} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-700">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{ev.name}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">SKU: <span className="font-mono">{ev.sku}</span></p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-slate-700 dark:text-slate-200">{ev.action === 'sent' ? 'Wysłano' : 'Odebrano'}: {ev.quantity} szt.</p>
                              {ev.order_number && (
                                <p className="text-xs text-slate-500 dark:text-slate-400">Zlecenie: <span className="font-mono">{ev.order_number}</span></p>
                              )}
                              {ev.created_at && (
                                <p className="text-xs text-slate-500 dark:text-slate-400">Data: {formatDateOnly(ev.created_at)}</p>
                              )}
                            </div>
                          </div>
                        </li>
                      ));
                    })()}
                  </ul>
                )}
                {serviceSummary.recent_events.length > 0 && (
                  <div className="mt-2 flex items-center justify-between">
                    <button
                      type="button"
                      className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 disabled:opacity-50"
                      onClick={() => setEventsPage(p => Math.max(1, p - 1))}
                      disabled={eventsPage <= 1}
                    >
                      Poprzednia
                    </button>
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      Strona {eventsPage} z {Math.max(1, Math.ceil(serviceSummary.recent_events.length / pageSize))}
                    </span>
                    <button
                      type="button"
                      className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 disabled:opacity-50"
                      onClick={() => setEventsPage(p => Math.min(Math.max(1, Math.ceil(serviceSummary.recent_events.length / pageSize)), p + 1))}
                      disabled={eventsPage >= Math.ceil(serviceSummary.recent_events.length / pageSize)}
                    >
                      Następna
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AnalyticsScreen;
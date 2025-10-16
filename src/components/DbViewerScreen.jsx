import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api';

const DbViewerScreen = ({ user }) => {
  const [tables, setTables] = useState([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    fetchTables();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      fetchTableData(selectedTable, limit, offset);
    }
  }, [selectedTable, limit, offset]);

  const fetchTables = async () => {
    try {
      setLoadingTables(true);
      const data = await api.get('/api/db/tables');
      setTables(data || []);
      if (!selectedTable && (data || []).length > 0) {
        setSelectedTable(data[0]);
      }
    } catch (error) {
      console.error('Błąd pobierania listy tabel:', error);
      toast.error('Błąd pobierania listy tabel bazy danych');
    } finally {
      setLoadingTables(false);
    }
  };

  const fetchTableData = async (table, lim, off) => {
    try {
      setLoadingData(true);
      const data = await api.get(`/api/db/table/${encodeURIComponent(table)}?limit=${lim}&offset=${off}`);
      setRows(data.rows || []);
      setColumns(data.columns || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Błąd pobierania danych tabeli:', error);
      toast.error('Błąd pobierania danych z tabeli');
    } finally {
      setLoadingData(false);
    }
  };

  const handlePrev = () => {
    setOffset(Math.max(0, offset - limit));
  };

  const handleNext = () => {
    const next = offset + limit;
    if (next < total) setOffset(next);
  };

  const handleSelectTable = (t) => {
    setSelectedTable(t);
    setOffset(0);
  };

  const renderCell = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    // Jeśli to JSON jako string – spróbuj ładnie sformatować krótkie
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        return trimmed;
      }
    }
    return String(value);
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="flex h-full">
      {/* Lista tabel */}
      <div className="w-64 border-r border-gray-200 dark:border-slate-700 p-4 overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-200">Tabele</h2>
          {loadingTables && <span className="text-xs text-gray-500 dark:text-slate-400">Ładowanie…</span>}
        </div>
        <ul className="space-y-1">
          {tables.map(t => (
            <li key={t}>
              <button
                onClick={() => handleSelectTable(t)}
                className={`w-full text-left px-2 py-1 rounded hover:bg-orange-50 dark:hover:bg-orange-900/20 ${selectedTable === t ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-900 dark:text-orange-200' : 'text-gray-700 dark:text-slate-200'}`}
              >
                {t}
              </button>
            </li>
          ))}
          {tables.length === 0 && !loadingTables && (
            <li className="text-sm text-gray-500 dark:text-slate-400">Brak tabel</li>
          )}
        </ul>
      </div>

      {/* Dane tabeli */}
      <div className="flex-1 p-4 overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-200">{selectedTable || 'Wybierz tabelę'}</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">Rekordy: {total}</p>
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-xs text-gray-600 dark:text-slate-300">Na stronę</label>
            <select
              className="text-sm bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded px-2 py-1"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value, 10))}
            >
              {[25,50,100,200,500].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <button onClick={handlePrev} className="text-sm px-2 py-1 rounded bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200">Poprzednia</button>
            <button onClick={handleNext} className="text-sm px-2 py-1 rounded bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200">Następna</button>
            <span className="text-xs text-gray-600 dark:text-slate-300">Strona {currentPage}/{totalPages}</span>
          </div>
        </div>

        <div className="border border-gray-200 dark:border-slate-700 rounded overflow-auto">
          {loadingData ? (
            <div className="p-4 text-sm text-gray-600 dark:text-slate-300">Ładowanie danych…</div>
          ) : rows.length === 0 ? (
            <div className="p-4 text-sm text-gray-600 dark:text-slate-300">Brak danych</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-800/50">
                <tr>
                  {columns.map(col => (
                    <th key={col} className="px-3 py-2 text-left font-medium text-gray-700 dark:text-slate-200 border-b border-gray-200 dark:border-slate-700">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx} className="odd:bg-white even:bg-gray-50 dark:odd:bg-slate-900 dark:even:bg-slate-800">
                    {columns.map(col => (
                      <td key={col} className="px-3 py-2 text-gray-700 dark:text-slate-200 border-b border-gray-200 dark:border-slate-700 whitespace-pre-wrap break-words">
                        {renderCell(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default DbViewerScreen;
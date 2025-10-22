import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api';
import ConfirmationModal from './ConfirmationModal';

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
  const [primaryKey, setPrimaryKey] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [showDeleteRowModal, setShowDeleteRowModal] = useState(false);
  const [deleteRowTarget, setDeleteRowTarget] = useState(null);
  const [deleteRowLoading, setDeleteRowLoading] = useState(false);
  const [showDeleteTableModal, setShowDeleteTableModal] = useState(false);
  const [deleteTableLoading, setDeleteTableLoading] = useState(false);
  const [columnTypes, setColumnTypes] = useState({});
  const [showAddRowModal, setShowAddRowModal] = useState(false);
  const [newRowValues, setNewRowValues] = useState({});
  const [addRowLoading, setAddRowLoading] = useState(false);
  const [addRowErrors, setAddRowErrors] = useState({});
  const [showCreateTableModal, setShowCreateTableModal] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newTableColumns, setNewTableColumns] = useState([]);
  const [newTablePrimaryKey, setNewTablePrimaryKey] = useState('');
  const [createTableLoading, setCreateTableLoading] = useState(false);

  const isAdmin = user?.role === 'administrator';

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
      const pk = Array.isArray(data.primaryKey) ? data.primaryKey[0] : null;
      setPrimaryKey(pk || null);
      setEditingId(null);
      setEditValues({});
      setColumnTypes(data.columnTypes || {});
      setNewRowValues({});
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

  const startEditRow = (row) => {
    if (!primaryKey) {
      toast.warn('Brak klucza głównego – edycja niewspierana');
      return;
    }
    setEditingId(row[primaryKey]);
    const initial = {};
    columns.forEach(c => { initial[c] = row[c]; });
    setEditValues(initial);
  };

  const cancelEditRow = () => {
    setEditingId(null);
    setEditValues({});
  };

  const inputTypeFor = (col) => {
    const t = String(columnTypes[col] || '').toUpperCase();
    if (t.includes('INT') || t.includes('REAL') || t.includes('DOUBLE') || t.includes('FLOAT')) return 'number';
    return 'text';
  };

  const handleEditChange = (col, value) => {
    setEditValues(prev => ({ ...prev, [col]: value }));
  };

  const saveEditRow = async () => {
    if (!selectedTable || !primaryKey) return;
    try {
      const pkValue = editingId;
      const updates = { ...editValues };
      delete updates[primaryKey];
      await api.put(`/api/db/table/${encodeURIComponent(selectedTable)}/row`, {
        pk: primaryKey,
        id: pkValue,
        updates
      });
      toast.success('Wiersz został zaktualizowany');
      cancelEditRow();
      fetchTableData(selectedTable, limit, offset);
    } catch (error) {
      console.error('Błąd zapisu wiersza:', error);
      toast.error(error?.message || 'Błąd zapisu wiersza');
    }
  };

  // Dodawanie wiersza
  const openAddRowModal = () => {
    if (!selectedTable) return;
    const initial = {};
    columns.forEach(c => { initial[c] = ''; });
    setNewRowValues(initial);
    setAddRowErrors({});
    setShowAddRowModal(true);
  };

  const handleNewRowChange = (col, value) => {
    setNewRowValues(prev => ({ ...prev, [col]: value }));
  };

  const validateNewRow = () => {
    const errs = {};
    columns.forEach(c => {
      const t = String(columnTypes[c] || '').toUpperCase();
      const val = newRowValues[c];
      if (val !== '' && val !== null && typeof val !== 'undefined') {
        if (t.includes('INT')) {
          if (isNaN(parseInt(val, 10))) errs[c] = 'Wymagana liczba całkowita';
        } else if (t.includes('REAL') || t.includes('DOUBLE') || t.includes('FLOAT')) {
          if (isNaN(parseFloat(val))) errs[c] = 'Wymagana liczba zmiennoprzecinkowa';
        }
      }
    });
    return errs;
  };

  const confirmAddRow = async () => {
    setAddRowLoading(true);
    const errs = validateNewRow();
    setAddRowErrors(errs);
    if (Object.keys(errs).length) {
      setAddRowLoading(false);
      return;
    }
    try {
      const values = { ...newRowValues };
      await api.post(`/api/db/table/${encodeURIComponent(selectedTable)}/row`, { values });
      toast.success('Wiersz został dodany');
      setShowAddRowModal(false);
      fetchTableData(selectedTable, limit, offset);
    } catch (error) {
      console.error('Błąd dodawania wiersza:', error);
      toast.error(error?.message || 'Błąd dodawania wiersza');
    } finally {
      setAddRowLoading(false);
    }
  };

  // Tworzenie tabeli
  const openCreateTableModal = () => {
    setNewTableName('');
    setNewTableColumns([{ name: '', type: 'TEXT', notNull: false }]);
    setNewTablePrimaryKey('');
    setCreateTableLoading(false);
    setShowCreateTableModal(true);
  };

  const addNewTableColumn = () => {
    setNewTableColumns(prev => [...prev, { name: '', type: 'TEXT', notNull: false }]);
  };

  const updateNewTableColumn = (idx, field, value) => {
    setNewTableColumns(prev => prev.map((c, i) => i === idx ? { ...c, [field]: field === 'notNull' ? !!value : value } : c));
  };

  const removeNewTableColumn = (idx) => {
    setNewTableColumns(prev => prev.filter((_, i) => i !== idx));
  };

  const confirmCreateTable = async () => {
    setCreateTableLoading(true);
    const invalid = !newTableName || newTableColumns.length === 0 || newTableColumns.some(c => !c.name || !/^[A-Za-z0-9_]+$/.test(c.name));
    if (invalid) {
      toast.error('Uzupełnij poprawnie nazwę i kolumny');
      setCreateTableLoading(false);
      return;
    }
    try {
      await api.post('/api/db/table', {
        name: newTableName,
        columns: newTableColumns,
        primaryKey: newTablePrimaryKey
      });
      toast.success(`Tabela ${newTableName} została utworzona`);
      setShowCreateTableModal(false);
      fetchTables();
      setSelectedTable(newTableName);
      setOffset(0);
    } catch (error) {
      console.error('Błąd tworzenia tabeli:', error);
      toast.error(error?.message || 'Błąd tworzenia tabeli');
    } finally {
      setCreateTableLoading(false);
    }
  };

  const requestDeleteRow = (row) => {
    if (!primaryKey) {
      toast.warn('Brak klucza głównego – usuwanie niewspierane');
      return;
    }
    setDeleteRowTarget(row);
    setShowDeleteRowModal(true);
  };

  const confirmDeleteRow = async () => {
    if (!selectedTable || !primaryKey || !deleteRowTarget) return;
    setDeleteRowLoading(true);
    try {
      const pkValue = deleteRowTarget[primaryKey];
      await api.delete(`/api/db/table/${encodeURIComponent(selectedTable)}/row?pk=${encodeURIComponent(primaryKey)}&id=${encodeURIComponent(pkValue)}`);
      toast.success('Wiersz został usunięty');
      setShowDeleteRowModal(false);
      setDeleteRowTarget(null);
      fetchTableData(selectedTable, limit, offset);
    } catch (error) {
      console.error('Błąd usuwania wiersza:', error);
      toast.error(error?.message || 'Błąd usuwania wiersza');
    } finally {
      setDeleteRowLoading(false);
    }
  };

  const requestDeleteTable = () => {
    if (!selectedTable) return;
    setShowDeleteTableModal(true);
  };

  const confirmDeleteTable = async () => {
    if (!selectedTable) return;
    setDeleteTableLoading(true);
    try {
      await api.delete(`/api/db/table/${encodeURIComponent(selectedTable)}`);
      toast.success(`Tabela ${selectedTable} została usunięta`);
      setShowDeleteTableModal(false);
      // odśwież listę tabel
      await fetchTables();
      setSelectedTable(null);
      setRows([]);
      setColumns([]);
      setTotal(0);
      setPrimaryKey(null);
    } catch (error) {
      console.error('Błąd usuwania tabeli:', error);
      toast.error(error?.message || 'Błąd usuwania tabeli');
    } finally {
      setDeleteTableLoading(false);
    }
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
          {isAdmin && (
            <button onClick={openCreateTableModal} className="text-xs px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700">Utwórz tabelę</button>
          )}
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
            {primaryKey && <p className="text-xs text-gray-500 dark:text-slate-400">Klucz główny: {primaryKey}</p>}
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
            {isAdmin && selectedTable && (
              <button
                onClick={openAddRowModal}
                className="ml-2 text-sm px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700"
              >
                Dodaj wiersz
              </button>
            )}
            {isAdmin && selectedTable && (
              <button
                onClick={requestDeleteTable}
                className="ml-2 text-sm px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700"
              >
                Usuń tabelę
              </button>
            )}
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
                  {isAdmin && <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-slate-200 border-b border-gray-200 dark:border-slate-700">Akcje</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx} className="odd:bg-white even:bg-gray-50 dark:odd:bg-slate-900 dark:even:bg-slate-800">
                    {columns.map(col => (
                      <td key={col} className="px-3 py-2 text-gray-700 dark:text-slate-200 border-b border-gray-200 dark:border-slate-700 whitespace-pre-wrap break-words">
                        {editingId === row[primaryKey] ? (
                          <input
                            type={inputTypeFor(col)}
                            className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded px-2 py-1"
                            value={editValues[col] ?? ''}
                            onChange={(e) => handleEditChange(col, e.target.value)}
                            disabled={col === primaryKey}
                            step={String(columnTypes[col] || '').toUpperCase().includes('INT') ? '1' : undefined}
                          />
                        ) : (
                          renderCell(row[col])
                        )}
                      </td>
                    ))}
                    {isAdmin && (
                      <td className="px-3 py-2 text-gray-700 dark:text-slate-200 border-b border-gray-200 dark:border-slate-700 whitespace-nowrap">
                        {editingId === row[primaryKey] ? (
                          <>
                            <button onClick={saveEditRow} className="text-sm px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 mr-2">Zapisz</button>
                            <button onClick={cancelEditRow} className="text-sm px-2 py-1 rounded bg-gray-200 dark:bg-slate-700">Anuluj</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEditRow(row)} className="text-sm px-2 py-1 rounded bg-yellow-500 text-white hover:bg-yellow-600 mr-2" disabled={!primaryKey}>Edytuj</button>
                            <button onClick={() => requestDeleteRow(row)} className="text-sm px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700" disabled={!primaryKey}>Usuń</button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal potwierdzenia usunięcia wiersza */}
      <ConfirmationModal
        isOpen={showDeleteRowModal}
        onClose={() => { if (!deleteRowLoading) { setShowDeleteRowModal(false); setDeleteRowTarget(null); } }}
        onConfirm={confirmDeleteRow}
        title="Usuń wiersz"
        message={deleteRowTarget && primaryKey ? `Czy na pewno chcesz usunąć wiersz ${primaryKey}=${deleteRowTarget[primaryKey]}?` : 'Czy na pewno chcesz usunąć ten wiersz?'}
        confirmText="Usuń"
        cancelText="Anuluj"
        type="danger"
        loading={deleteRowLoading}
      />

      {/* Modal potwierdzenia usunięcia tabeli */}
      <ConfirmationModal
        isOpen={showDeleteTableModal}
        onClose={() => { if (!deleteTableLoading) { setShowDeleteTableModal(false); } }}
        onConfirm={confirmDeleteTable}
        title="Usuń tabelę"
        message={selectedTable ? `Czy na pewno chcesz usunąć tabelę "${selectedTable}"?` : 'Czy na pewno chcesz usunąć tę tabelę?'}
        confirmText="Usuń"
        cancelText="Anuluj"
        type="danger"
        loading={deleteTableLoading}
      />

      {/* Modal dodawania wiersza */}
      {showAddRowModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded shadow-lg w-full max-w-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-3">Dodaj wiersz do: {selectedTable}</h3>
            <div className="space-y-3 max-h-[50vh] overflow-auto">
              {columns.map((col) => (
                <div key={col}>
                  <label className="block text-xs text-gray-700 dark:text-slate-300 mb-1">{col}</label>
                  <input
                    type={inputTypeFor(col)}
                    className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded px-2 py-1"
                    value={newRowValues[col] ?? ''}
                    onChange={(e) => handleNewRowChange(col, e.target.value)}
                    step={String(columnTypes[col] || '').toUpperCase().includes('INT') ? '1' : undefined}
                  />
                  {addRowErrors[col] && (
                    <p className="text-xs text-red-600 mt-1">{addRowErrors[col]}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end space-x-2">
              <button onClick={() => setShowAddRowModal(false)} className="text-sm px-2 py-1 rounded bg-gray-200 dark:bg-slate-700">Anuluj</button>
              <button onClick={confirmAddRow} disabled={addRowLoading} className="text-sm px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700">
                {addRowLoading ? 'Dodawanie…' : 'Dodaj'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal tworzenia tabeli */}
      {showCreateTableModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded shadow-lg w-full max-w-2xl p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-3">Utwórz nową tabelę</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-700 dark:text-slate-300 mb-1">Nazwa tabeli</label>
                <input
                  type="text"
                  className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded px-2 py-1"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-gray-700 dark:text-slate-300">Kolumny</label>
                  <button onClick={addNewTableColumn} className="text-xs px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700">Dodaj kolumnę</button>
                </div>
                <div className="space-y-3 max-h-[40vh] overflow-auto">
                  {newTableColumns.map((c, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-4">
                        <label className="block text-xs text-gray-700 dark:text-slate-300 mb-1">Nazwa</label>
                        <input
                          type="text"
                          className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded px-2 py-1"
                          value={c.name}
                          onChange={(e) => updateNewTableColumn(idx, 'name', e.target.value)}
                        />
                      </div>
                      <div className="col-span-4">
                        <label className="block text-xs text-gray-700 dark:text-slate-300 mb-1">Typ</label>
                        <select
                          className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded px-2 py-1"
                          value={c.type}
                          onChange={(e) => updateNewTableColumn(idx, 'type', e.target.value)}
                        >
                          {['TEXT','INTEGER','REAL','BLOB'].map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <label className="block text-xs text-gray-700 dark:text-slate-300 mb-1">NOT NULL</label>
                        <input
                          type="checkbox"
                          checked={!!c.notNull}
                          onChange={(e) => updateNewTableColumn(idx, 'notNull', e.target.checked)}
                        />
                      </div>
                      <div className="col-span-1">
                        <button onClick={() => removeNewTableColumn(idx)} className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700">Usuń</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-700 dark:text-slate-300 mb-1">Klucz główny</label>
                <select
                  className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded px-2 py-1"
                  value={newTablePrimaryKey}
                  onChange={(e) => setNewTablePrimaryKey(e.target.value)}
                >
                  <option value="">(brak)</option>
                  {newTableColumns.map((c, idx) => (
                    <option key={`${c.name}-${idx}`} value={c.name}>{c.name || `(kolumna ${idx+1})`}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end space-x-2">
              <button onClick={() => setShowCreateTableModal(false)} className="text-sm px-2 py-1 rounded bg-gray-200 dark:bg-slate-700">Anuluj</button>
              <button onClick={confirmCreateTable} disabled={createTableLoading} className="text-sm px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700">
                {createTableLoading ? 'Tworzenie…' : 'Utwórz'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DbViewerScreen;
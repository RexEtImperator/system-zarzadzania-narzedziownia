import React, { useMemo, useState, useEffect, useRef } from 'react';
import api from '../api';
import BarcodeScanner from './BarcodeScanner';
import { PERMISSIONS, hasPermission } from '../constants';
import { toast } from 'react-toastify';
import { CheckIcon, TrashIcon } from '@heroicons/react/24/solid';
import ConfirmationModal from './ConfirmationModal';

function InventoryScreen({ tools = [], user }) {
  // Istniejące filtry magazynowe
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

  // Sesje inwentaryzacji
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState(null);

  // Tworzenie sesji
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionNotes, setNewSessionNotes] = useState('');
  const [creatingSession, setCreatingSession] = useState(false);

  // Skanowanie
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanQty, setScanQty] = useState(1);
  const [scanStatus, setScanStatus] = useState('');
  const [scanError, setScanError] = useState('');
  const [lastScanTool, setLastScanTool] = useState(null);
  const lastScanTimerRef = useRef(null);

  // Skaner dla pola wyszukiwania
  const [searchScannerOpen, setSearchScannerOpen] = useState(false);
  const [searchScanError, setSearchScanError] = useState('');

  // Różnice i eksport
  const [differences, setDifferences] = useState([]);
  const [diffsLoading, setDiffsLoading] = useState(false);
  const [diffsError, setDiffsError] = useState('');
  const [diffSearch, setDiffSearch] = useState('');
  const [diffMinAbs, setDiffMinAbs] = useState(0);
  const [csvExporting, setCsvExporting] = useState(false);

  // Historia korekt
  const [corrections, setCorrections] = useState([]);
  const [corrLoading, setCorrLoading] = useState(false);
  const [corrError, setCorrError] = useState('');
  const [corrShowPendingOnly, setCorrShowPendingOnly] = useState(false);
  // Ostatnio skorygowane pozycje (do krótkiej etykiety „Skorygowano”)
  const [recentCorrections, setRecentCorrections] = useState([]);

  // Modal korekty
  const [corrModalOpen, setCorrModalOpen] = useState(false);
  const [corrToolId, setCorrToolId] = useState(null);
  const [corrToolName, setCorrToolName] = useState('');
  const [corrSku, setCorrSku] = useState('');
  const [corrDifferenceQty, setCorrDifferenceQty] = useState(0);
  const [corrReason, setCorrReason] = useState('');
  const [corrSubmitting, setCorrSubmitting] = useState(false);
  const [corrSystemQty, setCorrSystemQty] = useState(0);
  const [corrCountedQty, setCorrCountedQty] = useState(0);
  
  // Modal potwierdzenia usunięcia korekty
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Opcja: nie zatwierdzaj automatycznie korekt (tylko dla administratora)
  const [autoAcceptDisabled, setAutoAcceptDisabled] = useState(false);

  const fetchSessions = async () => {
    try {
      setSessionsLoading(true);
      setSessionsError('');
      const data = await api.get('/api/inventory/sessions');
      setSessions(Array.isArray(data) ? data : []);
      if (!selectedSessionId && Array.isArray(data) && data.length > 0) {
        // Spróbuj odtworzyć wybraną sesję z localStorage, jeśli istnieje
        let storedId = null;
        try { storedId = localStorage.getItem('inventorySelectedSessionId'); } catch (_) {}
        if (storedId && data.some(s => String(s.id) === String(storedId))) {
          const match = data.find(s => String(s.id) === String(storedId));
          setSelectedSessionId(match.id);
        } else {
          // Wybierz najnowszą aktywną sesję automatycznie
          const active = data.find(s => s.status === 'active');
          setSelectedSessionId(active ? active.id : data[0].id);
        }
      }
    } catch (err) {
      setSessionsError(err?.message || 'Nie udało się pobrać sesji');
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  };

  // Wstępnie odtwórz wybraną sesję z localStorage, zanim pobierzemy listę sesji
  useEffect(() => {
    try {
      const sid = localStorage.getItem('inventorySelectedSessionId');
      if (sid) {
        const parsed = Number(sid);
        setSelectedSessionId(Number.isNaN(parsed) ? sid : parsed);
      }
    } catch (_) {}
  }, []);

  // Odczyt ustawienia autozatwierdzania z localStorage
  useEffect(() => {
    try {
      const v = localStorage.getItem('inventoryAutoAcceptDisabled');
      setAutoAcceptDisabled(v === '1' || v === 'true');
    } catch (_) {}
  }, []);
  const canViewInventory = hasPermission(user, PERMISSIONS.VIEW_INVENTORY);

  useEffect(() => {
    if (!canViewInventory) {
      setSessions([]);
      setSelectedSessionId(null);
      return;
    }
    fetchSessions();
  }, [canViewInventory]);

  // Zapamiętuj/odtwarzaj wybraną sesję w localStorage
  useEffect(() => {
    try {
      if (selectedSessionId) {
        localStorage.setItem('inventorySelectedSessionId', String(selectedSessionId));
      } else {
        localStorage.removeItem('inventorySelectedSessionId');
      }
    } catch (_) {}
  }, [selectedSessionId]);

  // Zapisuj ustawienie autozatwierdzania w localStorage
  useEffect(() => {
    try {
      localStorage.setItem('inventoryAutoAcceptDisabled', autoAcceptDisabled ? '1' : '0');
    } catch (_) {}
  }, [autoAcceptDisabled]);
  // Czyść stare wpisy „świeżo skorygowanych” co 10s (retencja 60s)
  useEffect(() => {
    const interval = setInterval(() => {
      setRecentCorrections(prev => prev.filter(rc => Date.now() - rc.at < 60000));
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Pobierz różnice po zmianie wybranej sesji
  useEffect(() => {
    const fetchDiffs = async () => {
      if (!canViewInventory) {
        setDifferences([]);
        return;
      }
      if (!selectedSessionId) {
        setDifferences([]);
        return;
      }
      try {
        setDiffsLoading(true);
        setDiffsError('');
        const data = await api.get(`/api/inventory/sessions/${selectedSessionId}/differences?t=${Date.now()}`);
        setDifferences(Array.isArray(data) ? data : []);
      } catch (err) {
        setDiffsError(err?.message || 'Nie udało się pobrać różnic');
        setDifferences([]);
      } finally {
        setDiffsLoading(false);
      }
    };

    const fetchHistory = async () => {
      if (!canViewInventory) {
        setCorrections([]);
        return;
      }
      if (!selectedSessionId) {
        setCorrections([]);
        return;
      }
      try {
        setCorrLoading(true);
        setCorrError('');
        const data = await api.get(`/api/inventory/sessions/${selectedSessionId}/history`);
        const corr = Array.isArray(data?.corrections) ? data.corrections : Array.isArray(data) ? data : [];
        setCorrections(corr);
      } catch (err) {
        setCorrError(err?.message || 'Nie udało się pobrać historii/korekt');
        setCorrections([]);
      } finally {
        setCorrLoading(false);
      }
    };

    fetchDiffs();
    fetchHistory();
  }, [selectedSessionId, canViewInventory]);

  // Bramka uprawnień: jeśli brak VIEW_INVENTORY, pokaż komunikat i nie renderuj reszty UI
  if (!canViewInventory) {
    return (
      <div className="p-4 lg:p-8 bg-slate-50 dark:bg-slate-900 min-h-screen">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Brak uprawnień</h3>
          <p className="text-slate-600 dark:text-slate-400">Brak uprawnień do przeglądania inwentaryzacji (VIEW_INVENTORY).</p>
        </div>
      </div>
    );
  }

  const openCorrectionModal = (row) => {
    // Ustal ID narzędzia z możliwych pól lub dopasuj po SKU/nazwie
    let toolId = row?.tool_id ?? row?.toolId ?? row?.id ?? null;
    if (!toolId && row?.sku && Array.isArray(tools)) {
      const matchSku = tools.find(t => String(t.sku || '').toLowerCase() === String(row.sku || '').toLowerCase());
      toolId = matchSku?.id ?? matchSku?.tool_id ?? toolId;
    }
    if (!toolId && row?.name && Array.isArray(tools)) {
      const matchName = tools.find(t => String(t.name || '').toLowerCase() === String(row.name || '').toLowerCase());
      toolId = matchName?.id ?? matchName?.tool_id ?? toolId;
    }

    setCorrToolId(toolId);
    setCorrToolName(row.name || '');
    setCorrSku(row.sku || '');
    setCorrSystemQty(Number(row.system_qty || 0));
    setCorrCountedQty(Number(row.counted_qty || 0));
    setCorrDifferenceQty(Number(row.difference || (Number(row.counted_qty || 0) - Number(row.system_qty || 0)) || 0));
    setCorrReason('');
    setCorrModalOpen(true);

    if (!toolId) {
      toast.error('Nie można ustalić ID narzędzia dla korekty (brak powiązania).');
    }
  };

  const submitCorrection = async () => {
    if (!selectedSessionId) {
      toast.error('Brak wybranej sesji — wybierz sesję przed zapisem korekty.');
      return;
    }
    if (!corrToolId) {
      toast.error('Nie udało się ustalić narzędzia do korekty — spróbuj ponownie z panelu „Różnice stanów”.');
      return;
    }
    try {
      setCorrSubmitting(true);
      const systemQty = Number(corrSystemQty || 0);
      const countedQty = Number(corrCountedQty || 0);
      const difference_qty = countedQty - systemQty;
      // Najpierw ustaw counted_qty dla tej pozycji w bieżącej sesji
      await api.put(`/api/inventory/sessions/${selectedSessionId}/counts/${corrToolId}`, { counted_qty: countedQty });
      // Następnie zapisz korektę różnicy
      const saved = await api.post(`/api/inventory/sessions/${selectedSessionId}/corrections`, {
        tool_id: corrToolId,
        difference_qty,
        reason: corrReason || ''
      });
      // Automatyczne zatwierdzenie korekty, jeśli użytkownik ma uprawnienia administratora i autozatwierdzanie jest włączone
      const corrId = saved?.id || saved?.correction?.id;
      if (isAdmin && corrId && !autoAcceptDisabled) {
        try {
          await api.post(`/api/inventory/corrections/${corrId}/accept`, {});
        } catch (accErr) {
          toast.error(accErr?.message || 'Nie udało się zatwierdzić korekty');
        }
      }
      try {
        const diffs = await api.get(`/api/inventory/sessions/${selectedSessionId}/differences?t=${Date.now()}`);
        setDifferences(Array.isArray(diffs) ? diffs : []);
      } catch (_) {}
      try {
        const hist = await api.get(`/api/inventory/sessions/${selectedSessionId}/history?t=${Date.now()}`);
        const corr = Array.isArray(hist?.corrections) ? hist.corrections : Array.isArray(hist) ? hist : [];
        setCorrections(corr);
      } catch (_) {}
      if (canAcceptCorrection && !autoAcceptDisabled) {
        setRecentCorrections(prev => [
          { toolId: corrToolId, sku: corrSku, at: Date.now() },
          ...prev
        ].filter(rc => Date.now() - rc.at < 60000));
      }
      const successMsg = (canAcceptCorrection && !autoAcceptDisabled)
        ? 'Korekta została zapisana i zatwierdzona.'
        : 'Korekta została zapisana (oczekuje zatwierdzenia).';
      toast.success(successMsg);
      closeCorrectionModal();
    } catch (err) {
      toast.error(err?.message || 'Nie udało się dodać korekty');
    } finally {
      setCorrSubmitting(false);
    }
  };

  const closeCorrectionModal = () => {
    setCorrModalOpen(false);
    setCorrToolId(null);
    setCorrToolName('');
    setCorrSku('');
    setCorrDifferenceQty(0);
    setCorrReason('');
  };

  const handleCreateSession = async () => {
    if (!hasPermission(user, PERMISSIONS.ADMIN)) {
      alert('Tylko administrator może tworzyć sesje');
      return;
    }
    const name = String(newSessionName || '').trim();
    if (!name) {
      alert('Podaj nazwę sesji');
      return;
    }
    try {
      setCreatingSession(true);
      const created = await api.post('/api/inventory/sessions', { name, notes: newSessionNotes || '' });
      setNewSessionName('');
      setNewSessionNotes('');
      await fetchSessions();
      setSelectedSessionId(created?.id || null);
    } catch (err) {
      alert(err?.message || 'Nie udało się utworzyć sesji');
    } finally {
      setCreatingSession(false);
    }
  };

  const handleSessionStatus = async (action) => {
    if (!selectedSessionId) return;
    if (!hasPermission(user, PERMISSIONS.ADMIN)) {
      alert('Tylko administrator może zmieniać status sesji');
      return;
    }
    try {
      await api.put(`/api/inventory/sessions/${selectedSessionId}/status`, { action });
      await fetchSessions();
    } catch (err) {
      alert(err?.message || 'Zmiana statusu nie powiodła się');
    }
  };

  const handleDeleteSession = async (session) => {
    if (!session?.id) return;
    if (!hasPermission(user, PERMISSIONS.ADMIN)) {
      alert('Tylko administrator może usuwać sesje');
      return;
    }
    if (session.status !== 'ended') {
      alert('Usunąć można tylko sesję zakończoną');
      return;
    }
    if (!window.confirm(`Czy na pewno chcesz trwale usunąć sesję "${session.name}"?`)) {
      return;
    }
    try {
      // Jeśli usuwamy aktualnie wybraną sesję, wyczyść wybór, aby auto-selekcja zadziałała
      if (selectedSessionId === session.id) {
        setSelectedSessionId(null);
      }
      await api.delete(`/api/inventory/sessions/${session.id}`);
      await fetchSessions();
      toast.success('Sesja została trwale usunięta.');
    } catch (err) {
      alert(err?.message || 'Usuwanie sesji nie powiodło się');
    }
  };

  const handleOpenScanner = () => {
    setScanStatus('');
    setScanError('');
    setScannerOpen(true);
  };

  const handleCloseScanner = () => {
    setScannerOpen(false);
  };

  const handleScan = async (text) => {
    if (!selectedSessionId) {
      setScanError('Brak wybranej sesji');
      return;
    }
    try {
      setScanError('');
      const payload = { code: text, quantity: Math.max(1, parseInt(scanQty || 1, 10)) };
      const resp = await api.post(`/api/inventory/sessions/${selectedSessionId}/scan`, payload);
      setScanStatus(resp?.message || 'Zliczono');
      setLastScanTool(resp?.tool || null);
      fetchSessions();
      // Wyczyść status po 4s
      if (lastScanTimerRef.current) clearTimeout(lastScanTimerRef.current);
      lastScanTimerRef.current = setTimeout(() => {
        setScanStatus('');
        setLastScanTool(null);
      }, 4000);
    } catch (err) {
      setScanError(err?.message || 'Błąd skanowania');
    }
  };

  // Obsługa skanera dla wyszukiwania
  const openSearchScanner = () => {
    setSearchScanError('');
    setSearchScannerOpen(true);
  };
  const closeSearchScanner = () => {
    setSearchScannerOpen(false);
  };
  const handleSearchScan = (text) => {
    setSearch(text || '');
    setSearchScannerOpen(false);
  };

  const filteredDiffs = useMemo(() => {
    let rows = differences || [];
    const term = (diffSearch || '').trim().toLowerCase();
    const minAbs = Math.max(0, parseInt(diffMinAbs || 0, 10));
    if (minAbs > 0) {
      rows = rows.filter(r => Math.abs(r.difference || 0) >= minAbs);
    }
    if (term) {
      rows = rows.filter(r => String(r.name || '').toLowerCase().includes(term) || String(r.sku || '').toLowerCase().includes(term));
    }
    return rows;
  }, [differences, diffSearch, diffMinAbs]);

  const exportDiffsToCSV = async () => {
    try {
      setCsvExporting(true);
      const session = sessions.find(s => s.id === selectedSessionId);
      const now = new Date().toISOString();
      const header = ['Nazwa', 'SKU', 'System ilość', 'Zliczona ilość', 'Różnica', 'Sesja', 'Data eksportu', 'Odpowiedzialny'];
      const lines = [header.join(';')];
      for (const r of filteredDiffs) {
        const row = [
          (r.name || '').replace(/;/g, ','),
          (r.sku || '').replace(/;/g, ','),
          Number(r.system_qty ?? 0),
          Number(r.counted_qty ?? 0),
          Number(r.difference ?? 0),
          (session?.name || '').replace(/;/g, ','),
          now,
          (user?.full_name || user?.username || '').replace(/;/g, ',')
        ];
        lines.push(row.join(';'));
      }
      const csvContent = lines.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fname = `roznice-sesja-${session?.id || 'brak'}-${new Date().toLocaleDateString('pl-PL')}.csv`;
      link.download = fname;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Eksport CSV nie powiódł się');
    } finally {
      setCsvExporting(false);
    }
  };

  const isAdmin = hasPermission(user, PERMISSIONS.ADMIN);

  const acceptCorrection = async (corr) => {
    if (!isAdmin) {
      toast.error('Tylko administrator może zatwierdzać korekty');
      return;
    }
    try {
      await api.post(`/api/inventory/corrections/${corr.id}/accept`, {});
      // Odśwież różnice i historię po akcji
      try {
        const diffs = await api.get(`/api/inventory/sessions/${selectedSessionId}/differences?t=${Date.now()}`);
        setDifferences(Array.isArray(diffs) ? diffs : []);
      } catch (_) {}
      try {
        const data = await api.get(`/api/inventory/sessions/${selectedSessionId}/history?t=${Date.now()}`);
        const corrList = Array.isArray(data?.corrections) ? data.corrections : Array.isArray(data) ? data : [];
        setCorrections(corrList);
      } catch (_) {}
      // Dodaj znacznik świeżo skorygowanej pozycji
      setRecentCorrections(prev => [
        { toolId: corr.tool_id ?? null, sku: corr.tool_sku ?? null, at: Date.now() },
        ...prev
      ].filter(rc => Date.now() - rc.at < 60000));
      toast.success('Korekta została zatwierdzona i zastosowana.');
    } catch (err) {
      toast.error(err?.message || 'Nie udało się zatwierdzić korekty');
    }
  };

  const openDeleteModal = (corr) => {
    if (!isAdmin) {
      toast.error('Tylko administrator może usuwać korekty');
      return;
    }
    setDeleteTarget(corr);
    setShowDeleteModal(true);
  };

  const deleteCorrection = async (corr) => {
    if (!isAdmin) {
      toast.error('Tylko administrator może usuwać korekty');
      return;
    }
    try {
      await api.delete(`/api/inventory/corrections/${corr.id}`);
      // Odśwież różnice i historię po akcji
      try {
        const diffs = await api.get(`/api/inventory/sessions/${selectedSessionId}/differences?t=${Date.now()}`);
        setDifferences(Array.isArray(diffs) ? diffs : []);
      } catch (_) {}
      try {
        const data = await api.get(`/api/inventory/sessions/${selectedSessionId}/history?t=${Date.now()}`);
        const corrList = Array.isArray(data?.corrections) ? data.corrections : Array.isArray(data) ? data : [];
        setCorrections(corrList);
      } catch (_) {}
      toast.success('Korekta została usunięta.');
    } catch (err) {
      toast.error(err?.message || 'Nie udało się usunąć korekty');
      throw err;
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-slate-900 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Inwentaryzacja</h1>
          <p className="text-slate-600 dark:text-slate-400">Przegląd stanów magazynowych i materiały zużywalne + sesje</p>
        </div>
      </div>

      {/* Panel sesji */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 mb-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Sesje inwentaryzacji</h2>
          {isAdmin && (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <input
                type="text"
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
                placeholder="Nazwa nowej sesji"
                className="w-full sm:w-56 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-slate-100"
              />
              <input
                type="text"
                value={newSessionNotes}
                onChange={(e) => setNewSessionNotes(e.target.value)}
                placeholder="Notatki (opcjonalnie)"
                className="w-full sm:w-64 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-slate-100"
              />
              <button
                onClick={handleCreateSession}
                disabled={creatingSession}
                className="w-full sm:w-auto px-3 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800"
              >
                {creatingSession ? 'Tworzenie...' : 'Nowa sesja'}
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          {sessionsLoading ? (
            <div className="text-slate-600 dark:text-slate-300">Ładowanie sesji...</div>
          ) : sessionsError ? (
            <div className="text-red-600 dark:text-red-400">{sessionsError}</div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-200 uppercase tracking-wider">Nazwa</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-200 uppercase tracking-wider hidden sm:table-cell">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-200 uppercase tracking-wider hidden sm:table-cell">Zliczone pozycje</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-200 uppercase tracking-wider hidden sm:table-cell">Data rozpoczęcia</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-200 uppercase tracking-wider hidden sm:table-cell">Data zakończenia</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                {(sessions || []).map(s => (
                  <tr key={s.id} className={selectedSessionId === s.id ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                      {s.name}
                      <div className="sm:hidden mt-1 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                        <div>Status: {s.status}</div>
                        <div>Zliczone: {s.counted_items ?? 0}</div>
                        <div>Start: {s.started_at ? new Date(s.started_at).toLocaleString('pl-PL') : '-'}</div>
                        <div>Koniec: {s.finished_at ? new Date(s.finished_at).toLocaleString('pl-PL') : '-'}</div>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{s.status}</td>
                    <td className="hidden sm:table-cell px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{s.counted_items ?? 0}</td>
                    <td className="hidden sm:table-cell px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{s.started_at ? new Date(s.started_at).toLocaleString('pl-PL') : '-'}</td>
                    <td className="hidden sm:table-cell px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{s.finished_at ? new Date(s.finished_at).toLocaleString('pl-PL') : '-'}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedSessionId(s.id)}
                          className="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600"
                        >
                          Wybierz
                        </button>
                        {isAdmin && s.status === 'active' && (
                          <>
                            <button onClick={() => handleSessionStatus('pause')} className="px-3 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600">Wstrzymaj</button>
                            <button onClick={() => handleSessionStatus('end')} className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Zakończ</button>
                          </>
                        )}
                        {isAdmin && s.status === 'paused' && (
                          <button onClick={() => handleSessionStatus('resume')} className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Wznów</button>
                        )}
                        {isAdmin && s.status === 'ended' && (
                          <button onClick={() => handleDeleteSession(s)} className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Usuń</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {sessions && sessions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-600 dark:text-slate-400">Brak sesji</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Skanowanie w wybranej sesji */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-700 dark:text-slate-300">Wybrana sesja: </span>
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{selectedSessionId ? sessions.find(x => x.id === selectedSessionId)?.name : '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={scanQty}
              onChange={(e) => setScanQty(e.target.value)}
              className="w-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-slate-100"
              placeholder="Ilość"
            />
            <button
              onClick={handleOpenScanner}
              disabled={!selectedSessionId || sessions.find(s => s.id === selectedSessionId)?.status !== 'active'}
              className="px-3 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800"
            >
              Skanuj
            </button>
          </div>
        </div>
        {scanStatus && (
          <div className="mt-2 text-green-700 dark:text-green-300 text-sm">{scanStatus}</div>
        )}
        {scanError && (
          <div className="mt-2 text-red-700 dark:text-red-300 text-sm">{scanError}</div>
        )}
        {lastScanTool && (
          <div className="mt-2 text-sm text-slate-700 dark:text-slate-300">Ostatnio zliczono: {lastScanTool.name} (SKU: {lastScanTool.sku})</div>
        )}
      </div>

      {/* Różnice w wybranej sesji */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 mb-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Różnice stanów</h2>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <input
              type="text"
              value={diffSearch}
              onChange={(e) => setDiffSearch(e.target.value)}
              placeholder="Filtruj po nazwie lub SKU"
              className="w-full sm:w-56 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-slate-100"
            />
            <input
              type="number"
              min={0}
              value={diffMinAbs}
              onChange={(e) => setDiffMinAbs(e.target.value)}
              placeholder="Min. |różnica|"
              className="w-full sm:w-40 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-slate-100"
            />
            <button
              onClick={exportDiffsToCSV}
              disabled={csvExporting || filteredDiffs.length === 0}
              className="w-full sm:w-auto px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600"
            >
              {csvExporting ? 'Eksport…' : 'Eksport CSV'}
            </button>
            {isAdmin && (
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 ml-2">
                <input
                  type="checkbox"
                  checked={autoAcceptDisabled}
                  onChange={(e) => setAutoAcceptDisabled(!!e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                />
                <span>Nie zatwierdzaj automatycznie</span>
              </label>
            )}
          </div>
        </div>
        {diffsLoading ? (
          <div className="text-slate-600 dark:text-slate-300">Ładowanie różnic...</div>
        ) : diffsError ? (
          <div className="text-red-600 dark:text-red-400">{diffsError}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-200 uppercase tracking-wider">Nazwa</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-200 uppercase tracking-wider hidden sm:table-cell">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-200 uppercase tracking-wider hidden sm:table-cell">System ilość</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-200 uppercase tracking-wider hidden sm:table-cell">Zliczona ilość</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-200 uppercase tracking-wider">Różnica</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                {filteredDiffs.map((r) => {
                  const diffVal = Number(r.counted_qty ?? 0) - Number(r.system_qty ?? 0);
                  const recently = recentCorrections.some(rc => ((rc.toolId && rc.toolId === (r.tool_id ?? r.id)) || (rc.sku && rc.sku === r.sku)));
                  return (
                    <tr key={`diff-${r.tool_id ?? r.sku ?? r.name}`}>
                      <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                        {r.name}
                        {recently ? (
                          <span className="ml-2 inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 px-2 py-0.5 text-xs">Skorygowano</span>
                        ) : null}
                        <div className="mt-1 text-xs text-slate-500 sm:hidden">
                          <div>SKU: {r.sku || '-'}</div>
                          <div>System: {Number(r.system_qty ?? 0)}</div>
                          <div>Zliczona: {Number(r.counted_qty ?? 0)}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hidden sm:table-cell">{r.sku}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hidden sm:table-cell">{Number(r.system_qty ?? 0)}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hidden sm:table-cell">{Number(r.counted_qty ?? 0)}</td>
                      <td className={`px-4 py-3 text-sm ${diffVal > 0 ? 'text-green-700 dark:text-green-300' : diffVal < 0 ? 'text-red-700 dark:text-red-300' : 'text-slate-700 dark:text-slate-300'}`}>{diffVal}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <button
                          onClick={() => openCorrectionModal(r)}
                          className="w-full sm:w-auto px-3 py-2 text-sm bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800"
                        >
                          Dodaj korektę
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredDiffs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-600 dark:text-slate-400">Brak różnic do wyświetlenia</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Historia korekt */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Historia korekt</h2>
          <div className="flex items-center gap-2">
            <input
              id="corrPendingOnly"
              type="checkbox"
              checked={corrShowPendingOnly}
              onChange={(e) => setCorrShowPendingOnly(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="corrPendingOnly" className="text-sm text-slate-700 dark:text-slate-300">Tylko oczekujące</label>
          </div>
        </div>
        {corrLoading ? (
          <div className="text-slate-600 dark:text-slate-300">Ładowanie historii...</div>
        ) : corrError ? (
          <div className="text-red-600 dark:text-red-400">{corrError}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-200 uppercase tracking-wider">Nazwa</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-200 uppercase tracking-wider hidden sm:table-cell">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-200 uppercase tracking-wider">Różnica</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-200 uppercase tracking-wider hidden sm:table-cell">Powód</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-200 uppercase tracking-wider hidden sm:table-cell">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-200 uppercase tracking-wider hidden sm:table-cell">Utworzono</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-200 uppercase tracking-wider hidden sm:table-cell">Kto zatwierdził</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-200 uppercase tracking-wider hidden sm:table-cell">Kiedy</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                {((corrections || []).filter(c => !corrShowPendingOnly || !c.accepted_at)).map(c => (
                  <tr key={`corr-${c.id}`}>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                      {c.tool_name}
                      <div className="mt-1 text-xs text-slate-500 sm:hidden">
                        <div>SKU: {c.tool_sku || '-'}</div>
                        <div>Powód: {c.reason || '-'}</div>
                        <div>Status: {c.accepted_at ? 'Zatwierdzona' : 'Oczekuje'}</div>
                        <div>Utw.: {c.created_at ? new Date(c.created_at).toLocaleString('pl-PL') : '-'}</div>
                        {c.accepted_at ? (
                          <div>Zatw.: {(c.accepted_by_username || c.accepted_by_user_id || '-')} • {new Date(c.accepted_at).toLocaleString('pl-PL')}</div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hidden sm:table-cell">{c.tool_sku}</td>
                    <td className={`px-4 py-3 text-sm ${c.difference_qty > 0 ? 'text-green-700 dark:text-green-300' : c.difference_qty < 0 ? 'text-red-700 dark:text-red-300' : 'text-slate-700 dark:text-slate-300'}`}>{c.difference_qty}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hidden sm:table-cell">{c.reason || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hidden sm:table-cell">{c.accepted_at ? 'Zatwierdzona' : 'Oczekuje'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hidden sm:table-cell">{c.created_at ? new Date(c.created_at).toLocaleString('pl-PL') : '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hidden sm:table-cell">{c.accepted_at ? (c.accepted_by_username || c.accepted_by_user_id || '-') : '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hidden sm:table-cell">{c.accepted_at ? new Date(c.accepted_at).toLocaleString('pl-PL') : '-'}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      {!c.accepted_at && isAdmin ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => acceptCorrection(c)}
                            title="Zatwierdź korektę"
                            aria-label="Zatwierdź korektę"
                            className="w-10 h-10 sm:w-8 sm:h-8 grid place-items-center rounded-full bg-green-600 text-white hover:bg-green-700"
                          >
                            <CheckIcon className="w-5 h-5" aria-hidden="true" />
                          </button>
                          <button
                            onClick={() => openDeleteModal(c)}
                            title="Usuń korektę"
                            aria-label="Usuń korektę"
                            className="w-10 h-10 sm:w-8 sm:h-8 grid place-items-center rounded-full bg-red-600 text-white hover:bg-red-700"
                          >
                            <TrashIcon className="w-5 h-5" aria-hidden="true" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">Zatwierdzona</span>
                      )}
                    </td>
                  </tr>
                ))}
                {(!corrections || corrections.length === 0) && (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-slate-600 dark:text-slate-400">Brak korekt do wyświetlenia</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal dodawania korekty */}
      {corrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">Dodaj korektę</h3>
            <div className="space-y-3">
              <div className="text-sm text-slate-700 dark:text-slate-300">Pozycja: <span className="font-medium">{corrToolName}</span> <span className="text-slate-500">({corrSku || '-'})</span></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">System ilość</label>
                  <input
                    type="number"
                    value={corrSystemQty}
                    readOnly
                    className="w-full px-3 py-2 border rounded-lg bg-slate-100 dark:bg-slate-700 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Zliczona ilość</label>
                  <input
                    type="number"
                    value={corrCountedQty}
                    onChange={(e) => {
                      const val = Number(e.target.value || 0);
                      setCorrCountedQty(val);
                      setCorrDifferenceQty(val - Number(corrSystemQty || 0));
                    }}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-slate-100"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Różnica</label>
                <span className="text-xs text-slate-500 dark:text-slate-400">🔒 Pole obliczane automatycznie</span>
              </div>
              <input
                type="number"
                value={corrDifferenceQty}
                readOnly
                className="w-full px-3 py-2 border rounded-lg bg-slate-100 dark:bg-slate-700 dark:text-slate-100"
              />
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Powód (opcjonalnie)</label>
              <input
                type="text"
                value={corrReason}
                onChange={(e) => setCorrReason(e.target.value)}
                placeholder="Np. błąd ewidencji, zmiana stanu"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={closeCorrectionModal} className="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600">Anuluj</button>
              <button onClick={submitCorrection} disabled={corrSubmitting} className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">{corrSubmitting ? 'Zapisywanie...' : 'Zapisz korektę'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Istniejące filtry magazynowe */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Stan magazynowy</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Wyszukaj</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nazwa, SKU lub nr ewidencyjny"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={openSearchScanner}
                className="px-3 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                title="Skanuj kod do wyszukiwania"
              >
                📷
              </button>
            </div>
            {searchScanError && (
              <p className="text-red-600 dark:text-red-400 text-sm mt-1">{searchScanError}</p>
            )}
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
        <div className="overflow-x-auto">
        {/* Tabela materiałów zużywalnych */}
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-200 uppercase tracking-wider">Nazwa</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-200 uppercase tracking-wider hidden sm:table-cell">SKU</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-200 uppercase tracking-wider">Ilość</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-200 uppercase tracking-wider hidden sm:table-cell">Min</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 dark:text-slate-200 uppercase tracking-wider hidden sm:table-cell">Max</th>
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
                  <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                    {t.name}
                    <div className="mt-1 text-xs text-slate-500 sm:hidden">
                      <div>SKU: {t.sku || '-'}</div>
                      <div>Min: {min ?? '-'} | Max: {max ?? '-'}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hidden sm:table-cell">{t.sku}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{qty}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hidden sm:table-cell">{min ?? '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hidden sm:table-cell">{max ?? '-'}</td>
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

      {/* Modal skanera */}
      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={handleCloseScanner}
        onScan={handleScan}
        onError={(msg) => setScanError(msg)}
        displayQuantity={scanQty}
      />

      {/* Modal skanera dla wyszukiwania */}
      <BarcodeScanner
        isOpen={searchScannerOpen}
        onClose={closeSearchScanner}
        onScan={handleSearchScan}
        onError={(msg) => setSearchScanError(msg)}
      />

      {/* Modal potwierdzenia usunięcia korekty */}
      {showDeleteModal && (
        <ConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => { setShowDeleteModal(false); setDeleteTarget(null); }}
          onConfirm={async () => {
            if (!deleteTarget) return;
            try {
              setDeleteLoading(true);
              await deleteCorrection(deleteTarget);
              setShowDeleteModal(false);
              setDeleteTarget(null);
            } catch (_) {
              // Błąd komunikowany przez deleteCorrection
            } finally {
              setDeleteLoading(false);
            }
          }}
          title="Usuń korektę"
          message="Czy na pewno chcesz usunąć tę korektę?"
          confirmText="Usuń"
          cancelText="Anuluj"
          type="danger"
          loading={deleteLoading}
        />
      )}
    </div>
  );
}

export default InventoryScreen;
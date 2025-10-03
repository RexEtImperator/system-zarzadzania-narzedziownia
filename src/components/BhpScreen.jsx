import React, { useEffect, useRef, useState } from 'react';
import api from '../api';
import { toast } from 'react-toastify';
import { PERMISSIONS } from '../constants';

function BhpScreen({ employees = [], user }) {
  const formatDateForInput = (value) => {
    if (!value) return '';
    try {
      const str = String(value).trim();
      // ISO date or ISO with time -> take first 10 chars
      if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        return str.slice(0, 10);
      }
      // Handle DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
      const dmy = str.match(/^(\d{2})[.\/-](\d{2})[.\/-](\d{4})/);
      if (dmy) {
        const [, dd, mm, yyyy] = dmy;
        return `${yyyy}-${mm}-${dd}`;
      }
      // Fallback: try Date parsing
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      return '';
    } catch (_) {
      return '';
    }
  };
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    inventory_number: '',
    manufacturer: '',
    model: '',
    serial_number: '',
    catalog_number: '',
    production_date: '',
    inspection_date: '',
    is_set: false,
    has_shock_absorber: false,
    has_srd: false,
    harness_start_date: '',
    shock_absorber_serial: '',
    shock_absorber_name: '',
    shock_absorber_model: '',
    shock_absorber_catalog_number: '',
    shock_absorber_production_date: '',
    shock_absorber_start_date: '',
    srd_manufacturer: '',
    srd_model: '',
    srd_serial_number: '',
    srd_catalog_number: '',
    srd_production_date: '',
    status: 'dostępne'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [reviewsFilter, setReviewsFilter] = useState(false);
  const [detailsItem, setDetailsItem] = useState(null);
  const [detailsData, setDetailsData] = useState(null);
  const [issueModal, setIssueModal] = useState(false);
  const [returnModal, setReturnModal] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [activeIssueId, setActiveIssueId] = useState('');

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const result = await api.get('/api/bhp');
      setItems(result || []);
      notifyInspections(result || []);
    } catch (e) {
      console.error('Błąd pobierania BHP:', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const notifiedRef = useRef(new Set());
  // Odmiana jednostki dni: 1 dzień, pozostałe dni
  const dayWord = (n) => (Math.abs(n) === 1 ? 'dzień' : 'dni');
  const notifyInspections = (list) => {
    (list || []).forEach(item => {
      if (!item?.inspection_date) return;
      const insp = new Date(item.inspection_date);
      const now = new Date();
      const diffDays = Math.ceil((insp - now) / (1000 * 60 * 60 * 24));
      const key = `${item.id}-${diffDays}`;
      if (notifiedRef.current.has(key)) return;
      if (diffDays < 0) {
        toast.error(`Przegląd po terminie: ${item.inventory_number} (${Math.abs(diffDays)} ${dayWord(diffDays)})`, { toastId: key });
        notifiedRef.current.add(key);
      } else if (diffDays <= 7) {
        toast.warn(`Przegląd w ciągu 7 dni: ${item.inventory_number} (za ${diffDays} ${dayWord(diffDays)})`, { toastId: key });
        notifiedRef.current.add(key);
      } else if (diffDays <= 30) {
        toast.info(`Przegląd w ciągu 30 dni: ${item.inventory_number} (za ${diffDays} ${dayWord(diffDays)})`, { toastId: key });
        notifiedRef.current.add(key);
      }
    });
  };

  const openModal = (item = null) => {
    setEditingItem(item);
    if (item) {
      const hasShock = !!(item.shock_absorber_name || item.shock_absorber_model || item.shock_absorber_serial || item.shock_absorber_catalog_number || item.shock_absorber_production_date);
      const hasSrd = !!(item.srd_manufacturer || item.srd_model || item.srd_catalog_number || item.srd_production_date || item.srd_serial_number);
      setFormData({
        ...item,
        is_set: !!item.is_set,
        has_shock_absorber: hasShock,
        has_srd: hasSrd,
        production_date: formatDateForInput(item.production_date),
        harness_start_date: formatDateForInput(item.harness_start_date),
        shock_absorber_name: item.shock_absorber_name || '',
        shock_absorber_model: item.shock_absorber_model || '',
        shock_absorber_serial: item.shock_absorber_serial || '',
        shock_absorber_catalog_number: item.shock_absorber_catalog_number || '',
        shock_absorber_production_date: formatDateForInput(item.shock_absorber_production_date),
        shock_absorber_start_date: formatDateForInput(item.shock_absorber_start_date),
        srd_manufacturer: item.srd_manufacturer || '',
        srd_model: item.srd_model || '',
        srd_serial_number: item.srd_serial_number || '',
        srd_catalog_number: item.srd_catalog_number || '',
        srd_production_date: formatDateForInput(item.srd_production_date)
      });
    } else {
      setFormData({
        inventory_number: '',
        manufacturer: '',
        model: '',
        serial_number: '',
        catalog_number: '',
        production_date: '',
        inspection_date: '',
        is_set: false,
        has_shock_absorber: false,
        has_srd: false,
        harness_start_date: '',
        shock_absorber_serial: '',
        shock_absorber_name: '',
        shock_absorber_model: '',
        shock_absorber_catalog_number: '',
        shock_absorber_production_date: '',
        shock_absorber_start_date: '',
        srd_manufacturer: '',
        srd_model: '',
        srd_serial_number: '',
        srd_catalog_number: '',
        srd_production_date: '',
        status: 'dostępne'
      });
    }
    setShowModal(true);
  };

  const saveItem = async (e) => {
    e.preventDefault();
    try {
      if (formData.has_shock_absorber && formData.has_srd) {
        alert('Nie można zaznaczyć jednocześnie „Amortyzator” i „Urządzenie samohamowne”. Wybierz jedno.');
        return;
      }
      const normalizeDate = (v) => {
        if (!v) return null;
        const str = String(v).trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
        const dmy = str.match(/^(\d{2})[.\/-](\d{2})[.\/-](\d{4})/);
        if (dmy) {
          const [, dd, mm, yyyy] = dmy;
          return `${yyyy}-${mm}-${dd}`;
        }
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
        return null;
      };

      const payload = { 
        ...formData, 
        is_set: (formData.has_shock_absorber || formData.has_srd) ? 1 : 0,
        production_date: normalizeDate(formData.production_date),
        harness_start_date: normalizeDate(formData.harness_start_date),
        inspection_date: normalizeDate(formData.inspection_date),
        shock_absorber_production_date: normalizeDate(formData.shock_absorber_production_date),
        shock_absorber_start_date: normalizeDate(formData.shock_absorber_start_date),
        srd_production_date: normalizeDate(formData.srd_production_date)
      };
      let savedId = null;
      if (editingItem) {
        await api.put(`/api/bhp/${editingItem.id}`, payload);
        // Natychmiast zaktualizuj lokalny stan, aby ponowne otwarcie edycji pokazywało nowe wartości
        setItems(prev => prev.map(i => i.id === editingItem.id ? { ...i, ...payload } : i));
        savedId = editingItem.id;
      } else {
        const created = await api.post('/api/bhp', payload);
        setItems(prev => [...prev, created]);
        savedId = created?.id;
      }
      setShowModal(false);
      setEditingItem(null);
      // Natychmiast odśwież listę z API, aby widok był spójny z bazą
      await fetchItems();

      // Jeśli okno szczegółów jest otwarte dla edytowanej pozycji, przeładuj jego dane natychmiast
      if (detailsItem && savedId && detailsItem.id === savedId) {
        try {
          const freshDetails = await api.get(`/api/bhp/${savedId}/details`);
          setDetailsData(freshDetails);
          // Zsynchronizuj nagłówek szczegółów z najnowszymi danymi
          setDetailsItem(prev => (prev ? { ...prev, ...payload } : prev));
        } catch (err) {
          console.error('Błąd odświeżania szczegółów po zapisie:', err);
        }
      }

      // Potwierdzenie zapisu jako toast
      toast.success('Dane sprzętu zostały zaktualizowane');
    } catch (e) {
      console.error('Błąd zapisu BHP:', e);
      alert('Wystąpił błąd podczas zapisywania wpisu');
    }
  };

  const canManageBhp = (user?.role === 'administrator' || user?.role === 'manager');

  const deleteItem = async (id) => {
    if (!canManageBhp) {
      return alert('Brak uprawnień do usuwania BHP');
    }
    if (!window.confirm('Na pewno usunąć ten wpis BHP?')) return;
    try {
      await api.delete(`/api/bhp/${id}`);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (e) {
      console.error('Błąd usuwania BHP:', e);
      alert('Wystąpił błąd podczas usuwania');
    }
  };

  const openDetails = async (item) => {
    try {
      setDetailsItem(item);
      const data = await api.get(`/api/bhp/${item.id}/details`);
      setDetailsData(data);
    } catch (e) {
      console.error('Błąd pobierania szczegółów:', e);
      alert('Nie udało się pobrać szczegółów');
    }
  };

  const openIssue = (item) => {
    setDetailsItem(item);
    setSelectedEmployeeId('');
    setIssueModal(true);
  };

  const confirmIssue = async () => {
    if (!canManageBhp) {
      return alert('Brak uprawnień do wydawania BHP');
    }
    if (!selectedEmployeeId) return alert('Wybierz pracownika');
    try {
      await api.post(`/api/bhp/${detailsItem.id}/issue`, { employee_id: Number(selectedEmployeeId) });
      setIssueModal(false);
      fetchItems();
    } catch (e) {
      console.error('Błąd wydania:', e);
      alert('Nie udało się wydać');
    }
  };

  const openReturn = async (item) => {
    setDetailsItem(item);
    try {
      const data = await api.get(`/api/bhp/${item.id}/details`);
      const active = (data.issues || []).find(issue => issue.status === 'wydane');
      setActiveIssueId(active ? active.id : '');
      setReturnModal(true);
    } catch (e) {
      console.error('Błąd przygotowania zwrotu:', e);
      alert('Nie udało się pobrać danych zwrotu');
    }
  };

  const confirmReturn = async () => {
    if (!canManageBhp) {
      return alert('Brak uprawnień do zwrotu BHP');
    }
    if (!activeIssueId) return alert('Brak aktywnego wydania');
    try {
      await api.post(`/api/bhp/${detailsItem.id}/return`, { issue_id: Number(activeIssueId) });
      setReturnModal(false);
      fetchItems();
    } catch (e) {
      console.error('Błąd zwrotu:', e);
      alert('Nie udało się zwrócić');
    }
  };

  const filteredItemsBase = (items || []).filter(item => {
    const matchesSearch = !searchTerm || (
      item.inventory_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.manufacturer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.catalog_number?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const matchesStatus = !selectedStatus || item.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const getDiffDays = (dateStr) => {
    if (!dateStr) return null;
    const today = new Date();
    const date = new Date(dateStr);
    const diffMs = date.setHours(0,0,0,0) - today.setHours(0,0,0,0);
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  };

  const filteredItems = reviewsFilter
    ? (() => {
        const upcoming = [];
        const overdue = [];
        const noDate = [];
        filteredItemsBase.forEach(item => {
          const d = getDiffDays(item.inspection_date);
          if (d === null) {
            noDate.push(item);
          } else if (d >= 0) {
            upcoming.push({ item, d });
          } else {
            overdue.push({ item, d });
          }
        });
        upcoming.sort((a, b) => a.d - b.d);
        overdue.sort((a, b) => a.d - b.d); // more overdue first (-10 before -2)
        return [...upcoming.map(x => x.item), ...overdue.map(x => x.item), ...noDate];
      })()
    : filteredItemsBase;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen dark:bg-slate-900">
        <span className="text-slate-500 dark:text-slate-400">Ładowanie...</span>
      </div>
    );
  }

  const renderReminderBadge = (inspection_date) => {
    if (!inspection_date) return null;
    const now = new Date();
    const insp = new Date(inspection_date);
    const diffDays = Math.ceil((insp - now) / (1000 * 60 * 60 * 24));
    const statusClass = diffDays < 0
      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      : (diffDays <= 30
        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
        : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300');
    const label = diffDays < 0
      ? `Po terminie (${Math.abs(diffDays)} ${dayWord(diffDays)})`
      : `Przegląd za ${diffDays} ${dayWord(diffDays)}`;
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusClass}`}>
        {label}
      </span>
    );
  };

  return (
    <div className="p-6 bg-white dark:bg-slate-900 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Sprzęt BHP</h1>
          <p className="text-slate-600 dark:text-slate-400">Zarządzaj wyposażeniem BHP (wydania, zwroty, przeglądy)</p>
        </div>
        {canManageBhp ? (
          <button
            onClick={() => openModal()}
            className="bg-blue-600 dark:bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800"
          >
            Dodaj sprzęt
          </button>
        ) : null}
      </div>

      {/* Filtry */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Wyszukaj</label>
            <input
              type="text"
              placeholder="nr ewid., producent, model, seryjny..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Wszystkie</option>
              <option value="dostępne">Dostępne</option>
              <option value="wydane">Wydane</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Przeglądy</label>
            <button
              type="button"
              onClick={() => setReviewsFilter(prev => !prev)}
              className={`w-full px-3 py-2 rounded-lg border ${reviewsFilter ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600'}`}
            >
              {reviewsFilter ? 'Sortuj wg najbliższego przeglądu (ON)' : 'Sortuj wg najbliższego przeglądu (OFF)'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabela BHP */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-700">
            <tr>
              <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100">Nr ewidencyjny</th>
              <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100">Producent / Model</th>
              <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100">Seryjny / Katalogowy</th>
              <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100">Przegląd</th>
              <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100">Status</th>
              <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
            {filteredItems.map(item => (
              <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer" onClick={() => openDetails(item)}>
                <td className="p-4 font-mono text-sm text-slate-700 dark:text-slate-200">{item.inventory_number}</td>
                <td className="p-4 text-slate-700 dark:text-slate-200">
                  <div className="font-medium">{item.manufacturer || '-'} {item.model ? `— ${item.model}` : ''}</div>
                  {item.is_set ? (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Zestaw: amortyzator {item.shock_absorber_name || '-'} {item.shock_absorber_model || ''} • nr {item.shock_absorber_serial || '-'} • kat. {item.shock_absorber_catalog_number || '-'}
                    </div>
                  ) : null}
                  {item.assigned_employee_first_name || item.assigned_employee_last_name ? (
                    <div className="text-xs text-slate-500 dark:text-slate-400">Przypisano: {item.assigned_employee_first_name || ''} {item.assigned_employee_last_name || ''}</div>
                  ) : null}
                </td>
                <td className="p-4 text-slate-700 dark:text-slate-200">
                  <div>{item.serial_number || '-'}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Kat.: {item.catalog_number || '-'}</div>
                </td>
                <td className="p-4">
                  <div className="text-slate-700 dark:text-slate-200">{item.inspection_date ? new Date(item.inspection_date).toLocaleDateString('pl-PL') : '-'}</div>
                  <div className="mt-1">{renderReminderBadge(item.inspection_date)}</div>
                </td>
                <td className="p-4">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    item.status === 'dostępne' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300' :
                    item.status === 'wydane' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-300' :
                    'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-300'
                  }`}>
                    {item.status || 'nieznany'}
                  </span>
                </td>
                <td className="p-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-3">
                    {canManageBhp ? (
                      <>
                        <button onClick={() => openModal(item)} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium">Edytuj</button>
                        <button onClick={() => deleteItem(item.id)} className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm font-medium">Usuń</button>
                        {item.status !== 'wydane' ? (
                          <button onClick={() => openIssue(item)} className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 text-sm font-medium">Wydaj</button>
                        ) : (
                          <button onClick={() => openReturn(item)} className="text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 text-sm font-medium">Zwrot</button>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-slate-500 dark:text-slate-400">Brak uprawnień do akcji</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal dodawania/edycji */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{editingItem ? 'Edytuj pozycję BHP' : 'Dodaj pozycję BHP'}</h2>
            </div>
            <form onSubmit={saveItem} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nr ewidencyjny *</label>
                  <input type="text" value={formData.inventory_number} onChange={(e) => setFormData({ ...formData, inventory_number: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Producent</label>
                  <input type="text" value={formData.manufacturer} onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Model</label>
                  <input type="text" value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Numer seryjny</label>
                  <input type="text" value={formData.serial_number} onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Numer katalogowy</label>
                  <input type="text" value={formData.catalog_number} onChange={(e) => setFormData({ ...formData, catalog_number: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data produkcji (szelek)</label>
                  <input type="date" value={formData.production_date || ''} onChange={(e) => setFormData({ ...formData, production_date: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data rozpoczęcia użytkowania</label>
                  <input type="date" value={formData.harness_start_date || ''} onChange={(e) => setFormData({ ...formData, harness_start_date: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data przeglądu</label>
                  <input type="date" value={formData.inspection_date || ''} onChange={(e) => setFormData({ ...formData, inspection_date: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Zestaw</div>
                  <div className="flex items-center gap-6">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <input type="checkbox" className="accent-blue-600 dark:accent-blue-400" checked={formData.has_shock_absorber} onChange={(e) => {
                        const checked = e.target.checked;
                        setFormData({ ...formData, has_shock_absorber: checked, has_srd: checked ? false : formData.has_srd });
                      }} />
                      Amortyzator
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <input type="checkbox" className="accent-blue-600 dark:accent-blue-400" checked={formData.has_srd} onChange={(e) => {
                        const checked = e.target.checked;
                        setFormData({ ...formData, has_srd: checked, has_shock_absorber: checked ? false : formData.has_shock_absorber });
                      }} />
                      Urządzenie samohamowne
                    </label>
                  </div>
                </div>
              </div>

              {/* Amortyzator — pola po zaznaczeniu */}
              {formData.has_shock_absorber && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Amortyzator - producent</label>
                      <input type="text" value={formData.shock_absorber_name} onChange={(e) => setFormData({ ...formData, shock_absorber_name: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Amortyzator - model</label>
                      <input type="text" value={formData.shock_absorber_model} onChange={(e) => setFormData({ ...formData, shock_absorber_model: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Amortyzator - nr seryjny</label>
                      <input type="text" value={formData.shock_absorber_serial} onChange={(e) => setFormData({ ...formData, shock_absorber_serial: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Amortyzator - numer katalogowy</label>
                      <input type="text" value={formData.shock_absorber_catalog_number} onChange={(e) => setFormData({ ...formData, shock_absorber_catalog_number: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Amortyzator - data produkcji</label>
                      <input type="date" value={formData.shock_absorber_production_date || ''} onChange={(e) => setFormData({ ...formData, shock_absorber_production_date: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                  </div>
                </div>
              )}

              {/* Urządzenie samohamowne — pola po zaznaczeniu */}
              {formData.has_srd && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Urządzenie samohamowne - producent</label>
                      <input type="text" value={formData.srd_manufacturer} onChange={(e) => setFormData({ ...formData, srd_manufacturer: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Urządzenie samohamowne - model</label>
                      <input type="text" value={formData.srd_model} onChange={(e) => setFormData({ ...formData, srd_model: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Urządzenie samohamowne - nr seryjny</label>
                      <input type="text" value={formData.srd_serial_number} onChange={(e) => setFormData({ ...formData, srd_serial_number: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Urządzenie samohamowne - numer katalogowy</label>
                      <input type="text" value={formData.srd_catalog_number} onChange={(e) => setFormData({ ...formData, srd_catalog_number: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Urządzenie samohamowne - data produkcji</label>
                      <input type="date" value={formData.srd_production_date || ''} onChange={(e) => setFormData({ ...formData, srd_production_date: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                  </div>
                </div>
              )}

              {/* Usunięte: Amortyzator - data rozpoczęcia użytkowania (globalne pole wyżej) */}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600">Anuluj</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800">Zapisz</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal szczegółów */}
      {detailsItem && detailsData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 flex justify-between items-center border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Szczegóły BHP: {detailsItem.inventory_number}</h2>
              <button onClick={() => { setDetailsItem(null); setDetailsData(null); }} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"><span className="text-2xl">×</span></button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Producent:</span><span className="text-slate-900 dark:text-slate-100 font-medium">{detailsData.manufacturer || '-'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Model:</span><span className="text-slate-900 dark:text-slate-100">{detailsData.model || '-'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Seryjny:</span><span className="text-slate-900 dark:text-slate-100">{detailsData.serial_number || '-'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Katalogowy:</span><span className="text-slate-900 dark:text-slate-100">{detailsData.catalog_number || '-'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Data produkcji:</span><span className="text-slate-900 dark:text-slate-100">{detailsData.production_date ? new Date(detailsData.production_date).toLocaleDateString('pl-PL') : '-'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Rozpoczęcie użytkowania:</span><span className="text-slate-900 dark:text-slate-100">{detailsData.harness_start_date ? new Date(detailsData.harness_start_date).toLocaleDateString('pl-PL') : '-'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Przegląd:</span><span className="text-slate-900 dark:text-slate-100">{detailsData.inspection_date ? new Date(detailsData.inspection_date).toLocaleDateString('pl-PL') : '-'}</span></div>

                {(() => {
                  const hasShock = !!(detailsData.shock_absorber_name || detailsData.shock_absorber_model || detailsData.shock_absorber_serial || detailsData.shock_absorber_catalog_number || detailsData.shock_absorber_production_date);
                  const hasSrd = !!(detailsData.srd_manufacturer || detailsData.srd_model || detailsData.srd_catalog_number || detailsData.srd_production_date || detailsData.srd_serial_number);
                  return (
                    <>
                      {hasShock ? (
                        <div className="mt-4">
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Amortyzator</div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Producent:</span><span className="text-slate-900 dark:text-slate-100">{detailsData.shock_absorber_name || '-'}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Model:</span><span className="text-slate-900 dark:text-slate-100">{detailsData.shock_absorber_model || '-'}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Nr seryjny:</span><span className="text-slate-900 dark:text-slate-100">{detailsData.shock_absorber_serial || '-'}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Numer katalogowy:</span><span className="text-slate-900 dark:text-slate-100">{detailsData.shock_absorber_catalog_number || '-'}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Data produkcji:</span><span className="text-slate-900 dark:text-slate-100">{detailsData.shock_absorber_production_date ? new Date(detailsData.shock_absorber_production_date).toLocaleDateString('pl-PL') : '-'}</span></div>
                          </div>
                        </div>
                      ) : null}
                      {hasSrd ? (
                        <div className="mt-4">
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Urządzenie samohamowne</div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Producent:</span><span className="text-slate-900 dark:text-slate-100">{detailsData.srd_manufacturer || '-'}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Model:</span><span className="text-slate-900 dark:text-slate-100">{detailsData.srd_model || '-'}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Nr seryjny:</span><span className="text-slate-900 dark:text-slate-100">{detailsData.srd_serial_number || '-'}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Numer katalogowy:</span><span className="text-slate-900 dark:text-slate-100">{detailsData.srd_catalog_number || '-'}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Data produkcji:</span><span className="text-slate-900 dark:text-slate-100">{detailsData.srd_production_date ? new Date(detailsData.srd_production_date).toLocaleDateString('pl-PL') : '-'}</span></div>
                          </div>
                        </div>
                      ) : null}
                    </>
                  );
                })()}

                <div className="mt-2">{renderReminderBadge(detailsData.inspection_date)}</div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">Historia wydań/zwrotów</h3>
                <div className="space-y-2">
                  {(detailsData.issues || []).length === 0 ? (
                    <div className="text-sm text-slate-500 dark:text-slate-400">Brak wpisów</div>
                  ) : (
                    detailsData.issues.map((issue) => (
                      <div key={issue.id} className="p-2 bg-slate-50 dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600">
                        <div className="text-sm text-slate-900 dark:text-slate-100">
                          {issue.status === 'wydane' ? 'Wydano' : 'Zwrócono'} — {issue.employee_first_name} {issue.employee_last_name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{issue.issued_at ? new Date(issue.issued_at).toLocaleString('pl-PL') : '-'}{issue.returned_at ? ` • Zwrot: ${new Date(issue.returned_at).toLocaleString('pl-PL')}` : ''}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal wydania */}
      {issueModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Wydaj sprzęt BHP</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Pracownik</label>
                <select value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="">— wybierz —</option>
                  {(employees || []).map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setIssueModal(false)} className="flex-1 px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg">Anuluj</button>
                <button onClick={confirmIssue} className="flex-1 px-4 py-2 bg-emerald-600 dark:bg-emerald-700 text-white rounded-lg">Wydaj</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal zwrotu */}
      {returnModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Zwrot sprzętu BHP</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                {!activeIssueId ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">Brak aktywnego wydania do zwrotu</div>
                ) : (
                  <div className="text-sm text-slate-700 dark:text-slate-200">Wydanie ID: {activeIssueId}</div>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setReturnModal(false)} className="flex-1 px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg">Anuluj</button>
                <button onClick={confirmReturn} disabled={!activeIssueId} className="flex-1 px-4 py-2 bg-orange-600 dark:bg-orange-700 text-white rounded-lg disabled:opacity-50">Zwróć</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BhpScreen;
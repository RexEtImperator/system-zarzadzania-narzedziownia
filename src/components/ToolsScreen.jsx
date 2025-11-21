import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PencilSquareIcon, TrashIcon, WrenchIcon, EnvelopeIcon, ArrowDownOnSquareIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
 
import { notifyError, notifySuccess, notifyInfo, notifyWarn } from '../utils/notify';
import api from '../api';
import BarcodeScanner from './BarcodeScanner';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import * as XLSX from 'xlsx';
import { PERMISSIONS, hasPermission, PAGINATION } from '../constants';
import SkeletonList from './SkeletonList';
import { useLanguage } from '../contexts/LanguageContext';
import { getToolStatusInfo } from '../utils/statusUtils';

function ToolsScreen({ initialSearchTerm = '', user }) {
  const { t, language } = useLanguage();
  const locale = language === 'EN' ? 'en-GB' : (language === 'DE' ? 'de-DE' : 'pl-PL');
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTool, setEditingTool] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    serial_number: '',
    serial_unreadable: false,
    category: '',
    location: '',
    quantity: 1,
    status: 'dostępne',
    description: '',
    inventory_number: ''
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const MIN_SEARCH_LEN = 2;
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGINATION.DEFAULT_PAGE_SIZE);
  const [serverPagination, setServerPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: PAGINATION.DEFAULT_PAGE_SIZE });
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedTool, setSelectedTool] = useState(null);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [serviceTool, setServiceTool] = useState(null);
  const [serviceQuantity, setServiceQuantity] = useState(1);
  const [serviceOrderNumber, setServiceOrderNumber] = useState('');
  // Notify Return
  const [notifyModal, setNotifyModal] = useState(false);
  const [notifyTool, setNotifyTool] = useState(null);
  const [notifySending, setNotifySending] = useState(false);
  // Prefix for tool codes
  const [toolsCodePrefix, setToolsCodePrefix] = useState('');
  const [softLoading, setSoftLoading] = useState(false);
  const serviceModalRef = useRef(null);
  const notifyModalRef = useRef(null);
  const editModalRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (showServiceModal) handleCloseServiceModal();
        if (notifyModal) setNotifyModal(false);
        if (showModal) handleCloseModal();
      }
      if (e.key === 'Tab') {
        const el = serviceModalRef.current || notifyModalRef.current || editModalRef.current;
        if (!el) return;
        const nodes = el.querySelectorAll('a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])');
        const focusables = Array.from(nodes).filter(n => !n.hasAttribute('disabled'));
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    if (showServiceModal || notifyModal || showModal) {
      document.addEventListener('keydown', handler);
      setTimeout(() => {
        const el = serviceModalRef.current || notifyModalRef.current || editModalRef.current;
        if (!el) return;
        const nodes = el.querySelectorAll('a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])');
        const focusables = Array.from(nodes).filter(n => !n.hasAttribute('disabled'));
        if (focusables[0]) focusables[0].focus();
      }, 0);
    }
    return () => document.removeEventListener('keydown', handler);
  }, [showServiceModal, notifyModal, showModal]);

  // Backend suggestions for Power Tools; fallback to front-end data
  const [elektronarzedziaSuggestions, setElektronarzedziaSuggestions] = useState({ manufacturer: [], model: [], production_year: [] });
  const manufacturerSuggestions = useMemo(() => {
    if ((elektronarzedziaSuggestions.manufacturer || []).length > 0) return elektronarzedziaSuggestions.manufacturer;
    const s = new Set();
    (tools || [])
      .filter(t => (t?.category || '').trim().toLowerCase() === 'elektronarzędzia')
      .forEach(t => {
        const v = (t?.manufacturer || '').trim();
        if (v) s.add(v);
      });
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [tools, elektronarzedziaSuggestions]);

  const modelSuggestions = useMemo(() => {
    if ((elektronarzedziaSuggestions.model || []).length > 0) return elektronarzedziaSuggestions.model;
    const s = new Set();
    (tools || [])
      .filter(t => (t?.category || '').trim().toLowerCase() === 'elektronarzędzia')
      .forEach(t => {
        const v = (t?.model || '').trim();
        if (v) s.add(v);
      });
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [tools, elektronarzedziaSuggestions]);

  const yearSuggestions = useMemo(() => {
    if ((elektronarzedziaSuggestions.production_year || []).length > 0) return elektronarzedziaSuggestions.production_year.map(String).sort((a, b) => Number(a) - Number(b));
    const s = new Set();
    (tools || [])
      .filter(t => (t?.category || '').trim().toLowerCase() === 'elektronarzędzia')
      .forEach(t => {
        const yRaw = t?.production_year;
        if (typeof yRaw !== 'undefined' && yRaw !== null && String(yRaw).trim() !== '') {
          const y = parseInt(String(yRaw), 10);
          if (!Number.isNaN(y) && y >= 1900 && y <= (new Date().getFullYear() + 1)) {
            s.add(String(y));
          }
        }
      });
    return Array.from(s).sort((a, b) => Number(a) - Number(b));
  }, [tools, elektronarzedziaSuggestions]);

  // Pobierz sugestie z backendu, gdy modal jest otwarty i kategoria to Elektronarzędzia
  useEffect(() => {
    const cat = (formData.category || '').trim().toLowerCase();
    if (showModal && cat === 'elektronarzędzia') {
      (async () => {
        try {
          const data = await api.get('/api/tools/suggestions?category=Elektronarzędzia');
          const safe = data && typeof data === 'object' ? data : {};
          setElektronarzedziaSuggestions({
            manufacturer: Array.isArray(safe.manufacturer) ? safe.manufacturer : [],
            model: Array.isArray(safe.model) ? safe.model : [],
            production_year: Array.isArray(safe.production_year) ? safe.production_year : []
          });
        } catch (e) {
          console.warn(t('tools.suggestions.loadFailed'));
        }
      })();
    }
  }, [showModal, formData.category]);
  const [toolCategoryPrefixes, setToolCategoryPrefixes] = useState({});

  // Powiadomienia o nadchodzących przeglądach dla narzędzi spawalniczych
  const notifiedUpcomingRef = useRef(new Set());
  const didNotifyUpcomingRef = useRef(false);

  const daysUntil = (dateString) => {
    if (!dateString) return null;
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffMs = startOfDate - startOfNow;
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  };

  const notifyUpcomingSpawalnicze = (list) => {
    const arr = Array.isArray(list) ? list : [];
    arr.forEach(t => {
      const isSpawalnicze = String(t.category || '').toLowerCase() === 'spawalnicze'.toLowerCase();
      if (!isSpawalnicze) return;
      const d = daysUntil(t.inspection_date);
      if (d === null) return;
      // Tylko przyszłe terminy: 0-30 dni
      if (d < 0 || d > 30) return;
      const key = `${t.id || t.name}-${t.inspection_date || ''}`;
      if (notifiedUpcomingRef.current.has(key)) return;
      notifiedUpcomingRef.current.add(key);
      const label = t.inventory_number || t.name || t('tools.common.tool');
      const title = t('tools.weldInspection.title');
      const inTxt = t('tools.weldInspection.in');
      const daysTxt = t('tools.weldInspection.days');
      const extra = d <= 7 ? '' : t('tools.weldInspection.lessEqual30');
      const message = `${title}${label}${inTxt}${d}${daysTxt}${extra}`;
      if (d <= 7) {
        notifyWarn(message);
      } else {
        notifyInfo(message);
      }
    });
  };

  // Get unique categories and statuses for filters
  const categories = [...new Set((tools || []).map(tool => tool.category).filter(Boolean))];
  const statuses = [...new Set((tools || []).map(tool => tool.status).filter(Boolean))];
  // Kategorie z backendu do formularza dodawania/edycji
  const [availableCategories, setAvailableCategories] = useState([]);

  // Filter tools based on search and filters (fallback client-side)
  const filteredTools = useMemo(() => {
    const term = String(searchTerm || '').trim().toLowerCase();
    const cat = String(selectedCategory || '').trim().toLowerCase();
    const stat = String(selectedStatus || '').trim().toLowerCase();
    return (tools || []).filter(t => {
      const tCat = String(t?.category || '').trim().toLowerCase();
      const tStat = String(t?.status || '').trim().toLowerCase();
      if (cat && tCat !== cat) return false;
      if (stat && tStat !== stat) return false;
      if (!term) return true;
      const name = String(t?.name || '').toLowerCase();
      const sku = String(t?.sku || '').toLowerCase();
      const inv = String(t?.inventory_number || '').toLowerCase();
      const serial = String(t?.serial_number || '').toLowerCase();
      const loc = String(t?.location || '').toLowerCase();
      return name.includes(term) || sku.includes(term) || inv.includes(term) || serial.includes(term) || loc.includes(term);
    });
  }, [tools, searchTerm, selectedCategory, selectedStatus]);

  // Sort tools by inventory number ascending (empty values last)
  const sortedTools = useMemo(() => {
    const collator = new Intl.Collator(locale.startsWith('pl') ? 'pl' : (locale.startsWith('de') ? 'de' : 'en'), { numeric: true, sensitivity: 'base' });
    return [...filteredTools].sort((a, b) => {
      const aInv = String(a.inventory_number || '').trim();
      const bInv = String(b.inventory_number || '').trim();
      const aEmpty = aInv.length === 0;
      const bEmpty = bInv.length === 0;
      if (aEmpty && bEmpty) return 0;
      if (aEmpty) return 1; // empty last
      if (bEmpty) return -1; // empty last
      return collator.compare(aInv, bInv);
    });
  }, [filteredTools]);

  // Widokowe stronicowanie po stronie klienta, gdy backend nie stosuje limitu
  const visibleSortedTools = useMemo(() => {
    const totalLen = (tools || []).length;
    const serverPaginated = (serverPagination.totalPages > 1) || (serverPagination.totalItems !== totalLen);
    if (serverPaginated) return sortedTools;
    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, sortedTools.length);
    return sortedTools.slice(start, end);
  }, [sortedTools, tools, serverPagination, currentPage, pageSize]);

  const canViewTools = hasPermission(user, PERMISSIONS.VIEW_TOOLS);
  const canManageTools = hasPermission(user, PERMISSIONS.MANAGE_TOOLS);
  const canExportTools = hasPermission(user, PERMISSIONS.EXPORT_TOOLS);

  // Actions: Notify when tool is returned
  const openNotify = (tool) => {
    setNotifyTool(tool);
    setNotifyModal(true);
  };

  const confirmNotify = async () => {
    if (!canManageTools) {
      notifyError(t('tools.errors.noManagePermission'));
      return;
    }
    if (!notifyTool) return;
    try {
      setNotifySending(true);
      let targetEmployeeId = null;
      let targetBrandNumber = '';
      try {
        const issues = Array.isArray(notifyTool?.issues) ? notifyTool.issues : [];
        const active = issues.find(i => i.status === 'wydane') || issues[issues.length - 1];
        if (active && (active.employee_id || active.employeeId)) {
          targetEmployeeId = active.employee_id ?? active.employeeId;
          try {
            const emp = await api.get(`/api/employees/${targetEmployeeId}`);
            targetBrandNumber = emp?.brand_number || '';
          } catch (_) {}
        }
      } catch (_) {}
      await api.post(`/api/tools/${notifyTool.id}/notify-return`, {
        message: t('topbar.returnRequest'),
        target_employee_id: targetEmployeeId || undefined,
        target_brand_number: targetBrandNumber || undefined
      });
      notifySuccess(t('tools.notify.sent'));
      setNotifyModal(false);
      setNotifyTool(null);
    } catch (err) {
      notifyError(t('tools.notify.error'));
    } finally {
      setNotifySending(false);
    }
  };

  useEffect(() => {
    if (!canViewTools) {
      setLoading(false);
      setTools([]);
      return;
    }
    fetchTools({ soft: false });
  }, [canViewTools]);

  useEffect(() => {
    if (!canViewTools) return;
    fetchTools({ soft: true });
  }, [currentPage, pageSize]);

  useEffect(() => {
    if (!canViewTools) return;
    if (debouncedSearch && debouncedSearch.length < MIN_SEARCH_LEN) return;
    setCurrentPage(1);
    fetchTools({ soft: true });
  }, [debouncedSearch]);

  useEffect(() => {
    if (!canViewTools) return;
    setCurrentPage(1);
    fetchTools({ soft: false });
  }, [selectedCategory, selectedStatus]);

  // Once the tools are loaded, display the upcoming review toasts for the Welding category once
  useEffect(() => {
    if (!didNotifyUpcomingRef.current && (tools || []).length > 0) {
      try {
        notifyUpcomingSpawalnicze(tools);
      } finally {
        didNotifyUpcomingRef.current = true;
      }
    }
  }, [tools]);

  // Załaduj prefiks kodów z konfiguracji aplikacji
  useEffect(() => {
    const loadPrefixes = async () => {
      try {
        if (!canViewTools) return;
        const cfg = await api.get('/api/config/general');
        const tPrefix = cfg?.toolsCodePrefix || '';
        setToolsCodePrefix(tPrefix || '');
        setToolCategoryPrefixes(cfg?.toolCategoryPrefixes || {});
      } catch (err) {
        console.warn(t('tools.prefix.loadFailed'), err);
      }
    };
    loadPrefixes();
  }, [canViewTools]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        if (!canViewTools) return;
        const resp = await api.get('/api/categories');
        const names = Array.isArray(resp) ? resp.map(c => c.name).filter(Boolean) : [];
        setAvailableCategories(names);
      } catch (err) {
        console.warn('Nie udało się pobrać kategorii:', err?.message || err);
        setAvailableCategories([]);
      }
    };
    fetchCategories();
  }, [canViewTools]);


  // Bramka uprawnień: jeśli brak VIEW_TOOLS, pokaż komunikat i nie renderuj reszty UI
  if (!canViewTools) {
    return (
      <div className="p-4 lg:p-8 bg-slate-50 dark:bg-slate-900 min-h-screen">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Brak uprawnień</h3>
          <p className="text-slate-600 dark:text-slate-400">Brak uprawnień do przeglądania narzędzi (VIEW_TOOLS).</p>
        </div>
      </div>
    );
  }

  // Ustaw wstępny filtr z deep-linka, jeśli przekazano
  useEffect(() => {
    if (initialSearchTerm) {
      setSearchTerm(initialSearchTerm);
    }
  }, [initialSearchTerm]);

  // As-you-type walidacja unikalności numeru ewidencyjnego
  const inventoryCheckTimer = useRef(null);
  useEffect(() => {
    if (inventoryCheckTimer.current) {
      clearTimeout(inventoryCheckTimer.current);
    }
    inventoryCheckTimer.current = setTimeout(() => {
      const inv = (formData.inventory_number || '').trim();
      if (!inv) {
        setErrors(prev => ({ ...prev, inventory_number: null }));
        return;
      }
      const conflict = (tools || []).some(t => (
        t?.inventory_number &&
        t.inventory_number.toLowerCase() === inv.toLowerCase() &&
        t.id !== (editingTool?.id)
      ));
      setErrors(prev => ({
        ...prev,
        inventory_number: conflict ? 'Numer ewidencyjny jest już używany' : null
      }));
    }, 300);

    return () => {
      if (inventoryCheckTimer.current) {
        clearTimeout(inventoryCheckTimer.current);
      }
    };
  }, [formData.inventory_number, editingTool, tools]);

  // As-you-type walidacja unikalności SKU
  const skuCheckTimer = useRef(null);
  useEffect(() => {
    if (skuCheckTimer.current) {
      clearTimeout(skuCheckTimer.current);
    }
    skuCheckTimer.current = setTimeout(() => {
      const sku = (formData.sku || '').trim();
      if (!sku) {
        setErrors(prev => ({ ...prev, sku: null }));
        return;
      }
      const conflict = (tools || []).some(t => (
        t?.sku &&
        String(t.sku).toLowerCase() === sku.toLowerCase() &&
        t.id !== (editingTool?.id)
      ));
      setErrors(prev => ({
        ...prev,
        sku: conflict ? t('tools.validation.skuExists') : null
      }));
    }, 300);

    return () => {
      if (skuCheckTimer.current) {
        clearTimeout(skuCheckTimer.current);
      }
    };
  }, [formData.sku, editingTool, tools]);

  const fetchTools = async ({ soft = false } = {}) => {
    try {
      if (soft) setSoftLoading(true); else setLoading(true);
      const params = new URLSearchParams();
      params.append('page', String(currentPage));
      params.append('limit', String(pageSize));
      if (debouncedSearch && debouncedSearch.length >= MIN_SEARCH_LEN) params.append('search', debouncedSearch);
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedStatus) params.append('status', selectedStatus);
      const response = await api.get(`/api/tools?${params.toString()}`);
      const list = Array.isArray(response)
        ? response
        : (Array.isArray(response?.data) ? response.data : []);
      setTools(list);
      const p = response?.pagination;
      if (p && typeof p === 'object') {
        setServerPagination({
          currentPage: Number(p.currentPage) || currentPage,
          totalPages: Number(p.totalPages) || 1,
          totalItems: Number(p.totalItems) || list.length,
          itemsPerPage: Number(p.itemsPerPage) || pageSize
        });
      } else {
        setServerPagination({ currentPage, totalPages: 1, totalItems: list.length, itemsPerPage: pageSize });
      }
    } catch (error) {
      console.error('Error fetching tools:', error);
      setTools([]);
      setServerPagination({ currentPage, totalPages: 0, totalItems: 0, itemsPerPage: pageSize });
    } finally {
      if (soft) setSoftLoading(false); else setLoading(false);
    }
  };

  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(id);
  }, [searchTerm]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = t('tools.validation.nameRequired');
    }
    
    if (!formData.category.trim()) {
      newErrors.category = t('tools.validation.categoryRequired');
    }
    
    if (!formData.quantity || formData.quantity < 1) {
      newErrors.quantity = t('tools.validation.quantityMin');
    }

    // Sprawdzenie duplikatu numeru ewidencyjnego na submit
    const inv = (formData.inventory_number || '').trim();
    if (inv) {
      const conflict = (tools || []).some(t => (
        t?.inventory_number &&
        String(t.inventory_number).toLowerCase() === inv.toLowerCase() &&
        t.id !== (editingTool?.id)
      ));
      if (conflict) {
        newErrors.inventory_number = t('tools.validation.inventoryInUse');
      }
    }
    
    // Sprawdzenie duplikatu SKU na submit (po normalizacji z prefiksem)
    const normSku = (() => {
      const base = (formData.sku || '').toString().trim();
      const prefix = (toolsCodePrefix || '').toString();
      if (!base) return '';
      if (!prefix) return base;
      if (base.startsWith(`${prefix}-`)) return base;
      if (base.startsWith(prefix)) return `${prefix}-${base.slice(prefix.length)}`;
      return `${prefix}-${base}`;
    })();
    if (normSku) {
      const conflictSku = (tools || []).some(t => (
        t?.sku &&
        String(t.sku).toLowerCase() === normSku.toLowerCase() &&
        t.id !== (editingTool?.id)
      ));
      if (conflictSku) {
        newErrors.sku = 'Narzędzie o tym SKU już istnieje';
      }
    }

    // Walidacja stanów magazynowych dla materiałów zużywalnych
    const minValRaw = formData.min_stock;
    const maxValRaw = formData.max_stock;
    const minProvided = !(minValRaw === '' || minValRaw === null || typeof minValRaw === 'undefined');
    const maxProvided = !(maxValRaw === '' || maxValRaw === null || typeof maxValRaw === 'undefined');
    let minParsed = null;
    let maxParsed = null;
    if (minProvided) {
      minParsed = parseInt(minValRaw, 10);
      if (Number.isNaN(minParsed) || minParsed < 0) {
        newErrors.min_stock = t('tools.validation.minStockInvalid');
      }
    }
    if (maxProvided) {
      maxParsed = parseInt(maxValRaw, 10);
      if (Number.isNaN(maxParsed) || maxParsed < 0) {
        newErrors.max_stock = t('tools.validation.maxStockInvalid');
      }
    }
    if (!newErrors.min_stock && !newErrors.max_stock && minProvided && maxProvided && maxParsed < minParsed) {
      newErrors.max_stock = t('tools.validation.maxLessThanMin');
    }
    
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canManageTools) {
      notifyError(t('tools.errors.noManagePermission'));
      return;
    }
    
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});

  try {
      let dataToSubmit = { ...formData };
      
      // Generate SKU if not provided and not editing
      if (!editingTool && !dataToSubmit.sku) {
        const timestamp = Date.now().toString().slice(-6);
        const namePrefix = dataToSubmit.name.substring(0, 3).toUpperCase();
        dataToSubmit.sku = `${namePrefix}${timestamp}`;
      }

      // Znormalizuj SKU do formatu PREFIX-<wartość> (jeśli jest prefiks)
      {
        const baseSku = (dataToSubmit.sku || '').toString().trim();
        const prefix = (toolsCodePrefix || '').toString();
        if (baseSku && prefix) {
          if (baseSku.startsWith(`${prefix}-`)) {
            dataToSubmit.sku = baseSku;
          } else if (baseSku.startsWith(prefix)) {
            dataToSubmit.sku = `${prefix}-${baseSku.slice(prefix.length)}`;
          } else {
            dataToSubmit.sku = `${prefix}-${baseSku}`;
          }
        }
      }

      // Ustal treść kodu (z prefiksem) i zapisz jako barcode/qr_code — format PREFIX-<wartość>
      {
        const baseSku = (dataToSubmit.sku || '').toString();
        const prefix = (toolsCodePrefix || '').toString();
        let codeValue = baseSku;
        if (prefix) {
          if (baseSku.startsWith(`${prefix}-`)) {
            codeValue = baseSku;
          } else if (baseSku.startsWith(prefix)) {
            codeValue = `${prefix}-${baseSku.slice(prefix.length)}`;
          } else {
            codeValue = `${prefix}-${baseSku}`;
          }
        }
        dataToSubmit.barcode = codeValue;
        dataToSubmit.qr_code = codeValue;
      }

      if (editingTool) {
        await api.put(`/api/tools/${editingTool.id}`, dataToSubmit);
        setTools(prevTools => 
          prevTools.map(tool => 
            tool.id === editingTool.id ? { ...tool, ...dataToSubmit } : tool
          )
        );
        notifySuccess(t('tools.save.updateSuccess'));
      } else {
        const response = await api.post('/api/tools', dataToSubmit);
        // API client zwraca bezpośrednio obiekt narzędzia, nie { data }
        setTools(prevTools => [...prevTools, response]);
      }

      handleCloseModal();
    } catch (error) {
      console.error('Error saving tool:', error);
      let apiMsg = t('tools.save.error');
      if (error && typeof error.message === 'string' && error.message.trim().length > 0) {
        apiMsg = error.message;
      }
      const normalized = (apiMsg || '').toLowerCase();
      if (normalized.includes('sku') || normalized.includes('unique constraint')) {
        const msg = t('tools.validation.skuExists');
        setErrors(prev => ({ ...prev, sku: msg }));
        notifyError(msg);
      } else if (normalized.includes('numerze ewidencyjnym') || normalized.includes('inventory')) {
        setErrors(prev => ({ ...prev, inventory_number: apiMsg }));
        notifyError(apiMsg);
      } else if (normalized.includes('fabryczny') || normalized.includes('serial')) {
        setErrors(prev => ({ ...prev, serial_number: apiMsg }));
        notifyError(apiMsg);
      } else {
        setErrors(prev => ({ ...prev, submit: apiMsg }));
        if (apiMsg) notifyError(apiMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (tool = null) => {
    if (!canManageTools) {
      notifyError(t('tools.errors.noManagePermission'));
      return;
    }
    setEditingTool(tool);
    setFormData(tool ? { 
      ...tool, 
      // Znormalizuj SKU w modalu do formatu z prefiksem, aby użytkownik widział pełny kod
      sku: (() => {
        const base = (tool.sku || '').toString();
        const prefix = getCategoryPrefix(tool.category);
        if (!prefix) return base;
        if (base.startsWith(`${prefix}-`)) return base;
        if (base.startsWith(prefix)) return `${prefix}-${base.slice(prefix.length)}`;
        return `${prefix}-${base}`;
      })(),
      serial_unreadable: !!tool.serial_unreadable, 
      is_consumable: !!tool.is_consumable,
      min_stock: typeof tool.min_stock !== 'undefined' && tool.min_stock !== null ? tool.min_stock : '',
      max_stock: typeof tool.max_stock !== 'undefined' && tool.max_stock !== null ? tool.max_stock : '',
      inspection_date: tool.inspection_date || '' 
    } : {
      name: '',
      sku: '',
      serial_number: '',
      serial_unreadable: false,
      inventory_number: '',
      category: '',
      location: '',
      quantity: 1,
      status: 'dostępne',
      description: '',
      inspection_date: '',
      is_consumable: false,
      min_stock: '',
      max_stock: '',
      manufacturer: '',
      model: '',
      production_year: ''
    });
    setErrors({});
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTool(null);
    setFormData({
      name: '',
      sku: '',
      serial_number: '',
      serial_unreadable: false,
      inventory_number: '',
      category: '',
      location: '',
      quantity: 1,
      status: 'dostępne',
      description: '',
      inspection_date: '',
      is_consumable: false,
      min_stock: '',
      max_stock: '',
      manufacturer: '',
      model: '',
      production_year: ''
    });
    setErrors({});
  };

  const handleDelete = async (toolId) => {
    if (!canManageTools) {
      notifyError(t('tools.errors.noManagePermission'));
      return;
    }
    if (!window.confirm(t('tools.confirm.deleteTool'))) {
      return;
    }

    try {
      await api.delete(`/api/tools/${toolId}`);
      setTools(prevTools => prevTools.filter(tool => tool.id !== toolId));
    } catch (error) {
      console.error('Error deleting tool:', error);
      alert(t('tools.errors.deleteFailed'));
    }
  };

  const handleRowClick = async (tool) => {
    try {
      const resp = await api.get(`/api/tools/${tool.id}/details`);
      const details = resp?.tool || resp;
      setSelectedTool(details || tool);
    } catch (err) {
      console.error('Error fetching tool details:', err);
      setSelectedTool(tool);
    }
    setShowDetailsModal(true);
  };

  const handleOpenServiceModal = (tool) => {
    if (!canManageTools) {
      notifyError(t('tools.errors.noManagePermission'));
      return;
    }
    setServiceTool(tool);
    setServiceQuantity(1);
    setServiceOrderNumber(tool?.service_order_number || '');
    setShowServiceModal(true);
  };

  const handleCloseServiceModal = () => {
    setShowServiceModal(false);
    setServiceTool(null);
    setServiceQuantity(1);
    setServiceOrderNumber('');
  };

  const handleConfirmService = async () => {
    if (!canManageTools) {
      notifyError(t('tools.errors.noManagePermission'));
      return;
    }
    if (!serviceTool) return;
    const maxQty = (serviceTool.quantity || 0) - (serviceTool.service_quantity || 0);
    if (serviceQuantity < 1 || serviceQuantity > maxQty) {
      notifyError(`${t('tools.service.chooseQty')} ${maxQty}`);
      return;
    }
    try {
      const resp = await api.post(`/api/tools/${serviceTool.id}/service`, { quantity: serviceQuantity, service_order_number: (serviceOrderNumber || '').trim() || null });
      const updated = resp?.tool || resp; // w zależności od kształtu odpowiedzi
      setTools(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
      if (selectedTool?.id === updated.id) {
        setSelectedTool(prev => ({ ...prev, ...updated }));
      }
      notifySuccess(resp?.message || t('tools.service.sendSuccess'));
      handleCloseServiceModal();
    } catch (err) {
      const msg = err?.response?.data?.message || t('tools.service.sendFailed');
      notifyError(msg);
    }
  };

  const handleServiceReceive = async () => {
    if (!canManageTools) {
      notifyError(t('tools.errors.noManagePermission'));
      return;
    }
    if (!selectedTool) return;
    const current = selectedTool.service_quantity || 0;
    if (current <= 0) {
      notifyInfo(t('tools.service.receiveNone'));
      return;
    }
    try {
      const resp = await api.post(`/api/tools/${selectedTool.id}/service/receive`, { quantity: current });
      const updated = resp?.tool || resp;
      setTools(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
      setSelectedTool(prev => ({ ...prev, ...updated }));
      notifySuccess(resp?.message || t('tools.service.receiveSuccess'));
    } catch (err) {
      const msg = err?.response?.data?.message || t('tools.service.receiveFailed');
      notifyError(msg);
    }
  };

  const handleServiceReceiveFor = async (tool) => {
    if (!canManageTools) {
      notifyError(t('tools.errors.noManagePermission'));
      return;
    }
    if (!tool) return;
    const current = tool.service_quantity || 0;
    if (current <= 0) {
      notifyInfo(t('tools.service.receiveNone'));
      return;
    }
    try {
      const resp = await api.post(`/api/tools/${tool.id}/service/receive`, { quantity: current });
      const updated = resp?.tool || resp;
      setTools(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
      if (selectedTool?.id === updated.id) {
        setSelectedTool(prev => ({ ...prev, ...updated }));
      }
      notifySuccess(resp?.message || t('tools.service.receiveSuccess'));
    } catch (err) {
      const msg = err?.response?.data?.message || t('tools.service.receiveFailed');
      notifyError(msg);
    }
  };

  const handleScanResult = (result) => {
    setFormData(prev => ({ ...prev, sku: result }));
    setShowBarcodeScanner(false);
  };

  const handleScanError = (error) => {
    console.error('Scan error:', error);
    setShowBarcodeScanner(false);
  };

  // Zwraca efektywny prefiks dla danej kategorii (per-kategoria > tools > ogólny)
  const getCategoryPrefix = (categoryName) => {
    const byCat = (toolCategoryPrefixes || {})[categoryName || ''];
    if (byCat) return byCat.toString();
    if (toolsCodePrefix) return toolsCodePrefix.toString();
    return '';
  };

  // Oblicz treść kodu do QR/kreskowego z uwzględnieniem prefiksu
  // Normalizuje format do: PREFIX-<wartość> i unika podwajania prefiksu
  const getToolCodeText = (tool) => {
    const base = (tool?.sku || '').toString();
    const prefix = getCategoryPrefix(tool?.category);
    if (!prefix) return base;
    if (base.startsWith(`${prefix}-`)) return base;
    if (base.startsWith(prefix)) return `${prefix}-${base.slice(prefix.length)}`;
    return `${prefix}-${base}`;
  };

  // Wygeneruj SKU zgodnie z prefiksem, w formacie PREFIX-<wartość>
  const generateSkuWithPrefix = () => {
    const prefix = getCategoryPrefix(formData.category);
    const current = (formData.sku || '').toString().trim();
    const randomPart = Date.now().toString(36).toUpperCase().slice(-6);
    const suffix = current || randomPart;
    let next = suffix;
    if (prefix) {
      if (current.startsWith(`${prefix}-`)) {
        next = current;
      } else if (current.startsWith(prefix)) {
        next = `${prefix}-${current.slice(prefix.length)}`;
      } else {
        next = `${prefix}-${suffix}`;
      }
    }
    setFormData(prev => ({ ...prev, sku: next }));
  };

  // Generate QR Code
  const generateQRCode = async (text, width = 400) => {
    try {
      return await QRCode.toDataURL(text, {
        width: width,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'H',
        quality: 1
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
      return null;
    }
  };

  // Generate Barcode
  const generateBarcode = (text) => {
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, text, {
        format: 'CODE128',
        width: 3,
        height: 120,
        fontSize: 16,
        margin: 10,
        font: 'Arial',
        fontOptions: 'bold'
      });
      return canvas.toDataURL('image/png', 1.0);
    } catch (error) {
      console.error('Error generating barcode:', error);
      return null;
    }
  };

  // Download label function with improved quality
  const downloadLabel = async (tool) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Increase canvas size for better print quality (4x scale)
      const scale = 4;
      canvas.width = 400 * scale;
      canvas.height = 300 * scale;
      
      // Enable anti-aliasing and image smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.textRenderingOptimization = 'optimizeQuality';
      
      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Tool name (larger font)
      ctx.fillStyle = '#000000';
      ctx.font = `bold ${26 * scale}px Arial`;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.1)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      ctx.fillText(tool.name, canvas.width / 2, 40 * scale);
      
      // SKU (larger font)
      ctx.font = `${18 * scale}px Arial`;
      ctx.shadowColor = 'transparent';
      ctx.fillText(`${t('tools.labels.sku')}: ${tool.sku}`, canvas.width / 2, 70 * scale);
      
      // Generate and draw QR code
      const qrContent = getToolCodeText(tool);
      const qrCodeUrl = await generateQRCode(qrContent, 400);
      if (qrCodeUrl) {
        const qrImg = new Image();
        qrImg.onload = () => {
          ctx.drawImage(qrImg, 20 * scale, 90 * scale, 160 * scale, 160 * scale);
          
          // Generate and draw barcode
          const barcodeUrl = generateBarcode(qrContent);
          if (barcodeUrl) {
            const barcodeImg = new Image();
            barcodeImg.onload = () => {
              ctx.drawImage(barcodeImg, 200 * scale, 90 * scale, 200 * scale, 100 * scale);
              
              // Add informational text
              ctx.font = `${14 * scale}px Arial`;
              ctx.textAlign = 'center';
              ctx.fillText(t('tools.labels.scanPrompt'), canvas.width / 2, 280 * scale);

              // Download the image
              const link = document.createElement('a');
              link.download = `${t('tools.labels.filenameLabel')}-${tool.sku}.png`;
              link.href = canvas.toDataURL('image/png', 1.0);
              link.click();
            };
            barcodeImg.src = barcodeUrl;
          }
        };
        qrImg.src = qrCodeUrl;
      }
    } catch (error) {
      console.error('Error generating label:', error);
      alert(t('tools.labels.generateError'));
    }
  };

  // Download only-QR label (name + SKU + QR)
  const downloadQrLabel = async (tool) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const scale = 4;
      canvas.width = 400 * scale;
      canvas.height = 300 * scale;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Title: name
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.font = `bold ${26 * scale}px Arial`;
      ctx.fillText(tool.name || '', canvas.width / 2, 40 * scale);

      // Subtitle: SKU
      ctx.font = `${18 * scale}px Arial`;
      ctx.fillText(`${t('tools.labels.sku')}: ${tool.sku || ''}`, canvas.width / 2, 70 * scale);

      const qrCodeUrl = await generateQRCode(getToolCodeText(tool) || '', 800);
      if (qrCodeUrl) {
        const qrImg = new Image();
        qrImg.onload = () => {
          const size = 200 * scale;
          const x = (canvas.width - size) / 2;
          const y = 90 * scale;
          ctx.drawImage(qrImg, x, y, size, size);

          const link = document.createElement('a');
          link.download = `${t('tools.labels.filenameQr')}-${tool.sku || t('tools.common.tool')}.png`;
          link.href = canvas.toDataURL('image/png', 1.0);
          link.click();
        };
        qrImg.src = qrCodeUrl;
      }
    } catch (error) {
      console.error('Error generating QR-only label:', error);
      alert(t('tools.labels.generateQrError'));
    }
  };

  // Download only-barcode label (name + SKU + barcode)
  const downloadBarcodeLabel = async (tool) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const scale = 4;
      canvas.width = 400 * scale;
      canvas.height = 300 * scale;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Title: name
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.font = `bold ${26 * scale}px Arial`;
      ctx.fillText(tool.name || '', canvas.width / 2, 40 * scale);

      // Subtitle: SKU
      ctx.font = `${18 * scale}px Arial`;
      ctx.fillText(`${t('tools.labels.sku')}: ${tool.sku || ''}`, canvas.width / 2, 70 * scale);

      const barcodeUrl = generateBarcode(getToolCodeText(tool) || '');
      if (barcodeUrl) {
        const barcodeImg = new Image();
        barcodeImg.onload = () => {
          const w = 300 * scale;
          const h = 110 * scale;
          const x = (canvas.width - w) / 2;
          const y = 110 * scale;
          ctx.drawImage(barcodeImg, x, y, w, h);

          const link = document.createElement('a');
          link.download = `${t('tools.labels.filenameBarcode')}-${tool.sku || t('tools.common.tool')}.png`;
          link.href = canvas.toDataURL('image/png', 1.0);
          link.click();
        };
        barcodeImg.src = barcodeUrl;
      }
    } catch (error) {
      console.error('Error generating barcode-only label:', error);
      alert(t('tools.labels.generateBarcodeError'));
    }
  };

  // ===== Eksport listy i szczegółów =====
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

  const exportListToPDF = () => {
    const stamp = new Date().toLocaleString(locale);
    const itemsArr = filteredTools || [];

    const headerCells = [
      'Nr ewidencyjny',
      'Nazwa',
      'Numer fabryczny',
      'Kategoria',
      'Producent',
      'Model',
      'Rok Produkcji',
      'Status',
      'Lokalizacja',
      'SKU',
      'Ilość',
      'Opis',
      'Data przeglądu'
    ];
    const headerHtml = headerCells.map(h => `<th>${h}</th>`).join('');

    const tableRows = itemsArr.map(item => {
      const isSpawalnicze = String(item.category || '').trim().toLowerCase() === 'spawalnicze';
      const isElektronarzedzia = String(item.category || '').trim().toLowerCase() === 'elektronarzędzia';
      const insp = (isSpawalnicze && item.inspection_date) ? new Date(item.inspection_date).toLocaleDateString('pl-PL') : '';
      const cells = [
        `<td>${item.inventory_number || ''}</td>`,
        `<td>${item.name || ''}</td>`,
        `<td>${item.serial_unreadable ? 'nieczytelny' : (item.serial_number || '')}</td>`,
        `<td>${item.category || ''}</td>`,
        `<td>${isElektronarzedzia ? (item.manufacturer || '') : ''}</td>`,
        `<td>${isElektronarzedzia ? (item.model || '') : ''}</td>`,
        `<td>${isElektronarzedzia ? (item.production_year ?? '') : ''}</td>`,
        `<td>${item.status || ''}</td>`,
        `<td>${item.location || ''}</td>`,
        `<td>${getToolCodeText(item) || ''}</td>`,
        `<td>${item.quantity ?? ''}</td>`,
        `<td>${item.description || ''}</td>`,
        `<td>${insp}</td>`
      ];
      return `<tr>${cells.join('')}</tr>`;
    }).join('');

    const html = `
      <html>
      <head>
        <meta charset=\"utf-8\" />
        <title>Eksport Narzędzia — lista</title>
        <style>
          body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 24px; }
          h1 { font-size: 18px; margin: 0 0 8px; }
          .meta { color: #555; font-size: 12px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          thead th { background: #f3f4f6; color: #111827; text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
          tbody td { padding: 8px; border-bottom: 1px solid #eee; vertical-align: top; }
          tbody tr:nth-child(even) td { background: #fafafa; }
          @page { size: A4; margin: 12mm; }
        </style>
      </head>
      <body>
        <h1>Lista narzędzi</h1>
        <div class=\"meta\">Wygenerowano: ${stamp}</div>
        <table>
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
      </html>`;

    const w = window.open('', '_blank');
    if (!w) return alert('Pop-up został zablokowany przez przeglądarkę');
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  const exportListToXLSX = () => {
    const itemsArr = filteredTools || [];
    const headers = [
      'Nr ewidencyjny',
      'Nazwa',
      'Numer fabryczny',
      'Kategoria',
      'Producent',
      'Model',
      'Rok Produkcji',
      'Status',
      'Lokalizacja',
      'SKU',
      'Ilość',
      'Opis',
      'Data przeglądu'
    ];
    const rows = itemsArr.map(item => {
      const isSpawalnicze = String(item.category || '').trim().toLowerCase() === 'spawalnicze';
      const isElektronarzedzia = String(item.category || '').trim().toLowerCase() === 'elektronarzędzia';
      const insp = (isSpawalnicze && item.inspection_date) ? new Date(item.inspection_date).toLocaleDateString('pl-PL') : '';
      return [
        item.inventory_number || '',
        item.name || '',
        (item.serial_unreadable ? 'nieczytelny' : (item.serial_number || '')),
        item.category || '',
        isElektronarzedzia ? (item.manufacturer || '') : '',
        isElektronarzedzia ? (item.model || '') : '',
        isElektronarzedzia ? (item.production_year ?? '') : '',
        item.status || '',
        item.location || '',
        getToolCodeText(item) || '',
        item.quantity ?? '',
        item.description || '',
        insp
      ];
    });
    const aoa = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Narzędzia');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    downloadBlob(`narzedzia_lista_${stamp}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', wbout);
  };

  const exportDetailsToPDF = () => {
    if (!selectedTool) return;
    const stamp = new Date().toLocaleString('pl-PL');
    const rows = [
      ['Nr ewidencyjny', selectedTool.inventory_number || '-'],
      ['Nazwa', selectedTool.name || '-'],
      ['SKU', selectedTool.sku || '-'],
      ['Numer fabryczny', selectedTool.serial_unreadable ? 'nieczytelny' : (selectedTool.serial_number || '-')],
      ['Kategoria', selectedTool.category || '-'],
      ...(String(selectedTool.category || '').trim().toLowerCase() === 'elektronarzędzia' ? [
        ['Producent', selectedTool.manufacturer || '-'],
        ['Model', selectedTool.model || '-'],
        ['Rok produkcji', (typeof selectedTool.production_year !== 'undefined' && selectedTool.production_year !== null) ? String(selectedTool.production_year) : '-']
      ] : []),
      ...(String(selectedTool.category || '').trim().toLowerCase() === 'spawalnicze' && selectedTool.inspection_date ? [[
        'Data przeglądu', new Date(selectedTool.inspection_date).toLocaleDateString('pl-PL')
      ]] : []),
      ['Lokalizacja', selectedTool.location || '-'],
      ['Status', selectedTool.status || '-'],
      ['Ilość', selectedTool.quantity ?? '-'],
      ['Opis', selectedTool.description || '-']
    ];

    // Dodaj dane serwisowe, jeśli dostępne
    if ((selectedTool.service_quantity || 0) > 0) {
      rows.push(['W serwisie', String(selectedTool.service_quantity)]);
    }
    if (selectedTool.service_order_number) {
      rows.push(['Nr zlecenia serwisowego', selectedTool.service_order_number]);
    }
    if (selectedTool.service_sent_at) {
      const sent = new Date(selectedTool.service_sent_at).toLocaleString('pl-PL');
      rows.push(['Data wysłania na serwis', sent]);
    }

    const tableRowsHtml = rows.map(([label, value]) => `<tr><td>${label}</td><td>${value}</td></tr>`).join('');

    const html = `
      <html><head><meta charset=\"utf-8\" />
      <title>Eksport Narzędzia — szczegóły ${selectedTool.name || ''}</title>
      <style>
        body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 24px; }
        h1 { font-size: 18px; margin: 0 0 8px; }
        .meta { color: #555; font-size: 12px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        thead th { background: #f3f4f6; color: #111827; text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
        tbody td { padding: 8px; border-bottom: 1px solid #eee; }
        tbody tr:nth-child(even) td { background: #fafafa; }
        @page { size: A4; margin: 12mm; }
      </style>
      </head>
      <body>
        <h1>Szczegóły narzędzia</h1>
        <div class=\"meta\">Wygenerowano: ${stamp}</div>
        <table>
          <thead><tr><th>Pole</th><th>Wartość</th></tr></thead>
          <tbody>${tableRowsHtml}</tbody>
        </table>
      </body></html>`;

    const w = window.open('', '_blank');
    if (!w) return alert('Pop-up został zablokowany przez przeglądarkę');
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  const exportDetailsToXLSX = () => {
    if (!selectedTool) return;
    const headers = ['Pole', 'Wartość'];
    const fields = [
      ['Nr ewidencyjny', selectedTool.inventory_number || ''],
      ['Nazwa', selectedTool.name || ''],
      ['SKU', getToolCodeText(selectedTool) || ''],
      ['Numer fabryczny', selectedTool.serial_unreadable ? 'nieczytelny' : (selectedTool.serial_number || '')],
      ['Kategoria', selectedTool.category || ''],
      ...(String(selectedTool.category || '').trim().toLowerCase() === 'elektronarzędzia' ? [
        ['Producent', selectedTool.manufacturer || ''],
        ['Model', selectedTool.model || ''],
        ['Rok produkcji', (typeof selectedTool.production_year !== 'undefined' && selectedTool.production_year !== null) ? String(selectedTool.production_year) : '' ]
      ] : []),
      ...(String(selectedTool.category || '').trim().toLowerCase() === 'spawalnicze' && selectedTool.inspection_date ? [[
        'Data przeglądu', new Date(selectedTool.inspection_date).toLocaleDateString('pl-PL')
      ]] : []),
      ['Lokalizacja', selectedTool.location || ''],
      ['Status', selectedTool.status || ''],
      ['Ilość', selectedTool.quantity ?? ''],
      ['Opis', selectedTool.description || '']
    ];
    if ((selectedTool.service_quantity || 0) > 0) {
      fields.push(['W serwisie', String(selectedTool.service_quantity)]);
    }
    if (selectedTool.service_order_number) {
      fields.push(['Nr zlecenia serwisowego', selectedTool.service_order_number]);
    }
    if (selectedTool.service_sent_at) {
      const sent = new Date(selectedTool.service_sent_at).toLocaleString('pl-PL');
      fields.push(['Data wysłania na serwis', sent]);
    }
    const aoa = [headers, ...fields];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Narzędzie');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    downloadBlob(`narzedzie_${(selectedTool.sku || selectedTool.name || 'pozycja')}_${stamp}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', wbout);
  };

  // QR Code Display Component
  const QRCodeDisplay = ({ text }) => {
    const [qrCodeUrl, setQrCodeUrl] = useState('');

    useEffect(() => {
      const generateQR = async () => {
        try {
          const url = await QRCode.toDataURL(text, {
            width: 300,
            margin: 1,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            },
            errorCorrectionLevel: 'H',
            quality: 1
          });
          setQrCodeUrl(url);
        } catch (error) {
          console.error('Error generating QR code:', error);
        }
      };

      if (text) {
        generateQR();
      }
    }, [text]);

    if (!qrCodeUrl) return <div>{t('tools.qr.generating')}</div>;

    return (
      <img 
        src={qrCodeUrl} 
        alt={t('tools.qr.title')} 
        className="w-32 h-32 border border-slate-200 rounded"
        style={{ imageRendering: 'crisp-edges' }}
      />
    );
  };

  // Barcode Display Component
  const BarcodeDisplay = ({ text }) => {
    const [barcodeUrl, setBarcodeUrl] = useState('');

    useEffect(() => {
      const generateBC = () => {
        try {
          const canvas = document.createElement('canvas');
          JsBarcode(canvas, text, {
            format: 'CODE128',
            width: 4,
            height: 100,
            fontSize: 16,
            margin: 10,
            font: 'Arial',
            fontOptions: 'bold'
          });
          setBarcodeUrl(canvas.toDataURL('image/png', 1.0));
        } catch (error) {
          console.error('Error generating barcode:', error);
        }
      };

      if (text) {
        generateBC();
      }
    }, [text]);

    if (!barcodeUrl) return <div>{t('tools.barcode.generating')}</div>;

    return (
      <img 
        src={barcodeUrl} 
        alt={t('tools.barcode.title')} 
        className="border border-slate-200 rounded"
        style={{ imageRendering: 'crisp-edges' }}
      />
    );
  };

  // Fallback ładowania (po zarejestrowaniu wszystkich hooków i definicji fetchTools)
  if (loading) {
    return (
      <div className="p-6">
        <SkeletonList rows={12} cols={8} />
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-slate-900 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 sharp-text">{t('tools.header.title')}</h1>
          <p className="text-slate-600 dark:text-slate-400 sharp-text">{t('tools.header.subtitle')}</p>
        </div>
        {canManageTools && (
          <button
            onClick={() => handleOpenModal()}
            className="bg-blue-600 dark:bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors sharp-text"
          >
            {t('tools.actions.add')}
          </button>
        )}
      </div>
      {/* Search and Filter Section */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="tools-search" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 sharp-text">
              {t('tools.search.label')}
            </label>
            <div className="relative">
              <input
                id="tools-search"
                name="tools_search"
                type="text"
                placeholder={t('tools.search.placeholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setSearchTerm(''); } }}
                className="w-full pr-12 px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sharp-text"
              />
              {searchTerm && (
                <button
                  type="button"
                  aria-label={t('common.clearInput')}
                  title={t('common.clearInput')}
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="w-4 h-4"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div>
            <label htmlFor="tools-filter-category" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 sharp-text">
              {t('tools.filters.category.label')}
            </label>
            <select
              id="tools-filter-category"
              name="filter_category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sharp-text"
            >
              <option value="">{t('tools.filters.allCategories')}</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tools-filter-status" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 sharp-text">
              {t('tools.filters.status.label')}
            </label>
            <select
              id="tools-filter-status"
              name="filter_status"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sharp-text"
            >
              <option value="">{t('tools.filters.allStatuses')}</option>
              {statuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>
        {canExportTools && (
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={exportListToPDF}
              className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg hover:opacity-90 sharp-text"
            >
              {t('tools.export.pdf')}
            </button>
            <button
              type="button"
              onClick={exportListToXLSX}
              className="px-4 py-2 bg-emerald-600 dark:bg-emerald-700 text-white rounded-lg hover:bg-emerald-700 dark:hover:bg-emerald-800 sharp-text"
            >
              {t('tools.export.xlsx')}
            </button>
          </div>
        )}
      </div>

      {/* Tools List */}
      {loading && !softLoading ? (
        <div className="p-8 text-center">
          <div className="text-slate-400 dark:text-slate-500 text-6xl mb-4">🔧</div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2 sharp-text">{t('tools.loading.title')}</h3>
          <p className="text-slate-600 dark:text-slate-400 sharp-text">{t('tools.loading.subtitle')}</p>
        </div>
      ) : filteredTools.length === 0 ? (
        <div className="p-8 text-center">
          <div className="text-slate-400 dark:text-slate-500 text-6xl mb-4">🔧</div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2 sharp-text">{t('tools.empty.title')}</h3>
          <p className="text-slate-600 dark:text-slate-400 sharp-text">
            {searchTerm || selectedCategory || selectedStatus 
              ? t('tools.empty.descFiltered')
              : t('tools.empty.descDefault')}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-700 border-l-4 border-slate-50 dark:border-slate-700">
                <tr>
                  <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100 sharp-text">{t('tools.table.headers.inventoryNumberShort')}</th>
                  <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100 sharp-text">{t('tools.table.headers.name')}</th>
                  <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100 sharp-text">{t('tools.table.headers.serialNumber')}</th>
                  <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100 sharp-text">{t('tools.table.headers.category')}</th>
                  <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100 sharp-text">{t('tools.table.headers.location')}</th>
                  <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100 sharp-text">{t('tools.table.headers.sku')}</th>
                  <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100 sharp-text">{t('tools.table.headers.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                {visibleSortedTools.map((tool) => {
                  const { statusBorderColor } = getToolStatusInfo(tool);
                  
                  return (
                  <tr 
                    key={tool.id} 
                    className="hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                    onClick={() => handleRowClick(tool)}
                    style={{ borderLeft: '4px solid', borderLeftColor: statusBorderColor }}
                  >
                    <td className="p-4 text-slate-600 dark:text-slate-300 font-mono text-sm sharp-text">{tool.inventory_number || '-'}</td>
                    <td className="p-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100 sharp-text">{tool.name}</div>
                      {tool.description && (
                        <div className="text-sm text-slate-500 dark:text-slate-400 sharp-text">{tool.description}</div>
                      )}
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-300 font-mono text-sm sharp-text">{tool.serial_number || (tool.serial_unreadable ? t('tools.table.unreadableSerial') : '-')}</td>
                    <td className="p-4 text-slate-600 dark:text-slate-300 sharp-text">{tool.category || '-'}</td>
                    
                    <td className="p-4 text-slate-600 dark:text-slate-300 sharp-text">{tool.location || '-'}</td>
                    <td className="p-4 text-slate-600 dark:text-slate-300 font-mono text-sm sharp-text">{getToolCodeText(tool) || '-'}</td>
                <td className="p-4" onClick={(e) => e.stopPropagation()}>
                  {canManageTools ? (
                    <div className="flex gap-2">
                      {tool.status === 'wydane' && (
                        <button
                          onClick={() => openNotify(tool)}
                          className="p-2 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors"
                          aria-label={t('tools.actions.notifyReturn')}
                          title={t('tools.actions.notifyReturn')}
                        >
                          <EnvelopeIcon className="h-5 w-5" aria-hidden="true" />
                        </button>
                      )}
                      {(tool.service_quantity || 0) > 0 ? (
                        <button
                          onClick={() => handleServiceReceiveFor(tool)}
                          className="p-2 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                          aria-label={t('tools.actions.receiveFromService')}
                          title={t('tools.actions.receiveFromService')}
                        >
                          <ArrowDownOnSquareIcon className="h-5 w-5" aria-hidden="true" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenServiceModal(tool)}
                          className="p-2 bg-rose-100 text-rose-700 rounded hover:bg-rose-200 transition-colors"
                          aria-label={t('tools.actions.service')}
                          title={t('tools.actions.service')}
                        >
                          <WrenchIcon className="h-5 w-5" aria-hidden="true" />
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenModal(tool)}
                        className="p-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                        aria-label={t('tools.actions.edit')}
                        title={t('tools.actions.edit')}
                      >
                        <PencilSquareIcon className="h-5 w-5" aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => handleDelete(tool.id)}
                        className="p-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                        aria-label={t('tools.actions.delete')}
                        title={t('tools.actions.delete')}
                      >
                        <TrashIcon className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500 dark:text-slate-400">{t('bhp.actions.noPermission')}</span>
                  )}
                </td>
                  </tr>
                );})}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-600">
            {visibleSortedTools.map((tool) => {
              const { statusBorderColor } = getToolStatusInfo(tool);
              return (
              <div 
                key={tool.id} 
                className="p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-800"
                onClick={() => handleRowClick(tool)}
                style={{ borderLeft: '4px solid', borderLeftColor: statusBorderColor }}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100 sharp-text">{tool.name}</div>
                    {tool.description && (
                      <div className="text-sm text-slate-500 dark:text-slate-400 mt-1 sharp-text">{tool.description}</div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400 sharp-text">{t('tools.mobile.labels.inventoryNumber')}:</span>
                    <span className="text-slate-900 dark:text-slate-100 font-mono text-xs sharp-text">{tool.inventory_number || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400 sharp-text">{t('tools.mobile.labels.serialNumber')}:</span>
                    <span className="text-slate-900 dark:text-slate-100 font-mono text-xs sharp-text">{tool.serial_number || (tool.serial_unreadable ? t('tools.table.unreadableSerial') : '-')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400 sharp-text">{t('tools.mobile.labels.category')}:</span>
                    <span className="text-slate-900 dark:text-slate-100 sharp-text">{tool.category || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400 sharp-text">{t('tools.mobile.labels.location')}:</span>
                    <span className="text-slate-900 dark:text-slate-100 sharp-text">{tool.location || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400 sharp-text">{t('tools.labels.sku')}:</span>
                    <span className="text-slate-900 dark:text-slate-100 font-mono text-xs sharp-text">{getToolCodeText(tool) || '-'}</span>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-600" onClick={(e) => e.stopPropagation()}>
                  {canManageTools && (
                    <>
                      {tool.status === 'wydane' && (
                        <button
                          onClick={() => openNotify(tool)}
                          className="flex-1 bg-indigo-50 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 py-2 px-3 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-800 transition-colors text-sm font-medium sharp-text"
                        >
                          {t('tools.actions.notifyReturn')}
                        </button>
                      )}
                      {(tool.service_quantity || 0) > 0 ? (
                        <button
                          onClick={() => handleServiceReceiveFor(tool)}
                          className="flex-1 bg-green-50 dark:bg-green-900 text-green-600 dark:text-green-300 py-2 px-3 rounded-lg hover:bg-green-100 dark:hover:bg-green-800 transition-colors text-sm font-medium sharp-text flex items-center justify-center gap-2"
                        >
                          <ArrowDownOnSquareIcon className="h-5 w-5" aria-hidden="true" />
                          {t('tools.actions.receiveFromService')}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenServiceModal(tool)}
                          className="flex-1 bg-rose-50 dark:bg-rose-900 text-rose-600 dark:text-rose-300 py-2 px-3 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-800 transition-colors text-sm font-medium sharp-text"
                        >
                          {t('tools.actions.service')}
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenModal(tool)}
                        className="flex-1 bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300 py-2 px-3 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors text-sm font-medium sharp-text"
                      >
                        {t('tools.actions.edit')}
                      </button>
                      <button
                        onClick={() => handleDelete(tool.id)}
                        className="flex-1 bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-300 py-2 px-3 rounded-lg hover:bg-red-100 dark:hover:bg-red-800 transition-colors text-sm font-medium sharp-text"
                      >
                        {t('tools.actions.delete')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );})}
          </div>
        </>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between mt-3 px-6 py-3 bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="text-sm text-slate-700 dark:text-slate-200">
          {t('common.pagination.range', {
            start: ((serverPagination.totalPages > 1 || serverPagination.totalItems !== (tools || []).length) ? serverPagination.totalItems : filteredTools.length) === 0
              ? 0
              : ((serverPagination.currentPage - 1) * pageSize + 1),
            end: ((serverPagination.totalPages > 1 || serverPagination.totalItems !== (tools || []).length) ? serverPagination.totalItems : filteredTools.length) === 0
              ? 0
              : Math.min(
                  serverPagination.currentPage * pageSize,
                  (serverPagination.totalPages > 1 || serverPagination.totalItems !== (tools || []).length)
                    ? serverPagination.totalItems
                    : filteredTools.length
                ),
            total: (serverPagination.totalPages > 1 || serverPagination.totalItems !== (tools || []).length)
              ? serverPagination.totalItems
              : filteredTools.length
          })}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
            className="px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            aria-label="Rows per page"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={serverPagination.currentPage === 1}
              className="px-2 py-1 text-sm rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 disabled:opacity-50"
              aria-label={t('common.pagination.prev')}
            >
              ‹
            </button>
            <span className="text-sm text-slate-700 dark:text-slate-200">
              {serverPagination.currentPage} / {serverPagination.totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.min(serverPagination.totalPages, p + 1))}
              disabled={serverPagination.currentPage === serverPagination.totalPages}
              className="px-2 py-1 text-sm rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 disabled:opacity-50"
              aria-label={t('common.pagination.next')}
            >
              ›
            </button>
          </div>
        </div>
      </div>
      {/* Service Modal */}
      {showServiceModal && serviceTool && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={(e) => { if (e.target === e.currentTarget) handleCloseServiceModal(); }}
        >
          <div ref={serviceModalRef} role="dialog" aria-modal="true" aria-labelledby="service-title" aria-describedby="service-desc" className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 id="service-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100 sharp-text">{t('tools.service.modal.title')}</h2>
                <button
                  onClick={handleCloseServiceModal}
                  className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>
              <div id="service-desc" className="text-sm text-slate-600 dark:text-slate-300 mb-3 sharp-text">{t('tools.service.modalDescription')}</div>
              <div className="space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-300 sharp-text">{t('tools.common.toolIssued')}: <span className="font-medium">{serviceTool.name}</span></p>
                <p className="text-sm text-slate-600 dark:text-slate-300 sharp-text">{t('tools.service.available')}: <span className="font-medium">{(serviceTool.quantity || 0) - (serviceTool.service_quantity || 0)}</span> szt.</p>
                <label htmlFor="service-quantity" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 sharp-text">{t('tools.service.quantityLabel')}</label>
                <input
                  id="service-quantity"
                  type="number"
                  min={1}
                  max={(serviceTool.quantity || 0) - (serviceTool.service_quantity || 0)}
                  value={serviceQuantity}
                  onChange={(e) => setServiceQuantity(parseInt(e.target.value || '1', 10))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 sharp-text"
                />
                <label htmlFor="service-order-number" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 sharp-text">{t('tools.service.orderNumberLabel')}</label>
                <input
                  id="service-order-number"
                  type="text"
                  value={serviceOrderNumber}
                  onChange={(e) => setServiceOrderNumber(e.target.value)}
                  placeholder={t('tools.service.orderNumberPlaceholder')}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 sharp-text"
                />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={handleCloseServiceModal}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm hover:bg-slate-200 dark:hover:bg-slate-600 sharp-text focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleConfirmService}
                  className="px-3 py-1.5 bg-rose-600 dark:bg-rose-700 text-white rounded-lg text-sm hover:bg-rose-700 dark:hover:bg-rose-800 sharp-text focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500"
                >
                  {t('tools.service.sendButton')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notify Return Modal */}
      {notifyModal && notifyTool && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={(e) => { if (e.target === e.currentTarget) setNotifyModal(false); }}
        >
          <div ref={notifyModalRef} role="dialog" aria-modal="true" aria-labelledby="notify-title" aria-describedby="notify-desc" className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 id="notify-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100 sharp-text">{t('tools.actions.notifyReturn')}</h2>
                <button
                  onClick={() => setNotifyModal(false)}
                  className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>
              <div id="notify-desc" className="text-sm text-slate-600 dark:text-slate-300 mb-3 sharp-text">{t('tools.notify.modalDescription')}</div>
              <div className="space-y-2">
                <p className="text-sm text-slate-600 dark:text-slate-300 sharp-text">{t('tools.labels.sku')}: <span className="font-mono">{notifyTool.sku || '-'}</span></p>
                <p className="text-sm text-slate-600 dark:text-slate-300 sharp-text">{t('tools.common.toolIssued')}: <span className="font-medium">{notifyTool.name}</span></p>
                <p className="text-sm text-slate-600 dark:text-slate-300 sharp-text">{t('tools.table.headers.status')}: <span className="font-medium">{notifyTool.status || '-'}</span></p>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setNotifyModal(false)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm hover:bg-slate-200 dark:hover:bg-slate-600 sharp-text focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={confirmNotify}
                  disabled={notifySending}
                  className="px-3 py-1.5 bg-indigo-600 dark:bg-indigo-700 text-white rounded-lg text-sm hover:bg-indigo-700 dark:hover:bg-indigo-800 disabled:opacity-50 sharp-text focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  {t('confirmation.confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner */}
      {showBarcodeScanner && (
        <BarcodeScanner
          onScanResult={handleScanResult}
          onError={handleScanError}
        />
      )}

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={(e) => { if (e.target === e.currentTarget) handleCloseModal(); }}
        >
          <div ref={editModalRef} role="dialog" aria-modal="true" aria-labelledby="edit-title" aria-describedby="edit-desc" className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 id="edit-title" className="text-xl font-bold text-slate-900 dark:text-slate-100 sharp-text">
                  {editingTool ? 'Edytuj narzędzie' : 'Dodaj narzędzie'}
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>
              <div id="edit-desc" className="text-sm text-slate-600 dark:text-slate-300 mb-3 sharp-text">{t('tools.edit.modalDescription')}</div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* First row - Name and SKU */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="tool-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 sharp-text">
                      Nazwa *
                    </label>
                    <input
                      id="tool-name"
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100 sharp-text ${
                        errors.name ? 'border-red-300 dark:border-red-600' : 'border-slate-300 dark:border-slate-600'
                      }`}
                      placeholder="Nazwa narzędzia"
                    />
                    {errors.name && (
                      <p className="text-red-600 dark:text-red-400 text-sm mt-1 sharp-text">{errors.name}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="tool-sku" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 sharp-text">
                      SKU {!editingTool && <span className="text-slate-500 dark:text-slate-400 text-xs">(auto)</span>}
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="tool-sku"
                        type="text"
                        name="sku"
                        value={formData.sku}
                        onChange={handleInputChange}
                        className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100 sharp-text ${
                          errors.sku ? 'border-red-300 dark:border-red-600' : 'border-slate-300 dark:border-slate-600'
                        }`}
                        placeholder={editingTool ? "SKU narzędzia" : "SKU (opcjonalne)"}
                      />
                      {formData.sku && errors.sku && (
                        <span className="px-2 py-1 text-xs bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300 border border-red-200 dark:border-red-700 rounded self-center whitespace-nowrap sharp-text">
                          Zajęte
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowBarcodeScanner(true)}
                        className="px-3 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                        title="Skanuj kod kreskowy/QR"
                      >
                        📷
                      </button>
                      <button
                        type="button"
                        onClick={generateSkuWithPrefix}
                        className="px-3 py-2 bg-slate-600 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-700 dark:hover:bg-slate-800 focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-colors"
                        title="Generuj kod z prefiksem"
                      >
                        ⚙️
                      </button>
                    </div>
                    {errors.sku && (
                      <p className="text-red-600 dark:text-red-400 text-sm mt-1 sharp-text">{errors.sku}</p>
                    )}
                  </div>
                </div>

                {/* Inventory and Serial side-by-side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="tool-inventory-number" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 sharp-text">
                      Numer ewidencyjny
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="tool-inventory-number"
                        type="text"
                        name="inventory_number"
                        value={formData.inventory_number || ''}
                        onChange={handleInputChange}
                        className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-slate-100 sharp-text ${
                          errors.inventory_number ? 'border-red-300 dark:border-red-600' : 'border-slate-300 dark:border-slate-600'
                        }`}
                        placeholder="Np. NE-000123"
                      />
                      {formData.inventory_number && errors.inventory_number && (
                        <span className="px-2 py-1 text-xs bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300 border border-red-200 dark:border-red-700 rounded self-center whitespace-nowrap sharp-text">
                          Zajęte
                        </span>
                      )}
                    </div>
                    {errors.inventory_number && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400 sharp-text">{errors.inventory_number}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="tool-serial-number" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 sharp-text">
                      Numer fabryczny *
                    </label>
                    <input
                      id="tool-serial-number"
                      type="text"
                      name="serial_number"
                      value={formData.serial_number || ''}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-slate-100 sharp-text ${
                        errors.serial_number ? 'border-red-300 dark:border-red-600' : 'border-slate-300 dark:border-slate-600'
                      }`}
                      placeholder="Np. SN-123456"
                      disabled={formData.serial_unreadable}
                    />
                    {errors.serial_number && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400 sharp-text">{errors.serial_number}</p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        id="serial_unreadable"
                        type="checkbox"
                        name="serial_unreadable"
                        checked={!!formData.serial_unreadable}
                        onChange={handleInputChange}
                        className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="serial_unreadable" className="text-sm text-slate-700 dark:text-slate-300 sharp-text">Numer nieczytelny</label>
                    </div>
                  </div>
                </div>

                {/* Second row - Category and Location */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="tool-category" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 sharp-text">
                      Kategoria *
                    </label>
                    <select
                      id="tool-category"
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100 sharp-text ${
                        errors.category ? 'border-red-300 dark:border-red-600' : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      <option value="">Wybierz kategorię</option>
                      {availableCategories.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                      {formData.category && !availableCategories.includes(formData.category) && (
                        <option value={formData.category}>{formData.category} (istniejąca)</option>
                      )}
                    </select>
                    {errors.category && (
                      <p className="text-red-600 dark:text-red-400 text-sm mt-1 sharp-text">{errors.category}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="tool-location" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 sharp-text">
                      Lokalizacja
                    </label>
                    <input
                      id="tool-location"
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-slate-100 sharp-text"
                      placeholder="Lokalizacja narzędzia"
                    />
                  </div>
                </div>

                {/* Review Date tile for Spawalnicze/Spalawnicze */}
                {(() => {
                  const cat = (formData.category || '').trim().toLowerCase();
                  const isCombustion = cat === 'spawalnicze' || cat === 'spalawnicze';
                  if (!isCombustion) return null;
                  return (
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 p-4">
                      <label htmlFor="tool-inspection-date" className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 sharp-text">Data przeglądu</label>
                      <input
                        id="tool-inspection-date"
                        type="date"
                        name="inspection_date"
                        value={formData.inspection_date || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-slate-100 sharp-text"
                      />
                    </div>
                  );
                })()}

                {/* Elektronarzędzia tile: Producent/Model/Rok Produkcji */}
                {(() => {
                  const cat = (formData.category || '').trim().toLowerCase();
                  if (cat !== 'elektronarzędzia') return null;
                  const currentYear = new Date().getFullYear();
                  return (
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 p-4">
                      <div className="mb-2">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 sharp-text">Dane techniczne</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label htmlFor="tool-manufacturer" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 sharp-text">Producent</label>
                          <input
                            id="tool-manufacturer"
                            type="text"
                            name="manufacturer"
                            value={formData.manufacturer || ''}
                            onChange={handleInputChange}
                            list="manufacturer-suggestions"
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-slate-100 sharp-text"
                            placeholder="Np. Bosch, Makita, DeWalt"
                          />
                          <datalist id="manufacturer-suggestions">
                            {manufacturerSuggestions.map(opt => (
                              <option key={`mf-${opt}`} value={opt} />
                            ))}
                          </datalist>
                        </div>

                        <div>
                          <label htmlFor="tool-model" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 sharp-text">Model</label>
                          <input
                            id="tool-model"
                            type="text"
                            name="model"
                            value={formData.model || ''}
                            onChange={handleInputChange}
                            list="model-suggestions"
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-slate-100 sharp-text"
                            placeholder="Np. GSR 18V-55"
                          />
                          <datalist id="model-suggestions">
                            {modelSuggestions.map(opt => (
                              <option key={`md-${opt}`} value={opt} />
                            ))}
                          </datalist>
                        </div>

                        <div>
                          <label htmlFor="tool-production-year" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 sharp-text">Rok Produkcji</label>
                          <input
                            id="tool-production-year"
                            type="number"
                            name="production_year"
                            value={formData.production_year || ''}
                            onChange={handleInputChange}
                            list="year-suggestions"
                            min={1900}
                            max={currentYear + 1}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-slate-100 sharp-text"
                            placeholder="Np. 2024"
                          />
                          <datalist id="year-suggestions">
                            {yearSuggestions.map(opt => (
                              <option key={`yr-${opt}`} value={opt} />
                            ))}
                          </datalist>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 sharp-text">Skorzystaj z podpowiedzi aby szybko wybrać wcześniej użyte wartości.</p>
                    </div>
                  );
                })()}

                {/* Third row - Quantity */}
                <div>
                  <label htmlFor="tool-quantity" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 sharp-text">
                    Ilość *
                  </label>
                  <input
                    id="tool-quantity"
                    type="number"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleInputChange}
                    min="1"
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100 sharp-text ${
                      errors.quantity ? 'border-red-300 dark:border-red-600' : 'border-slate-300 dark:border-slate-600'
                    }`}
                  />
                  {errors.quantity && (
                    <p className="text-red-600 dark:text-red-400 text-sm mt-1 sharp-text">{errors.quantity}</p>
                  )}
                </div>

                {/* Consumable & Stock Limits */}
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 p-4">
                  <div className="flex items-center gap-2">
                    <input
                      id="is_consumable"
                      type="checkbox"
                      name="is_consumable"
                      checked={!!formData.is_consumable}
                      onChange={handleInputChange}
                      className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="is_consumable" className="text-sm font-medium text-slate-700 dark:text-slate-200 sharp-text">
                      Materiał zużywalny
                    </label>
                  </div>

                  {formData.is_consumable && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                      <div>
                        <label htmlFor="tool-min-stock" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 sharp-text">
                          Stan minimalny
                        </label>
                        <input
                          id="tool-min-stock"
                          type="number"
                          name="min_stock"
                          value={formData.min_stock}
                          onChange={handleInputChange}
                          min="0"
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100 sharp-text ${
                            errors.min_stock ? 'border-red-300 dark:border-red-600' : 'border-slate-300 dark:border-slate-600'
                          }`}
                          placeholder="np. 10"
                        />
                        {errors.min_stock && (
                          <p className="text-red-600 dark:text-red-400 text-sm mt-1 sharp-text">{errors.min_stock}</p>
                        )}
                      </div>
                      <div>
                        <label htmlFor="tool-max-stock" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 sharp-text">
                          Stan maksymalny
                        </label>
                        <input
                          id="tool-max-stock"
                          type="number"
                          name="max_stock"
                          value={formData.max_stock}
                          onChange={handleInputChange}
                          min="0"
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100 sharp-text ${
                            errors.max_stock ? 'border-red-300 dark:border-red-600' : 'border-slate-300 dark:border-slate-600'
                          }`}
                          placeholder="np. 100"
                        />
                        {errors.max_stock && (
                          <p className="text-red-600 dark:text-red-400 text-sm mt-1 sharp-text">{errors.max_stock}</p>
                        )}
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 sharp-text">
                    Ustaw min/max aby śledzić braki materiałów.
                  </p>
                </div>

                {/* Description - full width */}
                <div>
                  <label htmlFor="tool-description" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 sharp-text">
                    Opis
                  </label>
                  <textarea
                    id="tool-description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-slate-100 sharp-text"
                    placeholder="Opis narzędzia"
                  />
                </div>

                {errors.submit && (
                  <div className="text-red-600 dark:text-red-400 text-sm sharp-text">{errors.submit}</div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors sharp-text"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors disabled:opacity-50 sharp-text"
                  >
                    {isLoading ? 'Zapisywanie...' : (editingTool ? 'Zaktualizuj' : 'Dodaj')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Tool Details Modal */}
      {showDetailsModal && selectedTool && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={(e) => { if (e.target === e.currentTarget) setShowDetailsModal(false); }}
        >
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 flex justify-between items-center border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 sharp-text">
                Szczegóły narzędzia: {selectedTool.name}
              </h2>
              <div className="flex items-center gap-3">
                {canExportTools && (
                  <>
                    <button
                      onClick={exportDetailsToPDF}
                      className="px-3 py-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm hover:opacity-90 sharp-text"
                    >
                      Eksportuj do PDF
                    </button>
                    <button
                      onClick={exportDetailsToXLSX}
                      className="px-3 py-1.5 bg-emerald-600 dark:bg-emerald-700 text-white rounded-lg text-sm hover:bg-emerald-700 dark:hover:bg-emerald-800 sharp-text"
                    >
                      Eksportuj do EXCEL
                    </button>
                  </>
                )}
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Tool Information */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3 sharp-text">Informacje o narzędziu</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400 sharp-text">Nazwa:</span>
                        <span className="text-slate-900 dark:text-slate-100 font-medium sharp-text">{selectedTool.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400 sharp-text">Numer ewidencyjny:</span>
                        <span className="text-slate-900 dark:text-slate-100 font-mono sharp-text">{selectedTool.inventory_number || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400 sharp-text">Numer fabryczny:</span>
                        <span className="text-slate-900 dark:text-slate-100 font-mono sharp-text">{selectedTool.serial_unreadable ? 'nieczytelny' : (selectedTool.serial_number || '-')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400 sharp-text">SKU:</span>
                        <span className="text-slate-900 dark:text-slate-100 font-mono sharp-text">{getToolCodeText(selectedTool)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400 sharp-text">Kategoria:</span>
                        <span className="text-slate-900 dark:text-slate-100 sharp-text">{selectedTool.category || '-'}</span>
                      </div>
                      {String(selectedTool.category || '').trim().toLowerCase() === 'elektronarzędzia' && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-400 sharp-text">Producent:</span>
                            <span className="text-slate-900 dark:text-slate-100 sharp-text">{selectedTool.manufacturer || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-400 sharp-text">Model:</span>
                            <span className="text-slate-900 dark:text-slate-100 sharp-text">{selectedTool.model || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-400 sharp-text">Rok produkcji:</span>
                            <span className="text-slate-900 dark:text-slate-100 sharp-text">{(typeof selectedTool.production_year !== 'undefined' && selectedTool.production_year !== null) ? String(selectedTool.production_year) : '-'}</span>
                          </div>
                        </>
                      )}
                      {String(selectedTool.category || '').trim().toLowerCase() === 'spawalnicze' && (
                        <div className="flex justify-between">
                          <span className="text-slate-500 dark:text-slate-400 sharp-text">Data przeglądu:</span>
                          <span className="text-slate-900 dark:text-slate-100 sharp-text">{selectedTool.inspection_date ? new Date(selectedTool.inspection_date).toLocaleDateString('pl-PL') : '-'}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400 sharp-text">Lokalizacja:</span>
                        <span className="text-slate-900 dark:text-slate-100 sharp-text">{selectedTool.location || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400 sharp-text">Status:</span>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full sharp-text ${
                          selectedTool.status === 'dostępne' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300' :
                          selectedTool.status === 'wydane' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-300' :
                          selectedTool.status === 'serwis' ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300' :
                          'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-300'
                        }`}>
                          {selectedTool.status || 'nieznany'}
                        </span>
                      </div>
                      {(selectedTool.status === 'wydane' || selectedTool.status === 'częściowo wydane') && (
                        <div className="flex justify-between">
                          <span className="text-slate-500 dark:text-slate-400 sharp-text">Wydane dla:</span>
                          <span className="text-slate-900 dark:text-slate-100 sharp-text">
                            {Array.isArray(selectedTool.issues) && selectedTool.issues.length > 0
                              ? selectedTool.issues
                                  .map(i => {
                                    const fn = i.employee_first_name || '';
                                    const ln = i.employee_last_name || '';
                                    const brand = i.employee_brand_number || '';
                                    const qtyLabel = i.quantity > 1 ? ` (${i.quantity} szt.)` : '';
                                    const name = `${fn} ${ln}`.trim();
                                    const brandLabel = brand ? ` [${brand}]` : '';
                                    return `${name}${brandLabel}${qtyLabel}`;
                                  })
                                  .join(', ')
                              : '-'}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400 sharp-text">Ilość:</span>
                        <span className="text-slate-900 dark:text-slate-100 font-medium sharp-text">{selectedTool.quantity ?? '-'}</span>
                      </div>
                      {selectedTool.description && (
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 sharp-text">Opis:</span>
                          <p className="text-slate-900 dark:text-slate-100 mt-1 sharp-text">{selectedTool.description}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Informacja o serwisie nad Eksport */}
                  {(selectedTool.service_quantity || 0) > 0 && (
                    <div className="pt-2">
                      <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-700">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2 sharp-text">Serwis</h3>
                        <p className="text-sm text-slate-700 dark:text-slate-200 sharp-text">W serwisie: <span className="font-medium">{selectedTool.service_quantity}</span> szt.</p>
                        {selectedTool.service_order_number && (
                          <p className="text-sm text-slate-700 dark:text-slate-200 sharp-text">Nr zlecenia: <span className="font-mono">{selectedTool.service_order_number}</span></p>
                        )}
                        {selectedTool.status === 'serwis' && selectedTool.service_sent_at && (
                          <p className="text-xs text-slate-500 dark:text-slate-300 mt-1 sharp-text">Data wysłania: {new Date(selectedTool.service_sent_at).toLocaleString()}</p>
                        )}
                        <div className="pt-2">
                          {canManageTools && (
                            <button
                              onClick={handleServiceReceive}
                              className="px-3 py-1.5 bg-green-600 dark:bg-green-700 text-white rounded-lg text-sm hover:bg-green-700 dark:hover:bg-green-800 sharp-text"
                            >
                              Odebrano
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {canManageTools && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 sharp-text">{t('tools.qr.title')}</h3>
                      <button
                        onClick={() => downloadQrLabel(selectedTool)}
                        aria-label={t('tools.qr.downloadLabel')}
                        title={t('tools.qr.downloadLabel')}
                        className="bg-blue-600 dark:bg-blue-700 text-white p-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors flex items-center justify-center sharp-text"
                      >
                        <ArrowDownTrayIcon className="h-5 w-5" />
                        <span className="sr-only">{t('tools.qr.downloadLabel')}</span>
                      </button>
                    </div>
                    <div className="flex justify-center">
                      <QRCodeDisplay text={getToolCodeText(selectedTool)} />
                    </div>
                  </div>
                  )}
                  {canManageTools && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 sharp-text">{t('tools.barcode.title')}</h3>
                      <button
                        onClick={() => downloadBarcodeLabel(selectedTool)}
                        aria-label={t('tools.barcode.downloadLabel')}
                        title={t('tools.barcode.downloadLabel')}
                        className="bg-blue-600 dark:bg-blue-700 text-white p-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors flex items-center justify-center sharp-text"
                      >
                        <ArrowDownTrayIcon className="h-5 w-5" />
                        <span className="sr-only">{t('tools.barcode.downloadLabel')}</span>
                      </button>
                    </div>
                    <div className="flex justify-center">
                      <BarcodeDisplay text={getToolCodeText(selectedTool)} />
                    </div>
                  </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ToolsScreen;
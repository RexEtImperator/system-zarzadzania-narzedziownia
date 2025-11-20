import React, { useState, useEffect } from 'react';
import { UsersIcon, BuildingOfficeIcon, BriefcaseIcon, WrenchScrewdriverIcon, PlusIcon, MinusIcon, BoltIcon, ClockIcon, UserCircleIcon, Bars3Icon, InboxIcon, QrCodeIcon, ArrowUturnLeftIcon, XMarkIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import api from '../api';
import { formatTimeAgo } from '../utils/dateUtils';
import { PERMISSIONS, hasPermission } from '../constants';
import BarcodeScanner from './BarcodeScanner';
import { toast } from 'react-toastify';
import { useLanguage } from '../contexts/LanguageContext';
import EmployeeModal from './EmployeeModal';

const DashboardScreen = ({ user }) => {
  const { t } = useLanguage();
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeDepartments: 0,
    totalPositions: 0,
    totalTools: 0,
    toolHistory: [],
    overdueInspections: 0,
    totalBhp: 0,
    overdueToolsCount: 0,
    overdueBhpCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [showQuickIssueModal, setShowQuickIssueModal] = useState(false);
  const [searchCode, setSearchCode] = useState('');
  const [foundTool, setFoundTool] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [showQuickReturnModal, setShowQuickReturnModal] = useState(false);
  const [issuedTools, setIssuedTools] = useState([]);
  const [issuedToolsLoading, setIssuedToolsLoading] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  // Multi-skanowanie: lista pozycji do wydania
  const [quickIssueItems, setQuickIssueItems] = useState([]);

  useEffect(() => {
    fetchDashboardData();
    fetchEmployees();
    fetchDepartments();
    fetchPositions();
  }, []);

  useEffect(() => {
    if (showQuickReturnModal) {
      fetchIssuedTools();
    }
  }, [showQuickReturnModal]);

  const fetchEmployees = async () => {
    try {
      setEmployeesLoading(true);
      const data = await api.get('/api/employees');
      setEmployees(data);
    } catch (error) {
      console.error('Error fetching employees:', error);
      setEmployees([]);
    } finally {
      setEmployeesLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const data = await api.get('/api/departments');
      setDepartments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching departments:', error);
      setDepartments([
        { id: 1, name: 'Produkcja' },
        { id: 2, name: 'Magazyn' },
        { id: 3, name: 'Administracja' }
      ]);
    }
  };

  const fetchPositions = async () => {
    try {
      const data = await api.get('/api/positions');
      setPositions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching positions:', error);
      setPositions([
        { id: 1, name: 'Kierownik' },
        { id: 2, name: 'Specjalista' },
        { id: 3, name: 'Pracownik' },
        { id: 4, name: 'Stażysta' }
      ]);
    }
  };

  const fetchIssuedTools = async () => {
    try {
      setIssuedToolsLoading(true);
      // Jeśli zalogowany to pracownik, ogranicz do jego wydań
      let employeeFilter = '';
      if (String(user?.role) === 'employee') {
        try {
          const allEmployees = await api.get('/api/employees');
          const matched = (Array.isArray(allEmployees) ? allEmployees : []).find(e => String(e.login || '') === String(user?.username || ''));
          if (matched?.id) {
            employeeFilter = `&employee_id=${matched.id}`;
          }
        } catch (e) {
          console.warn('Nie udało się pobrać pracownika do filtrowania szybkiego zwrotu:', e?.message || e);
        }
      }
      const response = await api.get(`/api/tool-issues?status=wydane&limit=50${employeeFilter}`);
      const issuedToolsData = response.data.filter(item => item.status === 'wydane').map(item => ({
        id: item.id,
        toolId: item.tool_id,
        toolName: item.tool_name,
        employeeName: `${item.employee_first_name} ${item.employee_last_name}`,
        employeeId: item.employee_id,
        quantity: item.quantity,
        issuedAt: item.issued_at
      }));
      setIssuedTools(issuedToolsData);
    } catch (error) {
      console.error('Error fetching issued tools:', error);
      setIssuedTools([]);
    } finally {
      setIssuedToolsLoading(false);
    }
  };

  const handleAddEmployee = async (employeeData) => {
    try {
      // Mapuj ID działu/stanowiska na nazwy wymagane przez API
      const apiData = {
        first_name: employeeData.firstName,
        last_name: employeeData.lastName,
        phone: employeeData.phone,
        email: employeeData.email,
        department: departments.find(d => d.id?.toString() === employeeData.departmentId)?.name || '',
        position: positions.find(p => p.id?.toString() === employeeData.positionId)?.name || '',
        brand_number: employeeData.brandNumber || ''
      };

      const res = await api.post('/api/employees', apiData);
      if (res) {
        toast.success(t('dashboard.quick.employee.addSuccess'));
        setShowAddEmployeeModal(false);
        // Odśwież listy i statystyki
        await fetchEmployees();
        await fetchDashboardData();
      }
    } catch (error) {
      console.error('Error adding employee:', error);
      const msg = error?.response?.data?.message || t('dashboard.quick.employee.addError');
      toast.error(msg);
      throw error; // pozwala EmployeeModal zarządzać stanem ładowania
    }
  };

  // Funkcja obsługi błędów skanowania
  const handleScanError = (errorMessage) => {
    toast.error(errorMessage);
  };

  const searchToolByCode = async (code) => {
    if (!code.trim()) {
      setFoundTool(null);
      return;
    }

    console.log('=== FRONTEND SEARCH DEBUG ===');
    console.log('Search code:', code);
    console.log('Token from localStorage:', localStorage.getItem('token'));
    console.log('User from props:', user);

    setSearchLoading(true);
    try {
      const response = await api.get(`/api/tools/search?code=${encodeURIComponent(code.trim())}`);
      console.log('Search response:', response);
      if (response) {
        setFoundTool(response);
      } else {
        setFoundTool(null);
      }
    } catch (error) {
      console.error('Error searching tool:', error);
      console.error('Error details:', error.message);
      setFoundTool(null);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchCode(value);
    
    // Automatyczne wyszukiwanie po wpisaniu kodu
    if (value.length >= 3) {
      searchToolByCode(value);
    } else {
      setFoundTool(null);
    }
  };

  // Dodaj znalezione narzędzie do listy pozycji (domyślnie ilość = 1)
  const addFoundToolToList = () => {
    if (!foundTool) return;
    if (foundTool.status !== 'dostępne') {
      toast.error(t('dashboard.quick.issue.errors.toolNotAvailableSimple'));
      return;
    }
    const existsIdx = quickIssueItems.findIndex(it => it.tool?.id === foundTool.id);
    if (existsIdx >= 0) {
      // Zwiększ ilość, gdy już istnieje
      const next = quickIssueItems.map((it, idx) => idx === existsIdx ? { ...it, quantity: (it.quantity || 1) + 1 } : it);
      setQuickIssueItems(next);
    } else {
      setQuickIssueItems(prev => [...prev, { tool: foundTool, quantity: 1 }]);
    }
    // Wyczyść bieżące wyszukiwanie
    setFoundTool(null);
    setSearchCode('');
  };

  // Dodaj po kodzie (używane przez skaner)
  const addByCode = async (code) => {
    try {
      const response = await api.get(`/api/tools/search?code=${encodeURIComponent(code.trim())}`);
      const tool = response || null;
      if (!tool) {
        toast.error(t('dashboard.quick.issue.errors.toolNotFoundWithCode', { code }));
        return;
      }
      if (tool.status !== 'dostępne') {
        toast.error(t('dashboard.quick.issue.errors.toolUnavailableDetails', { name: tool.name, sku: tool.sku }));
        return;
      }
      const existsIdx = quickIssueItems.findIndex(it => it.tool?.id === tool.id);
      if (existsIdx >= 0) {
        const next = quickIssueItems.map((it, idx) => idx === existsIdx ? { ...it, quantity: (it.quantity || 1) + 1 } : it);
        setQuickIssueItems(next);
      } else {
        setQuickIssueItems(prev => [...prev, { tool, quantity: 1 }]);
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || t('dashboard.quick.issue.errors.addByCode'));
    }
  };

  const removeItem = (idx) => {
    setQuickIssueItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateItemQty = (idx, qty) => {
    const q = Math.max(1, parseInt(qty || 1, 10));
    setQuickIssueItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: q } : it));
  };

  const clearItems = () => setQuickIssueItems([]);

  // Wydanie wsadowe wszystkich pozycji z listy
  const handleQuickIssueBatch = async () => {
    if (!selectedEmployee) {
      alert('Wybierz pracownika');
      return;
    }
    if (quickIssueItems.length === 0) {
      alert('Lista pozycji jest pusta');
      return;
    }
    try {
      let successCount = 0;
      for (const item of quickIssueItems) {
        const tool = item.tool;
        const quantity = Math.max(1, parseInt(item.quantity || 1, 10));
        try {
          await api.post(`/api/tools/${tool.id}/issue`, {
            employee_id: parseInt(selectedEmployee),
            quantity
          });
          successCount += 1;
        } catch (e) {
          const msg = e?.response?.data?.message || t('dashboard.quick.issue.errorItem', { name: tool?.name || t('dashboard.labels.tool') });
          toast.error(msg);
        }
      }
      const employee = employees.find(emp => emp.id.toString() === selectedEmployee);
      const employeeName = employee ? `${employee.first_name} ${employee.last_name}` : t('dashboard.labels.employeeFallback');
      toast.success(t('dashboard.quick.issue.successBatch', { ok: successCount, total: quickIssueItems.length, employee: employeeName }));
      // Zamknij modal i wyczyść
      setShowQuickIssueModal(false);
      setSearchCode('');
      setFoundTool(null);
      setSelectedEmployee('');
      clearItems();
      // Odśwież dane dashboard
      fetchDashboardData();
    } catch (error) {
      console.error('Error batch issuing:', error);
      alert(error?.response?.data?.message || t('dashboard.quick.issue.batchError'));
    }
  };

  const handleQuickIssue = async () => {
    if (!foundTool) {
      alert(t('dashboard.quick.issue.errors.toolNotFound'));
      return;
    }

    if (foundTool.status !== 'dostępne') {
      alert(t('dashboard.quick.issue.errors.toolNotAvailable'));
      return;
    }

    if (!selectedEmployee) {
      alert(t('dashboard.quick.issue.errors.noEmployeeSelected'));
      return;
    }

    try {
      const response = await api.post(`/api/tools/${foundTool.id}/issue`, {
        employee_id: parseInt(selectedEmployee),
        quantity: 1
      });

      if (response) {
        // Znajdź dane wybranego pracownika do wyświetlenia w komunikacie
        const employee = employees.find(emp => emp.id.toString() === selectedEmployee);
        const employeeName = employee ? `${employee.first_name} ${employee.last_name}` : t('dashboard.labels.employeeFallback');
        
        alert(t('dashboard.quick.issue.successSingle', { tool: foundTool.name, employee: employeeName }));
        setShowQuickIssueModal(false);
        setSearchCode('');
        setFoundTool(null);
        setSelectedEmployee('');
        // Odśwież dane dashboard
        fetchDashboardData();
      }
    } catch (error) {
      console.error('Error issuing tool:', error);
      const errorMessage = error.response?.data?.message || t('dashboard.quick.issue.errorGeneral');
      alert(errorMessage);
    }
  };

  const handleQuickReturn = async (tool) => {
    if (!tool) {
      alert(t('dashboard.quick.return.errors.noToolData'));
      return;
    }

    try {
      const response = await api.post(`/api/tools/${tool.toolId}/return`, {
        issue_id: tool.id,
        quantity: tool.quantity
      });

      if (response) {
        alert(t('dashboard.quick.return.successSingle', { tool: tool.toolName, employee: tool.employeeName }));
        // Odśwież listę wydanych narzędzi
        fetchIssuedTools();
        // Odśwież dane dashboard
        fetchDashboardData();
      }
    } catch (error) {
      console.error('Error returning tool:', error);
      const errorMessage = error.response?.data?.message || t('dashboard.quick.return.errorGeneral');
      alert(errorMessage);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Ustal, czy zalogowany użytkownik jest pracownikiem i znajdź jego employee_id
      const isEmployee = String(user?.role) === 'employee';
      let currentEmployeeId = null;
      if (isEmployee) {
        try {
          const allEmployees = await api.get('/api/employees');
          const matched = (Array.isArray(allEmployees) ? allEmployees : []).find(e => String(e.login || '') === String(user?.username || ''));
          if (matched?.id) currentEmployeeId = matched.id;
        } catch (e) {
          console.warn('Nie udało się pobrać listy pracowników do filtrowania dashboardu:', e?.message || e);
        }
      }

      // Pobierz statystyki z nowego endpointu
      const statsRes = await api.get('/api/dashboard/stats');
      
      // Pobierz historię wydań/zwrotów narzędzi (jeśli są uprawnienia)
      let toolHistoryRes = null;
      try {
        if (hasPermission(user, PERMISSIONS.VIEW_TOOL_HISTORY)) {
          toolHistoryRes = await api.get(
            `/api/tool-issues?limit=6${currentEmployeeId ? `&employee_id=${currentEmployeeId}` : ''}`
          );
        }
      } catch (e) {
        console.warn('Nie udało się pobrać historii narzędzi (może brak uprawnień):', e?.message || e);
      }
      
      // Pobierz historię wydań/zwrotów BHP (jeśli są uprawnienia)
      let bhpHistoryRes = null;
      try {
        if (hasPermission(user, PERMISSIONS.VIEW_BHP_HISTORY)) {
          bhpHistoryRes = await api.get(
            `/api/bhp-issues?limit=6${currentEmployeeId ? `&employee_id=${currentEmployeeId}` : ''}`
          );
        }
      } catch (e) {
        console.warn('Nie udało się pobrać historii BHP (może brak uprawnień):', e?.message || e);
      }
      
      // Pobierz listy narzędzi i BHP, aby policzyć przeterminowane przeglądy
      let tools = [];
      let bhpItems = [];
      try {
        const toolsRes = await api.get('/api/tools');
        tools = Array.isArray(toolsRes) ? toolsRes : [];
      } catch (e) {
        console.warn('Nie udało się pobrać narzędzi do przeglądów:', e?.message || e);
      }
      try {
        const bhpRes = await api.get('/api/bhp');
        bhpItems = Array.isArray(bhpRes) ? bhpRes : [];
      } catch (e) {
        // /api/bhp wymaga uprawnień VIEW_BHP — traktuj brak uprawnień jako 0 pozycji
        console.warn('Nie udało się pobrać BHP do przeglądów (może brak uprawnień):', e?.message || e);
      }

      // Pomocniczy parser dat wspierający formaty ISO i europejskie
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

      // Liczba przeterminowanych: data przeglądu < dziś (początek dnia)
      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const isOverdue = (dateStr) => {
        const d = parseDateFlexible(dateStr);
        if (!d) return false;
        const startOfDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        return startOfDate < startOfToday;
      };

      const overdueTools = (Array.isArray(tools) ? tools : []).filter(t => t?.inspection_date && isOverdue(t.inspection_date));
      const overdueBhp = (Array.isArray(bhpItems) ? bhpItems : []).filter(b => b?.inspection_date && isOverdue(b.inspection_date));
      const overdueToolsCount = overdueTools.length;
      const overdueBhpCount = overdueBhp.length;
      const overdueCount = overdueToolsCount + overdueBhpCount;
      const totalBhp = Array.isArray(bhpItems) ? bhpItems.length : 0;

      // Przekształć dane z API na format wymagany przez UI
      const toolHistoryData = toolHistoryRes.data?.map(issue => ({
        id: issue.id,
        action: issue.status === 'wydane' ? 'wydanie' : 'zwrot',
        toolName: issue.tool_name,
        toolId: issue.tool_id,
        toolSku: issue.tool_sku || null,
        employeeName: `${issue.employee_first_name} ${issue.employee_last_name}`,
        issuedByName: issue.issued_by_user_name || '',
        time: formatTimeAgo(issue.status === 'zwrócone' && issue.returned_at ? issue.returned_at : issue.issued_at),
        quantity: issue.quantity
      })) || [];
      
      const bhpHistoryData = bhpHistoryRes?.data?.map(issue => ({
        id: issue.id,
        action: issue.status === 'wydane' ? 'wydanie' : 'zwrot',
        bhpLabel: issue.bhp_model ? `${issue.bhp_model} (${issue.bhp_inventory_number || 'brak nr'})` : `Nr ewid.: ${issue.bhp_inventory_number || 'nieznany'}`,
        bhpInventoryNumber: issue.bhp_inventory_number,
        bhpModel: issue.bhp_model,
        employeeName: `${issue.employee_first_name} ${issue.employee_last_name}`,
        issuedByName: issue.issued_by_user_name || '',
        time: formatTimeAgo(issue.status === 'zwrócone' && issue.returned_at ? issue.returned_at : issue.issued_at)
      })) || [];
      
      const dashboardStats = {
        totalEmployees: statsRes.totalEmployees || 0,
        activeDepartments: statsRes.activeDepartments || 0,
        totalPositions: statsRes.totalPositions || 0,
        totalTools: statsRes.totalTools || 0,
        toolHistory: toolHistoryData,
        bhpHistory: bhpHistoryData,
        overdueInspections: overdueCount,
        totalBhp,
        overdueToolsCount,
        overdueBhpCount
      };
      
      setStats(dashboardStats);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Fallback do pustych danych w przypadku błędu
      const mockStats = {
        totalEmployees: 0,
        activeDepartments: 0,
        totalPositions: 0,
        totalTools: 0,
        toolHistory: [],
        bhpHistory: [],
        overdueInspections: 0,
        totalBhp: 0,
        overdueToolsCount: 0,
        overdueBhpCount: 0
      };
      setStats(mockStats);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon, color = 'blue', tooltip }) => (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{title}</p>
          <div className="relative inline-block group">
            <p className={`text-2xl font-bold text-${color}-600 dark:text-${color}-400`} aria-describedby={tooltip ? `${title}-tooltip` : undefined}>
              {loading ? '...' : value}
            </p>
            {tooltip && (
              <div
                id={`${title}-tooltip`}
                role="tooltip"
                className="absolute left-1/2 -translate-x-1/2 mt-2 z-20 whitespace-nowrap rounded-md bg-slate-900 text-white text-xs px-3 py-2 shadow-lg opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 pointer-events-none"
              >
                {tooltip}
              </div>
            )}
          </div>
        </div>
        <div className={`w-12 h-12 bg-${color}-100 dark:bg-${color}-900/30 rounded-lg flex items-center justify-center`}>
          {React.cloneElement(icon, { 
            className: `w-6 h-6 text-${color}-600 dark:text-${color}-400` 
          })}
        </div>
      </div>
    </div>
  );

  const getActionIcon = (action) => {
    if (action === 'wydanie') {
      return (<PlusIcon className="w-4 h-4 text-white" aria-hidden="true" />);
    } else {
      return (<MinusIcon className="w-4 h-4 text-white" aria-hidden="true" />);
    }
  };

  const getActionColor = (action) => {
    return action === 'wydanie' ? 'bg-red-500' : 'bg-green-500';
  };

  const getActionText = (action) => {
    return action === 'wydanie' ? t('dashboard.action.issued') : t('dashboard.action.returned');
  };

  // Przywitanie z wyróżnionym imieniem/nazwiskiem
  const welcomeTemplate = t('dashboard.welcome');
  const displayName = user?.full_name || user?.username;
  const welcomeParts = (typeof welcomeTemplate === 'string' && welcomeTemplate.includes('{name}'))
    ? welcomeTemplate.split('{name}')
    : [welcomeTemplate, ''];

  return (
    <div className="space-y-8 p-6 bg-gray-50 dark:bg-gray-900 min-h-screen transition-colors duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700 transition-colors duration-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 transition-colors duration-200">{t('dashboard.title')}</h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 transition-colors duration-200">
              {welcomeParts[0]}
              <span className="text-indigo-600 dark:text-indigo-400">{displayName}</span>
              {welcomeParts[1]}
            </p>
          </div>
          <div className="hidden md:block">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <ChartBarIcon className="w-8 h-8 text-white" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
      {/* Stats Grid - hide for role 'employee' */}
      {String(user?.role) !== 'employee' && (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t('dashboard.stats.tools')}
          value={stats.totalTools}
          icon={
            <WrenchScrewdriverIcon />
          }
          color="orange"
        />
        <StatCard
          title={t('dashboard.stats.bhp')}
          value={stats.totalBhp}
          icon={
            <InboxIcon />
          }
          color="green"
        />
        <StatCard
          title={t('dashboard.stats.employees')}
          value={stats.totalEmployees}
          icon={
            <UsersIcon />
          }
          color="purple"
        />
        <StatCard
          title={t('dashboard.stats.overdueInspections')}
          value={stats.overdueInspections}
          icon={
            <ClockIcon />
          }
          color="red"
          tooltip={
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{t('dashboard.stats.tooltip.tools')}</span>
                <span>{stats.overdueToolsCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{t('dashboard.stats.tooltip.bhp')}</span>
                <span>{stats.overdueBhpCount}</span>
              </div>
            </div>
          }
        />
      </div>
      )}
      {/* Quick Actions */}
      {hasPermission(user, PERMISSIONS.VIEW_QUICK_ACTIONS) && (
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl border border-gray-100 dark:border-gray-700 transition-colors duration-200">
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center mr-3">
              <BoltIcon className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white transition-colors duration-200">
              {t('dashboard.quick.title')}
            </h3>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {hasPermission(user, PERMISSIONS.MANAGE_EMPLOYEES) && (
              <button onClick={() => setShowAddEmployeeModal(true)} className="group relative block w-full border-2 border-gray-200 dark:border-gray-600 rounded-xl p-6 text-center hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200">
                <div className="w-12 h-12 mx-auto bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-800/50 transition-colors">
                  <PlusIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                </div>
                <span className="mt-3 block text-sm font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-200">
                  {t('dashboard.quick.createEmployeeTitle')}
                </span>
                <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400 transition-colors duration-200">
                  {t('dashboard.quick.createEmployee')}
                </span>
              </button>
            )}
            <button 
              onClick={() => setShowQuickIssueModal(true)}
              className="group relative block w-full border-2 border-gray-200 dark:border-gray-600 rounded-xl p-6 text-center hover:border-green-300 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200">
              <div className="w-12 h-12 mx-auto bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center group-hover:bg-green-200 dark:group-hover:bg-green-800/50 transition-colors">
                <QrCodeIcon className="h-6 w-6 text-green-600 dark:text-green-400" aria-hidden="true" />
              </div>
              <span className="mt-3 block text-sm font-semibold text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors duration-200">
                {t('dashboard.quick.issue.title')}
              </span>
              <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400 transition-colors duration-200">
                {t('dashboard.quick.issue.subtitle')}
              </span>
            </button>
            <button 
              onClick={() => setShowQuickReturnModal(true)}
              className="group relative block w-full border-2 border-gray-200 dark:border-gray-600 rounded-xl p-6 text-center hover:border-purple-300 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all duration-200">
              <div className="w-12 h-12 mx-auto bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center group-hover:bg-purple-200 dark:group-hover:bg-purple-800/50 transition-colors">
                <ArrowUturnLeftIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" aria-hidden="true" />
              </div>
              <span className="mt-3 block text-sm font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors duration-200">
                {t('dashboard.quick.return.title')}
              </span>
              <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400 transition-colors duration-200">
                {t('dashboard.quick.return.subtitle')}
              </span>
            </button>
          </div>
        </div>
      </div>
      )}
      {/* Tool History */}
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl border border-gray-100 dark:border-gray-700 transition-colors duration-200">
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center mr-3">
                <ClockIcon className="w-5 h-5 text-white" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white transition-colors duration-200">
                {t('dashboard.history.tools.title')}
              </h3>
            </div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 transition-colors duration-200">
              {t('dashboard.history.recentCount', { count: stats.toolHistory.length })}
            </span>
          </div>
        </div>
        <div className="p-6">
          {!hasPermission(user, PERMISSIONS.VIEW_TOOL_HISTORY) ? (
            <div className="text-center py-8">
              <InboxIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" aria-hidden="true" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white transition-colors duration-200">{t('common.noPermissionsTitle')}</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 transition-colors duration-200">{t('dashboard.history.tools.noPermissions')}</p>
            </div>
          ) : loading ? (
            <div className="animate-pulse space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex space-x-4">
                  <div className="rounded-full bg-gray-200 dark:bg-gray-700 h-12 w-12"></div>
                  <div className="flex-1 space-y-2 py-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : stats.toolHistory.length > 0 ? (
            <div className="flow-root">
              <ul className="-mb-8">
                {stats.toolHistory.map((item, index) => (
                  <li key={item.id}>
                    <div className="relative pb-6">
                      {index !== stats.toolHistory.length - 1 && (
                        <span className="absolute top-5 left-4 -ml-px h-full w-0.5 bg-gray-200 dark:bg-gray-600" aria-hidden="true" />
                      )}
                      <div className="relative flex space-x-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg p-2 -m-2" onClick={() => { window.dispatchEvent(new CustomEvent('navigate', { detail: { screen: 'tools', q: item.toolSku || item.toolName } })); }}>
                        <div className="flex items-center justify-center">
                          <span className={`h-8 w-8 rounded-xl ${getActionColor(item.action)} flex items-center justify-center`}>
                            {getActionIcon(item.action)}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1 pt-1.5">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1 transition-colors duration-200">
                                {getActionText(item.action)} {t('dashboard.history.labels.tool')}: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{item.toolName}</span>
                              </p>
                              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400 transition-colors duration-200">
                                <span className="flex items-center">
                                  <UserCircleIcon className="w-4 h-4 mr-1" aria-hidden="true" />
                                  {item.employeeName}
                                </span>
                                {item.issuedByName && (
                                  <span className="flex items-center">
                                    <UserCircleIcon className="w-4 h-4 mr-1" aria-hidden="true" />
                                    {t('dashboard.history.labels.issuedBy')}: {item.issuedByName}
                                  </span>
                                )}
                                <span className="flex items-center">
                                  <Bars3Icon className="w-4 h-4 mr-1" aria-hidden="true" />
                                  {t('dashboard.history.labels.quantity')}: {item.quantity}
                                </span>
                              </div>
                            </div>
                            <div className="mt-1 sm:mt-0 sm:text-right">
                              <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center sm:justify-end transition-colors duration-200">
                                <ClockIcon className="w-4 h-4 mr-1" aria-hidden="true" />
                                {item.time}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-center py-8">
              <InboxIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" aria-hidden="true" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white transition-colors duration-200">{t('dashboard.history.noDataTitle')}</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 transition-colors duration-200">{t('dashboard.history.tools.noData')}</p>
            </div>
          )}
        </div>
      </div>

      {/* BHP History */}
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl border border-gray-100 dark:border-gray-700 transition-colors duration-200">
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center mr-3">
                <ClockIcon className="w-5 h-5 text-white" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white transition-colors duration-200">
                {t('dashboard.history.bhp.title')}
              </h3>
            </div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 transition-colors duration-200">
              {t('dashboard.history.recentCount', { count: stats.bhpHistory?.length || 0 })}
            </span>
          </div>
        </div>

        <div className="p-6">
          {!hasPermission(user, PERMISSIONS.VIEW_BHP_HISTORY) ? (
            <div className="text-center py-8">
              <InboxIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" aria-hidden="true" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white transition-colors duration-200">{t('common.noPermissionsTitle')}</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 transition-colors duration-200">{t('dashboard.history.bhp.noPermissions')}</p>
            </div>
          ) : loading ? (
            <div className="animate-pulse space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex space-x-4">
                  <div className="rounded-full bg-gray-200 dark:bg-gray-700 h-12 w-12"></div>
                  <div className="flex-1 space-y-2 py-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (stats.bhpHistory?.length || 0) > 0 ? (
            <div className="flow-root">
              <ul className="-mb-8">
                {stats.bhpHistory.map((item, index) => (
                  <li key={item.id}>
                    <div className="relative pb-8">
                      {index !== stats.bhpHistory.length - 1 && (
                        <span className="absolute top-5 left-4 -ml-px h-full w-0.5 bg-gray-200 dark:bg-gray-600" aria-hidden="true" />
                      )}
                      <div className="relative flex space-x-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg p-2 -m-2" onClick={() => { window.dispatchEvent(new CustomEvent('navigate', { detail: { screen: 'bhp', q: item.bhpInventoryNumber || item.bhpModel || item.bhpLabel } })); }}>
                        <div className="flex items-center justify-center">
                          <span className={`h-8 w-8 rounded-xl ${getActionColor(item.action)} flex items-center justify-center shadow-lg`}>
                            {getActionIcon(item.action)}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1 pt-1.5">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1 transition-colors duration-200">
                                {getActionText(item.action)} {t('dashboard.history.labels.bhp')}: <span className="font-semibold text-green-600 dark:text-green-400">{item.bhpLabel}</span>
                              </p>
                              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400 transition-colors duration-200">
                                <span className="flex items-center">
                                  <UserCircleIcon className="w-4 h-4 mr-1" aria-hidden="true" />
                                  {item.employeeName}
                                </span>
                                {item.issuedByName && (
                                  <span className="flex items-center">
                                    <UserCircleIcon className="w-4 h-4 mr-1" aria-hidden="true" />
                                    {t('dashboard.history.labels.issuedBy')}: {item.issuedByName}
                                  </span>
                                )}
                                {typeof item.quantity !== 'undefined' && (
                                  <span className="flex items-center">
                                    <Bars3Icon className="w-4 h-4 mr-1" aria-hidden="true" />
                                    {t('dashboard.history.labels.quantity')}: {item.quantity}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="mt-1 sm:mt-0 sm:text-right">
                              <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center sm:justify-end transition-colors duration-200">
                                <ClockIcon className="w-4 h-4 mr-1" aria-hidden="true" />
                                {item.time}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-center py-8">
              <InboxIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" aria-hidden="true" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white transition-colors duration-200">{t('dashboard.history.noDataTitle')}</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 transition-colors duration-200">{t('dashboard.history.bhp.noData')}</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Quick Issue Modal */}
      {showQuickIssueModal && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
          onClick={(e) => {
            // Zamykaj tylko przy kliknięciu w tło (overlay), nie wewnątrz modala
            if (e.target === e.currentTarget) {
              setShowQuickIssueModal(false);
              setSearchCode('');
              setFoundTool(null);
              setSelectedEmployee('');
            }
          }}
        >
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {t('dashboard.quick.issue.modalTitle')}
                </h3>
                <button
                  onClick={() => setShowQuickIssueModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XMarkIcon className="w-6 h-6" aria-hidden="true" />
                </button>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('dashboard.search.label')}
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={searchCode}
                    onChange={handleSearchChange}
                    placeholder={t('dashboard.search.placeholder')}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowBarcodeScanner(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors duration-200 flex items-center"
                  >
                    <QrCodeIcon className="w-5 h-5" aria-hidden="true" />
                  </button>
                </div>
                
                {/* Search Results */}
                {searchLoading && (
                  <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                      <span className="text-sm text-blue-600 dark:text-blue-400">{t('dashboard.search.searching')}</span>
                    </div>
                  </div>
                )}
                
                {foundTool && (
                  <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-green-800 dark:text-green-200">{foundTool.name}</h4>
                        <p className="text-sm text-green-600 dark:text-green-400">{t('dashboard.search.sku')}: {foundTool.sku}</p>
                        <p className="text-sm text-green-600 dark:text-green-400">{t('dashboard.search.status')}: {foundTool.status}</p>
                        <p className="text-sm text-green-600 dark:text-green-400">{t('dashboard.search.location')}: {foundTool.location}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl">{foundTool.status === 'dostępne' ? '✅' : '❌'}</span>
                        {foundTool.status === 'dostępne' && (
                          <button
                            type="button"
                            onClick={addFoundToolToList}
                            className="px-3 py-1 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md"
                          >
                            {t('dashboard.search.add')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Lista pozycji do wydania */}
                {quickIssueItems.length > 0 && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('dashboard.quickIssue.itemsLabel')}</label>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {quickIssueItems.map((it, idx) => (
                        <div key={it.tool?.id || idx} className="flex items-center justify-between p-2 border rounded-md bg-white dark:bg-gray-700 dark:border-gray-600">
                          <div className="mr-3">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{it.tool?.name}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-300">SKU: {it.tool?.sku}</div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              min={1}
                              value={it.quantity}
                              onChange={(e) => updateItemQty(idx, e.target.value)}
                              className="w-20 px-2 py-1 border rounded-md dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                            />
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="px-2 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md"
                            >
                              {t('common.remove')}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex justify-end">
                      <button type="button" onClick={clearItems} className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-600 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">{t('common.clearList')}</button>
                    </div>
                  </div>
                )}

                {/* Wybór pracownika - pokazuje się gdy są pozycje na liście */}
                {quickIssueItems.length > 0 && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('common.selectEmployee')}
                    </label>
                    {employeesLoading ? (
                      <div className="flex items-center justify-center py-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600 mr-2"></div>
                        <span className="text-sm text-gray-500">{t('loading.employees')}</span>
                      </div>
                    ) : (
                      <select
                        value={selectedEmployee}
                        onChange={(e) => setSelectedEmployee(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                      >
                        <option value="">{t('common.selectEmployee')}</option>
                        {employees.map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employee.first_name} {employee.last_name} ({employee.brand_number || employee.id}) - {employee.position}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
                
                {searchCode.length >= 3 && !searchLoading && !foundTool && quickIssueItems.length === 0 && (
                  <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-700">
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {t('dashboard.search.notFoundCode', { code: searchCode })}
                    </p>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowQuickIssueModal(false);
                    setSearchCode('');
                    setFoundTool(null);
                    setSelectedEmployee('');
                    clearItems();
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleQuickIssueBatch}
                  disabled={quickIssueItems.length === 0 || !selectedEmployee}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-md ${
                    quickIssueItems.length > 0 && selectedEmployee ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-400 cursor-not-allowed'
                  }`}
                >
                  {t('dashboard.quick.issue.submitBatch')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Return Modal */}
      {showQuickReturnModal && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
          onClick={(e) => {
            // Zamykaj tylko przy kliknięciu w tło (overlay), nie wewnątrz modala
            if (e.target === e.currentTarget) {
              setShowQuickReturnModal(false);
              setIssuedTools([]);
            }
          }}
        >
          <div className="relative top-20 mx-auto p-5 border w-[600px] shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {t('dashboard.quick.return.title')}
                </h3>
                <button
                  onClick={() => {
                    setShowQuickReturnModal(false);
                    setIssuedTools([]);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XMarkIcon className="w-6 h-6" aria-hidden="true" />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {t('dashboard.quick.return.listTitle')}
                </p>
                
                {issuedToolsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    <span className="ml-2 text-gray-600 dark:text-gray-400">{t('loading.issuedTools')}</span>
                  </div>
                ) : issuedTools.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400">{t('noData.issuedTools')}</p>
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto">
                    <div className="space-y-3">
                      {issuedTools.map((tool) => (
                        <div key={tool.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              {tool.toolName}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {t('dashboard.labels.employee')} {tool.employeeName}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-500">
                              {t('dashboard.labels.quantity')}: {tool.quantity} | {t('dashboard.labels.issuedAt')}: {formatTimeAgo(tool.issuedAt)}
                            </p>
                          </div>
                          <button
                            onClick={() => handleQuickReturn(tool)}
                            className="ml-4 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md transition-colors duration-200"
                          >
                            {t('dashboard.quick.return.submit')}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setShowQuickReturnModal(false);
                    setIssuedTools([]);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md"
                >
                  {t('common.close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {showBarcodeScanner && (
        <BarcodeScanner
          isOpen={showBarcodeScanner}
          onClose={() => setShowBarcodeScanner(false)}
          onScan={async (code) => {
            try {
              await addByCode(code);
            } finally {
              setShowBarcodeScanner(false);
            }
          }}
          onError={handleScanError}
        />
      )}

      {/* Add Employee Modal */}
      <EmployeeModal
        isOpen={showAddEmployeeModal}
        onClose={() => setShowAddEmployeeModal(false)}
        onSave={handleAddEmployee}
        employee={null}
        departments={departments}
        positions={positions}
      />
    </div>
  );
};

export default DashboardScreen;
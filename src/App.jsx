import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { ToastContainer } from 'react-toastify';
import { Bars3Icon } from '@heroicons/react/24/outline';
import 'react-toastify/dist/ReactToastify.css';
import api from './api';
import { 
  DepartmentManagementScreen, 
  PositionManagementScreen,
  AppConfigScreen,
  InventoryScreen,
  DbViewerScreen
} from './components';
import { ThemeProvider } from './contexts/ThemeContext';
import PermissionsModal from './components/PermissionsModal';

// Stałe uprawnień
const PERMISSIONS = {
  VIEW_TOOLS: 'view_tools',
  MANAGE_TOOLS: 'manage_tools',
  VIEW_EMPLOYEES: 'view_employees',
  MANAGE_EMPLOYEES: 'manage_employees',
  VIEW_ANALYTICS: 'view_analytics',
  VIEW_ADMIN: 'view_admin',
  MANAGE_USERS: 'manage_users',
  SYSTEM_SETTINGS: 'system_settings',
  VIEW_USERS: 'view_users',
  VIEW_AUDIT_LOG: 'view_audit_log',
  ACCESS_TOOLS: 'access_tools',
  VIEW_BHP: 'view_bhp',
  MANAGE_BHP: 'manage_bhp',
  DELETE_ISSUE_HISTORY: 'delete_issue_history',
  DELETE_SERVICE_HISTORY: 'delete_service_history',
  VIEW_DATABASE: 'view_database'
};

// Stałe akcji audytu
const AUDIT_ACTIONS = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  ADD_TOOL: 'add_tool',
  UPDATE_TOOL: 'update_tool',
  DELETE_TOOL: 'delete_tool',
  ISSUE_TOOL: 'issue_tool',
  RETURN_TOOL: 'return_tool',
  ADD_EMPLOYEE: 'add_employee',
  UPDATE_EMPLOYEE: 'update_employee',
  DELETE_EMPLOYEE: 'delete_employee',
  VIEW_ANALYTICS: 'view_analytics',
  ACCESS_ADMIN: 'access_admin',
  VIEW_USERS: 'view_users'
};

// Domyślne działy
const DEFAULT_DEPARTMENTS = [
  'Administracja',
  'Automatyczny',
  'Elektryczny',
  'Mechaniczny',
  'Narzędziownia',
  'Skrawanie',
  'Pomiarowy',
  'Zewnętrzny',
  'Ślusarko-spawalniczy'
];

// Domyślne stanowiska
const DEFAULT_POSITIONS = [
  'Kierownik działu',
  'Automatyk',
  'Elektryk',
  'Mechanik',
  'Narzędziowiec',
  'Pomiarowiec',
  'Tokarz',
  'Spawacz',
  'Ślusarz',
  'Zewnętrzny'
];

// Funkcja sprawdzania uprawnień
const hasPermission = (user, permission) => {
  if (!user) return false;
  
  const rolePermissions = {
    administrator: Object.values(PERMISSIONS),
    manager: [
      PERMISSIONS.VIEW_TOOLS,
      PERMISSIONS.MANAGE_TOOLS,
      PERMISSIONS.VIEW_EMPLOYEES,
      PERMISSIONS.MANAGE_EMPLOYEES,
      PERMISSIONS.VIEW_ANALYTICS,
      PERMISSIONS.VIEW_BHP,
      PERMISSIONS.MANAGE_BHP
    ],
    employee: [
      PERMISSIONS.VIEW_TOOLS,
      PERMISSIONS.VIEW_EMPLOYEES,
      PERMISSIONS.VIEW_BHP
    ],
    viewer: [
      PERMISSIONS.VIEW_TOOLS,
      PERMISSIONS.VIEW_EMPLOYEES,
      PERMISSIONS.VIEW_ANALYTICS,
      PERMISSIONS.VIEW_BHP
    ],
    user: [
      PERMISSIONS.ACCESS_TOOLS,
      PERMISSIONS.VIEW_USERS,
      PERMISSIONS.VIEW_ANALYTICS,
      PERMISSIONS.VIEW_AUDIT_LOG,
      PERMISSIONS.VIEW_BHP
    ]
  };
  
  return rolePermissions[user.role]?.includes(permission) || false;
};

// Funkcja dodawania wpisu do dziennika audytu
const addAuditLog = async (user, action, details) => {
  try {
    await api.post('/api/audit', {
      user_id: user.id,
      username: user.username,
      action,
      details,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error adding audit log:', error);
  }
};

// Funkcje pobierania skonfigurowanych działów i stanowisk
const getConfiguredDepartments = async () => {
  try {
    const data = await api.get('/api/departments');
    return data.map(dept => dept.name);
  } catch (error) {
    console.error('Error fetching departments:', error);
    return DEFAULT_DEPARTMENTS;
  }
};

const getConfiguredPositions = async () => {
  try {
    const data = await api.get('/api/positions');
    return data.map(pos => pos.name);
  } catch (error) {
    console.error('Error fetching positions:', error);
    return DEFAULT_POSITIONS;
  }
};

// Komponent modalny potwierdzenia
function ConfirmationModal({ isOpen, onClose, onConfirm, title, message, confirmText = "Potwierdź", cancelText = "Anuluj", type = "default" }) {
  if (!isOpen) return null;

  const getButtonClass = () => {
    switch (type) {
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 text-white dark:bg-red-700 dark:hover:bg-red-800';
      case 'warning':
        return 'bg-yellow-600 hover:bg-yellow-700 text-white dark:bg-yellow-700 dark:hover:bg-yellow-800';
      default:
        return 'bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-700">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h2>
        </div>
        <div className="p-6">
          <p className="text-slate-600 dark:text-slate-300 mb-6">{message}</p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 px-4 py-2 rounded-lg transition-colors ${getButtonClass()}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Komponenty interfejsu
function Sidebar({ onNav, current, user, isMobileOpen, onMobileClose }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  const formattedDateTime = now.toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'medium' });
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠', permission: null },
    { id: 'tools', label: 'Narzędzia', icon: '🔧', permission: PERMISSIONS.VIEW_TOOLS },
    { id: 'bhp', label: 'BHP', icon: '🦺', permission: PERMISSIONS.VIEW_BHP },
    { id: 'inventory', label: 'Inwentaryzacja', icon: '📦', permission: PERMISSIONS.ACCESS_TOOLS },
    { id: 'employees', label: 'Pracownicy', icon: '👥', permission: PERMISSIONS.VIEW_EMPLOYEES },
    { id: 'analytics', label: 'Analityka', icon: '📊', permission: PERMISSIONS.VIEW_ANALYTICS },
    { id: 'admin', label: 'Ustawienia', icon: '⚙️', permission: PERMISSIONS.VIEW_ADMIN }
  ];

  const filteredItems = menuItems.filter(item => 
    !item.permission || hasPermission(user, item.permission)
  );

  return (
    <>
      {/* Overlay dla mobile */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-slate-200 dark:border-gray-700 transform transition-all duration-200 ease-in-out ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} `}>
        <div className="flex flex-col h-full">
          <div className="border-b border-slate-200 dark:border-gray-700">
            <img src="/logo.png" alt="Logo systemu" className="mx-auto w-24 h-24 drop-shadow-lg" />
          </div>
          <div className="px-6 py-3 text-xs text-center text-slate-500 dark:text-gray-400 border-b border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800">
            {formattedDateTime}
          </div>
          
          <nav className="flex-1 p-4 space-y-2">
            {filteredItems.map(item => (
              <button
                key={item.id}
                onClick={() => onNav(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors duration-200 ${
                  current === item.id
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700'
                    : 'text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}

function MobileHeader({ onMenuToggle, user, currentScreen }) {
  const getScreenTitle = (screen) => {
    const titles = {
      dashboard: 'Dashboard',
      tools: 'Narzędzia',
      bhp: 'BHP',
      employees: 'Pracownicy',
      analytics: 'Analityka',
      labels: 'Etykiety',
      admin: 'Ustawienia',
      'user-management': 'Zarządzanie użytkownikami',
      config: 'Konfiguracja',
      audit: 'Dziennik audytu',
      'user-settings': 'Ustawienia użytkownika'
    };
    return titles[screen] || 'Zarządzanie Narzędziami';
  };

  return (
    <div className="lg:hidden hidden flex items-center items-center p-4 bg-white dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700 transition-colors duration-200">
      <h1 className="text-lg font-semibold text-slate-900 dark:text-white transition-colors duration-200">{getScreenTitle(currentScreen)}</h1>
      <div className="w-10" />
    </div>
  );
}

// Import komponentów z osobnych plików
import LoginScreen from './components/LoginScreen';
import DashboardScreen from './components/DashboardScreen';
import ToolsScreen from './components/ToolsScreen';
import BhpScreen from './components/BhpScreen';
import EmployeesScreen from './components/EmployeesScreen';
import AnalyticsScreen from './components/AnalyticsScreen';
import AuditLogScreen from './components/AuditLogScreen';
import TopBar from './components/TopBar';
import UserSettingsScreen from './components/UserSettingsScreen';
import UserManagementScreen from './components/UserManagementScreen';

// Panel administracyjny
function AdminPanel({ user, onNavigate }) {
  const [showDeleteHistoryConfirm, setShowDeleteHistoryConfirm] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showDeleteEmployeesConfirm, setShowDeleteEmployeesConfirm] = useState(false);
  const [showDeleteServiceHistoryConfirm, setShowDeleteServiceHistoryConfirm] = useState(false);
  const [showDeleteToolIssuesConfirm, setShowDeleteToolIssuesConfirm] = useState(false);
  const [showDeleteToolReturnsConfirm, setShowDeleteToolReturnsConfirm] = useState(false);
  const [showDeleteBhpIssuesConfirm, setShowDeleteBhpIssuesConfirm] = useState(false);
  const [showDeleteBhpReturnsConfirm, setShowDeleteBhpReturnsConfirm] = useState(false);

  const handleDeleteHistory = async () => {
    try {
      await api.delete('/tools/history');
      toast.success('Historia wydań została usunięta');
      setShowDeleteHistoryConfirm(false);
      addAuditLog(user, AUDIT_ACTIONS.ACCESS_ADMIN, 'Usunięto historię wydań narzędzi');
    } catch (error) {
      console.error('Error deleting history:', error);
      toast.error('Błąd podczas usuwania historii');
    }
  };

  const handleDeleteEmployees = async () => {
    try {
      await api.delete('/employees/all');
      toast.success('Wszyscy pracownicy zostali usunięci');
      setShowDeleteEmployeesConfirm(false);
      addAuditLog(user, AUDIT_ACTIONS.ACCESS_ADMIN, 'Usunięto wszystkich pracowników');
    } catch (error) {
      console.error('Error deleting employees:', error);
      toast.error('Błąd podczas usuwania pracowników');
    }
  };

  const handleDeleteServiceHistory = async () => {
    try {
      await api.delete('/api/service-history');
      toast.success('Historia serwisowania została usunięta');
      setShowDeleteServiceHistoryConfirm(false);
      addAuditLog(user, AUDIT_ACTIONS.ACCESS_ADMIN, 'Usunięto historię serwisowania');
    } catch (error) {
      console.error('Error deleting service history:', error);
      toast.error('Błąd podczas usuwania historii serwisowania');
    }
  };

  // Nowe akcje: kasowanie historii wydań/zwrotów (Narzędzia i BHP)
  const handleDeleteToolIssuesHistory = async () => {
    try {
      await api.delete('/api/tools/history/issues');
      toast.success('Usunięto historię WYDAŃ narzędzi');
      setShowDeleteToolIssuesConfirm(false);
      addAuditLog(user, AUDIT_ACTIONS.ACCESS_ADMIN, 'Usunięto historię WYDAŃ narzędzi');
    } catch (error) {
      console.error('Error deleting tool issues history:', error);
      toast.error('Błąd podczas usuwania historii wydań narzędzi');
    }
  };

  const handleDeleteToolReturnsHistory = async () => {
    try {
      await api.delete('/api/tools/history/returns');
      toast.success('Usunięto historię ZWROTÓW narzędzi');
      setShowDeleteToolReturnsConfirm(false);
      addAuditLog(user, AUDIT_ACTIONS.ACCESS_ADMIN, 'Usunięto historię ZWROTÓW narzędzi');
    } catch (error) {
      console.error('Error deleting tool returns history:', error);
      toast.error('Błąd podczas usuwania historii zwrotów narzędzi');
    }
  };

  const handleDeleteBhpIssuesHistory = async () => {
    try {
      await api.delete('/api/bhp/history/issues');
      toast.success('Usunięto historię WYDAŃ BHP');
      setShowDeleteBhpIssuesConfirm(false);
      addAuditLog(user, AUDIT_ACTIONS.ACCESS_ADMIN, 'Usunięto historię WYDAŃ BHP');
    } catch (error) {
      console.error('Error deleting BHP issues history:', error);
      toast.error('Błąd podczas usuwania historii wydań BHP');
    }
  };

  const handleDeleteBhpReturnsHistory = async () => {
    try {
      await api.delete('/api/bhp/history/returns');
      toast.success('Usunięto historię ZWROTÓW BHP');
      setShowDeleteBhpReturnsConfirm(false);
      addAuditLog(user, AUDIT_ACTIONS.ACCESS_ADMIN, 'Usunięto historię ZWROTÓW BHP');
    } catch (error) {
      console.error('Error deleting BHP returns history:', error);
      toast.error('Błąd podczas usuwania historii zwrotów BHP');
    }
  };

  return (
    <div className="p-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Ustawienia</h1>
        <p className="text-slate-600 dark:text-slate-400">Zarządzaj systemem i konfiguracją</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* App Configuration */}
        {hasPermission(user, PERMISSIONS.SYSTEM_SETTINGS) && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-200 dark:border-slate-700 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                <span className="text-2xl">🎛️</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Ustawienia aplikacji</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Konfiguruj parametry systemu</p>
              </div>
            </div>
            <div className="flex-1"></div>
            <button 
              onClick={() => onNavigate('app-config')}
              className="w-full bg-indigo-600 dark:bg-indigo-700 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-800 transition-colors"
            >
              Otwórz ustawienia
            </button>
          </div>
        )}

        {/* Audit Log */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-200 dark:border-slate-700 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📋</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Dziennik audytu</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Przeglądaj historię operacji</p>
            </div>
          </div>
          <div className="flex-1"></div>
          <button 
            onClick={() => onNavigate('audit')}
            className="w-full bg-purple-600 dark:bg-purple-700 text-white py-2 px-4 rounded-lg hover:bg-purple-700 dark:hover:bg-purple-800 transition-colors"
          >
            Zobacz dziennik
          </button>
        </div>

      </div>

      {/* Role Management - Osobny grid */}
      {hasPermission(user, PERMISSIONS.MANAGE_USERS) && (
        <div className="mt-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Danger Zone</h1>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">🎭</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Role i uprawnienia</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Konfiguruj role użytkowników</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="dark:text-slate-300">👑 Administrator</span>
                  <span className="text-slate-600 dark:text-slate-400">Pełny dostęp</span>
                </div>
                <div className="flex justify-between">
                  <span className="dark:text-slate-300">👔 Menedżer</span>
                  <span className="text-slate-600 dark:text-slate-400">Zarządzanie + analityka</span>
                </div>
                <div className="flex justify-between">
                  <span className="dark:text-slate-300">👷 Pracownik</span>
                  <span className="text-slate-600 dark:text-slate-400">Podstawowe operacje</span>
                </div>
                <div className="flex justify-between">
                  <span className="dark:text-slate-300">👤 Użytkownik</span>
                  <span className="text-slate-600 dark:text-slate-400">Ograniczony dostęp</span>
                </div>
                <div className="flex justify-between">
                  <span className="dark:text-slate-300">👁️ Obserwator</span>
                  <span className="text-slate-600 dark:text-slate-400">Tylko odczyt</span>
                </div>
              </div>
              <div className="mt-4">
                <button 
                  onClick={() => setShowPermissionsModal(true)}
                  className="w-full bg-orange-600 dark:bg-orange-700 text-white py-2 px-4 rounded-lg hover:bg-orange-700 dark:hover:bg-orange-800 transition-colors"
                >
                  Zarządzaj uprawnieniami
                </button>
              </div>
            </div>

            {/* Data Management */}
            {hasPermission(user, PERMISSIONS.SYSTEM_SETTINGS) && (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-200 dark:border-slate-700 flex flex-col h-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">🗑️</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Dane systemu</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Zarządzanie danymi</p>
                  </div>
                </div>
                <div className="flex-1"></div>

                <div className="space-y-6">
                  {/* Sekcja: Narzędzia */}
                  {hasPermission(user, PERMISSIONS.DELETE_ISSUE_HISTORY) && (
                    <div>
                      <h4 className="text-md font-semibold text-slate-900 dark:text-slate-100 mb-2">Narzędzia</h4>
                      <div className="space-y-3">
                        <button
                          onClick={() => setShowDeleteToolIssuesConfirm(true)}
                          className="w-full bg-red-600 dark:bg-red-700 text-white py-2 px-4 rounded-lg hover:bg-red-700 dark:hover:bg-red-800 transition-colors"
                        >
                          Usuń historię wydań
                        </button>
                        <button
                          onClick={() => setShowDeleteToolReturnsConfirm(true)}
                          className="w-full bg-red-600 dark:bg-red-700 text-white py-2 px-4 rounded-lg hover:bg-red-700 dark:hover:bg-red-800 transition-colors"
                        >
                          Usuń historię zwrotów
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Sekcja: Sprzęt BHP */}
                  {hasPermission(user, PERMISSIONS.DELETE_ISSUE_HISTORY) && (
                    <div>
                      <h4 className="text-md font-semibold text-slate-900 dark:text-slate-100 mb-2">Sprzęt BHP</h4>
                      <div className="space-y-3">
                        <button
                          onClick={() => setShowDeleteBhpIssuesConfirm(true)}
                          className="w-full bg-orange-600 dark:bg-orange-700 text-white py-2 px-4 rounded-lg hover:bg-orange-700 dark:hover:bg-orange-800 transition-colors"
                        >
                          Usuń historię wydań
                        </button>
                        <button
                          onClick={() => setShowDeleteBhpReturnsConfirm(true)}
                          className="w-full bg-orange-600 dark:bg-orange-700 text-white py-2 px-4 rounded-lg hover:bg-orange-700 dark:hover:bg-orange-800 transition-colors"
                        >
                          Usuń historię zwrotów
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Serwisowanie */}
                  {hasPermission(user, PERMISSIONS.DELETE_SERVICE_HISTORY) && (
                    <div>
                      <h4 className="text-md font-semibold text-slate-900 dark:text-slate-100 mb-2">Serwisowanie</h4>
                      <button
                        onClick={() => setShowDeleteServiceHistoryConfirm(true)}
                        className="w-full bg-rose-600 dark:bg-rose-700 text-white py-2 px-4 rounded-lg hover:bg-rose-700 dark:hover:bg-rose-800 transition-colors"
                      >
                        Usuń historię serwisowania
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Delete Employees */}
            {hasPermission(user, PERMISSIONS.SYSTEM_SETTINGS) && (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-200 dark:border-slate-700 flex flex-col h-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">👥</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Usuń pracowników</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Usuń wszystkich pracowników</p>
                  </div>
                </div>
                <div className="flex-1"></div>
                <button 
                  onClick={() => setShowDeleteEmployeesConfirm(true)}
                  className="w-full bg-yellow-600 dark:bg-yellow-700 text-white py-2 px-4 rounded-lg hover:bg-yellow-700 dark:hover:bg-yellow-800 transition-colors"
                >
                  Usuń dane pracowników
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal potwierdzenia usunięcia historii */}
      <ConfirmationModal
        isOpen={showDeleteHistoryConfirm}
        onClose={() => setShowDeleteHistoryConfirm(false)}
        onConfirm={handleDeleteHistory}
        title="Usuń historię wszystkich wydań"
        message="Czy na pewno chcesz usunąć całą historię wydawania narzędzi? Ta operacja jest nieodwracalna i usunie wszystkie dane o wydaniach i zwrotach narzędzi."
        confirmText="Usuń historię"
        cancelText="Anuluj"
        type="danger"
      />

      {/* Modal potwierdzenia usunięcia historii serwisowania */}
      <ConfirmationModal
        isOpen={showDeleteServiceHistoryConfirm}
        onClose={() => setShowDeleteServiceHistoryConfirm(false)}
        onConfirm={handleDeleteServiceHistory}
        title="Usuń historię serwisowania"
        message="Czy na pewno chcesz usunąć całą historię serwisowania narzędzi? Ta operacja jest nieodwracalna i usunie wszystkie powiązane wpisy."
        confirmText="Usuń historię serwisowania"
        cancelText="Anuluj"
        type="danger"
      />

      {/* Modale: Narzędzia – wydań/zwrotów */}
      <ConfirmationModal
        isOpen={showDeleteToolIssuesConfirm}
        onClose={() => setShowDeleteToolIssuesConfirm(false)}
        onConfirm={handleDeleteToolIssuesHistory}
        title="Usuń historię wydań narzędzi"
        message="Czy na pewno chcesz usunąć wszystkie wpisy o WYDANIACH narzędzi? Operacja jest nieodwracalna."
        confirmText="Usuń historię wydań"
        cancelText="Anuluj"
        type="danger"
      />
      <ConfirmationModal
        isOpen={showDeleteToolReturnsConfirm}
        onClose={() => setShowDeleteToolReturnsConfirm(false)}
        onConfirm={handleDeleteToolReturnsHistory}
        title="Usuń historię zwrotów narzędzi"
        message="Czy na pewno chcesz usunąć wszystkie wpisy o ZWROTACH narzędzi? Operacja jest nieodwracalna."
        confirmText="Usuń historię zwrotów"
        cancelText="Anuluj"
        type="danger"
      />

      {/* Modale: BHP – wydań/zwrotów */}
      <ConfirmationModal
        isOpen={showDeleteBhpIssuesConfirm}
        onClose={() => setShowDeleteBhpIssuesConfirm(false)}
        onConfirm={handleDeleteBhpIssuesHistory}
        title="Usuń historię wydań sprzętu BHP"
        message="Czy na pewno chcesz usunąć wszystkie wpisy o WYDANIACH sprzętu BHP? Operacja jest nieodwracalna."
        confirmText="Usuń historię wydań"
        cancelText="Anuluj"
        type="danger"
      />
      <ConfirmationModal
        isOpen={showDeleteBhpReturnsConfirm}
        onClose={() => setShowDeleteBhpReturnsConfirm(false)}
        onConfirm={handleDeleteBhpReturnsHistory}
        title="Usuń historię zwrotów sprzętu BHP"
        message="Czy na pewno chcesz usunąć wszystkie wpisy o ZWROTACH sprzętu BHP? Operacja jest nieodwracalna."
        confirmText="Usuń historię zwrotów"
        cancelText="Anuluj"
        type="danger"
      />

      {/* Modal potwierdzenia usunięcia pracowników */}
      <ConfirmationModal
        isOpen={showDeleteEmployeesConfirm}
        onClose={() => setShowDeleteEmployeesConfirm(false)}
        onConfirm={handleDeleteEmployees}
        title="Usuń wszystkich pracowników"
        message="Czy na pewno chcesz usunąć wszystkich pracowników z bazy danych? Ta operacja jest nieodwracalna i usunie wszystkie dane pracowników."
        confirmText="Usuń pracowników"
        cancelText="Anuluj"
        type="danger"
      />

      {/* Modal zarządzania uprawnieniami */}
      <PermissionsModal
        isOpen={showPermissionsModal}
        onClose={() => setShowPermissionsModal(false)}
        user={user}
      />
    </div>
  );
}

// Main App Component
function App() {
  const [user, setUser] = useState(null);
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [tools, setTools] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [appName, setAppName] = useState('SZN - System Zarządzania Narzędziownią');
  const [initialSearchTerm, setInitialSearchTerm] = useState({ tools: '', bhp: '' });

  // Sprawdź czy użytkownik jest już zalogowany przy starcie aplikacji
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    const savedScreen = localStorage.getItem('currentScreen');
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        // Ustaw token w API client
        api.setToken(token);
        
        // Przywróć ostatni ekran jeśli istnieje
        if (savedScreen) {
          setCurrentScreen(savedScreen);
        }
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('currentScreen');
      }
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchTools();
      fetchEmployees();
      fetchAppConfig();
    }
  }, [user]);

  // Odśwież narzędzia przy wejściu do Analityki, aby mieć aktualne daty przeglądów
  useEffect(() => {
    if (user && currentScreen === 'analytics') {
      fetchTools();
    }
  }, [user, currentScreen]);

  // Automatyczne wylogowanie przy nieprawidłowym tokenie (zdarzenie z klienta API)
  useEffect(() => {
    const onAuthInvalid = (e) => {
      const reason = e?.detail?.reason || 'Sesja wygasła lub token jest nieprawidłowy';
      // Pokaż komunikat i wyloguj użytkownika
      toast.error(`${reason}. Zaloguj się ponownie.`);
      handleLogout();
    };

    window.addEventListener('auth:invalid', onAuthInvalid);
    // Obsługa nawigacji z głębokim linkiem (z Analityki)
    const onNavigate = (e) => {
      try {
        const { screen, q } = e?.detail || {};
        if (screen === 'bhp' || screen === 'tools') {
          // Ustaw ekran i przekaż wstępny filtr
          if (screen === 'bhp') {
            setInitialSearchTerm(prev => ({ ...prev, bhp: q || '' }));
          } else {
            setInitialSearchTerm(prev => ({ ...prev, tools: q || '' }));
          }
          handleNavigation(screen);
        }
      } catch (err) {
        console.warn('navigate event error:', err);
      }
    };
    window.addEventListener('navigate', onNavigate);
    return () => {
      window.removeEventListener('auth:invalid', onAuthInvalid);
      window.removeEventListener('navigate', onNavigate);
    };
  }, []);

  const fetchTools = async () => {
    try {
      const data = await api.get('/api/tools');
      setTools(data);
    } catch (error) {
      console.error('Error fetching tools:', error);
      setTools([]);
    }
  };

  const fetchEmployees = async () => {
    try {
      const data = await api.get('/api/employees');
      setEmployees(data);
    } catch (error) {
      console.error('Error fetching employees:', error);
      setEmployees([]);
    }
  };

  const fetchAppConfig = async () => {
    try {
      const general = await api.get('/api/config/general');
      if (general?.appName) {
        setAppName(general.appName);
      }
    } catch (error) {
      console.error('Błąd pobierania ustawień ogólnych:', error);
    }
  };

  const handleNavigation = (screen) => {
    setCurrentScreen(screen);
    setIsMobileMenuOpen(false);
    
    // Zapisz aktualny ekran w localStorage
    localStorage.setItem('currentScreen', screen);
    
    // Dodaj wpis audytu dla nawigacji do ważnych sekcji
    const screenLabels = {
      'analytics': 'Przeglądano sekcję analityki',
      'admin': 'Dostęp do ustawień systemu',
      'audit': 'Przeglądano dziennik audytu'
    };
    
    if (screenLabels[screen]) {
      const action = screen === 'analytics' ? AUDIT_ACTIONS.VIEW_ANALYTICS : AUDIT_ACTIONS.ACCESS_ADMIN;
      addAuditLog(user, action, screenLabels[screen]);
    }
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const handleLogin = async (credentials) => {
    try {
      const response = await api.post('/api/login', credentials);
      
      if (response && response.token) {
        setUser(response);
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response));
        
        // Ustaw token w API client PRZED wywołaniem addAuditLog
        api.setToken(response.token);
        
        // Dodaj wpis do dziennika audytu (poprawne argumenty: user, action, details)
        await addAuditLog(response, AUDIT_ACTIONS.LOGIN, 'Użytkownik zalogował się do systemu');
        
        toast.success(`Witaj, ${response.full_name}!`);
      } else {
        throw new Error('Nieprawidłowa odpowiedź serwera');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error(error.message || 'Błąd logowania');
      throw error;
    }
  };

  const handleLogout = () => {
    // Dodaj wpis audytu o wylogowaniu
    addAuditLog(user, AUDIT_ACTIONS.LOGOUT, 'Wylogowano z systemu');
    
    // Usuń dane z localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('currentScreen');
    
    // Wyczyść token z API client
    api.setToken(null);
    
    // Wyczyść stan użytkownika
    setUser(null);
    setCurrentScreen('dashboard');
  };

  if (!user) {
    return (
      <ThemeProvider>
        <LoginScreen onLogin={handleLogin} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div className="flex h-screen bg-slate-50 dark:bg-gray-900 overflow-hidden transition-colors duration-200">
        <Sidebar 
          onNav={handleNavigation} 
          current={currentScreen} 
          user={user}
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={closeMobileMenu}
        />
        
        <div className="flex-1 flex flex-col min-w-0">
          {/* TopBar */}
          <TopBar 
            user={user} 
            onLogout={handleLogout} 
            onToggleSidebar={toggleMobileMenu}
            isSidebarOpen={isMobileMenuOpen}
            appName={appName}
            onNavigate={handleNavigation}
          />
          
          <MobileHeader 
            onMenuToggle={toggleMobileMenu}
            user={user}
            currentScreen={currentScreen}
          />
          
          <div className="flex-1 overflow-auto">
            {currentScreen === 'dashboard' && <DashboardScreen tools={tools} employees={employees} user={user} />}
            {currentScreen === 'tools' && <ToolsScreen tools={tools} setTools={setTools} employees={employees} user={user} initialSearchTerm={initialSearchTerm.tools} />}
            {currentScreen === 'bhp' && <BhpScreen employees={employees} user={user} initialSearchTerm={initialSearchTerm.bhp} />}
            {currentScreen === 'inventory' && <InventoryScreen tools={tools} user={user} />}
            {currentScreen === 'employees' && <EmployeesScreen employees={employees} setEmployees={setEmployees} user={user} />}
            {currentScreen === 'analytics' && <AnalyticsScreen tools={tools} employees={employees} user={user} />}
            {currentScreen === 'audit' && <AuditLogScreen user={user} />}
            {currentScreen === 'admin' && <AdminPanel user={user} onNavigate={handleNavigation} />}
            {currentScreen === 'user-management' && <UserManagementScreen user={user} />}
            {currentScreen === 'config' && <AppConfigScreen user={user} apiClient={api} />}
            {currentScreen === 'app-config' && <AppConfigScreen user={user} apiClient={api} />}
            {currentScreen === 'user-settings' && <UserSettingsScreen user={user} />}
            {currentScreen === 'db-viewer' && (
              user?.role === 'administrator' ? (
                <DbViewerScreen user={user} />
              ) : (
                <div className="p-6">
                  <h2 className="text-sm font-medium text-gray-900 dark:text-white">Brak uprawnień</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Panel podglądu bazy danych jest dostępny tylko dla administratora.</p>
                </div>
              )
            )}
          </div>
        </div>
        
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />
      </div>
    </ThemeProvider>
  );
}

export default App;
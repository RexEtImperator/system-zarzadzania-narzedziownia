import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { initFlowbite } from 'flowbite';
import { toast } from 'react-toastify';
import { ToastContainer } from 'react-toastify';
import { Bars3Icon, HomeIcon, WrenchScrewdriverIcon, ShieldCheckIcon, ArchiveBoxIcon, UsersIcon, TagIcon, ChartBarIcon, Cog6ToothIcon, FlagIcon } from '@heroicons/react/24/solid';
import 'react-toastify/dist/ReactToastify.css';
import api from './api';
// Screens loaded dynamically (code-splitting)
const LoginScreen = lazy(() => import('./components/LoginScreen'));
const DashboardScreen = lazy(() => import('./components/DashboardScreen'));
const ToolsScreen = lazy(() => import('./components/ToolsScreen'));
const BhpScreen = lazy(() => import('./components/BhpScreen'));
const EmployeesScreen = lazy(() => import('./components/EmployeesScreen'));
const AnalyticsScreen = lazy(() => import('./components/AnalyticsScreen'));
const AuditLogScreen = lazy(() => import('./components/AuditLogScreen'));
const TopBar = lazy(() => import('./components/TopBar'));
const UserSettingsScreen = lazy(() => import('./components/UserSettingsScreen'));
const ReportsScreen = lazy(() => import('./components/ReportsScreen'));
const AppConfigScreen = lazy(() => import('./components/AppConfigScreen'));
const DepartmentManagementScreen = lazy(() => import('./components/DepartmentManagementScreen'));
const PositionManagementScreen = lazy(() => import('./components/PositionManagementScreen'));
const LabelsManager = lazy(() => import('./components/LabelsManager'));
const InventoryScreen = lazy(() => import('./components/InventoryScreen'));
const DbViewerScreen = lazy(() => import('./components/DbViewerScreen'));
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
const PermissionsModal = lazy(() => import('./components/PermissionsModal'));

import { PERMISSIONS, hasPermission, setDynamicRolePermissions } from './constants';
import Preloader from './components/Preloader';

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

function Sidebar({ onNav, current, user, isMobileOpen, onMobileClose, collapsed = false }) {
  const [now, setNow] = useState(new Date());
  const { t, language } = useLanguage();
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  const locale = language === 'en' ? 'en-GB' : (language === 'de' ? 'de-DE' : 'pl-PL');
  const menuItems = [
    { id: 'dashboard', label: t('sidebar.dashboard'), icon: (<HomeIcon className="w-5 h-5" aria-hidden="true" />), permission: null },
    { id: 'tools', label: t('sidebar.tools'), icon: (<WrenchScrewdriverIcon className="w-5 h-5" aria-hidden="true" />), permission: PERMISSIONS.VIEW_TOOLS },
    { id: 'bhp', label: t('sidebar.bhp'), icon: (<ShieldCheckIcon className="w-5 h-5" aria-hidden="true" />), permission: PERMISSIONS.VIEW_BHP },
    { id: 'inventory', label: t('sidebar.inventory'), icon: (<ArchiveBoxIcon className="w-5 h-5" aria-hidden="true" />), permission: PERMISSIONS.VIEW_INVENTORY },
    { id: 'employees', label: t('sidebar.employees'), icon: (<UsersIcon className="w-5 h-5" aria-hidden="true" />), permission: PERMISSIONS.VIEW_EMPLOYEES },
    { id: 'labels', label: t('sidebar.labels'), icon: (<TagIcon className="w-5 h-5" aria-hidden="true" />), permission: PERMISSIONS.VIEW_LABELS },
    { id: 'analytics', label: t('sidebar.analytics'), icon: (<ChartBarIcon className="w-5 h-5" aria-hidden="true" />), permission: PERMISSIONS.VIEW_ANALYTICS },
    { id: 'report', label: t('sidebar.report'), icon: (<FlagIcon className="w-5 h-5" aria-hidden="true" />), permission: null },
    { id: 'admin', label: t('sidebar.admin'), icon: (<Cog6ToothIcon className="w-5 h-5" aria-hidden="true" />), permission: PERMISSIONS.VIEW_ADMIN }
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
      <div className={`fixed lg:static inset-y-0 left-0 z-50 ${collapsed ? 'w-16' : ''} bg-white dark:bg-gray-800 border-r border-slate-200 dark:border-gray-700 transform transition-all duration-200 ease-in-out ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} `}>
        <div className="flex flex-col h-full">
          <div className={`flex items-center justify-center ${collapsed ? 'pt-4' : ''}`}>
            <img
              src="/logo.png"
              alt="Logo systemu"
              className={`${collapsed ? 'w-12 h-12' : 'w-24 h-24 -mb-5'} drop-shadow-lg`}
            />
          </div>

          <nav className={`flex-1 ${collapsed ? 'px-2 pt-6' : 'p-4'} space-y-2`}>
            {filteredItems.map(item => (
              <div key={item.id} className="relative">
                <button
                  onClick={() => onNav(item.id)}
                  className={`w-full flex items-center ${collapsed ? 'justify-center' : ''} gap-3 ${collapsed ? 'px-2' : 'px-4'} py-3 rounded-lg text-left transition-colors duration-200 ${
                    current === item.id
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700'
                  }`}
                  {...(collapsed ? { 'data-tooltip-target': `tooltip-${item.id}`, 'data-tooltip-placement': 'right' } : {})}
                >
                <span>{item.icon}</span>
                  {!collapsed && <span className="font-medium">{item.label}</span>}
                </button>
                {collapsed && (
                  <div
                    id={`tooltip-${item.id}`}
                    role="tooltip"
                    className="absolute z-50 inline-block px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-lg shadow-sm opacity-0 tooltip dark:bg-gray-700 whitespace-nowrap min-w-max max-w-none"
                  >
                    {item.label}
                    <div className="tooltip-arrow" data-popper-arrow></div>
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}

function MobileHeader({ onMenuToggle, user, currentScreen }) {
  const { t } = useLanguage();
  const getScreenTitle = (screen) => {
    const title = t(`screens.${screen}`);
    return title || t('screens.defaultTitle');
  };

  return (
    <div className="lg:hidden hidden flex items-center items-center p-4 bg-white dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700 transition-colors duration-200">
      <h1 className="text-lg font-semibold text-slate-900 dark:text-white transition-colors duration-200">{getScreenTitle(currentScreen)}</h1>
      <div className="w-10" />
    </div>
  );
}

// Import komponentów z osobnych plików
// Powyżej zadeklarowano lazy importy; poniższe bezpośrednie importy nie są już potrzebne

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
  const { t } = useLanguage();

  const handleDeleteHistory = async () => {
    try {
      await api.delete('/tools/history');
      toast.success(t('admin.toast.historyDeleted'));
      setShowDeleteHistoryConfirm(false);
      addAuditLog(user, AUDIT_ACTIONS.ACCESS_ADMIN, 'Usunięto historię wydań narzędzi');
    } catch (error) {
      console.error('Error deleting history:', error);
      toast.error(t('admin.toast.historyDeleteError'));
    }
  };

  const handleDeleteEmployees = async () => {
    try {
      await api.delete('/employees/all');
      toast.success(t('admin.toast.employeesDeleted'));
      setShowDeleteEmployeesConfirm(false);
      addAuditLog(user, AUDIT_ACTIONS.ACCESS_ADMIN, 'Usunięto wszystkich pracowników');
    } catch (error) {
      console.error('Error deleting employees:', error);
      toast.error(t('admin.toast.employeesDeleteError'));
    }
  };

  const handleDeleteServiceHistory = async () => {
    try {
      await api.delete('/api/service-history');
      toast.success(t('admin.toast.serviceHistoryDeleted'));
      setShowDeleteServiceHistoryConfirm(false);
      addAuditLog(user, AUDIT_ACTIONS.ACCESS_ADMIN, 'Usunięto historię serwisowania');
    } catch (error) {
      console.error('Error deleting service history:', error);
      toast.error(t('admin.toast.serviceHistoryDeleteError'));
    }
  };

  const handleDeleteToolIssuesHistory = async () => {
    try {
      await api.delete('/api/tools/history/issues');
      toast.success(t('admin.toast.toolIssuesHistoryDeleted'));
      setShowDeleteToolIssuesConfirm(false);
      addAuditLog(user, AUDIT_ACTIONS.ACCESS_ADMIN, 'Usunięto historię WYDAŃ narzędzi');
    } catch (error) {
      console.error('Error deleting tool issues history:', error);
      toast.error(t('admin.toast.toolIssuesHistoryDeleteError'));
    }
  };

  const handleDeleteToolReturnsHistory = async () => {
    try {
      await api.delete('/api/tools/history/returns');
      toast.success(t('admin.toast.toolReturnsHistoryDeleted'));
      setShowDeleteToolReturnsConfirm(false);
      addAuditLog(user, AUDIT_ACTIONS.ACCESS_ADMIN, 'Usunięto historię ZWROTÓW narzędzi');
    } catch (error) {
      console.error('Error deleting tool returns history:', error);
      toast.error(t('admin.toast.toolReturnsHistoryDeleteError'));
    }
  };

  const handleDeleteBhpIssuesHistory = async () => {
    try {
      await api.delete('/api/bhp/history/issues');
      toast.success(t('admin.toast.bhpIssuesHistoryDeleted'));
      setShowDeleteBhpIssuesConfirm(false);
      addAuditLog(user, AUDIT_ACTIONS.ACCESS_ADMIN, 'Usunięto historię WYDAŃ BHP');
    } catch (error) {
      console.error('Error deleting BHP issues history:', error);
      toast.error(t('admin.toast.bhpIssuesHistoryDeleteError'));
    }
  };

  const handleDeleteBhpReturnsHistory = async () => {
    try {
      await api.delete('/api/bhp/history/returns');
      toast.success(t('admin.toast.bhpReturnsHistoryDeleted'));
      setShowDeleteBhpReturnsConfirm(false);
      addAuditLog(user, AUDIT_ACTIONS.ACCESS_ADMIN, 'Usunięto historię ZWROTÓW BHP');
    } catch (error) {
      console.error('Error deleting BHP returns history:', error);
      toast.error(t('admin.toast.bhpReturnsHistoryDeleteError'));
    }
  };

  return (
    <div className="p-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">{t('admin.settings.title')}</h1>
        <p className="text-slate-600 dark:text-slate-400">{t('admin.settings.subtitle')}</p>
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
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('admin.appConfig.card.title')}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">{t('admin.appConfig.card.subtitle')}</p>
              </div>
            </div>
            <div className="flex-1"></div>
            <button 
              onClick={() => onNavigate('app-config')}
              className="w-full bg-indigo-600 dark:bg-indigo-700 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-800 transition-colors"
            >
              {t('admin.appConfig.card.open')}
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
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('admin.audit.card.title')}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">{t('admin.audit.card.subtitle')}</p>
            </div>
          </div>
          <div className="flex-1"></div>
          <button 
            onClick={() => onNavigate('audit')}
            className="w-full bg-purple-600 dark:bg-purple-700 text-white py-2 px-4 rounded-lg hover:bg-purple-700 dark:hover:bg-purple-800 transition-colors"
          >
            {t('admin.audit.card.open')}
          </button>
        </div>

        {/* Roles and permissions */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-200 dark:border-slate-700 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🎭</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('admin.roles.card.title')}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">{t('admin.roles.card.subtitle')}</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="dark:text-slate-300">👑 {t('users.roles.administrator')}</span>
              <span className="text-slate-600 dark:text-slate-400">{t('users.descriptions.administrator')}</span>
            </div>
            <div className="flex justify-between">
              <span className="dark:text-slate-300">👔 {t('users.roles.manager')}</span>
              <span className="text-slate-600 dark:text-slate-400">{t('users.descriptions.manager')}</span>
            </div>
            <div className="flex justify-between">
              <span className="dark:text-slate-300">👷 {t('users.roles.employee')}</span>
              <span className="text-slate-600 dark:text-slate-400">{t('users.descriptions.employee')}</span>
            </div>
          </div>
          <div className="mt-4">
            <button 
              onClick={() => setShowPermissionsModal(true)}
              className="w-full bg-orange-600 dark:bg-orange-700 text-white py-2 px-4 rounded-lg hover:bg-orange-700 dark:hover:bg-orange-800 transition-colors"
            >
              {t('admin.roles.manage')}
            </button>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      {hasPermission(user, PERMISSIONS.SYSTEM_SETTINGS) && (
        <div className="mt-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">{t('admin.danger.title')}</h1>
            <p className="text-slate-600 dark:text-slate-400">{t('admin.danger.subtitle')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Sekcja: Narzędzia */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-200 dark:border-slate-700 flex flex-col h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">🗑️</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('admin.danger.tools.title')}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{t('admin.danger.tools.subtitle')}</p>
                </div>
              </div>
              <div className="flex-1"></div>
              <div className="space-y-6">
                {(hasPermission(user, PERMISSIONS.DELETE_ISSUE_HISTORY) || hasPermission(user, PERMISSIONS.DELETE_RETURN_HISTORY)) && (
                  <div>
                    <div className="space-y-3">
                      {hasPermission(user, PERMISSIONS.DELETE_ISSUE_HISTORY) && (
                        <button
                          onClick={() => setShowDeleteToolIssuesConfirm(true)}
                          className="w-full bg-red-600 dark:bg-red-700 text-white py-2 px-4 rounded-lg hover:bg-red-700 dark:hover:bg-red-800 transition-colors"
                        >
                          {t('admin.actions.deleteIssues')}
                        </button>
                      )}
                      {hasPermission(user, PERMISSIONS.DELETE_RETURN_HISTORY) && (
                        <button
                          onClick={() => setShowDeleteToolReturnsConfirm(true)}
                          className="w-full bg-red-600 dark:bg-red-700 text-white py-2 px-4 rounded-lg hover:bg-red-700 dark:hover:bg-red-800 transition-colors"
                        >
                          {t('admin.actions.deleteReturns')}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* Sekcja: Sprzęt BHP */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-200 dark:border-slate-700 flex flex-col h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">🗑️</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('admin.danger.bhp.title')}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{t('admin.danger.bhp.subtitle')}</p>
                </div>
              </div>
              <div className="space-y-6">
                {(hasPermission(user, PERMISSIONS.DELETE_ISSUE_HISTORY) || hasPermission(user, PERMISSIONS.DELETE_RETURN_HISTORY)) && (
                  <div>
                    <div className="space-y-3">
                      {hasPermission(user, PERMISSIONS.DELETE_ISSUE_HISTORY) && (
                        <button
                          onClick={() => setShowDeleteBhpIssuesConfirm(true)}
                          className="w-full bg-orange-600 dark:bg-orange-700 text-white py-2 px-4 rounded-lg hover:bg-orange-700 dark:hover:bg-orange-800 transition-colors"
                        >
                          {t('admin.actions.deleteIssues')}
                        </button>
                      )}
                      {hasPermission(user, PERMISSIONS.DELETE_RETURN_HISTORY) && (
                        <button
                          onClick={() => setShowDeleteBhpReturnsConfirm(true)}
                          className="w-full bg-orange-600 dark:bg-orange-700 text-white py-2 px-4 rounded-lg hover:bg-orange-700 dark:hover:bg-orange-800 transition-colors"
                        >
                          {t('admin.actions.deleteReturns')}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* Serwisowanie */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-200 dark:border-slate-700 flex flex-col h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">🗑️</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('admin.danger.service.title')}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{t('admin.danger.service.subtitle')}</p>
                </div>
              </div>
              <div className="space-y-6">
                {hasPermission(user, PERMISSIONS.DELETE_SERVICE_HISTORY) && (
                  <div>
                    <button
                      onClick={() => setShowDeleteServiceHistoryConfirm(true)}
                      className="w-full bg-rose-600 dark:bg-rose-700 text-white py-2 px-4 rounded-lg hover:bg-rose-700 dark:hover:bg-rose-800 transition-colors"
                    >
                      {t('admin.actions.deleteServiceHistory')}
                    </button>
                  </div>
                )}
              </div>
            </div>
            {/* Pracownicy */}
            {hasPermission(user, PERMISSIONS.MANAGE_EMPLOYEES) && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-200 dark:border-slate-700 flex flex-col h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">🗑️</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('admin.danger.employees.title')}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{t('admin.danger.employees.subtitle')}</p>
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <button 
                    onClick={() => setShowDeleteEmployeesConfirm(true)}
                    className="w-full bg-yellow-600 dark:bg-yellow-700 text-white py-2 px-4 rounded-lg hover:bg-yellow-700 dark:hover:bg-yellow-800 transition-colors"
                  >
                    {t('admin.actions.deleteEmployees')}
                  </button>
                </div>
              </div>
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
        title={t('admin.modals.deleteAllIssues.title')}
        message={t('admin.modals.deleteAllIssues.message')}
        confirmText={t('admin.modals.deleteAllIssues.confirm')}
        cancelText={t('common.cancel')}
        type="danger"
      />

      {/* Modal potwierdzenia usunięcia historii serwisowania */}
      <ConfirmationModal
        isOpen={showDeleteServiceHistoryConfirm}
        onClose={() => setShowDeleteServiceHistoryConfirm(false)}
        onConfirm={handleDeleteServiceHistory}
        title={t('admin.modals.deleteServiceHistory.title')}
        message={t('admin.modals.deleteServiceHistory.message')}
        confirmText={t('admin.modals.deleteServiceHistory.confirm')}
        cancelText={t('common.cancel')}
        type="danger"
      />

      {/* Modale: Narzędzia – wydań/zwrotów */}
      <ConfirmationModal
        isOpen={showDeleteToolIssuesConfirm}
        onClose={() => setShowDeleteToolIssuesConfirm(false)}
        onConfirm={handleDeleteToolIssuesHistory}
        title={t('admin.modals.deleteToolIssues.title')}
        message={t('admin.modals.deleteToolIssues.message')}
        confirmText={t('admin.modals.deleteToolIssues.confirm')}
        cancelText={t('common.cancel')}
        type="danger"
      />
      <ConfirmationModal
        isOpen={showDeleteToolReturnsConfirm}
        onClose={() => setShowDeleteToolReturnsConfirm(false)}
        onConfirm={handleDeleteToolReturnsHistory}
        title={t('admin.modals.deleteToolReturns.title')}
        message={t('admin.modals.deleteToolReturns.message')}
        confirmText={t('admin.modals.deleteToolReturns.confirm')}
        cancelText={t('common.cancel')}
        type="danger"
      />

      {/* Modale: BHP – wydań/zwrotów */}
      <ConfirmationModal
        isOpen={showDeleteBhpIssuesConfirm}
        onClose={() => setShowDeleteBhpIssuesConfirm(false)}
        onConfirm={handleDeleteBhpIssuesHistory}
        title={t('admin.modals.deleteBhpIssues.title')}
        message={t('admin.modals.deleteBhpIssues.message')}
        confirmText={t('admin.modals.deleteBhpIssues.confirm')}
        cancelText={t('common.cancel')}
        type="danger"
      />
      <ConfirmationModal
        isOpen={showDeleteBhpReturnsConfirm}
        onClose={() => setShowDeleteBhpReturnsConfirm(false)}
        onConfirm={handleDeleteBhpReturnsHistory}
        title={t('admin.modals.deleteBhpReturns.title')}
        message={t('admin.modals.deleteBhpReturns.message')}
        confirmText={t('admin.modals.deleteBhpReturns.confirm')}
        cancelText={t('common.cancel')}
        type="danger"
      />

      {/* Modal potwierdzenia usunięcia pracowników */}
      <ConfirmationModal
        isOpen={showDeleteEmployeesConfirm}
        onClose={() => setShowDeleteEmployeesConfirm(false)}
        onConfirm={handleDeleteEmployees}
        title={t('admin.modals.deleteEmployees.title')}
        message={t('admin.modals.deleteEmployees.message')}
        confirmText={t('admin.modals.deleteEmployees.confirm')}
        cancelText={t('common.cancel')}
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      const savedCollapsed = localStorage.getItem('sidebarCollapsed');
      if (savedCollapsed === null) return false;
      const normalized = String(savedCollapsed).trim().toLowerCase();
      if (normalized === 'true' || normalized === '1') return true;
      if (normalized === 'false' || normalized === '0') return false;
      try {
        const parsed = JSON.parse(savedCollapsed);
        return Boolean(parsed);
      } catch (_) {
        return false;
      }
    } catch (_) {
      return false;
    }
  });
  const [appName, setAppName] = useState('SZN - System Zarządzania Narzędziownią');
  const [initialSearchTerm, setInitialSearchTerm] = useState({ tools: '', bhp: '' });
  const { t } = useLanguage();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    const savedScreen = localStorage.getItem('currentScreen');

    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        api.setToken(token);
        loadRolePermissions();
        
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

  // Save sidebar collapse preference on each change
  useEffect(() => {
    try {
      localStorage.setItem('sidebarCollapsed', isSidebarCollapsed ? 'true' : 'false');
      if (isSidebarCollapsed) {
        // Po pojawieniu się elementów tooltipów zainicjuj Flowbite
        initFlowbite();
      }
    } catch (e) {
      // Ignore errors localStorage
    }
  }, [isSidebarCollapsed]);

  useEffect(() => {
    if (user) {
      fetchTools();
      fetchEmployees();
      fetchAppConfig();
      loadRolePermissions();
    }
  }, [user]);

  useEffect(() => {
    if (user && currentScreen === 'analytics') {
      fetchTools();
    }
  }, [user, currentScreen]);

  useEffect(() => {
    const onAuthInvalid = (e) => {
      const reason = e?.detail?.reason || 'Sesja wygasła lub token jest nieprawidłowy';
      toast.error(t('auth.invalid', { reason }));
      handleLogout();
    };

    window.addEventListener('auth:invalid', onAuthInvalid);
    // Deep link navigation support (from Analytics)
    const onNavigate = (e) => {
      try {
        const { screen, q } = e?.detail || {};
        if (screen === 'bhp' || screen === 'tools') {
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

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed(prev => !prev);
  };

  const handleLogin = async (credentials) => {
    try {
      const response = await api.post('/api/login', credentials);
      if (response && response.token) {
        setUser(response);
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response));
        api.setToken(response.token);
        await loadRolePermissions();
        await addAuditLog(response, AUDIT_ACTIONS.LOGIN, 'Użytkownik zalogował się do systemu');
        toast.success(t('dashboard.welcome', { name: response.full_name }));
      } else {
        throw new Error('Invalid server response');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error(error.message || 'Błąd logowania');
      throw error;
    }
  };

  const loadRolePermissions = async () => {
    try {
      const data = await api.get('/api/role-permissions');
      setDynamicRolePermissions(data || null);
    } catch (error) {
      console.error('Error getting role permissions:', error);
      setDynamicRolePermissions(null);
    }
  };

  const handleLogout = () => {
    addAuditLog(user, AUDIT_ACTIONS.LOGOUT, 'Wylogowano z systemu');

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('currentScreen');

    api.setToken(null);

    setUser(null);
    setCurrentScreen('dashboard');
  };

  if (!user) {
    return (
      <Suspense fallback={<Preloader fullscreen label="Ładowanie…" /> }>
        <LoginScreen onLogin={handleLogin} />
      </Suspense>
    );
  }

  return (
      <div className="flex h-screen bg-slate-50 dark:bg-gray-900 overflow-hidden transition-colors duration-200">
        <Sidebar 
          onNav={handleNavigation} 
          current={currentScreen} 
          user={user}
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={closeMobileMenu}
          collapsed={isSidebarCollapsed}
        />
        <div className="flex-1 flex flex-col min-w-0">
          {/* TopBar + content w Suspense, aby nie blokować pierwszego renderu */}
          <Suspense fallback={<div className="h-14 border-b border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800"/>}>
            <TopBar 
              user={user} 
              onLogout={handleLogout} 
              onToggleSidebar={toggleMobileMenu}
              isSidebarCollapsed={isSidebarCollapsed}
              onToggleSidebarCollapse={toggleSidebarCollapse}
              isSidebarOpen={isMobileMenuOpen}
              appName={appName}
              onNavigate={handleNavigation}
            />
          </Suspense>

          <MobileHeader 
            onMenuToggle={toggleMobileMenu}
            user={user}
            currentScreen={currentScreen}
          />

          <Suspense fallback={<Preloader fullscreen label="Ładowanie…" /> }>
            <div className="flex-1 overflow-auto">
              {currentScreen === 'dashboard' && <DashboardScreen tools={tools} employees={employees} user={user} />}
              {currentScreen === 'tools' && <ToolsScreen tools={tools} setTools={setTools} employees={employees} user={user} initialSearchTerm={initialSearchTerm.tools} />}
              {currentScreen === 'bhp' && <BhpScreen employees={employees} user={user} initialSearchTerm={initialSearchTerm.bhp} />}
              {currentScreen === 'inventory' && <InventoryScreen tools={tools} user={user} />}
              {currentScreen === 'labels' && <LabelsManager user={user} />}
              {currentScreen === 'employees' && <EmployeesScreen employees={employees} setEmployees={setEmployees} user={user} />}
              {currentScreen === 'analytics' && <AnalyticsScreen tools={tools} employees={employees} user={user} />}
              {currentScreen === 'audit' && <AuditLogScreen user={user} />}
              {currentScreen === 'admin' && <AdminPanel user={user} onNavigate={handleNavigation} />}
              {currentScreen === 'report' && <ReportsScreen user={user} employees={employees} tools={tools} />}
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
          </Suspense>
        </div>
        
        <ToastContainer
          position="top-right"
          autoClose={2500}
          hideProgressBar={true}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="colored"
          toastClassName="rounded-lg shadow-md"
          bodyClassName="text-sm"
        />
      </div>
  );
}

export default App;
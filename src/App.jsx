import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import api from './api';
import { 
  DepartmentManagementScreen, 
  PositionManagementScreen,
  AppConfigScreen 
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
  ACCESS_TOOLS: 'access_tools'
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
      PERMISSIONS.VIEW_ANALYTICS
    ],
    employee: [
      PERMISSIONS.VIEW_TOOLS,
      PERMISSIONS.VIEW_EMPLOYEES
    ],
    viewer: [
      PERMISSIONS.VIEW_TOOLS,
      PERMISSIONS.VIEW_EMPLOYEES,
      PERMISSIONS.VIEW_ANALYTICS
    ],
    user: [
      PERMISSIONS.ACCESS_TOOLS,
      PERMISSIONS.VIEW_USERS,
      PERMISSIONS.VIEW_ANALYTICS,
      PERMISSIONS.VIEW_AUDIT_LOG
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

// Funkcje pobierania skonfigurowanych działów i pozycji
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
        return 'bg-red-600 hover:bg-red-700 text-white';
      case 'warning':
        return 'bg-yellow-600 hover:bg-yellow-700 text-white';
      default:
        return 'bg-blue-600 hover:bg-blue-700 text-white';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        </div>
        
        <div className="p-6">
          <p className="text-slate-600 mb-6">{message}</p>
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
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
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠', permission: null },
    { id: 'tools', label: 'Narzędzia', icon: '🔧', permission: PERMISSIONS.VIEW_TOOLS },
    { id: 'employees', label: 'Pracownicy', icon: '👥', permission: PERMISSIONS.VIEW_EMPLOYEES },
    { id: 'analytics', label: 'Analityka', icon: '📊', permission: PERMISSIONS.VIEW_ANALYTICS },
    { id: 'labels', label: 'Etykiety', icon: '🏷️', permission: PERMISSIONS.VIEW_TOOLS },
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
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-slate-200 dark:border-gray-700 transform transition-all duration-300 ease-in-out
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-slate-200 dark:border-gray-700">
            <img src="/logo.png" alt="Logo systemu" className="w-48 object-contain drop-shadow-lg" />
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
      employees: 'Pracownicy',
      analytics: 'Analityka',
      labels: 'Etykiety',
      admin: 'Ustawienia',
      'user-management': 'Zarządzanie użytkownikami',
      config: 'Konfiguracja',
      audit: 'Dziennik audytu'
    };
    return titles[screen] || 'Zarządzanie Narzędziami';
  };

  return (
    <div className="lg:hidden flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700 transition-colors duration-200">
      <button
        onClick={onMenuToggle}
        className="p-2 text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-gray-100 hover:bg-slate-50 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      
      <h1 className="text-lg font-semibold text-slate-900 dark:text-white transition-colors duration-200">{getScreenTitle(currentScreen)}</h1>
      
      <div className="w-10" /> {/* Spacer */}
    </div>
  );
}

// Import komponentów z osobnych plików
import LoginScreen from './components/LoginScreen';
import DashboardScreen from './components/DashboardScreen';
import ToolsScreen from './components/ToolsScreen';
import EmployeesScreen from './components/EmployeesScreen';
import AnalyticsScreen from './components/AnalyticsScreen';
import LabelsManager from './components/LabelsManager';
import AuditLogScreen from './components/AuditLogScreen';
import TopBar from './components/TopBar';

// Komponent zarządzania użytkownikami
function UserManagementScreen({ user }) {
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    role: 'user',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await api.get('/api/users');
      setUsers(data);
      addAuditLog(user, AUDIT_ACTIONS.VIEW_USERS, 'Przeglądano listę użytkowników');
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Błąd podczas pobierania użytkowników');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      full_name: '',
      role: 'user',
      password: '',
      confirmPassword: ''
    });
    setShowModal(true);
  };

  const handleEditUser = (userToEdit) => {
    setEditingUser(userToEdit);
    setFormData({
      username: userToEdit.username,
      full_name: userToEdit.full_name,
      role: userToEdit.role,
      password: '',
      confirmPassword: ''
    });
    setShowModal(true);
  };

  const handleDeleteUser = async (userId, username) => {
    if (!confirm(`Czy na pewno chcesz usunąć użytkownika "${username}"?`)) {
      return;
    }

    try {
      await api.del(`/users/${userId}`);
      setUsers(users.filter(u => u.id !== userId));
      addAuditLog(user, AUDIT_ACTIONS.DELETE_USER, `Usunięto użytkownika: ${username}`);
      toast.success('Użytkownik został usunięty');
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Błąd podczas usuwania użytkownika');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.username || !formData.full_name) {
      toast.error('Wypełnij wszystkie wymagane pola');
      return;
    }

    if (!editingUser && (!formData.password || formData.password !== formData.confirmPassword)) {
      toast.error('Hasła nie są identyczne');
      return;
    }

    try {
      setLoading(true);
      const userData = {
        username: formData.username,
        full_name: formData.full_name,
        role: formData.role
      };

      if (formData.password) {
        userData.password = formData.password;
      }

      if (editingUser) {
        await api.put(`/api/users/${editingUser.id}`, userData);
        setUsers(users.map(u => u.id === editingUser.id ? {...u, ...userData} : u));
        addAuditLog(user, AUDIT_ACTIONS.UPDATE_USER, `Zaktualizowano użytkownika: ${userData.username}`);
        toast.success('Użytkownik został zaktualizowany');
      } else {
        const newUser = await api.post('/api/users', userData);
        setUsers([...users, newUser]);
        addAuditLog(user, AUDIT_ACTIONS.ADD_USER, `Dodano użytkownika: ${userData.username}`);
        toast.success('Użytkownik został dodany');
      }

      setShowModal(false);
      setFormData({
        username: '',
        full_name: '',
        role: 'user',
        password: '',
        confirmPassword: ''
      });
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error('Błąd podczas zapisywania użytkownika');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Zarządzanie użytkownikami</h1>
        <button
          onClick={handleAddUser}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Dodaj użytkownika
        </button>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Szukaj użytkowników..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Użytkownik
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Rola
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                Akcje
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {filteredUsers.map((u) => (
              <tr key={u.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{u.full_name}</div>
                    <div className="text-sm text-slate-500">@{u.username}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    u.role === 'administrator' ? 'bg-red-100 text-red-800' :
                    u.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                    u.role === 'employee' ? 'bg-green-100 text-green-800' :
                    u.role === 'user' ? 'bg-purple-100 text-purple-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {u.role === 'administrator' ? 'Administrator' :
                     u.role === 'manager' ? 'Menedżer' :
                     u.role === 'employee' ? 'Pracownik' :
                     u.role === 'user' ? 'Użytkownik' :
                     'Obserwator'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => handleEditUser(u)}
                    className="text-blue-600 hover:text-blue-900 mr-3"
                  >
                    Edytuj
                  </button>
                  <button
                    onClick={() => handleDeleteUser(u.id, u.username)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Usuń
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal dodawania/edycji użytkownika */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">
                {editingUser ? 'Edytuj użytkownika' : 'Dodaj użytkownika'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nazwa użytkownika
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Imię i nazwisko
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Rola
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="user">Użytkownik</option>
                  <option value="employee">Pracownik</option>
                  <option value="manager">Menedżer</option>
                  <option value="administrator">Administrator</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {editingUser ? 'Nowe hasło (opcjonalne)' : 'Hasło'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required={!editingUser}
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Potwierdź hasło
                  </label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Zapisywanie...' : (editingUser ? 'Zaktualizuj' : 'Dodaj')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Panel administracyjny
function AdminPanel({ user, onNavigate }) {
  const [showDeleteHistoryConfirm, setShowDeleteHistoryConfirm] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showDeleteEmployeesConfirm, setShowDeleteEmployeesConfirm] = useState(false);

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

  return (
    <div className="p-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Ustawienia</h1>
        <p className="text-slate-600 dark:text-slate-400">Zarządzaj systemem i konfiguracją</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* User Management */}
        {hasPermission(user, PERMISSIONS.MANAGE_USERS) && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-200 dark:border-slate-700 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <span className="text-2xl">👥</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Użytkownicy</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Zarządzaj kontami użytkowników</p>
              </div>
            </div>
            <div className="flex-1"></div>
            <button 
              onClick={() => onNavigate('user-management')}
              className="w-full bg-blue-600 dark:bg-blue-700 text-white py-2 px-4 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors"
            >
              Zarządzaj użytkownikami
            </button>
          </div>
        )}

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
                <button 
                  onClick={() => setShowDeleteHistoryConfirm(true)}
                  className="w-full bg-red-600 dark:bg-red-700 text-white py-2 px-4 rounded-lg hover:bg-red-700 dark:hover:bg-red-800 transition-colors"
                >
                  Usuń historię wydań
                </button>
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
          />
          
          <MobileHeader 
            onMenuToggle={toggleMobileMenu}
            user={user}
            currentScreen={currentScreen}
          />
          
          <div className="flex-1 overflow-auto">
            {currentScreen === 'dashboard' && <DashboardScreen tools={tools} employees={employees} user={user} />}
            {currentScreen === 'tools' && <ToolsScreen tools={tools} setTools={setTools} employees={employees} user={user} />}
            {currentScreen === 'employees' && <EmployeesScreen employees={employees} setEmployees={setEmployees} user={user} />}
            {currentScreen === 'analytics' && <AnalyticsScreen tools={tools} employees={employees} />}
            {currentScreen === 'labels' && <LabelsManager tools={tools} user={user} />}
            {currentScreen === 'audit' && <AuditLogScreen user={user} />}
            {currentScreen === 'admin' && <AdminPanel user={user} onNavigate={handleNavigation} />}
            {currentScreen === 'user-management' && <UserManagementScreen user={user} />}
            {currentScreen === 'config' && <AppConfigScreen user={user} apiClient={api} />}
            {currentScreen === 'app-config' && <AppConfigScreen user={user} apiClient={api} />}
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
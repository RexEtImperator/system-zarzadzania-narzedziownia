import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import api from './api';

// Stałe uprawnień
const PERMISSIONS = {
  VIEW_TOOLS: 'view_tools',
  MANAGE_TOOLS: 'manage_tools',
  VIEW_EMPLOYEES: 'view_employees',
  MANAGE_EMPLOYEES: 'manage_employees',
  VIEW_ANALYTICS: 'view_analytics',
  VIEW_ADMIN: 'view_admin',
  MANAGE_USERS: 'manage_users',
  SYSTEM_SETTINGS: 'system_settings'
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
  ACCESS_ADMIN: 'access_admin'
};

// Domyślne działy
const DEFAULT_DEPARTMENTS = [
  'Produkcja',
  'Magazyn',
  'Konserwacja',
  'Administracja',
  'IT',
  'Narzędziownia'
];

// Domyślne pozycje
const DEFAULT_POSITIONS = [
  'Operator maszyn',
  'Magazynier',
  'Technik konserwacji',
  'Specjalista ds. narzędzi',
  'Kierownik magazynu',
  'Administrator IT',
  'Specjalista HR',
  'Kontroler jakości'
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
    ]
  };
  
  return rolePermissions[user.role]?.includes(permission) || false;
};

// Funkcja dodawania wpisu do dziennika audytu
const addAuditLog = async (user, action, details) => {
  try {
    await api.post('/audit', {
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
    const data = await api.get('/departments');
    return data.map(dept => dept.name);
  } catch (error) {
    console.error('Error fetching departments:', error);
    return DEFAULT_DEPARTMENTS;
  }
};

const getConfiguredPositions = async () => {
  try {
    const data = await api.get('/positions');
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
    { id: 'dashboard', label: 'Dashboard', icon: '📊', permission: null },
    { id: 'tools', label: 'Narzędzia', icon: '🔧', permission: PERMISSIONS.VIEW_TOOLS },
    { id: 'employees', label: 'Pracownicy', icon: '👥', permission: PERMISSIONS.VIEW_EMPLOYEES },
    { id: 'analytics', label: 'Analityka', icon: '📈', permission: PERMISSIONS.VIEW_ANALYTICS },
    { id: 'labels', label: 'Etykiety', icon: '🏷️', permission: PERMISSIONS.VIEW_TOOLS },
    { id: 'admin', label: 'Admin', icon: '⚙️', permission: PERMISSIONS.VIEW_ADMIN }
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
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-slate-200">
            <h1 className="text-xl font-bold text-slate-900">Zarządzanie Narzędziami</h1>
          </div>
          
          <nav className="flex-1 p-4 space-y-2">
            {filteredItems.map(item => (
              <button
                key={item.id}
                onClick={() => onNav(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                  current === item.id
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-slate-700 hover:bg-slate-50'
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

function TopBar({ user, onLogout }) {
  return (
    <div className="hidden lg:flex items-center justify-between p-4 bg-white border-b border-slate-200">
      <div className="flex items-center gap-4">
        <span className="text-slate-600">Witaj, {user.full_name || user.username}!</span>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          user.role === 'administrator' ? 'bg-red-100 text-red-800' :
          user.role === 'manager' ? 'bg-blue-100 text-blue-800' :
          user.role === 'employee' ? 'bg-green-100 text-green-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {user.role === 'administrator' ? '👑 Administrator' :
           user.role === 'manager' ? '👔 Menedżer' :
           user.role === 'employee' ? '👷 Pracownik' :
           '👁️ Obserwator'}
        </span>
      </div>
      
      <button
        onClick={onLogout}
        className="px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
      >
        Wyloguj
      </button>
    </div>
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
      admin: 'Panel Administracyjny',
      'user-management': 'Zarządzanie użytkownikami',
      config: 'Konfiguracja',
      audit: 'Dziennik audytu'
    };
    return titles[screen] || 'Zarządzanie Narzędziami';
  };

  return (
    <div className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200">
      <button
        onClick={onMenuToggle}
        className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      
      <h1 className="text-lg font-semibold text-slate-900">{getScreenTitle(currentScreen)}</h1>
      
      <div className="w-10" /> {/* Spacer */}
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/login', formData);
      onLogin(response);
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Błędne dane logowania');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Zarządzanie Narzędziami</h1>
          <p className="text-slate-600">Zaloguj się do systemu</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
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
              Hasło
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Logowanie...' : 'Zaloguj się'}
          </button>
        </form>
      </div>
    </div>
  );
}

function DashboardScreen({ tools, employees, user }) {
  const [searchTerm, setSearchTerm] = useState('');

  // Statystyki
  const totalTools = tools?.length || 0;
  const availableTools = tools?.filter(tool => tool.status === 'dostępne').length || 0;
  const issuedTools = tools?.filter(tool => tool.status === 'wydane').length || 0;
  const totalEmployees = employees?.length || 0;

  // Filtrowanie narzędzi
  const filteredTools = tools?.filter(tool =>
    tool.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tool.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tool.category?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Ostatnie aktywności (przykładowe dane)
  const recentActivities = [
    { id: 1, action: 'Wydano narzędzie', tool: 'Wiertarka XYZ', employee: 'Jan Kowalski', time: '2 godziny temu' },
    { id: 2, action: 'Zwrócono narzędzie', tool: 'Młotek ABC', employee: 'Anna Nowak', time: '4 godziny temu' },
    { id: 3, action: 'Dodano narzędzie', tool: 'Klucz DEF', employee: 'Admin', time: '1 dzień temu' }
  ];

  return (
    <div className="p-4 lg:p-8 bg-slate-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 mb-2">Dashboard</h1>
        <p className="text-slate-600">Przegląd systemu zarządzania narzędziami</p>
      </div>

      {/* Statystyki */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Wszystkie narzędzia</p>
              <p className="text-2xl font-bold text-slate-900">{totalTools}</p>
            </div>
            <div className="text-3xl">🔧</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Dostępne</p>
              <p className="text-2xl font-bold text-green-600">{availableTools}</p>
            </div>
            <div className="text-3xl">✅</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Wydane</p>
              <p className="text-2xl font-bold text-yellow-600">{issuedTools}</p>
            </div>
            <div className="text-3xl">📤</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Pracownicy</p>
              <p className="text-2xl font-bold text-blue-600">{totalEmployees}</p>
            </div>
            <div className="text-3xl">👥</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Wyszukiwanie narzędzi */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Szybkie wyszukiwanie</h2>
          </div>
          <div className="p-6">
            <input
              type="text"
              placeholder="Szukaj narzędzi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
            />
            
            {searchTerm && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredTools.slice(0, 5).map(tool => (
                  <div key={tool.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium text-slate-900">{tool.name}</p>
                      <p className="text-sm text-slate-600">{tool.sku} • {tool.category}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      tool.status === 'dostępne' ? 'bg-green-100 text-green-800' :
                      tool.status === 'wydane' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {tool.status}
                    </span>
                  </div>
                ))}
                {filteredTools.length > 5 && (
                  <p className="text-sm text-slate-500 text-center py-2">
                    i {filteredTools.length - 5} więcej...
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Ostatnie aktywności */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Ostatnie aktywności</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {recentActivities.map(activity => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{activity.action}</p>
                    <p className="text-sm text-slate-600">{activity.tool} • {activity.employee}</p>
                    <p className="text-xs text-slate-500">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Komponent konfiguracji parametrów aplikacji
function AppConfigScreen({ user }) {
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [newDepartment, setNewDepartment] = useState('');
  const [newPosition, setNewPosition] = useState('');
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [editingPosition, setEditingPosition] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Stany dla modalów potwierdzenia
  const [showDeleteDeptConfirm, setShowDeleteDeptConfirm] = useState(false);
  const [showDeletePosConfirm, setShowDeletePosConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  // Pobierz działy i pozycje z bazy danych przy załadowaniu komponentu
  useEffect(() => {
    fetchDepartments();
    fetchPositions();
  }, []);

  const fetchDepartments = async () => {
    try {
      const data = await api.get('/departments');
      setDepartments(data);
    } catch (error) {
      console.error('Błąd podczas pobierania działów:', error);
      toast.error('Błąd podczas pobierania działów');
    }
  };

  const fetchPositions = async () => {
    try {
      const data = await api.get('/positions');
      setPositions(data);
      setLoading(false);
    } catch (error) {
      console.error('Błąd podczas pobierania pozycji:', error);
      toast.error('Błąd podczas pobierania pozycji');
      setLoading(false);
    }
  };

  // Zarządzanie działami
  const addDepartment = async () => {
    if (!newDepartment.trim()) return;
    
    try {
      const response = await api.post('/departments', { name: newDepartment.trim() });
      setDepartments([...departments, response]);
      setNewDepartment('');
      toast.success('Dział został dodany pomyślnie');
    } catch (error) {
      console.error('Błąd podczas dodawania działu:', error);
      toast.error(error.message || 'Błąd podczas dodawania działu');
    }
  };

  const deleteDepartment = async (dept) => {
    try {
      await api.del(`/departments/${dept.id}`);
      setDepartments(departments.filter(d => d.id !== dept.id));
      toast.success('Dział został usunięty pomyślnie');
    } catch (error) {
      console.error('Błąd podczas usuwania działu:', error);
      toast.error('Błąd podczas usuwania działu');
    }
  };

  const updateDepartment = async (dept, newName) => {
    if (!newName.trim() || newName === dept.name) {
      setEditingDepartment(null);
      return;
    }
    
    try {
      await api.put(`/departments/${dept.id}`, { name: newName.trim() });
      setDepartments(departments.map(d => 
        d.id === dept.id ? { ...d, name: newName.trim() } : d
      ));
      setEditingDepartment(null);
      toast.success('Dział został zaktualizowany pomyślnie');
    } catch (error) {
      console.error('Błąd podczas aktualizacji działu:', error);
      toast.error(error.message || 'Błąd podczas aktualizacji działu');
    }
  };

  // Zarządzanie pozycjami
  const addPosition = async () => {
    if (!newPosition.trim()) return;
    
    try {
      const response = await api.post('/positions', { name: newPosition.trim() });
      setPositions([...positions, response]);
      setNewPosition('');
      toast.success('Pozycja została dodana pomyślnie');
    } catch (error) {
      console.error('Błąd podczas dodawania pozycji:', error);
      toast.error(error.message || 'Błąd podczas dodawania pozycji');
    }
  };

  const deletePosition = async (pos) => {
    try {
      await api.del(`/positions/${pos.id}`);
      setPositions(positions.filter(p => p.id !== pos.id));
      toast.success('Pozycja została usunięta pomyślnie');
    } catch (error) {
      console.error('Błąd podczas usuwania pozycji:', error);
      toast.error('Błąd podczas usuwania pozycji');
    }
  };

  const updatePosition = async (pos, newName) => {
    if (!newName.trim() || newName === pos.name) {
      setEditingPosition(null);
      return;
    }
    
    try {
      await api.put(`/positions/${pos.id}`, { name: newName.trim() });
      setPositions(positions.map(p => 
        p.id === pos.id ? { ...p, name: newName.trim() } : p
      ));
      setEditingPosition(null);
      toast.success('Pozycja została zaktualizowana pomyślnie');
    } catch (error) {
      console.error('Błąd podczas aktualizacji pozycji:', error);
      toast.error(error.message || 'Błąd podczas aktualizacji pozycji');
    }
  };

  const resetToDefaults = async () => {
    try {
      // Usuń wszystkie istniejące działy i pozycje
      await Promise.all([
        ...departments.map(dept => api.del(`/departments/${dept.id}`)),
        ...positions.map(pos => api.del(`/positions/${pos.id}`))
      ]);
      
      // Dodaj domyślne działy
      const defaultDepts = await Promise.all(
        DEFAULT_DEPARTMENTS.map(name => api.post('/departments', { name }))
      );
      
      // Dodaj domyślne pozycje
      const defaultPos = await Promise.all(
        DEFAULT_POSITIONS.map(name => api.post('/positions', { name }))
      );
      
      setDepartments(defaultDepts);
      setPositions(defaultPos);
      toast.success('Przywrócono domyślne ustawienia');
      setShowResetConfirm(false);
    } catch (error) {
      console.error('Błąd podczas przywracania domyślnych ustawień:', error);
      toast.error('Błąd podczas przywracania domyślnych ustawień');
    }
  };

  if (!hasPermission(user, PERMISSIONS.SYSTEM_SETTINGS)) {
    return (
      <div className="p-4 lg:p-8 bg-slate-50 min-h-screen text-center">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Brak dostępu</h2>
        <p className="text-slate-600">Nie masz uprawnień do konfiguracji systemu.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 lg:p-8 bg-slate-50 min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Ładowanie konfiguracji...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">Konfiguracja parametrów aplikacji</h1>
        <button
          onClick={() => setShowResetConfirm(true)}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <span>🔄</span>
          Przywróć domyślne
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Zarządzanie działami */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
              <span>🏢</span>
              Działy
            </h2>
            <p className="text-sm text-slate-600 mt-1">Zarządzaj działami w organizacji</p>
          </div>
          
          <div className="p-6">
            {/* Dodawanie nowego działu */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newDepartment}
                onChange={(e) => setNewDepartment(e.target.value)}
                placeholder="Nazwa nowego działu"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && addDepartment()}
              />
              <button
                onClick={addDepartment}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Dodaj
              </button>
            </div>

            {/* Lista działów */}
            <div className="space-y-2">
              {departments.map((dept) => (
                <div key={dept.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  {editingDepartment === dept.id ? (
                    <div className="flex gap-2 flex-1">
                      <input
                        type="text"
                        defaultValue={dept.name}
                        className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            updateDepartment(dept, e.target.value);
                          }
                        }}
                        onBlur={(e) => updateDepartment(dept, e.target.value)}
                        autoFocus
                      />
                    </div>
                  ) : (
                    <span className="text-slate-900">{dept.name}</span>
                  )}
                  
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditingDepartment(editingDepartment === dept.id ? null : dept.id)}
                      className="text-blue-600 hover:text-blue-800 p-1"
                      title="Edytuj"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => {
                        setItemToDelete(dept);
                        setShowDeleteDeptConfirm(true);
                      }}
                      className="text-red-600 hover:text-red-800 p-1"
                      title="Usuń"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Zarządzanie pozycjami */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
              <span>👔</span>
              Pozycje
            </h2>
            <p className="text-sm text-slate-600 mt-1">Zarządzaj pozycjami w organizacji</p>
          </div>
          
          <div className="p-6">
            {/* Dodawanie nowej pozycji */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newPosition}
                onChange={(e) => setNewPosition(e.target.value)}
                placeholder="Nazwa nowej pozycji"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && addPosition()}
              />
              <button
                onClick={addPosition}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Dodaj
              </button>
            </div>

            {/* Lista pozycji */}
            <div className="space-y-2">
              {positions.map((pos) => (
                <div key={pos.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  {editingPosition === pos.id ? (
                    <div className="flex gap-2 flex-1">
                      <input
                        type="text"
                        defaultValue={pos.name}
                        className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            updatePosition(pos, e.target.value);
                          }
                        }}
                        onBlur={(e) => updatePosition(pos, e.target.value)}
                        autoFocus
                      />
                    </div>
                  ) : (
                    <span className="text-slate-900">{pos.name}</span>
                  )}
                  
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditingPosition(editingPosition === pos.id ? null : pos.id)}
                      className="text-blue-600 hover:text-blue-800 p-1"
                      title="Edytuj"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => {
                        setItemToDelete(pos);
                        setShowDeletePosConfirm(true);
                      }}
                      className="text-red-600 hover:text-red-800 p-1"
                      title="Usuń"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Informacje o konfiguracji */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">ℹ️ Informacje</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Zmiany są zapisywane automatycznie w bazie danych</li>
          <li>• Nowe działy i pozycje będą dostępne w formularzach pracowników</li>
          <li>• Usunięcie działu/pozycji nie wpłynie na istniejących pracowników</li>
          <li>• Przycisk "Przywróć domyślne" resetuje wszystkie ustawienia</li>
        </ul>
      </div>

      {/* Modały potwierdzenia */}
      <ConfirmationModal
        isOpen={showDeleteDeptConfirm}
        onClose={() => {
          setShowDeleteDeptConfirm(false);
          setItemToDelete(null);
        }}
        onConfirm={() => deleteDepartment(itemToDelete)}
        title="Usuń dział"
        message={`Czy na pewno chcesz usunąć dział "${itemToDelete?.name}"?`}
        confirmText="Usuń"
        cancelText="Anuluj"
        type="danger"
      />

      <ConfirmationModal
        isOpen={showDeletePosConfirm}
        onClose={() => {
          setShowDeletePosConfirm(false);
          setItemToDelete(null);
        }}
        onConfirm={() => deletePosition(itemToDelete)}
        title="Usuń pozycję"
        message={`Czy na pewno chcesz usunąć pozycję "${itemToDelete?.name}"?`}
        confirmText="Usuń"
        cancelText="Anuluj"
        type="danger"
      />

      <ConfirmationModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={resetToDefaults}
        title="Przywróć domyślne ustawienia"
        message="Czy na pewno chcesz przywrócić domyślne ustawienia? Wszystkie niestandardowe działy i pozycje zostaną usunięte i zastąpione domyślnymi."
        confirmText="Przywróć"
        cancelText="Anuluj"
        type="danger"
      />
    </div>
  );
}

// Komponent zarządzania pracownikami
function EmployeesScreen({ employees, setEmployees, user }) {
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    position: '',
    department: '',
    brand_number: ''
  });
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPosition, setFilterPosition] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  
  // Stany dla działów i pozycji
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);

  // Pobierz działy i pozycje przy załadowaniu komponentu
  useEffect(() => {
    const fetchDepartmentsAndPositions = async () => {
      try {
        const [deptData, posData] = await Promise.all([
          getConfiguredDepartments(),
          getConfiguredPositions()
        ]);
        setDepartments(deptData);
        setPositions(posData);
      } catch (error) {
        console.error('Error fetching departments and positions:', error);
        // Fallback do wartości domyślnych
        setDepartments(DEFAULT_DEPARTMENTS);
        setPositions(DEFAULT_POSITIONS);
      }
    };

    fetchDepartmentsAndPositions();
  }, []);

  const handleAddEmployee = () => {
    setEditingEmployee(null);
    setFormData({
      first_name: '',
      last_name: '',
      phone: '',
      position: '',
      department: '',
      brand_number: ''
    });
    setShowModal(true);
  };

  const handleEditEmployee = (employee) => {
    setEditingEmployee(employee);
    setFormData({
      first_name: employee.first_name,
      last_name: employee.last_name,
      phone: employee.phone || '',
      position: employee.position,
      department: employee.department,
      brand_number: employee.brand_number || ''
    });
    setShowModal(true);
  };

  const handleDeleteEmployee = async (id, name) => {
    if (window.confirm(`Czy na pewno chcesz usunąć pracownika ${name}?`)) {
      try {
        await api.delete(`/employees/${id}`);
        setEmployees(employees.filter(emp => emp.id !== id));
        toast.success('Pracownik został usunięty pomyślnie!');
        addAuditLog(user, AUDIT_ACTIONS.DELETE_EMPLOYEE, `Usunięto pracownika: ${name}`);
      } catch (error) {
        console.error('Error deleting employee:', error);
        toast.error('Błąd podczas usuwania pracownika');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingEmployee) {
        await api.put(`/employees/${editingEmployee.id}`, formData);
        setEmployees(employees.map(emp => 
          emp.id === editingEmployee.id ? { ...emp, ...formData } : emp
        ));
        toast.success('Pracownik został zaktualizowany pomyślnie!');
        addAuditLog(user, AUDIT_ACTIONS.UPDATE_EMPLOYEE, `Zaktualizowano pracownika: ${formData.first_name} ${formData.last_name}`);
      } else {
        const response = await api.post('/employees', formData);
        const newEmployee = { ...formData, id: response.id };
        setEmployees([...employees, newEmployee]);
        toast.success('Pracownik został dodany pomyślnie!');
        addAuditLog(user, AUDIT_ACTIONS.ADD_EMPLOYEE, `Dodano pracownika: ${formData.first_name} ${formData.last_name}`);
      }

      setShowModal(false);
      setFormData({
        first_name: '',
        last_name: '',
        phone: '',
        position: '',
        department: '',
        brand_number: ''
      });
    } catch (error) {
      console.error('Error saving employee:', error);
      toast.error('Błąd podczas zapisywania pracownika');
    } finally {
      setLoading(false);
    }
  };

  // Filtrowanie pracowników
  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = searchTerm === '' || 
      employee.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.brand_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPosition = filterPosition === '' || employee.position === filterPosition;
    const matchesDepartment = filterDepartment === '' || employee.department === filterDepartment;
    
    return matchesSearch && matchesPosition && matchesDepartment;
  });

  if (!hasPermission(user, PERMISSIONS.VIEW_EMPLOYEES)) {
    return (
      <div className="p-4 lg:p-8 bg-slate-50 min-h-screen text-center">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Brak dostępu</h2>
        <p className="text-slate-600">Nie masz uprawnień do tej sekcji.</p>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 bg-slate-50 min-h-screen">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 mb-4 lg:mb-0">Pracownicy</h1>
        
        {hasPermission(user, PERMISSIONS.MANAGE_EMPLOYEES) && (
          <button
            onClick={handleAddEmployee}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <span className="text-lg">👤</span>
            Dodaj pracownika
          </button>
        )}
      </div>

      {/* Filtry i wyszukiwanie */}
      <div className="bg-white rounded-xl shadow-sm p-4 lg:p-6 border border-slate-200 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Szukaj pracownika</label>
            <input
              type="text"
              placeholder="Imię, nazwisko, telefon..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Filtruj po stanowisku</label>
            <select
              value={filterPosition}
              onChange={(e) => setFilterPosition(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Wszystkie stanowiska</option>
              {positions.map(position => (
                <option key={position} value={position}>{position}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Filtruj po dziale</label>
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Wszystkie działy</option>
              {departments.map(department => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Lista pracowników */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {filteredEmployees.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-6xl mb-4">👥</div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Brak pracowników</h3>
            <p className="text-slate-600 mb-4">
              {searchTerm || filterPosition || filterDepartment 
                ? 'Nie znaleziono pracowników spełniających kryteria wyszukiwania.'
                : 'Nie ma jeszcze żadnych pracowników w systemie.'
              }
            </p>
            {hasPermission(user, PERMISSIONS.MANAGE_EMPLOYEES) && !searchTerm && !filterPosition && !filterDepartment && (
              <button
                onClick={handleAddEmployee}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Dodaj pierwszego pracownika
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left p-4 font-semibold text-slate-900">Pracownik</th>
                  <th className="text-left p-4 font-semibold text-slate-900">Kontakt</th>
                  <th className="text-left p-4 font-semibold text-slate-900">Stanowisko</th>
                  <th className="text-left p-4 font-semibold text-slate-900">Dział</th>
                  <th className="text-left p-4 font-semibold text-slate-900">Nr identyfikacyjny</th>
                  {hasPermission(user, PERMISSIONS.MANAGE_EMPLOYEES) && (
                    <th className="text-right p-4 font-semibold text-slate-900">Akcje</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-slate-50">
                    <td className="p-4">
                      <div className="font-medium text-slate-900">
                        {employee.first_name} {employee.last_name}
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-600">
                      {employee.phone || 'Brak telefonu'}
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {employee.position}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {employee.department}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-slate-600">
                      {employee.brand_number || 'Brak numeru'}
                    </td>
                    {hasPermission(user, PERMISSIONS.MANAGE_EMPLOYEES) && (
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditEmployee(employee)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edytuj pracownika"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteEmployee(employee.id, `${employee.first_name} ${employee.last_name}`)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Usuń pracownika"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal dodawania/edycji pracownika */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">
                {editingEmployee ? 'Edytuj pracownika' : 'Dodaj nowego pracownika'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Imię *
                </label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nazwisko *
                </label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Telefon
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="+48 123 456 789"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Stanowisko *
                </label>
                <select
                  value={formData.position}
                  onChange={(e) => setFormData({...formData, position: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Wybierz stanowisko</option>
                  {positions.map(position => (
                    <option key={position} value={position}>{position}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Dział *
                </label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({...formData, department: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Wybierz dział</option>
                  {departments.map(department => (
                    <option key={department} value={department}>{department}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Numer identyfikacyjny
                </label>
                <input
                  type="text"
                  value={formData.brand_number}
                  onChange={(e) => setFormData({...formData, brand_number: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="np. EMP001"
                />
              </div>

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
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Zapisywanie...' : (editingEmployee ? 'Zaktualizuj' : 'Dodaj')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function UserManagementScreen({ user }) {
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    role: 'employee',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch users on component mount
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await api.get('/users');
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
      role: 'employee',
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
    
    // Validation
    if (!formData.username || !formData.full_name) {
      toast.error('Nazwa użytkownika i pełne imię są wymagane');
      return;
    }

    if (!editingUser && !formData.password) {
      toast.error('Hasło jest wymagane dla nowego użytkownika');
      return;
    }

    if (formData.password && formData.password !== formData.confirmPassword) {
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
        // Update existing user
        const updatedUser = await api.put(`/users/${editingUser.id}`, userData);
        setUsers(users.map(u => u.id === editingUser.id ? updatedUser : u));
        addAuditLog(user, AUDIT_ACTIONS.EDIT_USER, `Edytowano użytkownika: ${formData.username}`);
        toast.success('Użytkownik został zaktualizowany');
      } else {
        // Add new user
        const newUser = await api.post('/users', userData);
        setUsers([...users, newUser]);
        addAuditLog(user, AUDIT_ACTIONS.ADD_USER, `Dodano użytkownika: ${formData.username}`);
        toast.success('Użytkownik został dodany');
      }

      setShowModal(false);
      setFormData({
        username: '',
        full_name: '',
        role: 'employee',
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

  // Filter users based on search term
  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleLabel = (role) => {
    switch (role) {
      case 'administrator': return '👑 Administrator';
      case 'manager': return '👔 Menedżer';
      case 'employee': return '👷 Pracownik';
      case 'viewer': return '👁️ Obserwator';
      default: return role;
    }
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'administrator': return 'bg-red-100 text-red-800';
      case 'manager': return 'bg-blue-100 text-blue-800';
      case 'employee': return 'bg-green-100 text-green-800';
      case 'viewer': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!hasPermission(user, PERMISSIONS.MANAGE_USERS)) {
    return (
      <div className="p-4 lg:p-8 bg-slate-50 min-h-screen text-center">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Brak dostępu</h2>
        <p className="text-slate-600">Nie masz uprawnień do zarządzania użytkownikami.</p>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 bg-slate-50 min-h-screen">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 mb-2">Zarządzanie użytkownikami</h1>
          <p className="text-slate-600">Dodawaj, edytuj i zarządzaj kontami użytkowników systemu</p>
        </div>
        <button
          onClick={handleAddUser}
          className="mt-4 lg:mt-0 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <span className="text-lg">👤</span>
          Dodaj użytkownika
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Szukaj użytkowników..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Users List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-4">⏳</div>
            <p className="text-slate-600">Ładowanie użytkowników...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-4">👥</div>
            <p className="text-slate-600">
              {searchTerm ? 'Nie znaleziono użytkowników pasujących do wyszukiwania' : 'Brak użytkowników w systemie'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left p-4 font-semibold text-slate-900">Użytkownik</th>
                  <th className="text-left p-4 font-semibold text-slate-900">Nazwa użytkownika</th>
                  <th className="text-left p-4 font-semibold text-slate-900">Rola</th>
                  <th className="text-left p-4 font-semibold text-slate-900">Utworzono</th>
                  <th className="text-right p-4 font-semibold text-slate-900">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((userItem) => (
                  <tr key={userItem.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-600 rounded-full flex items-center justify-center text-white font-semibold">
                          {userItem.full_name ? userItem.full_name.charAt(0).toUpperCase() : userItem.username ? userItem.username.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{userItem.full_name}</p>
                          <p className="text-sm text-slate-600">ID: {userItem.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-mono text-sm bg-slate-100 px-2 py-1 rounded">
                        {userItem.username}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeClass(userItem.role)}`}>
                        {getRoleLabel(userItem.role)}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-slate-600">
                      {userItem.created_at ? new Date(userItem.created_at).toLocaleDateString('pl-PL') : 'Nieznana'}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditUser(userItem)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edytuj użytkownika"
                        >
                          ✏️
                        </button>
                        {userItem.id !== user.id && (
                          <button
                            onClick={() => handleDeleteUser(userItem.id, userItem.username)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Usuń użytkownika"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">
                {editingUser ? 'Edytuj użytkownika' : 'Dodaj nowego użytkownika'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nazwa użytkownika *
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                  disabled={editingUser} // Username cannot be changed
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Pełne imię i nazwisko *
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
                  <option value="administrator">👑 Administrator</option>
                  <option value="manager">👔 Menedżer</option>
                  <option value="employee">👷 Pracownik</option>
                  <option value="viewer">👁️ Obserwator</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {editingUser ? 'Nowe hasło (pozostaw puste aby nie zmieniać)' : 'Hasło *'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required={!editingUser}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Potwierdź hasło {!editingUser && '*'}
                </label>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required={!editingUser || formData.password}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  disabled={loading}
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  disabled={loading}
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

function AdminPanel({ user, onNavigate }) {
  const [showDeleteHistoryConfirm, setShowDeleteHistoryConfirm] = useState(false);

  const handleDeleteHistory = async () => {
    try {
      // Tutaj będzie logika usuwania historii wydań z bazy danych
      // Na razie symulujemy operację
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success('Historia wszystkich wydań została usunięta pomyślnie!');
      addAuditLog(user, AUDIT_ACTIONS.DELETE_TOOL, 'Usunięto historię wszystkich wydań');
      setShowDeleteHistoryConfirm(false);
    } catch (error) {
      console.error('Error deleting history:', error);
      toast.error('Błąd podczas usuwania historii wydań');
    }
  };

  if (!hasPermission(user, PERMISSIONS.VIEW_ADMIN)) {
    return (
      <div className="p-4 lg:p-8 bg-slate-50 min-h-screen text-center">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Brak dostępu</h2>
        <p className="text-slate-600">Nie masz uprawnień do tej sekcji.</p>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 bg-slate-50 min-h-screen">
      <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 mb-6">Panel Administracyjny</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* User Management */}
        {hasPermission(user, PERMISSIONS.MANAGE_USERS) && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">👥</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Zarządzanie użytkownikami</h3>
                <p className="text-sm text-slate-600">Dodawaj i edytuj konta użytkowników</p>
              </div>
            </div>
            <button 
              onClick={() => onNavigate('user-management')}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Zarządzaj użytkownikami
            </button>
          </div>
        )}

        {/* System Settings */}
        {hasPermission(user, PERMISSIONS.SYSTEM_SETTINGS) && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">⚙️</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Ustawienia systemu</h3>
                <p className="text-sm text-slate-600">Konfiguruj parametry aplikacji</p>
              </div>
            </div>
            <button 
              onClick={() => onNavigate('config')}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
            >
              Otwórz ustawienia
            </button>
          </div>
        )}

        {/* Delete History */}
        {hasPermission(user, PERMISSIONS.MANAGE_USERS) && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">🗑️</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Usuń historie wszystkich wydań</h3>
                <p className="text-sm text-slate-600">Wyczyść całą historię wydawania narzędzi</p>
              </div>
            </div>
            <button 
              onClick={() => setShowDeleteHistoryConfirm(true)}
              className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
            >
              Usuń historie
            </button>
          </div>
        )}

        {/* Audit Log */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📋</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Dziennik audytu</h3>
              <p className="text-sm text-slate-600">Przeglądaj historię operacji</p>
            </div>
          </div>
          <button 
            onClick={() => onNavigate('audit')}
            className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors"
          >
            Zobacz dziennik
          </button>
        </div>

        {/* Role Management */}
        {hasPermission(user, PERMISSIONS.MANAGE_USERS) && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">🎭</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Role i uprawnienia</h3>
                <p className="text-sm text-slate-600">Konfiguruj role użytkowników</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>👑 Administrator</span>
                <span className="text-slate-600">Pełny dostęp</span>
              </div>
              <div className="flex justify-between">
                <span>👔 Menedżer</span>
                <span className="text-slate-600">Zarządzanie + analityka</span>
              </div>
              <div className="flex justify-between">
                <span>👷 Pracownik</span>
                <span className="text-slate-600">Podstawowe operacje</span>
              </div>
              <div className="flex justify-between">
                <span>👁️ Obserwator</span>
                <span className="text-slate-600">Tylko odczyt</span>
              </div>
            </div>
          </div>
        )}
      </div>

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

  // Sprawdź czy użytkownik jest już zalogowany przy starcie aplikacji
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchTools();
      fetchEmployees();
    }
  }, [user]);

  const fetchTools = async () => {
    try {
      const data = await api.get('/tools');
      setTools(data);
    } catch (error) {
      console.error('Error fetching tools:', error);
      // Mock data for demo
      setTools([
        { id: 1, name: 'Wiertarka Bosch', category: 'Elektronarzędzia', status: 'dostępne', location: 'Magazyn A', sku: 'SKU12345678', quantity: 1 },
        { id: 2, name: 'Młotek Stanley', category: 'Narzędzia ręczne', status: 'wydane', location: 'Warsztat', sku: 'SKU87654321', quantity: 1 }
      ]);
    }
  };

  const fetchEmployees = async () => {
    try {
      const data = await api.get('/employees');
      setEmployees(data);
    } catch (error) {
      console.error('Error fetching employees:', error);
      setEmployees([]);
    }
  };

  const handleNavigation = (screen) => {
    setCurrentScreen(screen);
    setIsMobileMenuOpen(false);
    
    // Dodaj wpis audytu dla nawigacji do ważnych sekcji
    const screenLabels = {
      'analytics': 'Przeglądano sekcję analityki',
      'admin': 'Dostęp do panelu administracyjnego',
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

  const handleLogout = () => {
    // Dodaj wpis audytu o wylogowaniu
    addAuditLog(user, AUDIT_ACTIONS.LOGOUT, 'Wylogowano z systemu');
    
    // Usuń dane z localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Wyczyść stan użytkownika
    setUser(null);
    setCurrentScreen('dashboard');
  };

  if (!user) {
    return <LoginScreen onLogin={(userData) => {
      setUser(userData);
      // Zapisz token i dane użytkownika w localStorage
      if (userData.token) {
        localStorage.setItem('token', userData.token);
        localStorage.setItem('user', JSON.stringify(userData));
      } else {
        // Jeśli nie ma tokena w userData, zapisz dane użytkownika bez tokena
        localStorage.setItem('user', JSON.stringify(userData));
      }
      addAuditLog(userData, AUDIT_ACTIONS.LOGIN, 'Zalogowano do systemu');
    }} />;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar 
        onNav={handleNavigation} 
        current={currentScreen} 
        user={user}
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={closeMobileMenu}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* TopBar */}
        <TopBar user={user} onLogout={handleLogout} />
        
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
          {currentScreen === 'config' && <AppConfigScreen user={user} />}
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
  );
}

export default App;
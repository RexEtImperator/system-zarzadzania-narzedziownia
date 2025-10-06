import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../api';

const PermissionsModal = ({ isOpen, onClose, user }) => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('users'); // 'users' lub 'roles'
  const [rolePermissions, setRolePermissions] = useState({});
  const [availablePermissions, setAvailablePermissions] = useState([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);

  // Definicja dostępnych ról i ich uprawnień
  const roles = {
    administrator: {
      name: 'Administrator',
      description: 'Pełny dostęp do wszystkich funkcji systemu',
      color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    },
    manager: {
      name: 'Menedżer',
      description: 'Zarządzanie narzędziami, pracownikami i analityka',
      color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
    },
    employee: {
      name: 'Pracownik',
      description: 'Podstawowe operacje na narzędziach i pracownikach',
      color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    },
    user: {
      name: 'Użytkownik',
      description: 'Dostęp do narzędzi i podstawowych funkcji',
      color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
    },
    viewer: {
      name: 'Obserwator',
      description: 'Tylko odczyt danych',
      color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
    }
  };

  // Mapowanie nazw uprawnień na czytelne opisy
  const permissionLabels = {
    'VIEW_USERS': 'Przeglądanie użytkowników',
    'CREATE_USERS': 'Tworzenie użytkowników',
    'EDIT_USERS': 'Edycja użytkowników',
    'DELETE_USERS': 'Usuwanie użytkowników',
    'VIEW_ANALYTICS': 'Przeglądanie analityki',
    'ACCESS_TOOLS': 'Dostęp do narzędzi',
    'MANAGE_DEPARTMENTS': 'Zarządzanie działami',
    'MANAGE_POSITIONS': 'Zarządzanie stanowiskami',
    'SYSTEM_SETTINGS': 'Ustawienia systemowe',
    'VIEW_ADMIN': 'Panel administracyjny',
    'MANAGE_USERS': 'Zarządzanie użytkownikami',
    'VIEW_AUDIT_LOG': 'Dziennik audytu',
    'VIEW_BHP': 'BHP – przeglądanie',
    'MANAGE_BHP': 'BHP – zarządzanie',
    'DELETE_ISSUE_HISTORY': 'Usuwanie historii wydań',
    'DELETE_SERVICE_HISTORY': 'Usuwanie historii serwisowania'
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      if (activeTab === 'roles') {
        fetchRolePermissions();
        fetchAvailablePermissions();
      }
    }
  }, [isOpen, activeTab]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await api.get('/api/users');
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Błąd podczas pobierania użytkowników');
    } finally {
      setLoading(false);
    }
  };

  const fetchRolePermissions = async () => {
    try {
      setLoadingPermissions(true);
      const data = await api.get('/api/role-permissions');
      setRolePermissions(data);
    } catch (error) {
      console.error('Error fetching role permissions:', error);
      toast.error('Błąd podczas pobierania uprawnień ról');
    } finally {
      setLoadingPermissions(false);
    }
  };

  const fetchAvailablePermissions = async () => {
    try {
      const data = await api.get('/api/permissions');
      setAvailablePermissions(data);
    } catch (error) {
      console.error('Error fetching available permissions:', error);
      toast.error('Błąd podczas pobierania dostępnych uprawnień');
    }
  };

  const handlePermissionToggle = (role, permission) => {
    setRolePermissions(prev => {
      const currentPermissions = prev[role] || [];
      const hasPermission = currentPermissions.includes(permission);
      
      const newPermissions = hasPermission
        ? currentPermissions.filter(p => p !== permission)
        : [...currentPermissions, permission];
      
      return {
        ...prev,
        [role]: newPermissions
      };
    });
  };

  const saveRolePermissions = async (role) => {
    try {
      setSaving(true);
      const permissions = rolePermissions[role] || [];
      await api.put(`/api/role-permissions/${role}`, { permissions });
      toast.success(`Uprawnienia dla roli ${roles[role]?.name || role} zostały zaktualizowane`);
    } catch (error) {
      console.error('Error saving role permissions:', error);
      toast.error('Błąd podczas zapisywania uprawnień');
      // Odśwież uprawnienia w przypadku błędu
      fetchRolePermissions();
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      setSaving(true);
      await api.put(`/api/users/${userId}`, { role: newRole });
      
      // Aktualizuj lokalny stan
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      
      toast.success('Rola użytkownika została zaktualizowana');
    } catch (error) {
      console.error('Error updating user role:', error);
      toast.error('Błąd podczas aktualizacji roli użytkownika');
    } finally {
      setSaving(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 transition-opacity"
          onClick={handleBackdropClick}
        ></div>

        {/* Center modal */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
          &#8203;
        </span>

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white dark:bg-slate-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          <div className="bg-white dark:bg-slate-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              {/* Icon */}
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/30 sm:mx-0 sm:h-10 sm:w-10">
                <span className="text-2xl">🎭</span>
              </div>

              {/* Content */}
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-slate-100" id="modal-title">
                  Zarządzanie uprawnieniami użytkowników
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    Zarządzaj rolami i uprawnieniami użytkowników w systemie
                  </p>
                </div>

                {/* Tabs */}
                <div className="mt-6">
                  <div className="border-b border-gray-200 dark:border-slate-600">
                    <nav className="-mb-px flex space-x-8">
                      <button
                        onClick={() => setActiveTab('users')}
                        className={`py-2 px-1 border-b-2 font-medium text-sm ${
                          activeTab === 'users'
                            ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                            : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 hover:border-gray-300 dark:hover:border-slate-500'
                        }`}
                      >
                        Użytkownicy
                      </button>
                      <button
                        onClick={() => setActiveTab('roles')}
                        className={`py-2 px-1 border-b-2 font-medium text-sm ${
                          activeTab === 'roles'
                            ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                            : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 hover:border-gray-300 dark:hover:border-slate-500'
                        }`}
                      >
                        Uprawnienia ról
                      </button>
                    </nav>
                  </div>
                </div>

                {/* Tab Content */}
                <div className="mt-6">
                  {activeTab === 'users' ? (
                    // Users list
                    <div>
                      {loading ? (
                        <div className="flex justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                        </div>
                      ) : (
                        <div className="max-h-96 overflow-y-auto">
                          <div className="space-y-4">
                            {users.map((u) => (
                              <div key={u.id} className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                                      <span className="text-sm font-medium text-white">
                                        {u.full_name?.charAt(0).toUpperCase() || u.username?.charAt(0).toUpperCase() || 'U'}
                                      </span>
                                    </div>
                                    <div>
                                      <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
                                        {u.full_name || u.username}
                                      </div>
                                      <div className="text-xs text-gray-500 dark:text-slate-400">
                                        @{u.username}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center space-x-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${roles[u.role]?.color || 'bg-gray-100 text-gray-800'}`}>
                                      {roles[u.role]?.name || u.role}
                                    </span>
                                    
                                    <select
                                      value={u.role}
                                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                      disabled={saving || u.id === user?.id}
                                      className="text-sm border border-gray-300 dark:border-slate-600 rounded-md px-2 py-1 bg-white dark:bg-slate-600 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:opacity-50"
                                    >
                                      {Object.entries(roles).map(([roleKey, roleData]) => (
                                        <option key={roleKey} value={roleKey}>
                                          {roleData.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                                
                                {u.id === user?.id && (
                                  <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                                    ⚠️ Nie możesz zmienić własnej roli
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Role permissions management
                    <div>
                      {loadingPermissions ? (
                        <div className="flex justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                        </div>
                      ) : (
                        <div className="max-h-96 overflow-y-auto">
                          <div className="space-y-6">
                            {Object.entries(roles).map(([roleKey, roleData]) => (
                              <div key={roleKey} className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-4">
                                  <div className="flex items-center space-x-3">
                                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${roleData.color}`}>
                                      {roleData.name}
                                    </span>
                                    <span className="text-sm text-gray-500 dark:text-slate-400">
                                      {roleData.description}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => saveRolePermissions(roleKey)}
                                    disabled={saving}
                                    className="px-3 py-1 bg-orange-600 text-white text-sm rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {saving ? 'Zapisywanie...' : 'Zapisz'}
                                  </button>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-2">
                                  {availablePermissions.map(permission => (
                                    <label key={permission} className="flex items-center space-x-2 text-sm">
                                      <input
                                        type="checkbox"
                                        checked={(rolePermissions[roleKey] || []).includes(permission)}
                                        onChange={() => handlePermissionToggle(roleKey, permission)}
                                        className="rounded border-gray-300 dark:border-slate-600 text-orange-600 focus:ring-orange-500"
                                      />
                                      <span className="text-gray-700 dark:text-slate-300">
                                        {permissionLabels[permission] || permission}
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 dark:bg-slate-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={onClose}
              className="w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-slate-600 shadow-sm px-4 py-2 bg-white dark:bg-slate-600 text-base font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 sm:w-auto sm:text-sm"
            >
              Zamknij
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PermissionsModal;
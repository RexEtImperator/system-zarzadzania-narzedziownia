import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../api';

const AUDIT_ACTIONS = {
  VIEW_USERS: 'VIEW_USERS',
  ADD_USER: 'ADD_USER',
  UPDATE_USER: 'UPDATE_USER',
  DELETE_USER: 'DELETE_USER'
};

const addAuditLog = async (user, action, details) => {
  try {
    await api.post('/api/audit', {
      user_id: user.id,
      username: user.username,
      action,
      details,
      ip_address: 'localhost'
    });
  } catch (error) {
    console.error('Error adding audit log:', error);
  }
};

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
        setUsers(users.map(u => u.id === editingUser.id ? { ...u, ...userData } : u));
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
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Zarządzanie użytkownikami</h1>
        <button
          onClick={handleAddUser}
          className="bg-blue-600 dark:bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors"
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
          className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
        />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                Użytkownik
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                Rola
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                Akcje
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
            {filteredUsers.map((u) => (
              <tr key={u.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{u.full_name}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-300">@{u.username}</div>
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
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 mr-3"
                  >
                    Edytuj
                  </button>
                  <button
                    onClick={() => handleDeleteUser(u.id, u.username)}
                    className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {editingUser ? 'Edytuj użytkownika' : 'Dodaj użytkownika'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Nazwa użytkownika
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Imię i nazwisko
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Rola
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                >
                  <option value="user">Użytkownik</option>
                  <option value="employee">Pracownik</option>
                  <option value="manager">Menedżer</option>
                  <option value="administrator">Administrator</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {editingUser ? 'Nowe hasło (opcjonalne)' : 'Hasło'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
                  required={!editingUser}
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Potwierdź hasło
                  </label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
                    required
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 disabled:opacity-50 transition-colors"
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

export default UserManagementScreen;
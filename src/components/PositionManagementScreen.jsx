import React, { useState, useEffect } from 'react';

const PositionManagementScreen = ({ apiClient }) => {
  const [positions, setPositions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPosition, setEditingPosition] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    departmentId: '',
    requirements: '',
    status: 'active'
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchPositions();
    fetchDepartments();
  }, []);

  const fetchPositions = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get('/api/positions');
      // Normalizacja ewentualnych pól z API
      const normalized = (Array.isArray(data) ? data : []).map(p => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        departmentId: p.departmentId || p.department_id || '',
        departmentName: p.departmentName || p.department_name || '',
        requirements: p.requirements || '',
        employeeCount: p.employeeCount || p.employee_count || 0,
        status: p.status || 'active'
      }));
      setPositions(normalized);
    } catch (error) {
      console.error('Błąd podczas pobierania stanowisk:', error);
      // Fallback: użyj domyślnych nazw stanowisk z wymagań
      const fallbackNames = [
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
      setPositions(fallbackNames.map((name, idx) => ({
        id: idx + 1,
        name,
        description: '',
        departmentId: '',
        departmentName: '',
        requirements: '',
        employeeCount: 0,
        status: 'active'
      })));
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const data = await apiClient.get('/api/departments');
      const normalized = (Array.isArray(data) ? data : []).map(d => ({ id: d.id, name: d.name }));
      setDepartments(normalized);
    } catch (error) {
      console.error('Błąd podczas pobierania departamentów:', error);
      // Fallback: lista działów zgodna z wymaganiami
      setDepartments([
        { id: 1, name: 'Administracja' },
        { id: 2, name: 'Automatyczny' },
        { id: 3, name: 'Elektryczny' },
        { id: 4, name: 'Mechaniczny' },
        { id: 5, name: 'Narzędziownia' },
        { id: 6, name: 'Skrawanie' },
        { id: 7, name: 'Pomiarowy' },
        { id: 8, name: 'Zewnętrzny' },
        { id: 9, name: 'Ślusarko-spawalniczy' }
      ]);
    }
  };

  const handleAdd = () => {
    setEditingPosition(null);
    setFormData({
      name: '',
      description: '',
      departmentId: '',
      requirements: '',
      status: 'active'
    });
    setErrors({});
    setShowModal(true);
  };

  const handleEdit = (position) => {
    setEditingPosition(position);
    setFormData({
      name: position.name,
      description: position.description,
      departmentId: position.departmentId.toString(),
      requirements: position.requirements || '',
      status: position.status
    });
    setErrors({});
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Czy na pewno chcesz usunąć to stanowisko?')) {
      try {
        // Tutaj byłoby wywołanie API
        setPositions(prev => prev.filter(pos => pos.id !== id));
      } catch (error) {
        console.error('Błąd podczas usuwania stanowiska:', error);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Nazwa jest wymagana';
    }
    if (!formData.departmentId) {
      newErrors.departmentId = 'Departament jest wymagany';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const departmentName = departments.find(d => d.id.toString() === formData.departmentId)?.name || '';
      
      if (editingPosition) {
        // Aktualizacja
        setPositions(prev => prev.map(pos => 
          pos.id === editingPosition.id 
            ? { 
                ...pos, 
                ...formData, 
                departmentId: parseInt(formData.departmentId),
                departmentName
              }
            : pos
        ));
      } else {
        // Dodawanie
        const newPosition = {
          id: Date.now(),
          ...formData,
          departmentId: parseInt(formData.departmentId),
          departmentName,
          employeeCount: 0
        };
        setPositions(prev => [...prev, newPosition]);
      }
      setShowModal(false);
    } catch (error) {
      console.error('Błąd podczas zapisywania stanowiska:', error);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { label: 'Aktywne', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' },
      inactive: { label: 'Nieaktywne', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100' }
    };
    
    const config = statusConfig[status] || statusConfig.active;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  // Wynagrodzenie nie jest używane na stanowisku

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Zarządzanie stanowiskami</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Zarządzaj stanowiskami pracy w organizacji
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Dodaj stanowisko
        </button>
      </div>

      {/* Positions Table */}
      <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
        {loading ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Ładowanie stanowisk...</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {positions.map((position) => (
              <li key={position.id}>
                <div className="px-4 py-4 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2V6" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="flex items-center">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {position.name}
                        </div>
                        <div className="ml-2">
                          {getStatusBadge(position.status)}
                        </div>
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {position.description}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Departament: {position.departmentName} • {position.employeeCount} pracowników
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEdit(position)}
                      className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 text-sm font-medium"
                    >
                      Edytuj
                    </button>
                    <button
                      onClick={() => handleDelete(position.id)}
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium"
                    >
                      Usuń
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowModal(false)}></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleSubmit}>
                <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
                    {editingPosition ? 'Edytuj stanowisko' : 'Dodaj nowe stanowisko'}
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Nazwa *
                      </label>
                      <input
                        type="text"
                        name="name"
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className={`mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                          errors.name ? 'border-red-300' : ''
                        }`}
                      />
                      {errors.name && (
                        <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="departmentId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Departament *
                      </label>
                      <select
                        name="departmentId"
                        id="departmentId"
                        value={formData.departmentId}
                        onChange={(e) => setFormData(prev => ({ ...prev, departmentId: e.target.value }))}
                        className={`mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                          errors.departmentId ? 'border-red-300' : ''
                        }`}
                      >
                        <option value="">Wybierz departament</option>
                        {departments.map(dept => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name}
                          </option>
                        ))}
                      </select>
                      {errors.departmentId && (
                        <p className="mt-1 text-sm text-red-600">{errors.departmentId}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Opis
                      </label>
                      <textarea
                        name="description"
                        id="description"
                        rows={3}
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    {/* Wynagrodzenie usunięte zgodnie z wymaganiami */}

                    <div>
                      <label htmlFor="requirements" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Wymagania
                      </label>
                      <textarea
                        name="requirements"
                        id="requirements"
                        rows={3}
                        value={formData.requirements}
                        onChange={(e) => setFormData(prev => ({ ...prev, requirements: e.target.value }))}
                        className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Wymagania dla tego stanowiska..."
                      />
                    </div>

                    <div>
                      <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Status
                      </label>
                      <select
                        name="status"
                        id="status"
                        value={formData.status}
                        onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                        className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="active">Aktywne</option>
                        <option value="inactive">Nieaktywne</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Zapisz
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-700 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Anuluj
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PositionManagementScreen;
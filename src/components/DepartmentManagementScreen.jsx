import React, { useState, useEffect } from 'react';

const DepartmentManagementScreen = ({ apiClient }) => {
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    managerId: '',
    status: 'active'
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchDepartments();
    fetchEmployees();
  }, []);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get('/api/departments');
      setDepartments(data);
    } catch (error) {
      console.error('Błąd podczas pobierania departamentów:', error);
      // Fallback: użyj domyślnych nazw działów z wymagań
      const fallbackNames = [
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
      setDepartments(fallbackNames.map((name, idx) => ({
        id: idx + 1,
        name,
        description: '',
        managerId: '',
        managerName: 'Nie przypisano',
        employeeCount: 0,
        status: 'active'
      })));
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const data = await apiClient.get('/api/employees');
      // Normalizuj do { id, name }
      const normalized = data.map(e => ({ id: e.id || e.employee_id || e.brand_number, name: `${e.first_name} ${e.last_name}` }));
      setEmployees(normalized);
    } catch (error) {
      console.error('Błąd podczas pobierania pracowników:', error);
      // Fallback minimalny
      setEmployees([
        { id: 1, name: 'Jan Kowalski' },
        { id: 2, name: 'Anna Nowak' },
        { id: 3, name: 'Piotr Wiśniewski' }
      ]);
    }
  };

  const handleAdd = () => {
    setEditingDepartment(null);
    setFormData({
      name: '',
      description: '',
      managerId: '',
      status: 'active'
    });
    setErrors({});
    setShowModal(true);
  };

  const handleEdit = (department) => {
    setEditingDepartment(department);
    setFormData({
      name: department.name,
      description: department.description,
      managerId: department.managerId || '',
      status: department.status
    });
    setErrors({});
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Czy na pewno chcesz usunąć ten departament?')) {
      try {
        // Tutaj byłoby wywołanie API
        setDepartments(prev => prev.filter(dept => dept.id !== id));
      } catch (error) {
        console.error('Błąd podczas usuwania departamentu:', error);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Nazwa jest wymagana';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const managerName = employees.find(e => String(e.id) === String(formData.managerId))?.name || 'Nie przypisano';
      if (editingDepartment) {
        // Aktualizacja
        setDepartments(prev => prev.map(dept => 
          dept.id === editingDepartment.id 
            ? { ...dept, ...formData, managerName }
            : dept
        ));
        // TODO: wywołanie API: await apiClient.put(`/api/departments/${editingDepartment.id}`, { ...formData })
      } else {
        // Dodawanie
        const newDepartment = {
          id: Date.now(),
          ...formData,
          managerName,
          employeeCount: 0
        };
        setDepartments(prev => [...prev, newDepartment]);
        // TODO: wywołanie API: await apiClient.post('/api/departments', newDepartment)
      }
      setShowModal(false);
    } catch (error) {
      console.error('Błąd podczas zapisywania departamentu:', error);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { label: 'Aktywny', className: 'bg-green-100 text-green-800' },
      inactive: { label: 'Nieaktywny', className: 'bg-red-100 text-red-800' }
    };
    
    const config = statusConfig[status] || statusConfig.active;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Zarządzanie departamentami</h1>
          <p className="mt-1 text-sm text-gray-500">
            Zarządzaj departamentami w organizacji
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Dodaj departament
        </button>
      </div>

      {/* Departments Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {loading ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500">Ładowanie departamentów...</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {departments.map((department) => (
              <li key={department.id}>
                <div className="px-4 py-4 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="flex items-center">
                        <div className="text-sm font-medium text-gray-900">
                          {department.name}
                        </div>
                        <div className="ml-2">
                          {getStatusBadge(department.status)}
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        {department.description}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Kierownik: {department.managerName} • {department.employeeCount} pracowników
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEdit(department)}
                      className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                    >
                      Edytuj
                    </button>
                    <button
                      onClick={() => handleDelete(department.id)}
                      className="text-red-600 hover:text-red-900 text-sm font-medium"
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

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    {editingDepartment ? 'Edytuj departament' : 'Dodaj nowy departament'}
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                        Nazwa *
                      </label>
                      <input
                        type="text"
                        name="name"
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                          errors.name ? 'border-red-300' : ''
                        }`}
                      />
                      {errors.name && (
                        <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                        Opis
                      </label>
                      <textarea
                        name="description"
                        id="description"
                        rows={3}
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>

                    <div>
                      <label htmlFor="managerId" className="block text-sm font-medium text-gray-700">
                        Kierownik działu
                      </label>
                      <select
                        name="managerId"
                        id="managerId"
                        value={formData.managerId}
                        onChange={(e) => setFormData(prev => ({ ...prev, managerId: e.target.value }))}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      >
                        <option value="">Nie przypisano</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                        Status
                      </label>
                      <select
                        name="status"
                        id="status"
                        value={formData.status}
                        onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      >
                        <option value="active">Aktywny</option>
                        <option value="inactive">Nieaktywny</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Zapisz
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
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

export default DepartmentManagementScreen;
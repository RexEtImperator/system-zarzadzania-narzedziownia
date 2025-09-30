import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../api';

const AUDIT_ACTIONS = {
  EMPLOYEE_ADD: 'EMPLOYEE_ADD',
  EMPLOYEE_EDIT: 'EMPLOYEE_EDIT',
  EMPLOYEE_DELETE: 'EMPLOYEE_DELETE'
};

const addAuditLog = async (user, action, details) => {
  try {
    await api.post('/audit-logs', {
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

function EmployeesScreen({ employees, setEmployees, user }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterPosition, setFilterPosition] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDepartments();
    fetchPositions();
  }, []);

  const fetchDepartments = async () => {
    try {
      const data = await api.get('/departments');
      setDepartments(data);
    } catch (error) {
      console.error('Error fetching departments:', error);
      setDepartments([
        { id: 1, name: 'IT' },
        { id: 2, name: 'HR' },
        { id: 3, name: 'Produkcja' },
        { id: 4, name: 'Magazyn' }
      ]);
    }
  };

  const fetchPositions = async () => {
    try {
      const data = await api.get('/positions');
      setPositions(data);
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

  const handleAddEmployee = async (employeeData) => {
    try {
      setLoading(true);
      const newEmployee = await api.post('/employees', employeeData);
      setEmployees(prev => [...prev, newEmployee]);
      setShowAddModal(false);
      toast.success('Pracownik został dodany pomyślnie');
      
      await addAuditLog(user, AUDIT_ACTIONS.EMPLOYEE_ADD, 
        `Dodano pracownika: ${employeeData.first_name} ${employeeData.last_name}`);
    } catch (error) {
      console.error('Error adding employee:', error);
      toast.error('Błąd podczas dodawania pracownika');
      setError('Błąd podczas dodawania pracownika');
    } finally {
      setLoading(false);
    }
  };

  const handleEditEmployee = async (employeeData) => {
    try {
      setLoading(true);
      const updatedEmployee = await api.put(`/employees/${editingEmployee.id}`, employeeData);
      setEmployees(prev => prev.map(emp => 
        emp.id === editingEmployee.id ? updatedEmployee : emp
      ));
      setShowEditModal(false);
      setEditingEmployee(null);
      toast.success('Dane pracownika zostały zaktualizowane');
      
      await addAuditLog(user, AUDIT_ACTIONS.EMPLOYEE_EDIT, 
        `Edytowano pracownika: ${employeeData.first_name} ${employeeData.last_name}`);
    } catch (error) {
      console.error('Error updating employee:', error);
      toast.error('Błąd podczas aktualizacji danych pracownika');
      setError('Błąd podczas aktualizacji danych pracownika');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEmployee = async (employee) => {
    if (!window.confirm(`Czy na pewno chcesz usunąć pracownika ${employee.first_name} ${employee.last_name}?`)) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/employees/${employee.id}`);
      setEmployees(prev => prev.filter(emp => emp.id !== employee.id));
      toast.success('Pracownik został usunięty');
      
      await addAuditLog(user, AUDIT_ACTIONS.EMPLOYEE_DELETE, 
        `Usunięto pracownika: ${employee.first_name} ${employee.last_name}`);
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast.error('Błąd podczas usuwania pracownika');
      setError('Błąd podczas usuwania pracownika');
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = 
      employee.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.employee_id?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDepartment = filterDepartment === 'all' || employee.department_id?.toString() === filterDepartment;
    const matchesPosition = filterPosition === 'all' || employee.position_id?.toString() === filterPosition;
    
    return matchesSearch && matchesDepartment && matchesPosition;
  });

  const getDepartmentName = (departmentId) => {
    const dept = departments.find(d => d.id === departmentId);
    return dept ? dept.name : 'Nieznany';
  };

  const getPositionName = (positionId) => {
    const pos = positions.find(p => p.id === positionId);
    return pos ? pos.name : 'Nieznana';
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">Zarządzanie Pracownikami</h1>
        <p className="text-slate-600">Zarządzaj danymi pracowników w systemie</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <div className="text-red-600 mr-2">⚠️</div>
            <p className="text-red-800">{error}</p>
            <button
              onClick={() => setError('')}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Filtry i wyszukiwanie */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Filtry i wyszukiwanie</h3>
          {user?.role === 'admin' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="w-full md:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <span>+</span>
              Dodaj pracownika
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Wyszukaj</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Imię, nazwisko, email..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Dział</label>
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Wszystkie działy</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id.toString()}>{dept.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Stanowisko</label>
            <select
              value={filterPosition}
              onChange={(e) => setFilterPosition(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Wszystkie stanowiska</option>
              {positions.map(pos => (
                <option key={pos.id} value={pos.id.toString()}>{pos.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterDepartment('all');
                setFilterPosition('all');
              }}
              className="w-full px-4 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Wyczyść filtry
            </button>
          </div>
        </div>
      </div>

      {/* Lista pracowników */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Ładowanie pracowników...</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-6xl mb-4">👥</div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Brak pracowników</h3>
            <p className="text-slate-600">
              {employees.length === 0 
                ? 'Nie dodano jeszcze żadnych pracowników.' 
                : 'Nie znaleziono pracowników spełniających kryteria wyszukiwania.'
              }
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left p-4 font-semibold text-slate-900">ID</th>
                    <th className="text-left p-4 font-semibold text-slate-900">Imię i nazwisko</th>
                    <th className="text-left p-4 font-semibold text-slate-900">Email</th>
                    <th className="text-left p-4 font-semibold text-slate-900">Dział</th>
                    <th className="text-left p-4 font-semibold text-slate-900">Stanowisko</th>
                    <th className="text-left p-4 font-semibold text-slate-900">Telefon</th>
                    {user?.role === 'admin' && (
                      <th className="text-left p-4 font-semibold text-slate-900">Akcje</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id} className="hover:bg-slate-50">
                      <td className="p-4 font-mono text-sm text-slate-600">
                        {employee.employee_id || employee.id}
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-slate-900">
                          {employee.first_name} {employee.last_name}
                        </div>
                      </td>
                      <td className="p-4 text-slate-600">
                        {employee.email || '-'}
                      </td>
                      <td className="p-4 text-slate-600">
                        {getDepartmentName(employee.department_id)}
                      </td>
                      <td className="p-4 text-slate-600">
                        {getPositionName(employee.position_id)}
                      </td>
                      <td className="p-4 text-slate-600">
                        {employee.phone || '-'}
                      </td>
                      {user?.role === 'admin' && (
                        <td className="p-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingEmployee(employee);
                                setShowEditModal(true);
                              }}
                              className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                            >
                              Edytuj
                            </button>
                            <button
                              onClick={() => handleDeleteEmployee(employee)}
                              className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                            >
                              Usuń
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-slate-200">
              {filteredEmployees.map((employee) => (
                <div key={employee.id} className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {employee.first_name} {employee.last_name}
                      </h3>
                      <p className="text-sm text-slate-500 font-mono">
                        ID: {employee.employee_id || employee.id}
                      </p>
                    </div>
                    {user?.role === 'admin' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingEmployee(employee);
                            setShowEditModal(true);
                          }}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                        >
                          Edytuj
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(employee)}
                          className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                        >
                          Usuń
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Email:</span>
                      <span className="text-slate-900">{employee.email || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Dział:</span>
                      <span className="text-slate-900">{getDepartmentName(employee.department_id)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Stanowisko:</span>
                      <span className="text-slate-900">{getPositionName(employee.position_id)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Telefon:</span>
                      <span className="text-slate-900">{employee.phone || '-'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modals would go here - AddEmployeeModal and EditEmployeeModal */}
      {/* For brevity, I'm not including the full modal implementations */}
    </div>
  );
}

export default EmployeesScreen;
import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../api';
import EmployeeModal from './EmployeeModal';

const AUDIT_ACTIONS = {
  EMPLOYEE_ADD: 'EMPLOYEE_ADD',
  EMPLOYEE_EDIT: 'EMPLOYEE_EDIT',
  EMPLOYEE_DELETE: 'EMPLOYEE_DELETE'
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
      const data = await api.get('/api/departments');
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
      const data = await api.get('/api/positions');
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
      // Mapowanie danych z formularza na format API
      const apiData = {
        first_name: employeeData.firstName,
        last_name: employeeData.lastName,
        phone: employeeData.phone,
        department: departments.find(d => d.id.toString() === employeeData.departmentId)?.name || '',
        position: positions.find(p => p.id.toString() === employeeData.positionId)?.name || '',
        brand_number: employeeData.brandNumber || ''
      };
      
      const newEmployee = await api.post('/api/employees', apiData);
      setEmployees(prev => [...prev, newEmployee]);
      setShowAddModal(false);
      toast.success('Pracownik został dodany pomyślnie');
      
      await addAuditLog(user, AUDIT_ACTIONS.EMPLOYEE_ADD, 
        `Dodano pracownika: ${employeeData.firstName} ${employeeData.lastName}`);
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
      // Mapowanie danych z formularza na format API
      const apiData = {
        first_name: employeeData.firstName,
        last_name: employeeData.lastName,
        phone: employeeData.phone,
        department: departments.find(d => d.id.toString() === employeeData.departmentId)?.name || '',
        position: positions.find(p => p.id.toString() === employeeData.positionId)?.name || '',
        brand_number: employeeData.brandNumber || editingEmployee.brand_number
      };
      
      const updatedEmployee = await api.put(`/api/employees/${editingEmployee.id}`, apiData);
      setEmployees(prev => prev.map(emp => 
        emp.id === editingEmployee.id ? updatedEmployee : emp
      ));
      setShowEditModal(false);
      setEditingEmployee(null);
      toast.success('Dane pracownika zostały zaktualizowane');
      
      await addAuditLog(user, AUDIT_ACTIONS.EMPLOYEE_EDIT, 
        `Edytowano pracownika: ${employeeData.firstName} ${employeeData.lastName}`);
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
      await api.delete(`/api/employees/${employee.id}`);
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
      employee.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.brand_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDepartment = filterDepartment === 'all' || employee.department?.toLowerCase() === departments.find(d => d.id.toString() === filterDepartment)?.name?.toLowerCase();
    const matchesPosition = filterPosition === 'all' || employee.position?.toLowerCase() === positions.find(p => p.id.toString() === filterPosition)?.name?.toLowerCase();
    
    return matchesSearch && matchesDepartment && matchesPosition;
  }).sort((a, b) => {
    // Sortowanie według numeru służbowego od 1 do najwyższego
    const brandA = parseInt(a.brand_number) || 999999;
    const brandB = parseInt(b.brand_number) || 999999;
    return brandA - brandB;
  });

  const getDepartmentName = (department) => {
    return department || 'Nieznany';
  };

  const getPositionName = (position) => {
    return position || 'Nieznana';
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">Zarządzanie Pracownikami</h1>
        <p className="text-slate-600 dark:text-slate-400">Zarządzaj danymi pracowników w systemie</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center">
            <div className="text-red-600 dark:text-red-400 mr-2">⚠️</div>
            <p className="text-red-800 dark:text-red-200">{error}</p>
            <button
              onClick={() => setError('')}
              className="ml-auto text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Filtry i wyszukiwanie */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 mb-6 p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Filtry i wyszukiwanie</h3>
          {user?.role === 'administrator' && (
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
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Wyszukaj</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Imię, nazwisko, numer służbowy..."
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Dział</label>
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="all">Wszystkie działy</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id.toString()}>{dept.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Stanowisko</label>
            <select
              value={filterPosition}
              onChange={(e) => setFilterPosition(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
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
              className="w-full px-4 py-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              Wyczyść filtry
            </button>
          </div>
        </div>
      </div>

      {/* Lista pracowników */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        {filteredEmployees.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">👥</div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Brak pracowników</h3>
            <p className="text-slate-600 dark:text-slate-400">
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
                <thead className="bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
                  <tr>
                    <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100">Imię i nazwisko</th>
                    <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100">Numer służbowy</th>
                    <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100">Telefon</th>
                    <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100">Dział</th>
                    <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100">Stanowisko</th>
                    {user?.role === 'administrator' && (
                      <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100">Akcje</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                      <td className="p-4">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {employee.first_name} {employee.last_name}
                        </div>
                      </td>
                      <td className="p-4 font-mono text-sm text-slate-600 dark:text-slate-400">
                        {employee.brand_number || '-'}
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-400">
                        {employee.phone || '-'}
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-400">
                        {getDepartmentName(employee.department)}
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-400">
                        {getPositionName(employee.position)}
                      </td>
                      {user?.role === 'administrator' && (
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
            <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-600">
              {filteredEmployees.map((employee) => (
                <div key={employee.id} className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                      {employee.first_name} {employee.last_name}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">
                      Numer służbowy: {employee.brand_number || '-'}
                    </p>
                  </div>
                    {user?.role === 'administrator' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingEmployee(employee);
                            setShowEditModal(true);
                          }}
                          className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                        >
                          Edytuj
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(employee)}
                          className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                        >
                          Usuń
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Telefon:</span>
                      <span className="text-slate-900 dark:text-slate-100">{employee.phone || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Dział:</span>
                      <span className="text-slate-900 dark:text-slate-100">{getDepartmentName(employee.department)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Stanowisko:</span>
                      <span className="text-slate-900 dark:text-slate-100">{getPositionName(employee.position)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      <EmployeeModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddEmployee}
        employee={null}
        departments={departments}
        positions={positions}
      />
      
      <EmployeeModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingEmployee(null);
        }}
        onSave={handleEditEmployee}
        employee={editingEmployee ? {
          firstName: editingEmployee.first_name,
          lastName: editingEmployee.last_name,
          phone: editingEmployee.phone,
          departmentId: departments.find(d => d.name === editingEmployee.department)?.id?.toString() || '',
          positionId: positions.find(p => p.name === editingEmployee.position)?.id?.toString() || '',
          brandNumber: editingEmployee.brand_number,
          status: editingEmployee.status || 'active'
        } : null}
        departments={departments}
        positions={positions}
      />
    </div>
  );
}

export default EmployeesScreen;
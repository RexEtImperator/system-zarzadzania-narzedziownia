import React, { useState, useEffect } from 'react';
import { PencilSquareIcon, TrashIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import api from '../api';
import EmployeeModal from './EmployeeModal';
import { PERMISSIONS, hasPermission } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';
import SkeletonList from './SkeletonList';

const AUDIT_ACTIONS = {
  EMPLOYEE_VIEW: 'EMPLOYEE_VIEW',
  EMPLOYEE_ADD: 'EMPLOYEE_ADD',
  EMPLOYEE_EDIT: 'EMPLOYEE_EDIT',
  EMPLOYEE_DELETE: 'EMPLOYEE_DELETE',
  EMPLOYEE_SEND_CREDENTIALS: 'EMPLOYEE_SEND_CREDENTIALS'
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
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterPosition, setFilterPosition] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [error, setError] = useState('');

  // Zbiór nazw działów i stanowisk do filtrowania: UNION danych z bazy i istniejących w pracownikach
  const departmentNames = Array.from(new Set([
    ...departments.map(d => d.name).filter(Boolean),
    ...employees.map(e => e.department).filter(Boolean)
  ])).sort((a, b) => a.localeCompare(b));

  const positionNames = Array.from(new Set([
    ...positions.map(p => p.name).filter(Boolean),
    ...employees.map(e => e.position).filter(Boolean)
  ])).sort((a, b) => a.localeCompare(b));

  useEffect(() => {
    fetchDepartments();
    fetchPositions();
  }, []);

  // Przenieś pobieranie pracowników do ekranu
  useEffect(() => {
    const canView = hasPermission(user, PERMISSIONS.VIEW_EMPLOYEES);
    if (!canView) return;
    let cancelled = false;
    const loadEmployees = async () => {
      try {
        setInitialLoading(true);
        const data = await api.get('/api/employees');
        if (!cancelled) setEmployees(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching employees:', err);
        if (!cancelled) setEmployees([]);
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    };
    // Ładuj tylko gdy lista jest pusta – ograniczenie kosztu
    if (!employees || employees.length === 0) {
      loadEmployees();
    }
    return () => { cancelled = true; };
  }, [user]);

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
        email: employeeData.email,
        department: departments.find(d => d.id.toString() === employeeData.departmentId)?.name || '',
        position: positions.find(p => p.id.toString() === employeeData.positionId)?.name || '',
        brand_number: employeeData.brandNumber || ''
      };
      
      const newEmployee = await api.post('/api/employees', apiData);
      setEmployees(prev => [...prev, newEmployee]);
      setShowAddModal(false);
      toast.success(t('employees.addedSuccess'));
      
      await addAuditLog(user, AUDIT_ACTIONS.EMPLOYEE_ADD, 
        `Dodano pracownika: ${employeeData.firstName} ${employeeData.lastName}`);
    } catch (error) {
      console.error('Error adding employee:', error);
      toast.error(t('employees.addError'));
      setError(t('employees.addError'));
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
        email: employeeData.email,
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
      toast.success(t('employees.updatedSuccess'));
      
      await addAuditLog(user, AUDIT_ACTIONS.EMPLOYEE_EDIT, 
        `Edytowano pracownika: ${employeeData.firstName} ${employeeData.lastName}`);
    } catch (error) {
      console.error('Error updating employee:', error);
      toast.error(t('employees.updateError'));
      setError(t('employees.updateError'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEmployee = async (employee) => {
    if (!window.confirm(`${t('employees.confirmDelete')} ${employee.first_name} ${employee.last_name}?`)) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/api/employees/${employee.id}`);
      setEmployees(prev => prev.filter(emp => emp.id !== employee.id));
      toast.success(t('employees.deletedSuccess'));
      
      await addAuditLog(user, AUDIT_ACTIONS.EMPLOYEE_DELETE, 
        `Usunięto pracownika: ${employee.first_name} ${employee.last_name}`);
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast.error(t('employees.deleteError'));
      setError(t('employees.deleteError'));
    } finally {
      setLoading(false);
    }
  };

  const handleSendCredentials = async (employee) => {
    try {
      if (!employee?.email) {
        toast.warn(t('employees.toast.noEmail'));
        return;
      }
      setLoading(true);
      const resp = await api.post(`/api/employees/${employee.id}/send-credentials`, {});
      const emailSent = resp?.emailSent;
      const createdLogin = resp?.createdLogin;
      const updatedEmployee = resp?.employee;
      if (updatedEmployee) {
        setEmployees(prev => prev.map(e => e.id === updatedEmployee.id ? updatedEmployee : e));
      }
      if (emailSent) {
        toast.success(createdLogin ? t('employees.toast.loginCreatedAndEmailSent') : t('employees.toast.emailSent'));
      } else {
        toast.info(createdLogin ? t('employees.toast.loginCreatedEmailNotSent') : t('employees.toast.emailNotSent'));
      }
      // Logowanie audytowe
      await addAuditLog(user, AUDIT_ACTIONS.EMPLOYEE_SEND_CREDENTIALS, 
        `Wysłano dane logowania dla pracownika ID=${employee.id}, login=${updatedEmployee?.login || employee.login || 'brak'}, emailSent=${emailSent}, createdLogin=${createdLogin}`);
    } catch (error) {
      console.error('Error sending credentials:', error);
      toast.error(t('employees.toast.sendError'));
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

    const matchesDepartment = filterDepartment === 'all' || (employee.department && filterDepartment && employee.department.toLowerCase() === filterDepartment.toLowerCase());
    const matchesPosition = filterPosition === 'all' || (employee.position && filterPosition && employee.position.toLowerCase() === filterPosition.toLowerCase());
    
    return matchesSearch && matchesDepartment && matchesPosition;
  }).sort((a, b) => {
    // Sortowanie według numeru służbowego od 1 do najwyższego
    const brandA = parseInt(a.brand_number) || 999999;
    const brandB = parseInt(b.brand_number) || 999999;
    return brandA - brandB;
  });

  // Skeleton dla tabeli pracowników
  const renderSkeleton = (
    <div className="p-4">
      <SkeletonList rows={8} cols={4} />
    </div>
  );

  const getDepartmentName = (department) => {
    return department || t('employees.unknownDept');
  };

  const getPositionName = (position) => {
    return position || t('employees.unknownPos');
  };

  return (
    <div className="p-6 bg-white dark:bg-slate-900 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('employees.title')}</h1>
          <p className="text-slate-600 dark:text-slate-400">{t('employees.subtitle')}</p>
        </div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          {hasPermission(user, PERMISSIONS.MANAGE_EMPLOYEES) && (
            <button
              onClick={() => setShowAddModal(true)}
              className="w-full md:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <span>+</span>
              {t('employees.add')}
            </button>
          )}
        </div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('employees.search')}</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('employees.searchPlaceholder')}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('employees.department')}</label>
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="all">{t('employees.allDepartments')}</option>
              {departmentNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('employees.position')}</label>
            <select
              value={filterPosition}
              onChange={(e) => setFilterPosition(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="all">{t('employees.allPositions')}</option>
              {positionNames.map(name => (
                <option key={name} value={name}>{name}</option>
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
              {t('employees.clearFilters')}
            </button>
          </div>
        </div>
      </div>

      {/* Lista pracowników */}
      {initialLoading && employees.length === 0 ? (
        renderSkeleton
      ) : (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        {filteredEmployees.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">👥</div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">{t('employees.none')}</h3>
            <p className="text-slate-600 dark:text-slate-400">
              {employees.length === 0 
                ? t('employees.noneAdded') 
                : t('employees.noneFound')
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
                    <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100">{t('employees.fullName')}</th>
                    <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100">{t('employees.brandNumber')}</th>
                    <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100">{t('employees.phone')}</th>
                    <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100">{t('employees.departmentCol')}</th>
                    <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100">{t('employees.positionCol')}</th>
                    {user?.role === 'administrator' && (
                      <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100">{t('employees.actions')}</th>
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
                        {employee.login && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                            LOGIN: {employee.login}
                          </div>
                        )}
                        {employee.email && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                            EMAIL: {employee.email}
                          </div>
                        )}
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
                              onClick={() => handleSendCredentials(employee)}
                              disabled={!employee?.email}
                              className={`p-2 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 transition-colors ${!employee?.email ? 'opacity-50 cursor-not-allowed' : ''}`}
                              aria-label="Wyślij dane logowania"
                              title={!employee?.email ? 'Uzupełnij e‑mail pracownika, aby wysłać' : 'Wyślij dane logowania'}
                            >
                              <EnvelopeIcon className="h-5 w-5" aria-hidden="true" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingEmployee(employee);
                                setShowEditModal(true);
                              }}
                              className="p-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                              aria-label={t('employees.edit')}
                              title={t('employees.edit')}
                            >
                              <PencilSquareIcon className="h-5 w-5" aria-hidden="true" />
                            </button>
                            <button
                              onClick={() => handleDeleteEmployee(employee)}
                              className="p-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                              aria-label={t('employees.delete')}
                              title={t('employees.delete')}
                            >
                              <TrashIcon className="h-5 w-5" aria-hidden="true" />
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
                    {employee.login && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        LOGIN: {employee.login}
                      </p>
                    )}
                    {employee.email && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        EMAIL: {employee.email}
                      </p>
                    )}
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">
                      {t('employees.brandNumber')}: {employee.brand_number || '-'}
                    </p>
                  </div>
                    {user?.role === 'administrator' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSendCredentials(employee)}
                          disabled={!employee?.email}
                          className={`p-2 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 rounded hover:bg-emerald-200 dark:hover:bg-emerald-800 transition-colors ${!employee?.email ? 'opacity-50 cursor-not-allowed' : ''}`}
                          aria-label="Wyślij dane logowania"
                          title={!employee?.email ? 'Uzupełnij e‑mail pracownika, aby wysłać' : 'Wyślij dane logowania'}
                        >
                          <EnvelopeIcon className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingEmployee(employee);
                            setShowEditModal(true);
                          }}
                          className="p-2 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                          aria-label="Edytuj"
                          title="Edytuj"
                        >
                          <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(employee)}
                          className="p-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                          aria-label="Usuń"
                          title="Usuń"
                        >
                          <TrashIcon className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">{t('employees.mobilePhone')}</span>
                      <span className="text-slate-900 dark:text-slate-100">{employee.phone || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">{t('employees.mobileDepartment')}</span>
                      <span className="text-slate-900 dark:text-slate-100">{getDepartmentName(employee.department)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">{t('employees.mobilePosition')}</span>
                      <span className="text-slate-900 dark:text-slate-100">{getPositionName(employee.position)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      )}

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
          email: editingEmployee.email,
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
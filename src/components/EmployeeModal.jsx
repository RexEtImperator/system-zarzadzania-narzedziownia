import React, { useState, useEffect } from 'react';

const EmployeeModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  employee = null, 
  departments = [], 
  positions = [] 
}) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    departmentId: '',
    positionId: '',
    brandNumber: '',
    status: 'active'
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (employee) {
      setFormData({
        firstName: employee.firstName || '',
        lastName: employee.lastName || '',
        phone: employee.phone || '',
        departmentId: employee.departmentId || '',
        positionId: employee.positionId || '',
        brandNumber: employee.brandNumber || '',
        status: employee.status || 'active'
      });
    } else {
      setFormData({
        firstName: '',
        lastName: '',
        phone: '',
        departmentId: '',
        positionId: '',
        brandNumber: '',
        status: 'active'
      });
    }
    setErrors({});
  }, [employee, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'Imię jest wymagane';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Nazwisko jest wymagane';
    }

    if (!formData.departmentId) {
      newErrors.departmentId = 'Departament jest wymagany';
    }

    if (!formData.positionId) {
      newErrors.positionId = 'Stanowisko jest wymagane';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Błąd podczas zapisywania pracownika:', error);
      setErrors({ submit: 'Wystąpił błąd podczas zapisywania' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-black dark:bg-opacity-60 transition-opacity" onClick={onClose}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom bg-white dark:bg-slate-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <form onSubmit={handleSubmit}>
            <div className="bg-white dark:bg-slate-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="sm:flex sm:items-start">
                <div className="w-full">
                  <h3 className="text-lg leading-6 font-medium text-slate-900 dark:text-slate-100 mb-4">
                    {employee ? 'Edytuj pracownika' : 'Dodaj nowego pracownika'}
                  </h3>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        Imię *
                      </label>
                      <input
                        type="text"
                        name="firstName"
                        id="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                        placeholder="np. Jan"
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white dark:bg-slate-700 dark:text-slate-100 ${
                          errors.firstName ? 'border-red-300 dark:border-red-600' : 'border-slate-300 dark:border-slate-600'
                        }`}
                      />
                      {errors.firstName && (
                        <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        Nazwisko *
                      </label>
                      <input
                        type="text"
                        name="lastName"
                        id="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                        placeholder="np. Kowalski"
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white dark:bg-slate-700 dark:text-slate-100 ${
                          errors.lastName ? 'border-red-300 dark:border-red-600' : 'border-slate-300 dark:border-slate-600'
                        }`}
                      />
                      {errors.lastName && (
                        <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        Telefon
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        id="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="np. 500 600 700"
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-slate-300 text-gray-900 bg-white dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"
                      />
                    </div>

                    <div>
                      <label htmlFor="brandNumber" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        Numer służbowy
                      </label>
                      <input
                        type="text"
                        name="brandNumber"
                        id="brandNumber"
                        value={formData.brandNumber}
                        onChange={handleChange}
                        placeholder="np. ID-1234"
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-slate-300 text-gray-900 bg-white dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"
                      />
                    </div>

                    <div>
                      <label htmlFor="departmentId" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        Departament *
                      </label>
                      <select
                        name="departmentId"
                        id="departmentId"
                        value={formData.departmentId}
                        onChange={handleChange}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white dark:bg-slate-700 dark:text-slate-100 ${
                          errors.departmentId ? 'border-red-300 dark:border-red-600' : 'border-slate-300 dark:border-slate-600'
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
                      <label htmlFor="positionId" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        Stanowisko *
                      </label>
                      <select
                        name="positionId"
                        id="positionId"
                        value={formData.positionId}
                        onChange={handleChange}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white dark:bg-slate-700 dark:text-slate-100 ${
                          errors.positionId ? 'border-red-300 dark:border-red-600' : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        <option value="">Wybierz stanowisko</option>
                        {positions.map(pos => (
                          <option key={pos.id} value={pos.id}>
                            {pos.name}
                          </option>
                        ))}
                      </select>
                      {errors.positionId && (
                        <p className="mt-1 text-sm text-red-600">{errors.positionId}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        Status
                      </label>
                      <select
                        name="status"
                        id="status"
                        value={formData.status}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-slate-300 text-gray-900 bg-white dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"
                      >
                        <option value="active">Aktywny</option>
                        <option value="inactive">Nieaktywny</option>
                        <option value="suspended">Zawieszony</option>
                      </select>
                    </div>
                  </div>

                  {errors.submit && (
                    <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                      <p className="text-sm text-red-600 dark:text-red-400">{errors.submit}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-slate-800 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Zapisywanie...' : 'Zapisz'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-slate-600 shadow-sm px-4 py-2 bg-white dark:bg-slate-700 text-base font-medium text-gray-700 dark:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Anuluj
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EmployeeModal;
import React, { useState, useEffect } from 'react';
import api from '../api';
import { AUDIT_ACTIONS } from '../constants';
import { toast } from 'react-toastify';
import ConfirmationModal from './ConfirmationModal';
import { useLanguage } from '../contexts/LanguageContext';

// Komponent dziennika audytu
function AuditLogScreen({ user }) {
  const { t } = useLanguage();
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });
  const [filters, setFilters] = useState({
    action: 'all',
    username: '',
    startDate: '',
    endDate: ''
  });

  const canManageAuditLogs = user?.role === 'administrator';
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const response = await api.getAuditLogs({
        page: pagination.page,
        limit: pagination.limit,
        ...filters
      });
      
      if (response.logs) {
        setAuditLogs(response.logs);
        setPagination(prev => ({
          ...prev,
          total: response.pagination.total,
          totalPages: response.pagination.totalPages
        }));
        setError(null);
      } else {
        setError('Nie udało się pobrać dziennika audytu');
      }
    } catch (error) {
      console.error('Błąd podczas pobierania dziennika audytu:', error);
      setError('Nie udało się pobrać dziennika audytu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [pagination.page, filters]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('pl-PL');
  };

  const getActionLabel = (action) => {
    return AUDIT_ACTIONS[action] || action;
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleDeleteAuditLogs = () => {
    if (!canManageAuditLogs) {
      toast.error('Brak uprawnień administratora do usunięcia logów');
      return;
    }
    setShowDeleteModal(true);
  };

  const handleConfirmDeleteAuditLogs = async () => {
    try {
      setDeleteLoading(true);
      await api.delete('/api/audit');
      toast.success('Logi audytu zostały usunięte');
      setShowDeleteModal(false);
      // Odśwież listę po usunięciu
      setPagination(prev => ({ ...prev, page: 1 }));
      await fetchAuditLogs();
    } catch (err) {
      console.error('Błąd podczas usuwania logów audytu:', err);
      toast.error('Błąd podczas usuwania logów audytu');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-slate-900 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white mb-2 transition-colors duration-200">Dziennik audytu</h1>
          <p className="text-slate-600 dark:text-gray-400 transition-colors duration-200">Historia wszystkich działań w systemie</p>
        </div>
        {canManageAuditLogs ? (
          <button
            onClick={handleDeleteAuditLogs}
            className="bg-red-600 dark:bg-red-700 text-white px-4 py-2 rounded-lg hover:bg-red-700 dark:hover:bg-red-800"
          >
            Usuń logi
          </button>
        ) : null}
      </div>

      {/* Filtry */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6 mb-6 transition-colors duration-200">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2 transition-colors duration-200">Akcja</label>
            <select
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-slate-900 dark:text-white transition-colors duration-200"
            >
              <option value="all">Wszystkie</option>
              {Object.entries(AUDIT_ACTIONS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2 transition-colors duration-200">Użytkownik</label>
            <input
              type="text"
              value={filters.username}
              onChange={(e) => handleFilterChange('username', e.target.value)}
              placeholder="Nazwa użytkownika"
              className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-400 transition-colors duration-200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2 transition-colors duration-200">Data od</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-slate-900 dark:text-white transition-colors duration-200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2 transition-colors duration-200">Data do</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-slate-900 dark:text-white transition-colors duration-200"
            />
          </div>
        </div>
      </div>

      {/* Lista dziennika */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 transition-colors duration-200">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-slate-600 dark:text-gray-400 transition-colors duration-200">Ładowanie dziennika audytu...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-red-600 dark:text-red-400 transition-colors duration-200">{error}</p>
            <button
              onClick={fetchAuditLogs}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg transition-colors duration-200"
            >
              Spróbuj ponownie
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-gray-700 border-b border-slate-200 dark:border-gray-600 transition-colors duration-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-300 uppercase tracking-wider transition-colors duration-200 hidden sm:table-cell">
                      Data i czas
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-300 uppercase tracking-wider transition-colors duration-200 hidden sm:table-cell">
                      Akcja
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-300 uppercase tracking-wider transition-colors duration-200 hidden sm:table-cell">
                      Użytkownik
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-300 uppercase tracking-wider transition-colors duration-200">
                      Szczegóły
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-300 uppercase tracking-wider transition-colors duration-200 hidden sm:table-cell">
                      IP
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-slate-200 dark:divide-gray-600 transition-colors duration-200">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors duration-200">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-white transition-colors duration-200">
                        {formatDate(log.timestamp)}
                        <div className="mt-1 text-xs text-slate-500 dark:text-gray-400 sm:hidden">
                          <div className="flex items-center gap-1">
                            Akcja:
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                              {getActionLabel(log.action)}
                            </span>
                          </div>
                          <div>Użytkownik: {log.username}</div>
                          <div>IP: {log.ip_address || '-'}</div>
                          <div className="truncate">Szczegóły: {log.details}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 transition-colors duration-200">
                          {getActionLabel(log.action)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-white transition-colors duration-200 hidden sm:table-cell">
                        {log.username}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-900 dark:text-white max-w-xs truncate transition-colors duration-200 hidden sm:table-cell">
                        {log.details}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-gray-400 transition-colors duration-200 hidden sm:table-cell">
                        {log.ip_address}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginacja */}
            {pagination.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-200 dark:border-gray-600 flex items-center justify-between transition-colors duration-200">
                <div className="text-sm text-slate-700 dark:text-gray-300 transition-colors duration-200">
                  Strona {pagination.page} z {pagination.totalPages} 
                  ({pagination.total} rekordów)
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="px-3 py-1 text-sm border border-slate-300 dark:border-gray-600 rounded hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800 text-slate-900 dark:text-white transition-colors duration-200"
                  >
                    Poprzednia
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page === pagination.totalPages}
                    className="px-3 py-1 text-sm border border-slate-300 dark:border-gray-600 rounded hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800 text-slate-900 dark:text-white transition-colors duration-200"
                  >
                    Następna
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDeleteAuditLogs}
        title="Usuń logi audytu"
        message="Czy na pewno chcesz usunąć wszystkie logi audytu? Tej operacji nie można cofnąć."
        confirmText="Usuń logi"
        cancelText={t('common.cancel')}
        type="danger"
        loading={deleteLoading}
      />
    </div>
  );
}

export default AuditLogScreen;
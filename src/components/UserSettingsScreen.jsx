import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { CheckIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import api from '../api';
import { toast } from 'react-toastify';

function UserSettingsScreen({ user }) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('security');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const tabs = [
    { id: 'security', name: t('userSettings.tabs.security'), icon: '🔐' }
  ];

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error(t('userSettings.errors.fillAllFields'));
      return;
    }
    if (newPassword.length < 6) {
      toast.error(t('userSettings.errors.passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('userSettings.errors.passwordMismatch'));
      return;
    }

    setLoading(true);
    try {
      // Weryfikacja bieżącego hasła przez próbę logowania
      await api.post('/api/login', { username: user.username, password: currentPassword });

      // Aktualizacja hasła użytkownika
      await api.put(`/api/users/${user.id}`, {
        username: user.username,
        role: user.role,
        full_name: user.full_name,
        password: newPassword
      });

      setSaved(true);
      toast.success(t('userSettings.toast.passwordChanged'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      const msg = error?.message || t('userSettings.errors.changeFailed');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const renderSecurityTab = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">{t('userSettings.changePassword.title')}</h3>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('userSettings.changePassword.username')}</label>
            <input
              type="text"
              id="username"
              name="username"
              value={user?.username || ''}
              readOnly
              autoComplete="username"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-gray-100 dark:bg-gray-900 dark:border-gray-700 dark:text-white cursor-not-allowed"
            />
          </div>
          <div>
            <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('userSettings.changePassword.current')}</label>
            <input
              type="password"
              id="current-password"
              name="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
              placeholder="Wpisz aktualne hasło"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('userSettings.changePassword.new')}</label>
            <input
              type="password"
              id="new-password"
              name="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
              placeholder="Wpisz nowe hasło"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('userSettings.changePassword.confirm')}</label>
            <input
              type="password"
              id="confirm-password"
              name="confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
              placeholder="Powtórz nowe hasło"
              autoComplete="new-password"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 dark:bg-indigo-700 hover:bg-indigo-700 dark:hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {t('common.saving')}
                </>
              ) : (
                <>
                  <CheckIcon className="w-4 h-4 mr-2" aria-hidden="true" />
                  {t('common.saveChanges')}
                </>
              )}
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400">{t('userSettings.changePassword.notice')}</span>
          </div>
        </form>
      </div>
    </div>
  );

  const activeTabMeta = tabs.find((t) => t.id === activeTab) || tabs[0];

  return (
    <div className="space-y-8 p-6 bg-gray-50 dark:bg-gray-900 min-h-screen transition-colors duration-200">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('userSettings.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">{t('userSettings.subtitle')}</p>
        </div>
      </div>

      {saved && (
        <div className="rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 transition-colors duration-200">
          <div className="flex">
            <div className="flex-shrink-0">
              <CheckCircleIcon className="h-5 w-5 text-green-400 dark:text-green-300" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800 dark:text-green-300">{t('userSettings.toast.passwordSaved')}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl border border-gray-100 dark:border-gray-700 transition-colors duration-200">
        <div className="grid grid-cols-1 md:grid-cols-12">
          <aside className="md:col-span-3 md:sticky md:top-0 md:self-start md:max-h-[80vh] md:overflow-y-auto border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700 p-3 md:p-4">
            <nav className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible" aria-label="Tabs">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`${
                      isActive
                        ? 'bg-indigo-50 dark:bg-slate-700 text-indigo-700 dark:text-indigo-300'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                    } w-full text-left px-3 py-2 rounded-md transition-colors flex items-center gap-2`}
                  >
                    <span aria-hidden="true">{tab.icon}</span>
                    <span className="text-sm font-medium">{tab.name}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="md:col-span-9 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <span aria-hidden="true">{activeTabMeta.icon}</span>
                {activeTabMeta.name}
              </h2>
            </div>
              {activeTab === 'security' && renderSecurityTab()}
          </main>
        </div>
      </div>
    </div>
  );
}

export default UserSettingsScreen;
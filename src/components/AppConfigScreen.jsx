import React, { useState, useEffect } from 'react';

const AppConfigScreen = ({ apiClient }) => {
  const [config, setConfig] = useState({
    general: {
      appName: 'System Zarządzania',
      companyName: 'Moja Firma',
      timezone: 'Europe/Warsaw',
      language: 'pl',
      dateFormat: 'DD/MM/YYYY',
      currency: 'PLN'
    },
    security: {
      sessionTimeout: 30,
      passwordMinLength: 8,
      requireSpecialChars: true,
      requireNumbers: true,
      maxLoginAttempts: 5,
      lockoutDuration: 15
    },
    notifications: {
      emailNotifications: true,
      smsNotifications: false,
      pushNotifications: true,
      auditLogRetention: 90,
      backupFrequency: 'daily'
    },
    features: {
      enableAuditLog: true,
      enableReports: true,
      enableMobileApp: true,
      enableApiAccess: false,
      enableDataExport: true
    }
  });

  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      // W rzeczywistej aplikacji pobierałbyś konfigurację z API
      // const response = await apiClient.get('/config');
      // setConfig(response.data);
    } catch (error) {
      console.error('Błąd podczas ładowania konfiguracji:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      // W rzeczywistej aplikacji zapisałbyś konfigurację przez API
      // await apiClient.put('/config', config);
      
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Błąd podczas zapisywania konfiguracji:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = (section, key, value) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  const tabs = [
    { id: 'general', name: 'Ogólne', icon: '⚙️' },
    { id: 'security', name: 'Bezpieczeństwo', icon: '🔒' },
    { id: 'notifications', name: 'Powiadomienia', icon: '🔔' },
    { id: 'features', name: 'Funkcje', icon: '🎛️' }
  ];

  const renderGeneralTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Ustawienia ogólne</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Nazwa aplikacji
            </label>
            <input
              type="text"
              value={config.general.appName}
              onChange={(e) => updateConfig('general', 'appName', e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Nazwa firmy
            </label>
            <input
              type="text"
              value={config.general.companyName}
              onChange={(e) => updateConfig('general', 'companyName', e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Strefa czasowa
            </label>
            <select
              value={config.general.timezone}
              onChange={(e) => updateConfig('general', 'timezone', e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option value="Europe/Warsaw">Europa/Warszawa</option>
              <option value="Europe/London">Europa/Londyn</option>
              <option value="America/New_York">Ameryka/Nowy Jork</option>
              <option value="Asia/Tokyo">Azja/Tokio</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Język
            </label>
            <select
              value={config.general.language}
              onChange={(e) => updateConfig('general', 'language', e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option value="pl">Polski</option>
              <option value="en">English</option>
              <option value="de">Deutsch</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Format daty
            </label>
            <select
              value={config.general.dateFormat}
              onChange={(e) => updateConfig('general', 'dateFormat', e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Waluta
            </label>
            <select
              value={config.general.currency}
              onChange={(e) => updateConfig('general', 'currency', e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option value="PLN">PLN</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSecurityTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Ustawienia bezpieczeństwa</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Timeout sesji (minuty)
            </label>
            <input
              type="number"
              value={config.security.sessionTimeout}
              onChange={(e) => updateConfig('security', 'sessionTimeout', parseInt(e.target.value))}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Minimalna długość hasła
            </label>
            <input
              type="number"
              value={config.security.passwordMinLength}
              onChange={(e) => updateConfig('security', 'passwordMinLength', parseInt(e.target.value))}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Maksymalna liczba prób logowania
            </label>
            <input
              type="number"
              value={config.security.maxLoginAttempts}
              onChange={(e) => updateConfig('security', 'maxLoginAttempts', parseInt(e.target.value))}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Czas blokady (minuty)
            </label>
            <input
              type="number"
              value={config.security.lockoutDuration}
              onChange={(e) => updateConfig('security', 'lockoutDuration', parseInt(e.target.value))}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="flex items-center">
            <input
              id="requireSpecialChars"
              type="checkbox"
              checked={config.security.requireSpecialChars}
              onChange={(e) => updateConfig('security', 'requireSpecialChars', e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="requireSpecialChars" className="ml-2 block text-sm text-gray-900">
              Wymagaj znaków specjalnych w haśle
            </label>
          </div>

          <div className="flex items-center">
            <input
              id="requireNumbers"
              type="checkbox"
              checked={config.security.requireNumbers}
              onChange={(e) => updateConfig('security', 'requireNumbers', e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="requireNumbers" className="ml-2 block text-sm text-gray-900">
              Wymagaj cyfr w haśle
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  const renderNotificationsTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Ustawienia powiadomień</h3>
        
        <div className="space-y-4">
          <div className="flex items-center">
            <input
              id="emailNotifications"
              type="checkbox"
              checked={config.notifications.emailNotifications}
              onChange={(e) => updateConfig('notifications', 'emailNotifications', e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="emailNotifications" className="ml-2 block text-sm text-gray-900">
              Powiadomienia email
            </label>
          </div>

          <div className="flex items-center">
            <input
              id="smsNotifications"
              type="checkbox"
              checked={config.notifications.smsNotifications}
              onChange={(e) => updateConfig('notifications', 'smsNotifications', e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="smsNotifications" className="ml-2 block text-sm text-gray-900">
              Powiadomienia SMS
            </label>
          </div>

          <div className="flex items-center">
            <input
              id="pushNotifications"
              type="checkbox"
              checked={config.notifications.pushNotifications}
              onChange={(e) => updateConfig('notifications', 'pushNotifications', e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="pushNotifications" className="ml-2 block text-sm text-gray-900">
              Powiadomienia push
            </label>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Przechowywanie logów audytu (dni)
            </label>
            <input
              type="number"
              value={config.notifications.auditLogRetention}
              onChange={(e) => updateConfig('notifications', 'auditLogRetention', parseInt(e.target.value))}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Częstotliwość kopii zapasowych
            </label>
            <select
              value={config.notifications.backupFrequency}
              onChange={(e) => updateConfig('notifications', 'backupFrequency', e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option value="daily">Codziennie</option>
              <option value="weekly">Tygodniowo</option>
              <option value="monthly">Miesięcznie</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  const renderFeaturesTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Funkcje systemu</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="enableAuditLog" className="text-sm font-medium text-gray-900">
                Dziennik audytu
              </label>
              <p className="text-sm text-gray-500">Rejestrowanie wszystkich działań użytkowników</p>
            </div>
            <input
              id="enableAuditLog"
              type="checkbox"
              checked={config.features.enableAuditLog}
              onChange={(e) => updateConfig('features', 'enableAuditLog', e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="enableReports" className="text-sm font-medium text-gray-900">
                Raporty
              </label>
              <p className="text-sm text-gray-500">Generowanie raportów i analiz</p>
            </div>
            <input
              id="enableReports"
              type="checkbox"
              checked={config.features.enableReports}
              onChange={(e) => updateConfig('features', 'enableReports', e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="enableMobileApp" className="text-sm font-medium text-gray-900">
                Aplikacja mobilna
              </label>
              <p className="text-sm text-gray-500">Dostęp przez urządzenia mobilne</p>
            </div>
            <input
              id="enableMobileApp"
              type="checkbox"
              checked={config.features.enableMobileApp}
              onChange={(e) => updateConfig('features', 'enableMobileApp', e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="enableApiAccess" className="text-sm font-medium text-gray-900">
                Dostęp API
              </label>
              <p className="text-sm text-gray-500">Zewnętrzny dostęp przez API</p>
            </div>
            <input
              id="enableApiAccess"
              type="checkbox"
              checked={config.features.enableApiAccess}
              onChange={(e) => updateConfig('features', 'enableApiAccess', e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="enableDataExport" className="text-sm font-medium text-gray-900">
                Eksport danych
              </label>
              <p className="text-sm text-gray-500">Możliwość eksportu danych do plików</p>
            </div>
            <input
              id="enableDataExport"
              type="checkbox"
              checked={config.features.enableDataExport}
              onChange={(e) => updateConfig('features', 'enableDataExport', e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return renderGeneralTab();
      case 'security':
        return renderSecurityTab();
      case 'notifications':
        return renderNotificationsTab();
      case 'features':
        return renderFeaturesTab();
      default:
        return renderGeneralTab();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Konfiguracja aplikacji</h1>
          <p className="mt-1 text-sm text-gray-500">
            Zarządzaj ustawieniami i konfiguracją systemu
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Zapisywanie...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Zapisz zmiany
            </>
          )}
        </button>
      </div>

      {/* Success Message */}
      {saved && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">
                Konfiguracja została zapisana pomyślnie!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm flex items-center`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default AppConfigScreen;
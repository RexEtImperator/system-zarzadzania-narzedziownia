import React, { useState, useEffect } from 'react';
import { ArchiveBoxIcon, CheckIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import DepartmentManagementScreen from './DepartmentManagementScreen';
import PositionManagementScreen from './PositionManagementScreen';
import UserManagementScreen from './UserManagementScreen';

const AppConfigScreen = ({ apiClient, user }) => {
  const MIN_LOGO_WIDTH = 64;
  const MIN_LOGO_HEIGHT = 64;
  const MAX_LOGO_WIDTH = 1024;
  const MAX_LOGO_HEIGHT = 1024;
  const [config, setConfig] = useState({
    general: {
      appName: 'System Zarządzania',
      companyName: 'Moja Firma',
      timezone: 'Europe/Warsaw',
      language: 'pl',
      dateFormat: 'DD/MM/YYYY'
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
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoTs, setLogoTs] = useState(Date.now());
  const [logoHistory, setLogoHistory] = useState([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backups, setBackups] = useState([]);
  const [lastBackupFile, setLastBackupFile] = useState(null);
  const [lastBackupAt, setLastBackupAt] = useState(null);
  // Kategorie narzędzi (konfiguracja)
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [catNewName, setCatNewName] = useState('');
  const [catEditingId, setCatEditingId] = useState(null);
  const [catEditingName, setCatEditingName] = useState('');

  useEffect(() => {
    loadConfig();
    loadLogoHistory();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      // Pobierz ustawienia ogólne z API
      const general = await apiClient.get('/api/config/general');
      setConfig(prev => ({
        ...prev,
        general: {
          appName: general.appName || prev.general.appName,
          companyName: general.companyName ?? prev.general.companyName,
          timezone: general.timezone || prev.general.timezone,
          language: general.language || prev.general.language,
          dateFormat: general.dateFormat || prev.general.dateFormat
        },
        notifications: {
          ...prev.notifications,
          backupFrequency: general.backupFrequency || prev.notifications.backupFrequency
        }
      }));
      setLastBackupAt(general.lastBackupAt || null);
    } catch (error) {
      console.error('Błąd podczas ładowania konfiguracji:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLogoHistory = async () => {
    try {
      const data = await apiClient.get('/api/config/logo/history');
      setLogoHistory(Array.isArray(data?.versions) ? data.versions : []);
    } catch (err) {
      console.warn('Nie udało się pobrać historii logo:', err?.message || err);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      // Zapisz ustawienia ogólne przez API
      await apiClient.put('/api/config/general', {
        appName: config.general.appName,
        companyName: config.general.companyName,
        timezone: config.general.timezone,
        language: config.general.language,
        dateFormat: config.general.dateFormat,
        backupFrequency: config.notifications.backupFrequency
      });
      
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
    { id: 'users', name: 'Użytkownicy', icon: '👥' },
    { id: 'features', name: 'Funkcje', icon: '🎛️' },
    { id: 'departments', name: 'Działy', icon: '🏢' },
    { id: 'positions', name: 'Stanowiska', icon: '👔' },
    { id: 'categories', name: 'Kategorie', icon: '🏷️' },
    { id: 'backup', name: 'Backup', icon: '💾' }
  ];

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setLogoFile(null);
      setLogoPreview(null);
      return;
    }
    if (file.type !== 'image/png') {
      toast.error('Dozwolone są tylko pliki PNG');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Plik jest za duży (maks. 2MB)');
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    // Walidacja wymiarów na froncie
    const img = new Image();
    img.onload = () => {
      const w = img.width;
      const h = img.height;
      if (
        w < MIN_LOGO_WIDTH || h < MIN_LOGO_HEIGHT ||
        w > MAX_LOGO_WIDTH || h > MAX_LOGO_HEIGHT
      ) {
        toast.error(`Wymiary logo poza zakresem: min ${MIN_LOGO_WIDTH}x${MIN_LOGO_HEIGHT}, max ${MAX_LOGO_WIDTH}x${MAX_LOGO_HEIGHT}. Otrzymano ${w}x${h}`);
        URL.revokeObjectURL(previewUrl);
        return;
      }
      setLogoFile(file);
      setLogoPreview(previewUrl);
    };
    img.onerror = () => {
      toast.error('Nieprawidłowy plik obrazu');
      URL.revokeObjectURL(previewUrl);
    };
    img.src = previewUrl;
  };

  const handleLogoUpload = async () => {
    if (!logoFile) {
      toast.error('Wybierz plik logo (PNG)');
      return;
    }
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('logo', logoFile);
      const resp = await apiClient.postForm('/api/config/logo', formData);
      toast.success('Logo zostało zaktualizowane');
      setLogoTs((resp && resp.timestamp) || Date.now());
      setLogoFile(null);
      setLogoPreview(null);
      // Odśwież historię po udanym uploadzie
      loadLogoHistory();
    } catch (error) {
      let msg = 'Błąd uploadu logo';
      if (error && typeof error.message === 'string') {
        try {
          const parsed = JSON.parse(error.message);
          msg = parsed.error || parsed.message || msg;
        } catch (_) {
          msg = error.message || msg;
        }
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoRollback = async (filename) => {
    if (!filename) return;
    try {
      setLoading(true);
      await apiClient.post('/api/config/logo/rollback', { filename });
      toast.success('Przywrócono wybraną wersję logo');
      setLogoTs(Date.now());
    } catch (error) {
      let msg = 'Błąd przywracania wersji';
      if (error && typeof error.message === 'string') {
        try { const parsed = JSON.parse(error.message); msg = parsed.error || parsed.message || msg; } catch (_) { msg = error.message || msg; }
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const renderGeneralTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Ustawienia ogólne</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Nazwa aplikacji
            </label>
            <input
              type="text"
              value={config.general.appName}
              onChange={(e) => updateConfig('general', 'appName', e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Nazwa firmy
            </label>
            <input
              type="text"
              value={config.general.companyName}
              onChange={(e) => updateConfig('general', 'companyName', e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Strefa czasowa
            </label>
            <select
              value={config.general.timezone}
              onChange={(e) => updateConfig('general', 'timezone', e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="Europe/Warsaw">Europa/Warszawa</option>
              <option value="Europe/London">Europa/Londyn</option>
              <option value="America/New_York">Ameryka/Nowy Jork</option>
              <option value="Asia/Tokyo">Azja/Tokio</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Język
            </label>
            <select
              value={config.general.language}
              onChange={(e) => updateConfig('general', 'language', e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="pl">Polski</option>
              <option value="en">English</option>
              <option value="de">Deutsch</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Format daty
            </label>
            <select
              value={config.general.dateFormat}
              onChange={(e) => updateConfig('general', 'dateFormat', e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>
        </div>
        {/* Logo aplikacji */}
        <div className="mt-6">
          <h4 className="text-md font-medium text-gray-900 dark:text-gray-200 mb-3">Logo aplikacji</h4>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 items-start">
            <div>
              <div className="border rounded-lg bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 p-4 flex items-center justify-center">
                <img
                  src={(logoPreview || `/logo.png?ts=${logoTs}`)}
                  alt="Aktualne logo"
                  className="h-24 object-contain"
                />
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Dozwolone wymiary: min {MIN_LOGO_WIDTH}x{MIN_LOGO_HEIGHT}, max {MAX_LOGO_WIDTH}x{MAX_LOGO_HEIGHT}. Aby zobaczyć nowe logo w całej aplikacji, odśwież stronę.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Prześlij plik PNG (max 2MB)</label>
              <input
                type="file"
                accept="image/png"
                onChange={handleLogoChange}
                className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleLogoUpload}
                  disabled={loading || !logoFile}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  Zapisz nowe logo
                </button>
                {logoFile && (
                  <button
                    type="button"
                    onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                    className="inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 border-slate-300 dark:border-slate-600"
                  >
                    Anuluj
                  </button>
                )}
              </div>
            </div>
          </div>
          {/* Historia wersji logo */}
          <div className="mt-6">
            <h5 className="text-sm font-medium text-gray-900 dark:text-gray-200 mb-2">Historia logo</h5>
            {logoHistory.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">Brak zapisanych wersji logo.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {logoHistory.map(v => (
                  <div key={v.filename} className="border rounded-lg p-2 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600">
                    <img src={`${v.url}`} alt={v.filename} className="h-16 object-contain mx-auto" />
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{v.filename}</span>
                      <button
                        type="button"
                        onClick={() => handleLogoRollback(v.filename)}
                        className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-600 text-gray-700 dark:text-gray-200 hover:bg-slate-200 dark:hover:bg-slate-500"
                      >
                        Przywróć
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderSecurityTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Ustawienia bezpieczeństwa</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Timeout sesji (minuty)
            </label>
            <input
              type="number"
              value={config.security.sessionTimeout}
              onChange={(e) => updateConfig('security', 'sessionTimeout', parseInt(e.target.value))}
              className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Minimalna długość hasła
            </label>
            <input
              type="number"
              value={config.security.passwordMinLength}
              onChange={(e) => updateConfig('security', 'passwordMinLength', parseInt(e.target.value))}
              className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Maksymalna liczba prób logowania
            </label>
            <input
              type="number"
              value={config.security.maxLoginAttempts}
              onChange={(e) => updateConfig('security', 'maxLoginAttempts', parseInt(e.target.value))}
              className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Czas blokady (minuty)
            </label>
            <input
              type="number"
              value={config.security.lockoutDuration}
              onChange={(e) => updateConfig('security', 'lockoutDuration', parseInt(e.target.value))}
              className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
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
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded"
            />
            <label htmlFor="requireSpecialChars" className="ml-2 block text-sm text-gray-900 dark:text-gray-200">
              Wymagaj znaków specjalnych w haśle
            </label>
          </div>

          <div className="flex items-center">
            <input
              id="requireNumbers"
              type="checkbox"
              checked={config.security.requireNumbers}
              onChange={(e) => updateConfig('security', 'requireNumbers', e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded"
            />
            <label htmlFor="requireNumbers" className="ml-2 block text-sm text-gray-900 dark:text-gray-200">
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
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Ustawienia powiadomień</h3>
        
        <div className="space-y-4">
          <div className="flex items-center">
            <input
              id="emailNotifications"
              type="checkbox"
              checked={config.notifications.emailNotifications}
              onChange={(e) => updateConfig('notifications', 'emailNotifications', e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded"
            />
            <label htmlFor="emailNotifications" className="ml-2 block text-sm text-gray-900 dark:text-gray-200">
              Powiadomienia email
            </label>
          </div>

          <div className="flex items-center">
            <input
              id="smsNotifications"
              type="checkbox"
              checked={config.notifications.smsNotifications}
              onChange={(e) => updateConfig('notifications', 'smsNotifications', e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded"
            />
            <label htmlFor="smsNotifications" className="ml-2 block text-sm text-gray-900 dark:text-gray-200">
              Powiadomienia SMS
            </label>
          </div>

          <div className="flex items-center">
            <input
              id="pushNotifications"
              type="checkbox"
              checked={config.notifications.pushNotifications}
              onChange={(e) => updateConfig('notifications', 'pushNotifications', e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded"
            />
            <label htmlFor="pushNotifications" className="ml-2 block text-sm text-gray-900 dark:text-gray-200">
              Powiadomienia push
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  const renderFeaturesTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Funkcje systemu</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="enableAuditLog" className="text-sm font-medium text-gray-900 dark:text-gray-200">
                Dziennik audytu
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400">Rejestrowanie wszystkich działań użytkowników</p>
            </div>
            <input
              id="enableAuditLog"
              type="checkbox"
              checked={config.features.enableAuditLog}
              onChange={(e) => updateConfig('features', 'enableAuditLog', e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="enableReports" className="text-sm font-medium text-gray-900 dark:text-gray-200">
                Raporty
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400">Generowanie raportów i analiz</p>
            </div>
            <input
              id="enableReports"
              type="checkbox"
              checked={config.features.enableReports}
              onChange={(e) => updateConfig('features', 'enableReports', e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="enableMobileApp" className="text-sm font-medium text-gray-900 dark:text-gray-200">
                Aplikacja mobilna
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400">Dostęp przez urządzenia mobilne</p>
            </div>
            <input
              id="enableMobileApp"
              type="checkbox"
              checked={config.features.enableMobileApp}
              onChange={(e) => updateConfig('features', 'enableMobileApp', e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="enableApiAccess" className="text-sm font-medium text-gray-900 dark:text-gray-200">
                Dostęp API
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400">Zewnętrzny dostęp przez API</p>
            </div>
            <input
              id="enableApiAccess"
              type="checkbox"
              checked={config.features.enableApiAccess}
              onChange={(e) => updateConfig('features', 'enableApiAccess', e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="enableDataExport" className="text-sm font-medium text-gray-900 dark:text-gray-200">
                Eksport danych
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400">Możliwość eksportu danych do plików</p>
            </div>
            <input
              id="enableDataExport"
              type="checkbox"
              checked={config.features.enableDataExport}
              onChange={(e) => updateConfig('features', 'enableDataExport', e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded"
            />
          </div>

          {config.features.enableDataExport && (
            <div className="mt-6">
              <h4 className="text-md font-medium text-gray-900 dark:text-gray-200 mb-3">Inne ustawienia</h4>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Przechowywanie logów audytu (dni)
                  </label>
                  <input
                    type="number"
                    value={config.notifications.auditLogRetention}
                    onChange={(e) => updateConfig('notifications', 'auditLogRetention', parseInt(e.target.value))}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Częstotliwość kopii zapasowych
                  </label>
                  <select
                    value={config.notifications.backupFrequency}
                    onChange={(e) => updateConfig('notifications', 'backupFrequency', e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  >
                    <option value="daily">Codziennie</option>
                    <option value="weekly">Tygodniowo</option>
                    <option value="monthly">Miesięcznie</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const formatDateTime = (dt) => {
    if (!dt) return '-';
    try {
      const d = new Date(dt);
      if (isNaN(d.getTime())) return dt;
      return d.toLocaleString('pl-PL');
    } catch {
      return dt;
    }
  };

  const loadBackups = async () => {
    try {
      setBackupLoading(true);
      const resp = await apiClient.get('/api/backup/list');
      const files = Array.isArray(resp?.backups) ? resp.backups.map(b => b.file) : [];
      setBackups(files);
      // Posortuj nazwy plików malejąco (database-YYYYMMDD-HHMMSS.db)
      const sorted = files.slice().sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
      setLastBackupFile(sorted[0] || null);
    } catch (err) {
      // Brak uprawnień (403) lub inny błąd – pokaż tylko lastBackupAt z configu
      console.warn('Nie udało się pobrać listy backupów:', err?.message || err);
    } finally {
      setBackupLoading(false);
    }
  };

  useEffect(() => {
    // Po wczytaniu konfiguracji spróbuj pobrać listę backupów
    loadBackups();
  }, []);

  const runBackup = async () => {
    try {
      setBackupLoading(true);
      await apiClient.post('/api/backup/run', {});
      toast.success('Kopia zapasowa wykonana');
      // Odśwież informacje po udanym backupie
      await loadConfig();
      await loadBackups();
    } catch (err) {
      const msg = err?.message || 'Nie udało się wykonać kopii zapasowej';
      toast.error(msg);
    } finally {
      setBackupLoading(false);
    }
  };

  const renderBackupTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Kopie zapasowe bazy danych</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
            <div className="text-sm text-gray-700 dark:text-gray-300">Ostatnia kopia (z konfiguracji)</div>
            <div className="mt-1 text-base font-medium text-gray-900 dark:text-white">{formatDateTime(lastBackupAt)}</div>
          </div>
          <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
            <div className="text-sm text-gray-700 dark:text-gray-300">Ostatni plik w folderze backups</div>
            <div className="mt-1 text-base font-medium text-gray-900 dark:text-white">{lastBackupFile || '-'}</div>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={runBackup}
            disabled={backupLoading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 dark:bg-indigo-700 hover:bg-indigo-700 dark:hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {backupLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Trwa wykonywanie kopii...
              </>
            ) : (
              <>
                <ArchiveBoxIcon className="w-4 h-4 mr-2" aria-hidden="true" />
                Wykonaj kopię zapasową
              </>
            )}
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">Wymagane uprawnienia administratora</span>
        </div>
      </div>
    </div>
  );

  // Kategorie – ładowanie i operacje
  const loadCategories = async () => {
    try {
      setCategoriesLoading(true);
      const data = await apiClient.get('/api/categories/stats');
      const list = Array.isArray(data) ? data.map(c => ({ id: c.id, name: c.name, tool_count: c.tool_count ?? 0 })) : [];
      setCategories(list);
    } catch (err) {
      console.error('Nie udało się pobrać kategorii:', err);
      // Fallback: puste lub domyślne
      setCategories([
        { id: 1, name: 'Ręczne', tool_count: 0 },
        { id: 2, name: 'Elektronarzędzia', tool_count: 0 },
        { id: 3, name: 'Spawalnicze', tool_count: 0 },
        { id: 4, name: 'Pneumatyczne', tool_count: 0 },
        { id: 5, name: 'Akumulatorowe', tool_count: 0 }
      ]);
    } finally {
      setCategoriesLoading(false);
    }
  };

  useEffect(() => {
    // Załaduj kategorie przy pierwszym renderze ekranu konfiguracyjnego
    loadCategories();
  }, []);

  const addCategory = async () => {
    const name = (catNewName || '').trim();
    if (!name) {
      toast.error('Podaj nazwę kategorii');
      return;
    }
    try {
      const created = await apiClient.post('/api/categories', { name });
      setCategories(prev => [...prev, { id: created.id, name: created.name }]);
      setCatNewName('');
      toast.success('Dodano kategorię');
    } catch (err) {
      const msg = err?.message || 'Nie udało się dodać kategorii';
      toast.error(msg);
    }
  };

  const startEditCategory = (cat) => {
    setCatEditingId(cat.id);
    setCatEditingName(cat.name);
  };

  const cancelEditCategory = () => {
    setCatEditingId(null);
    setCatEditingName('');
  };

  const saveEditCategory = async () => {
    const id = catEditingId;
    const name = (catEditingName || '').trim();
    if (!id) return;
    if (!name) {
      toast.error('Nazwa nie może być pusta');
      return;
    }
    try {
      const updated = await apiClient.put(`/api/categories/${id}`, { name });
      setCategories(prev => prev.map(c => c.id === id ? { id, name: updated.name || name } : c));
      cancelEditCategory();
      toast.success('Zaktualizowano kategorię');
    } catch (err) {
      const msg = err?.message || 'Nie udało się zaktualizować kategorii';
      toast.error(msg);
    }
  };

  const deleteCategory = async (cat) => {
    if (!cat?.id) return;
    if (!window.confirm(`Usunąć kategorię „${cat.name}”?`)) return;
    try {
      await apiClient.delete(`/api/categories/${cat.id}`);
      setCategories(prev => prev.filter(c => c.id !== cat.id));
      toast.success('Usunięto kategorię');
    } catch (err) {
      const msg = err?.message || 'Nie udało się usunąć kategorii';
      toast.error(msg);
    }
  };

  const renderCategoriesTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Kategorie narzędzi</h3>
        <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
          <div className="flex items-end gap-2 mb-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nowa kategoria</label>
              <input
                type="text"
                value={catNewName}
                onChange={(e) => setCatNewName(e.target.value)}
                placeholder="np. Ręczne"
                className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
            <button
              type="button"
              onClick={addCategory}
              className="px-4 py-2 rounded-md bg-indigo-600 dark:bg-indigo-700 text-white hover:bg-indigo-700 dark:hover:bg-indigo-800"
            >
              Dodaj
            </button>
          </div>

          {categoriesLoading ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">Ładowanie kategorii...</div>
          ) : categories.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">Brak kategorii</div>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-700">
              {categories.map(cat => (
                <li key={cat.id} className="py-3 flex items-center justify-between">
                  <div className="flex-1">
                    {catEditingId === cat.id ? (
                      <input
                        type="text"
                        value={catEditingName}
                        onChange={(e) => setCatEditingName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                      />
                    ) : (
                      <span className="text-sm text-gray-900 dark:text-white">{cat.name} <span className="text-gray-500 dark:text-gray-400">({cat.tool_count ?? 0})</span></span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {catEditingId === cat.id ? (
                      <>
                        <button
                          type="button"
                          onClick={saveEditCategory}
                          className="px-3 py-1 rounded bg-green-600 dark:bg-green-700 text-white"
                        >Zapisz</button>
                        <button
                          type="button"
                          onClick={cancelEditCategory}
                          className="px-3 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                        >Anuluj</button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEditCategory(cat)}
                          className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 text-sm font-medium"
                        >Edytuj</button>
                        <button
                          type="button"
                          onClick={() => deleteCategory(cat)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium"
                        >Usuń</button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
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
      case 'users':
        return <UserManagementScreen user={user} />;
      case 'features':
        return renderFeaturesTab();
      case 'departments':
        return <DepartmentManagementScreen apiClient={apiClient} />;
      case 'positions':
        return <PositionManagementScreen apiClient={apiClient} />;
      case 'categories':
        return renderCategoriesTab();
      case 'backup':
        return renderBackupTab();
      default:
        return renderGeneralTab();
    }
  };

  // Dane aktywnej zakładki do nagłówka sekcji
  const activeTabMeta = tabs.find((t) => t.id === activeTab) || tabs[0];

  return (
    <div className="space-y-8 p-6 bg-gray-50 dark:bg-gray-900 min-h-screen transition-colors duration-200">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Konfiguracja aplikacji</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
            Zarządzaj ustawieniami i konfiguracją systemu
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 dark:bg-indigo-700 hover:bg-indigo-700 dark:hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Zapisywanie...
            </>
          ) : (
            <>
              <CheckIcon className="w-4 h-4 mr-2" aria-hidden="true" />
              Zapisz zmiany
            </>
          )}
        </button>
      </div>

      {/* Success Message */}
      {saved && (
        <div className="rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 transition-colors duration-200">
          <div className="flex">
            <div className="flex-shrink-0">
              <CheckCircleIcon className="h-5 w-5 text-green-400 dark:text-green-300" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800 dark:text-green-300">
                Konfiguracja została zapisana pomyślnie!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs - vertical left panel (sticky on tall screens), content on the right */}
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl border border-gray-100 dark:border-gray-700 transition-colors duration-200">
        <div className="grid grid-cols-1 md:grid-cols-12">
          {/* Left navigation panel */}
          <aside className="md:col-span-3 md:sticky md:top-0 md:self-start md:max-h-[80vh] md:overflow-y-auto border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700 p-3 md:p-4">
            <nav
              className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible"
              aria-label="Tabs"
            >
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

          {/* Right content area */}
          <main className="md:col-span-9 p-6">
            {/* Dynamiczny nagłówek sekcji zależny od aktywnej zakładki */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <span aria-hidden="true">{activeTabMeta.icon}</span>
                {activeTabMeta.name}
              </h2>
            </div>
            {renderTabContent()}
          </main>
        </div>
      </div>
    </div>
  );
};

export default AppConfigScreen;
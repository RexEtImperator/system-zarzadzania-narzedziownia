import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { ArchiveBoxIcon, CheckIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import DepartmentManagementScreen from './DepartmentManagementScreen';
import PositionManagementScreen from './PositionManagementScreen';
import UserManagementScreen from './UserManagementScreen';
import ConfirmationModal from './ConfirmationModal';

const AppConfigScreen = ({ apiClient, user }) => {
  const { t } = useLanguage();
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
      dateFormat: 'DD/MM/YYYY',
      // Prefiksy dla kodów
      toolsCodePrefix: '',
      bhpCodePrefix: '',
      toolCategoryPrefixes: {}
    },
    security: {
      sessionTimeout: 30,
      passwordMinLength: 8,
      requireSpecialChars: true,
      requireNumbers: true,
      maxLoginAttempts: 5,
      lockoutDuration: 15
    },
    email: {
      host: '',
      port: 587,
      secure: false,
      user: '',
      pass: '',
      from: 'no-reply@example.com'
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
  // Walidacja SMTP + test wysyłki
  const [emailErrors, setEmailErrors] = useState({ host: '', port: '', from: '' });
  const [testEmail, setTestEmail] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState('');

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
  // Modal potwierdzenia usuwania logo
  const [showLogoDeleteModal, setShowLogoDeleteModal] = useState(false);
  const [logoDeleteFilename, setLogoDeleteFilename] = useState(null);
  const [logoDeleteLoading, setLogoDeleteLoading] = useState(false);

  // Ujednolicone helpery toastr dla tej sekcji konfiguracji
  const notifySuccess = (message) => toast.success(message, { autoClose: 2500, hideProgressBar: true });
  const notifyError = (message) => toast.error(message, { autoClose: 2500, hideProgressBar: true });

  useEffect(() => {
    loadConfig();
    loadEmailConfig();
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
          dateFormat: general.dateFormat || prev.general.dateFormat,
          toolsCodePrefix: general.toolsCodePrefix ?? prev.general.toolsCodePrefix,
          bhpCodePrefix: general.bhpCodePrefix ?? prev.general.bhpCodePrefix,
          toolCategoryPrefixes: general.toolCategoryPrefixes || {}
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
        backupFrequency: config.notifications.backupFrequency,
        // Prefiksy
        toolsCodePrefix: config.general.toolsCodePrefix,
        bhpCodePrefix: config.general.bhpCodePrefix,
        toolCategoryPrefixes: config.general.toolCategoryPrefixes
      });
      // Zapisz konfigurację SMTP (jeśli admin)
      const validCfg = validateEmailConfig(config.email);
      setEmailErrors(validCfg.errors);
      if (!validCfg.isValid) {
        notifyError('Popraw konfigurację SMTP (host/port/from)');
      } else {
        try {
          await apiClient.put('/api/config/email', {
            host: config.email.host,
            port: config.email.port,
            secure: !!config.email.secure,
            user: config.email.user,
            pass: config.email.pass,
            from: config.email.from
          });
        } catch (e) {
          console.warn('Nie udało się zapisać konfiguracji SMTP:', e?.message || e);
        }
      }
      
      // Zaktualizuj język lokalnie dla natychmiastowego efektu UI
      try {
        localStorage.setItem('language', config.general.language);
        window.dispatchEvent(new CustomEvent('language:changed', { detail: { language: config.general.language } }));
      } catch (_) {
        // ignore localStorage errors
      }

      // Toastr
      notifySuccess('Konfiguracja została zapisana pomyślnie!');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (error) {
      console.error('Błąd podczas zapisywania konfiguracji:', error);
      notifyError('Nie udało się zapisać konfiguracji');
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

  const validateEmailConfig = (emailCfg) => {
    const errors = { host: '', port: '', from: '' };
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    // host
    if (!emailCfg.host || String(emailCfg.host).trim().length === 0) {
      errors.host = 'Pole host jest wymagane';
    }
    // port
    const portNum = parseInt(emailCfg.port, 10);
    if (!portNum || portNum <= 0 || portNum > 65535) {
      errors.port = 'Podaj poprawny port (1-65535)';
    }
    // from
    if (!emailCfg.from || !emailRegex.test(String(emailCfg.from))) {
      errors.from = 'Podaj poprawny adres e-mail w polu FROM';
    }
    const isValid = !errors.host && !errors.port && !errors.from;
    return { isValid, errors };
  };

  const onEmailFieldChange = (field, value) => {
    updateConfig('email', field, value);
    const next = { ...config.email, [field]: value };
    const valid = validateEmailConfig(next);
    setEmailErrors(valid.errors);
  };

  const tabs = [
    { id: 'general', name: 'Ogólne', icon: '⚙️' },
    { id: 'security', name: 'Bezpieczeństwo', icon: '🔒' },
    { id: 'email', name: 'Poczta email', icon: '✉️' },
    { id: 'users', name: 'Użytkownicy', icon: '👥' },
    { id: 'features', name: 'Funkcje', icon: '🎛️' },
    { id: 'departments', name: 'Działy', icon: '🏢' },
    { id: 'positions', name: 'Stanowiska', icon: '👔' },
    { id: 'categories', name: 'Kategorie', icon: '🏷️' },
    { id: 'codes', name: 'Kody qr/kreskowe', icon: '🔖' },
    { id: 'translations', name: 'Tłumaczenie', icon: '🈶' },
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
      notifyError('Dozwolone są tylko pliki PNG');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      notifyError('Plik jest za duży (maks. 2MB)');
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
        notifyError(`Wymiary logo poza zakresem: min ${MIN_LOGO_WIDTH}x${MIN_LOGO_HEIGHT}, max ${MAX_LOGO_WIDTH}x${MAX_LOGO_HEIGHT}. Otrzymano ${w}x${h}`);
        URL.revokeObjectURL(previewUrl);
        return;
      }
      setLogoFile(file);
      setLogoPreview(previewUrl);
    };
    img.onerror = () => {
      notifyError('Nieprawidłowy plik obrazu');
      URL.revokeObjectURL(previewUrl);
    };
    img.src = previewUrl;
  };

  const handleLogoUpload = async () => {
    if (!logoFile) {
      notifyError('Wybierz plik logo (PNG)');
      return;
    }
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('logo', logoFile);
      const resp = await apiClient.postForm('/api/config/logo', formData);
      notifySuccess('Logo zostało zaktualizowane');
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
      notifyError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoRollback = async (filename) => {
    if (!filename) return;
    try {
      setLoading(true);
      await apiClient.post('/api/config/logo/rollback', { filename });
      notifySuccess('Przywrócono wybraną wersję logo');
      setLogoTs(Date.now());
    } catch (error) {
      let msg = 'Błąd przywracania wersji';
      if (error && typeof error.message === 'string') {
        try { const parsed = JSON.parse(error.message); msg = parsed.error || parsed.message || msg; } catch (_) { msg = error.message || msg; }
      }
      notifyError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoDelete = async (filename) => {
    if (!filename) return;
    try {
      setLogoDeleteLoading(true);
      await apiClient.delete(`/api/config/logo/${encodeURIComponent(filename)}`);
      notifySuccess('Wersja logo została usunięta');
      await loadLogoHistory();
    } catch (error) {
      let msg = 'Błąd usuwania wersji logo';
      if (error && typeof error.message === 'string') {
        try { const parsed = JSON.parse(error.message); msg = parsed.error || parsed.message || msg; } catch (_) { msg = error.message || msg; }
      }
      notifyError(msg);
    } finally {
      setLogoDeleteLoading(false);
      setShowLogoDeleteModal(false);
      setLogoDeleteFilename(null);
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
                        Zastosuj
                      </button>
                      <button
                        type="button"
                        onClick={() => { setLogoDeleteFilename(v.filename); setShowLogoDeleteModal(true); }}
                        className="ml-2 text-xs px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50"
                      >
                        Usuń
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

  const loadEmailConfig = async () => {
    try {
      const emailCfg = await apiClient.get('/api/config/email');
      setConfig(prev => ({
        ...prev,
        email: {
          host: emailCfg.host ?? prev.email.host,
          port: emailCfg.port ?? prev.email.port,
          secure: !!emailCfg.secure,
          user: emailCfg.user ?? prev.email.user,
          pass: emailCfg.pass ?? prev.email.pass,
          from: emailCfg.from ?? prev.email.from
        }
      }));
    } catch (err) {
      console.warn('Nie udało się pobrać konfiguracji SMTP:', err?.message || err);
    }
  };

  const renderEmailTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Konfiguracja SMTP</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">SMTP_HOST</label>
            <input
              type="text"
              value={config.email.host}
              onChange={(e) => onEmailFieldChange('host', e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
            {emailErrors.host && (<p className="mt-1 text-xs text-red-600">{emailErrors.host}</p>)}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">SMTP_PORT</label>
            <input
              type="number"
              value={config.email.port}
              onChange={(e) => onEmailFieldChange('port', parseInt(e.target.value) || 0)}
              className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
            {emailErrors.port && (<p className="mt-1 text-xs text-red-600">{emailErrors.port}</p>)}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">SMTP_SECURE (Tak lub NIE)</label>
            <select
              value={config.email.secure ? 'TAK' : 'NIE'}
              onChange={(e) => onEmailFieldChange('secure', e.target.value === 'TAK')}
              className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="TAK">TAK</option>
              <option value="NIE">NIE</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">SMTP_USER</label>
            <input
              type="text"
              value={config.email.user}
              onChange={(e) => onEmailFieldChange('user', e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">SMTP_PASS</label>
            <input
              type="password"
              value={config.email.pass}
              onChange={(e) => onEmailFieldChange('pass', e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">SMTP_FROM</label>
            <input
              type="text"
              value={config.email.from}
              onChange={(e) => onEmailFieldChange('from', e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
            {emailErrors.from && (<p className="mt-1 text-xs text-red-600">{emailErrors.from}</p>)}
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Ustawienia używane do wysyłki e-maili (np. danych logowania).</p>
      </div>
      <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
        <h4 className="text-md font-medium text-gray-900 dark:text-white mb-2">Test wysyłki e-mail</h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Wyślij testową wiadomość, aby zweryfikować konfigurację SMTP. Wymagane uprawnienia administratora.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Adres odbiorcy (TO)</label>
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="np. test@twojadomena.pl"
              className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <button
              type="button"
              onClick={async () => {
                setTestResult('');
                const validCfg = validateEmailConfig(config.email);
                setEmailErrors(validCfg.errors);
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!validCfg.isValid) {
                  setTestResult('Najpierw popraw konfigurację SMTP (host/port/from).');
                  notifyError('Najpierw popraw konfigurację SMTP (host/port/from)');
                  return;
                }
                if (!testEmail || !emailRegex.test(testEmail)) {
                  setTestResult('Podaj poprawny adres odbiorcy testowej wiadomości.');
                  notifyError('Podaj poprawny adres odbiorcy testowej wiadomości.');
                  return;
                }
                try {
                  setIsSendingTest(true);
                  await apiClient.post('/api/config/email/test', { to: testEmail });
                  setTestResult('Wiadomość testowa została wysłana pomyślnie.');
                  notifySuccess('Wiadomość testowa została wysłana pomyślnie.');
                } catch (err) {
                  setTestResult(`Błąd wysyłki testowej: ${err?.message || err}`);
                  notifyError(`Błąd wysyłki testowej: ${err?.message || err}`);
                } finally {
                  setIsSendingTest(false);
                }
              }}
              disabled={isSendingTest}
              className={`inline-flex items-center px-4 py-2 rounded-md text-white ${isSendingTest ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
            >
              {isSendingTest ? 'Wysyłanie…' : 'Wyślij mail testowy'}
            </button>
            {testResult && (<p className="mt-2 text-xs text-gray-600 dark:text-gray-300">{testResult}</p>)}
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

          {/* Sekcja konfiguracji kodów przeniesiona do zakładki 'Kody qr/kreskowe' */}

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

  const renderCodesTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Konfiguracja kodów qr/kreskowych</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Prefiks kodów dla Narzędzi
            </label>
            <input
              type="text"
              placeholder="np. TOOL-"
              value={config.general.toolsCodePrefix}
              onChange={(e) => updateConfig('general', 'toolsCodePrefix', e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Prefiks kodów dla BHP
            </label>
            <input
              type="text"
              placeholder="np. BHP-"
              value={config.general.bhpCodePrefix}
              onChange={(e) => updateConfig('general', 'bhpCodePrefix', e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
            />
          </div>
        </div>
      </div>
      <div className="pt-2">
        <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">Prefiksy per kategoria narzędzia</h4>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Możesz zdefiniować różne prefiksy dla konkretnych kategorii.</p>
        <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
          {categoriesLoading ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">{t('loading.categories')}</div>
          ) : (categories || []).length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">{t('noData.categories')}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {categories.map(cat => (
                <div key={cat.id} className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{cat.name}</label>
                  <input
                    type="text"
                    placeholder="np. OSSR-"
                    value={(config.general.toolCategoryPrefixes?.[cat.name]) || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setConfig(prev => ({
                        ...prev,
                        general: {
                          ...prev.general,
                          toolCategoryPrefixes: {
                            ...(prev.general.toolCategoryPrefixes || {}),
                            [cat.name]: val
                          }
                        }
                      }));
                    }}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">{cat.tool_count ? `${cat.tool_count} narzędzi` : '—'}</p>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">Prefiks per kategoria ma pierwszeństwo nad prefiksem ogólnym dla narzędzi.</div>
        </div>
      </div>
    </div>
  );

  // ====== Zakładka: Tłumaczenie ======
  const [translationsLoading, setTranslationsLoading] = useState(false);
  const [translationsSearch, setTranslationsSearch] = useState('');
  const [translations, setTranslations] = useState({}); // { key: { pl, en, de } }
  const [changedPairs, setChangedPairs] = useState(new Set()); // set of `${key}|${lang}` changed
  const [selectedLang, setSelectedLang] = useState('pl');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newPL, setNewPL] = useState('');
  const [newEN, setNewEN] = useState('');
  const [newDE, setNewDE] = useState('');
  const [adding, setAdding] = useState(false);

  const loadTranslations = async () => {
    try {
      setTranslationsLoading(true);
      const [plRes, enRes, deRes] = await Promise.all([
        apiClient.get('/api/translations/pl'),
        apiClient.get('/api/translations/en'),
        apiClient.get('/api/translations/de')
      ]);
      const plMap = plRes?.translations || {};
      const enMap = enRes?.translations || {};
      const deMap = deRes?.translations || {};
      const allKeys = Array.from(new Set([...Object.keys(plMap), ...Object.keys(enMap), ...Object.keys(deMap)])).sort();
      const merged = {};
      for (const k of allKeys) {
        merged[k] = { pl: plMap[k] ?? '', en: enMap[k] ?? '', de: deMap[k] ?? '' };
      }
      setTranslations(merged);
      setChangedPairs(new Set());
    } catch (err) {
      notifyError('Nie udało się pobrać tłumaczeń');
    } finally {
      setTranslationsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'translations') {
      loadTranslations();
    }
  }, [activeTab]);

  const setValue = (key, lang, value) => {
    setTranslations(prev => ({
      ...prev,
      [key]: { ...(prev[key] || {}), [lang]: value }
    }));
    setChangedPairs(prev => {
      const next = new Set(prev);
      next.add(`${key}|${lang}`);
      return next;
    });
  };

  const saveTranslations = async () => {
    try {
      const updates = [];
      for (const pair of Array.from(changedPairs)) {
        const [key, lang] = pair.split('|');
        const row = translations[key];
        if (!row) continue;
        updates.push({ lang, key, value: row[lang] ?? '' });
      }
      if (updates.length === 0) {
        notifyError('Brak zmian do zapisania');
        return;
      }
      await apiClient.put('/api/translate/bulk', { updates });
      notifySuccess('Tłumaczenia zapisane');
      setChangedPairs(new Set());
    } catch (_) {
      notifyError('Nie udało się zapisać tłumaczeń');
    }
  };

  const renderTranslationsTab = () => {
    const keys = Object.keys(translations || {}).filter(k => !translationsSearch || k.toLowerCase().includes(translationsSearch.toLowerCase()));
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Tłumaczenia i18n</h3>
            <div className="flex items-center bg-slate-100 dark:bg-slate-900 rounded-md p-1">
              {['pl','en','de'].map((lng) => (
                <button
                  key={lng}
                  type="button"
                  onClick={() => setSelectedLang(lng)}
                  className={`px-3 py-1 rounded ${selectedLang === lng ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow' : 'text-slate-600 dark:text-slate-300'}`}
                >
                  {lng.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setShowAddModal(true); setNewKey(''); setNewPL(''); setNewEN(''); setNewDE(''); }}
              className="px-4 py-2 rounded-md bg-emerald-600 dark:bg-emerald-700 text-white hover:bg-emerald-700 dark:hover:bg-emerald-800">
              Dodaj tłumaczenie
            </button>
            <input
              type="text"
              placeholder="Szukaj klucza…"
              value={translationsSearch}
              onChange={(e) => setTranslationsSearch(e.target.value)}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={saveTranslations}
              className="px-4 py-2 rounded-md bg-indigo-600 dark:bg-indigo-700 text-white hover:bg-indigo-700 dark:hover:bg-indigo-800 disabled:opacity-60"
              disabled={translationsLoading}
            >
              Zapisz zmiany
            </button>
          </div>
        </div>

        <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
          {translationsLoading ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">Ładowanie tłumaczeń…</div>
          ) : keys.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">Brak kluczy do wyświetlenia</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Klucz</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{selectedLang.toUpperCase()}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {keys.map((k) => (
                    <tr key={k}>
                      <td className="px-3 py-2 align-top text-xs text-gray-600 dark:text-gray-300 w-64">{k}</td>
                      <td className="px-3 py-2">
                        <textarea
                          rows={2}
                          value={translations[k]?.[selectedLang] ?? ''}
                          onChange={(e) => setValue(k, selectedLang, e.target.value)}
                          className="w-full px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => !adding && setShowAddModal(false)} />
            <div className="relative z-10 w-full max-w-2xl rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Dodaj tłumaczenie</h4>
                <button type="button" onClick={() => !adding && setShowAddModal(false)} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">✖</button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Klucz</label>
                  {(() => {
                    const trimmedKey = newKey.trim();
                    const keyExists = !!trimmedKey && Object.prototype.hasOwnProperty.call(translations, trimmedKey);
                    const base = "w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 ";
                    const border = keyExists ? "border-red-400 dark:border-red-500" : "border-slate-300 dark:border-slate-600";
                    return (
                      <>
                        <input
                          type="text"
                          value={newKey}
                          onChange={(e) => setNewKey(e.target.value)}
                          className={base + border}
                          placeholder="np. inventory.correctionDelete.title"
                        />
                        {keyExists && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">Taki klucz już istnieje. Edytuj go na liście zamiast dodawać.</p>
                        )}
                      </>
                    );
                  })()}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">PL</label>
                    <textarea rows={3} value={newPL} onChange={(e) => setNewPL(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">EN</label>
                    <textarea rows={3} value={newEN} onChange={(e) => setNewEN(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">DE</label>
                    <textarea rows={3} value={newDE} onChange={(e) => setNewDE(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
                  </div>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-end gap-2">
                <button type="button" onClick={() => !adding && setShowAddModal(false)} className="px-4 py-2 rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700">Anuluj</button>
                <button
                  type="button"
                  disabled={!newKey.trim() || adding || Object.prototype.hasOwnProperty.call(translations, newKey.trim())}
                  onClick={async () => {
                    try {
                      setAdding(true);
                      const trimmedKey = newKey.trim();
                      const updates = [
                        { lang: 'pl', key: trimmedKey, value: newPL ?? '' },
                        { lang: 'en', key: trimmedKey, value: newEN ?? '' },
                        { lang: 'de', key: trimmedKey, value: newDE ?? '' }
                      ];
                      await apiClient.put('/api/translate/bulk', { updates });
                      setShowAddModal(false);
                      setNewKey(''); setNewPL(''); setNewEN(''); setNewDE('');
                      await loadTranslations();
                      notifySuccess('Tłumaczenie dodane');
                    } catch (e) {
                      notifyError('Nie udało się dodać tłumaczenia');
                    } finally {
                      setAdding(false);
                    }
                  }}
                  className="px-4 py-2 rounded-md bg-emerald-600 dark:bg-emerald-700 text-white hover:bg-emerald-700 dark:hover:bg-emerald-800 disabled:opacity-60"
                >
                  Dodaj
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

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
      notifySuccess('Kopia zapasowa wykonana');
      // Odśwież informacje po udanym backupie
      await loadConfig();
      await loadBackups();
    } catch (err) {
      const msg = err?.message || 'Nie udało się wykonać kopii zapasowej';
      notifyError(msg);
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
      notifyError('Podaj nazwę kategorii');
      return;
    }
    try {
      const created = await apiClient.post('/api/categories', { name });
      setCategories(prev => [...prev, { id: created.id, name: created.name }]);
      setCatNewName('');
      notifySuccess('Dodano kategorię');
    } catch (err) {
      const msg = err?.message || 'Nie udało się dodać kategorii';
      notifyError(msg);
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
      notifyError('Nazwa nie może być pusta');
      return;
    }
    try {
      const updated = await apiClient.put(`/api/categories/${id}`, { name });
      setCategories(prev => prev.map(c => c.id === id ? { id, name: updated.name || name } : c));
      cancelEditCategory();
      notifySuccess('Zaktualizowano kategorię');
    } catch (err) {
      const msg = err?.message || 'Nie udało się zaktualizować kategorii';
      notifyError(msg);
    }
  };

  const deleteCategory = async (cat) => {
    if (!cat?.id) return;
    if (!window.confirm(`Usunąć kategorię „${cat.name}”?`)) return;
    try {
      await apiClient.delete(`/api/categories/${cat.id}`);
      setCategories(prev => prev.filter(c => c.id !== cat.id));
      notifySuccess('Usunięto kategorię');
    } catch (err) {
      const msg = err?.message || 'Nie udało się usunąć kategorii';
      notifyError(msg);
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
            <div className="text-sm text-gray-500 dark:text-gray-400">{t('loading.categories')}</div>
          ) : categories.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">{t('noData.categories')}</div>
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
      case 'email':
        return renderEmailTab();
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
      case 'codes':
        return renderCodesTab();
      case 'translations':
        return renderTranslationsTab();
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

      {/* Modal potwierdzenia usunięcia logo */}
      <ConfirmationModal
        isOpen={showLogoDeleteModal}
        onClose={() => { if (!logoDeleteLoading) { setShowLogoDeleteModal(false); setLogoDeleteFilename(null); } }}
        onConfirm={() => logoDeleteFilename && handleLogoDelete(logoDeleteFilename)}
        title="Usuń wersję logo"
        message={logoDeleteFilename ? `Czy na pewno chcesz usunąć wersję: ${logoDeleteFilename}?` : 'Czy na pewno chcesz usunąć tę wersję logo?'}
        confirmText="Usuń"
        cancelText={t('common.cancel')}
        type="danger"
        loading={logoDeleteLoading}
      />

    </div>
  );
};

export default AppConfigScreen;
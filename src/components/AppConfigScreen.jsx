import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { ArchiveBoxIcon, CheckIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import DepartmentManagementScreen from './DepartmentManagementScreen';
import PositionManagementScreen from './PositionManagementScreen';
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

  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [catNewName, setCatNewName] = useState('');
  const [catEditingId, setCatEditingId] = useState(null);
  const [catEditingName, setCatEditingName] = useState('');

  const [showLogoDeleteModal, setShowLogoDeleteModal] = useState(false);
  const [logoDeleteFilename, setLogoDeleteFilename] = useState(null);
  const [logoDeleteLoading, setLogoDeleteLoading] = useState(false);

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
      console.error('Failed to load configuration:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLogoHistory = async () => {
    try {
      const data = await apiClient.get('/api/config/logo/history');
      setLogoHistory(Array.isArray(data?.versions) ? data.versions : []);
    } catch (err) {
      console.warn('Failed to load logo history:', err?.message || err);
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
        toolsCodePrefix: config.general.toolsCodePrefix,
        bhpCodePrefix: config.general.bhpCodePrefix,
        toolCategoryPrefixes: config.general.toolCategoryPrefixes
      });
      // Zapisz konfigurację SMTP (jeśli admin)
      const validCfg = validateEmailConfig(config.email);
      setEmailErrors(validCfg.errors);
      if (!validCfg.isValid) {
        notifyError(t('appConfig.email.fixConfig'));
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
          console.warn('Failed to save SMTP configuration:', e?.message || e);
        }
      }
      
      // Update language locally for immediate UI effect
      try {
        localStorage.setItem('language', config.general.language);
        window.dispatchEvent(new CustomEvent('language:changed', { detail: { language: config.general.language } }));
      } catch (_) {
        // ignore localStorage errors
      }

      // Toastr
      notifySuccess(t('appConfig.save.success'));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (error) {
      console.error('Error saving configuration:', error);
      notifyError(t('appConfig.save.error'));
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
      errors.host = t('appConfig.email.validation.hostRequired');
    }
    // port
    const portNum = parseInt(emailCfg.port, 10);
    if (!portNum || portNum <= 0 || portNum > 65535) {
      errors.port = t('appConfig.email.validation.portInvalid');
    }
    // from
    if (!emailCfg.from || !emailRegex.test(String(emailCfg.from))) {
      errors.from = t('appConfig.email.validation.fromInvalid');
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
    { id: 'general', name: t('appConfig.tabs.general'), icon: '⚙️' },
    { id: 'security', name: t('appConfig.tabs.security'), icon: '🔒' },
    { id: 'email', name: t('appConfig.tabs.email'), icon: '✉️' },
    { id: 'users', name: t('appConfig.tabs.users'), icon: '👥' },
    { id: 'features', name: t('appConfig.tabs.features'), icon: '🎛️' },
    { id: 'departments', name: t('appConfig.tabs.departments'), icon: '🏢' },
    { id: 'positions', name: t('appConfig.tabs.positions'), icon: '👔' },
    { id: 'categories', name: t('appConfig.tabs.categories'), icon: '🏷️' },
    { id: 'codes', name: t('appConfig.tabs.codes'), icon: '🔖' },
    { id: 'translations', name: t('appConfig.tabs.translations'), icon: '🈶' },
    { id: 'backup', name: t('appConfig.tabs.backup'), icon: '💾' }
  ];

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setLogoFile(null);
      setLogoPreview(null);
      return;
    }
    if (file.type !== 'image/png') {
      notifyError(t('appConfig.logo.onlyPng'));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      notifyError(t('appConfig.logo.fileTooLarge'));
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
        notifyError(
          t('appConfig.logo.dimensionsOutOfRange')
            .replace('{minW}', MIN_LOGO_WIDTH)
            .replace('{minH}', MIN_LOGO_HEIGHT)
            .replace('{maxW}', MAX_LOGO_WIDTH)
            .replace('{maxH}', MAX_LOGO_HEIGHT)
            .replace('{w}', w)
            .replace('{h}', h)
        );
        URL.revokeObjectURL(previewUrl);
        return;
      }
      setLogoFile(file);
      setLogoPreview(previewUrl);
    };
    img.onerror = () => {
      notifyError(t('appConfig.logo.invalidImageFile'));
      URL.revokeObjectURL(previewUrl);
    };
    img.src = previewUrl;
  };

  const handleLogoUpload = async () => {
    if (!logoFile) {
      notifyError(t('appConfig.logo.selectPng'));
      return;
    }
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('logo', logoFile);
      const resp = await apiClient.postForm('/api/config/logo', formData);
      notifySuccess(t('appConfig.logo.updated'));
      setLogoTs((resp && resp.timestamp) || Date.now());
      setLogoFile(null);
      setLogoPreview(null);
      // Refresh history after successful upload
      loadLogoHistory();
    } catch (error) {
      let msg = t('appConfig.logo.uploadError');
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
      notifySuccess(t('appConfig.logo.rollbackSuccess'));
      setLogoTs(Date.now());
    } catch (error) {
      let msg = t('appConfig.logo.rollbackError');
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
      notifySuccess(t('appConfig.logo.deleteSuccess'));
      await loadLogoHistory();
    } catch (error) {
      let msg = t('appConfig.logo.deleteError');
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
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('appConfig.general.appName')}
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
              {t('appConfig.general.companyName')}
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
              {t('appConfig.general.timezone')}
            </label>
            <select
              value={config.general.timezone}
              onChange={(e) => updateConfig('general', 'timezone', e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="Europe/Warsaw">{t('appConfig.general.timezones.warsaw')}</option>
              <option value="Europe/London">{t('appConfig.general.timezones.london')}</option>
              <option value="America/New_York">{t('appConfig.general.timezones.newYork')}</option>
              <option value="Asia/Tokyo">{t('appConfig.general.timezones.tokyo')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('appConfig.general.language')}
            </label>
            <select
              value={config.general.language}
              onChange={(e) => updateConfig('general', 'language', e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="pl">{t('appConfig.general.language_pl')}</option>
              <option value="en">{t('appConfig.general.language_en')}</option>
              <option value="de">{t('appConfig.general.language_de')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('appConfig.general.dateFormat')}
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
          <h4 className="text-md font-medium text-gray-900 dark:text-gray-200 mb-3">{t('appConfig.logo.title')}</h4>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 items-start">
            <div>
              <div className="border rounded-lg bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 p-4 flex items-center justify-center">
                <img
                  src={(logoPreview || `/logo.png?ts=${logoTs}`)}
                  alt={t('appConfig.logo.currentAlt')}
                  className="h-24 object-contain"
                />
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t('appConfig.logo.dimensionsHint').replace('{minW}', MIN_LOGO_WIDTH).replace('{minH}', MIN_LOGO_HEIGHT).replace('{maxW}', MAX_LOGO_WIDTH).replace('{maxH}', MAX_LOGO_HEIGHT)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('appConfig.logo.uploadLabel')}</label>
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
                  {t('appConfig.logo.saveNew')}
                </button>
                {logoFile && (
                  <button
                    type="button"
                    onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                    className="inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 border-slate-300 dark:border-slate-600"
                  >
                    {t('common.cancel')}
                  </button>
                )}
              </div>
            </div>
          </div>
          {/* Historia wersji logo */}
          <div className="mt-6">
            <h5 className="text-sm font-medium text-gray-900 dark:text-gray-200 mb-2">{t('appConfig.logo.historyTitle')}</h5>
            {logoHistory.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('appConfig.logo.historyEmpty')}</p>
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
                        {t('appConfig.logo.apply')}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setLogoDeleteFilename(v.filename); setShowLogoDeleteModal(true); }}
                        className="ml-2 text-xs px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50"
                      >
                        {t('common.remove')}
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
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('appConfig.security.sessionTimeout')}
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
              {t('appConfig.security.passwordMinLength')}
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
              {t('appConfig.security.maxLoginAttempts')}
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
              {t('appConfig.security.lockoutDuration')}
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
              {t('appConfig.security.requireSpecialChars')}
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
              {t('appConfig.security.requireNumbers')}
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
      console.error('Error loading email config:', err?.message || err);
    }
  };

  const renderEmailTab = () => (
    <div className="space-y-6">
      <div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('appConfig.email.host')}</label>
            <input
              type="text"
              value={config.email.host}
              onChange={(e) => onEmailFieldChange('host', e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
            {emailErrors.host && (<p className="mt-1 text-xs text-red-600">{emailErrors.host}</p>)}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('appConfig.email.port')}</label>
            <input
              type="number"
              value={config.email.port}
              onChange={(e) => onEmailFieldChange('port', parseInt(e.target.value) || 0)}
              className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
            {emailErrors.port && (<p className="mt-1 text-xs text-red-600">{emailErrors.port}</p>)}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('appConfig.email.secure')}</label>
            <select
              value={config.email.secure ? 'YES' : 'NO'}
              onChange={(e) => onEmailFieldChange('secure', e.target.value === 'YES')}
              className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="YES">{t('appConfig.email.yes')}</option>
              <option value="NO">{t('appConfig.email.no')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('appConfig.email.user')}</label>
            <input
              type="text"
              value={config.email.user}
              onChange={(e) => onEmailFieldChange('user', e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('appConfig.email.pass')}</label>
            <input
              type="password"
              value={config.email.pass}
              onChange={(e) => onEmailFieldChange('pass', e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('appConfig.email.from')}</label>
            <input
              type="text"
              value={config.email.from}
              onChange={(e) => onEmailFieldChange('from', e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
            {emailErrors.from && (<p className="mt-1 text-xs text-red-600">{emailErrors.from}</p>)}
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{t('appConfig.email.description')}</p>
      </div>
      <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
        <h4 className="text-md font-medium text-gray-900 dark:text-white mb-2">{t('appConfig.email.test.title')}</h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{t('appConfig.email.test.description')}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('appConfig.email.test.recipient')}</label>
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder={t('appConfig.email.test.recipientPlaceholder')}
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
                  setTestResult(t('appConfig.email.test.fixConfig'));
                  notifyError(t('appConfig.email.test.fixConfig'));
                  return;
                }
                if (!testEmail || !emailRegex.test(testEmail)) {
                  setTestResult(t('appConfig.email.test.invalidRecipient'));
                  notifyError(t('appConfig.email.test.invalidRecipient'));
                  return;
                }
                try {
                  setIsSendingTest(true);
                  await apiClient.post('/api/config/email/test', { to: testEmail });
                  setTestResult(t('appConfig.email.test.success'));
                  notifySuccess(t('appConfig.email.test.success'));
                } catch (err) {
                  setTestResult(`${t('appConfig.email.test.error')}: ${err?.message || err}`);
                  notifyError(`${t('appConfig.email.test.error')}: ${err?.message || err}`);
                } finally {
                  setIsSendingTest(false);
                }
              }}
              disabled={isSendingTest}
              className={`inline-flex items-center px-4 py-2 rounded-md text-white ${isSendingTest ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
            >
              {isSendingTest ? t('appConfig.email.test.sending') : t('appConfig.email.test.send')}
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
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">{t('appConfig.notifications.title')}</h3>
        
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
              {t('appConfig.notifications.email')}
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
              {t('appConfig.notifications.sms')}
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
              {t('appConfig.notifications.push')}
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  const renderFeaturesTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">{t('appConfig.features.title')}</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="enableAuditLog" className="text-sm font-medium text-gray-900 dark:text-gray-200">
                {t('appConfig.features.auditLog')}
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('appConfig.features.auditLogDesc')}</p>
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
                {t('appConfig.features.reports')}
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('appConfig.features.reportsDesc')}</p>
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
                {t('appConfig.features.mobileApp')}
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('appConfig.features.mobileAppDesc')}</p>
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
                {t('appConfig.features.apiAccess')}
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('appConfig.features.apiAccessDesc')}</p>
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
                {t('appConfig.features.dataExport')}
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('appConfig.features.dataExportDesc')}</p>
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
              <h4 className="text-md font-medium text-gray-900 dark:text-gray-200 mb-3">{t('appConfig.features.otherSettings')}</h4>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('appConfig.features.auditRetention')}</label>
                  <input
                    type="number"
                    value={config.notifications.auditLogRetention}
                    onChange={(e) => updateConfig('notifications', 'auditLogRetention', parseInt(e.target.value))}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('appConfig.features.backupFrequency')}</label>
                  <select
                    value={config.notifications.backupFrequency}
                    onChange={(e) => updateConfig('notifications', 'backupFrequency', e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  >
                    <option value="daily">{t('appConfig.features.frequency.daily')}</option>
                    <option value="weekly">{t('appConfig.features.frequency.weekly')}</option>
                    <option value="monthly">{t('appConfig.features.frequency.monthly')}</option>
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
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('appConfig.codes.toolsPrefix')}</label>
            <input
              type="text"
              placeholder={t('appConfig.codes.toolsPrefixPlaceholder')}
              value={config.general.toolsCodePrefix}
              onChange={(e) => updateConfig('general', 'toolsCodePrefix', e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('appConfig.codes.bhpPrefix')}</label>
            <input
              type="text"
              placeholder={t('appConfig.codes.bhpPrefixPlaceholder')}
              value={config.general.bhpCodePrefix}
              onChange={(e) => updateConfig('general', 'bhpCodePrefix', e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
            />
          </div>
        </div>
      </div>
      <div className="pt-2">
        <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">{t('appConfig.codes.categoryPrefixesTitle')}</h4>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{t('appConfig.codes.categoryPrefixesDesc')}</p>
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
                    placeholder={t('appConfig.codes.categoryPrefixPlaceholder')}
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
                  <p className="text-xs text-gray-500 dark:text-gray-400">{cat.tool_count ? `${cat.tool_count} ${t('appConfig.codes.toolsCountSuffix')}` : '—'}</p>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">{t('appConfig.codes.categoryPrefixNote')}</div>
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
      notifySuccess(t('appConfig.translations.saved'));
      setChangedPairs(new Set());
    } catch (_) {
      notifyError(t('appConfig.translations.saveError'));
    }
  };

  const renderTranslationsTab = () => {
    const keys = Object.keys(translations || {}).filter(k => !translationsSearch || k.toLowerCase().includes(translationsSearch.toLowerCase()));
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t('appConfig.translations.title')}</h3>
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
              {t('appConfig.translations.addTranslation')}
            </button>
            <input
              type="text"
              placeholder={t('appConfig.translations.searchPlaceholder')}
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
              {t('common.saveChanges')}
            </button>
          </div>
        </div>

        <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
          {translationsLoading ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">{t('appConfig.translations.loading')}</div>
          ) : keys.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">{t('appConfig.translations.empty')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{t('appConfig.translations.key')}</th>
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
                <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('appConfig.translations.addTranslation')}</h4>
                <button type="button" onClick={() => !adding && setShowAddModal(false)} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">✖</button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('appConfig.translations.key')}</label>
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
                          placeholder={t('appConfig.translations.keyPlaceholder')}
                        />
                        {keyExists && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{t('appConfig.translations.keyExists')}</p>
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
                <button type="button" onClick={() => !adding && setShowAddModal(false)} className="px-4 py-2 rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700">{t('common.cancel')}</button>
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
                      notifySuccess(t('appConfig.translations.added'));
                    } catch (e) {
                      notifyError(t('appConfig.translations.addError'));
                    } finally {
                      setAdding(false);
                    }
                  }}
                  className="px-4 py-2 rounded-md bg-emerald-600 dark:bg-emerald-700 text-white hover:bg-emerald-700 dark:hover:bg-emerald-800 disabled:opacity-60"
                >
                  {t('common.saveChanges')}
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
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
            <div className="text-sm text-gray-700 dark:text-gray-300">{t('appConfig.backup.lastFromConfig')}</div>
            <div className="mt-1 text-base font-medium text-gray-900 dark:text-white">{formatDateTime(lastBackupAt)}</div>
          </div>
          <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
            <div className="text-sm text-gray-700 dark:text-gray-300">{t('appConfig.backup.lastFile')}</div>
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
                {t('appConfig.backup.running')}
              </>
            ) : (
              <>
                <ArchiveBoxIcon className="w-4 h-4 mr-2" aria-hidden="true" />
                {t('appConfig.backup.run')}
              </>
            )}
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">{t('appConfig.backup.adminRequired')}</span>
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
      console.error('Failed to fetch categories:', err);
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
        <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
          <div className="flex items-end gap-2 mb-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('appConfig.categories.newCategory')}</label>
              <input
                type="text"
                value={catNewName}
                onChange={(e) => setCatNewName(e.target.value)}
                placeholder={t('appConfig.categories.newCategoryPlaceholder')}
                className="mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
            <button
              type="button"
              onClick={addCategory}
              className="px-4 py-2 rounded-md bg-indigo-600 dark:bg-indigo-700 text-white hover:bg-indigo-700 dark:hover:bg-indigo-800"
            >
              {t('appConfig.categories.add')}
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
                        >{t('common.saveChanges')}</button>
                        <button
                          type="button"
                          onClick={cancelEditCategory}
                          className="px-3 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                        >{t('common.cancel')}</button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEditCategory(cat)}
                          className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 text-sm font-medium"
                        >{t('appConfig.categories.edit')}</button>
                        <button
                          type="button"
                          onClick={() => deleteCategory(cat)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium"
                        >{t('common.remove')}</button>
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

  function UserManagementTab({ user, apiClient }) {
    const [users, setUsers] = useState([]);
    const { t } = useLanguage();
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({
      username: '',
      full_name: '',
      role: 'employee',
      password: '',
      confirmPassword: ''
    });
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const AUDIT_ACTIONS = {
      VIEW_USERS: 'VIEW_USERS',
      ADD_USER: 'ADD_USER',
      UPDATE_USER: 'UPDATE_USER',
      DELETE_USER: 'DELETE_USER'
    };

    const addAuditLog = async (actor, action, details) => {
      try {
        await apiClient.post('/api/audit', {
          user_id: actor.id,
          username: actor.username,
          action,
          details,
          ip_address: 'localhost'
        });
      } catch (error) {
        console.error('Error adding audit log:', error);
      }
    };

    useEffect(() => {
      fetchUsers();
    }, []);

    const fetchUsers = async () => {
      try {
        setLoading(true);
        const data = await apiClient.get('/api/users');
        setUsers(Array.isArray(data) ? data : []);
        addAuditLog(user, AUDIT_ACTIONS.VIEW_USERS, 'Przeglądano listę użytkowników');
      } catch (error) {
        console.error('Error fetching users:', error);
        toast.error(t('common.toastr.users.fetchError'));
      } finally {
        setLoading(false);
      }
    };

    const handleAddUser = () => {
      setEditingUser(null);
      setFormData({
        username: '',
        full_name: '',
        role: 'employee',
        password: '',
        confirmPassword: ''
      });
      setShowModal(true);
    };

    const handleEditUser = (userToEdit) => {
      setEditingUser(userToEdit);
      setFormData({
        username: userToEdit.username,
        full_name: userToEdit.full_name,
        role: userToEdit.role,
        password: '',
        confirmPassword: ''
      });
      setShowModal(true);
    };

    const handleDeleteUser = async (userId, username) => {
      if (!window.confirm(`Czy na pewno chcesz usunąć użytkownika "${username}"?`)) {
        return;
      }

      try {
        await apiClient.del(`/api/users/${userId}`);
        setUsers(users.filter(u => u.id !== userId));
        addAuditLog(user, AUDIT_ACTIONS.DELETE_USER, `Usunięto użytkownika: ${username}`);
        toast.success(t('common.toastr.users.deletedSuccess'));
      } catch (error) {
        console.error('Error deleting user:', error);
        toast.error(t('common.toastr.users.deleteError'));
      }
    };

    const handleSubmit = async (e) => {
      e.preventDefault();

      if (!formData.username || !formData.full_name) {
        toast.error(t('common.toastr.form.requiredFields'));
        return;
      }

      if (!editingUser && (!formData.password || formData.password !== formData.confirmPassword)) {
        toast.error(t('common.toastr.form.passwordMismatch'));
        return;
      }

      try {
        setLoading(true);
        const userData = {
          username: formData.username,
          full_name: formData.full_name,
          role: formData.role
        };

        if (formData.password) {
          userData.password = formData.password;
        }

        if (editingUser) {
          await apiClient.put(`/api/users/${editingUser.id}`, userData);
          setUsers(users.map(u => u.id === editingUser.id ? { ...u, ...userData } : u));
          addAuditLog(user, AUDIT_ACTIONS.UPDATE_USER, `Zaktualizowano użytkownika: ${userData.username}`);
          toast.success(t('common.toastr.users.updatedSuccess'));
        } else {
          const newUser = await apiClient.post('/api/users', userData);
          setUsers([...users, newUser]);
          addAuditLog(user, AUDIT_ACTIONS.ADD_USER, `Dodano użytkownika: ${userData.username}`);
          toast.success(t('common.toastr.users.addedSuccess'));
        }

        setShowModal(false);
        setFormData({
          username: '',
          full_name: '',
          role: 'employee',
          password: '',
          confirmPassword: ''
        });
      } catch (error) {
        console.error('Error saving user:', error);
        toast.error(t('common.toastr.users.saveError'));
      } finally {
        setLoading(false);
      }
    };

    const filteredUsers = users.filter(u =>
      (u.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.full_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
      setCurrentPage(1);
    }, [searchTerm]);

    const totalItems = filteredUsers.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const startIndex = (currentPage - 1) * pageSize;
    const endIndexExclusive = Math.min(startIndex + pageSize, totalItems);
    const paginatedUsers = filteredUsers.slice(startIndex, endIndexExclusive);

    useEffect(() => {
      if (currentPage > totalPages) {
        setCurrentPage(totalPages);
      }
    }, [totalPages, currentPage]);

    return (
      <>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Zarządzanie użytkownikami</h1>
          <button
            onClick={handleAddUser}
            className="bg-blue-600 dark:bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors"
          >
            Dodaj użytkownika
          </button>
        </div>

        <div className="mb-6">
          <input
            type="text"
            placeholder="Szukaj użytkowników..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
          />
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                  Użytkownik
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                  Rola
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                  Akcje
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
              {paginatedUsers.map((u) => (
                <tr key={u.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{u.full_name}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-300">@{u.username}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      u.role === 'administrator' ? 'bg-red-100 text-red-800' :
                      u.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                      u.role === 'employee' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {u.role === 'administrator' ? t('users.roles.administrator') :
                       u.role === 'manager' ? t('users.roles.manager') :
                       u.role === 'employee' ? t('users.roles.employee') :
                       t('users.roles.observer')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEditUser(u)}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 mr-3"
                    >
                      Edytuj
                    </button>
                    <button
                      onClick={() => handleDeleteUser(u.id, u.username)}
                      className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                    >
                      Usuń
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-3 px-6 py-3 bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="text-sm text-slate-700 dark:text-slate-200">
            {totalItems === 0 ? '0–0 / 0' : `${startIndex + 1}–${endIndexExclusive} / ${totalItems}`}
          </div>
          <div className="flex items-center gap-3">
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              aria-label="Rows per page"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 text-sm rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 disabled:opacity-50"
                aria-label="Previous page"
              >
                ‹
              </button>
              <span className="text-sm text-slate-700 dark:text-slate-200">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-sm rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 disabled:opacity-50"
                aria-label="Next page"
              >
                ›
              </button>
            </div>
          </div>
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {editingUser ? 'Edytuj użytkownika' : 'Dodaj użytkownika'}
                </h2>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Nazwa użytkownika
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Imię i nazwisko
                  </label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Rola
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  >
                    <option value="employee">Pracownik</option>
                    <option value="manager">Menedżer</option>
                    <option value="administrator">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {editingUser ? 'Nowe hasło (opcjonalne)' : 'Hasło'}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
                    required={!editingUser}
                  />
                </div>

                {!editingUser && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Potwierdź hasło
                    </label>
                    <input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
                      required
                    />
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 disabled:opacity-50 transition-colors"
                  >
                    {loading ? 'Zapisywanie...' : (editingUser ? 'Zaktualizuj' : 'Dodaj')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    );
  }

  const renderUserManagementTab = () => (
    <UserManagementTab user={user} apiClient={apiClient} />
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
        return renderUserManagementTab();
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('appConfig.header.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">{t('appConfig.header.subtitle')}</p>
        </div>
        <button
          onClick={handleSave}
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
        title={t('appConfig.logo.deleteTitle')}
        message={logoDeleteFilename ? `${t('appConfig.logo.deleteMessagePrefix')} ${logoDeleteFilename}?` : t('appConfig.logo.deleteMessage')}
        confirmText={t('common.remove')}
        cancelText={t('common.cancel')}
        type="danger"
        loading={logoDeleteLoading}
      />

    </div>
  );
};

export default AppConfigScreen;
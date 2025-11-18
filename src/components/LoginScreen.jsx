import React, { useState, useEffect } from 'react';
import { XCircleIcon, ArrowPathIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useLanguage } from '../contexts/LanguageContext';

const LoginScreen = ({ onLogin }) => {
  const { t } = useLanguage();
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  useEffect(() => {
    try {
      const savedUsername = localStorage.getItem('rememberedUsername');
      if (savedUsername) {
        setCredentials(prev => ({ ...prev, username: savedUsername }));
        setRememberMe(true);
      }
    } catch (_) {
      // graceful no-op if localStorage is unavailable
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      await onLogin(credentials);
      // Po udanym logowaniu zarządzaj zapisem loginu
      try {
        if (rememberMe) {
          localStorage.setItem('rememberedUsername', credentials.username);
        } else {
          localStorage.removeItem('rememberedUsername');
        }
      } catch (_) {}
    } catch (err) {
      setError(err.message || t('login.error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const updateCapsLock = (e) => {
    try {
      const isOn =
        (typeof e.getModifierState === 'function' && e.getModifierState('CapsLock')) ||
        (e.nativeEvent?.getModifierState?.('CapsLock')) ||
        false;
      setCapsLockOn(!!isOn);
    } catch (_) {
      setCapsLockOn(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-200">
      {/* Lewa kolumna */}
      <div className="w-full md:w-1/2 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="flex justify-center">
              <img 
                src="/logo.png" 
                alt="Logo systemu" 
                className="h-32 w-48 object-contain drop-shadow-lg"
              />
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2 transition-colors duration-200">
              {t('login.title')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors duration-200">
              {t('login.subtitle')}
            </p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-100 dark:border-gray-700 transition-colors duration-200">
              <div className="space-y-4">
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors duration-200">
                    {t('login.username')}
                  </label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    required
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 bg-white dark:bg-gray-700"
                    placeholder={t('login.enterUsername')}
                    value={credentials.username}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors duration-200">
                    {t('login.password')}
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 bg-white dark:bg-gray-700"
                      placeholder={t('login.enterPassword')}
                      value={credentials.password}
                      onChange={handleChange}
                      onKeyDown={updateCapsLock}
                      onKeyUp={updateCapsLock}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(prev => !prev)}
                      aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                      title={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                      aria-pressed={showPassword}
                      className="absolute inset-y-0 right-2 flex items-center p-2 text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md"
                      disabled={isLoading}
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-5 w-5" aria-hidden="true" />
                      ) : (
                        <EyeIcon className="h-5 w-5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  {capsLockOn && (
                    <div className="mt-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 transition-colors duration-200">
                      <p className="text-sm text-yellow-800 dark:text-yellow-300">{t('login.capsLock')}</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center mt-2">
                  <input
                    id="rememberMe"
                    name="rememberMe"
                    type="checkbox"
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={isLoading}
                  />
                  <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">{t('login.rememberMe')}</label>
                </div>
              </div>
                {error && (
                <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 transition-colors duration-200">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <XCircleIcon className="h-5 w-5 text-red-400 dark:text-red-300" aria-hidden="true" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-700 dark:text-red-300 transition-colors duration-200">{error}</p>
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-6">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
                >
                  {isLoading ? (
                    <>
                      <ArrowPathIcon className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" aria-hidden="true" />
                      {t('login.loading')}
                    </>
                  ) : (
                    t('login.submit')
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Prawa kolumna */}
      <div className="hidden md:flex md:w-1/2 items-center justify-center">
        <div className="w-full h-full rounded-none flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0"></div>
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              src="/login-screen-picture.png"
              alt="Ilustracja narzędziowni"
              className="object-cover h-full w-full opacity-50"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
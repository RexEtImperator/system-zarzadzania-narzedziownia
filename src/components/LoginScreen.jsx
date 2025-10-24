import React, { useState } from 'react';
import { XCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

const LoginScreen = ({ onLogin }) => {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      await onLogin(credentials);
    } catch (err) {
      setError(err.message || 'Błąd logowania');
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
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
            Zaloguj się do systemu
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors duration-200">
            System zarządzania narzędziownią
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-100 dark:border-gray-700 transition-colors duration-200">
            <div className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors duration-200">
                  Nazwa użytkownika
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 bg-white dark:bg-gray-700"
                  placeholder="Wprowadź nazwę użytkownika"
                  value={credentials.username}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 transition-colors duration-200">
                  Hasło
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 bg-white dark:bg-gray-700"
                  placeholder="Wprowadź hasło"
                  value={credentials.password}
                  onChange={handleChange}
                  disabled={isLoading}
                />
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
                    Logowanie...
                  </>
                ) : (
                  'Zaloguj się'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;
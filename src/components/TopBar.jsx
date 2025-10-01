import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';

const TopBar = ({ user, onLogout, onToggleSidebar, isSidebarOpen }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { isDarkMode, toggleTheme } = useTheme();

  // Zamknij dropdown po kliknięciu poza nim
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleLogoutClick = () => {
    setIsDropdownOpen(false);
    onLogout();
  };

  const handleThemeToggle = () => {
    toggleTheme();
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between transition-colors duration-200">
      <div className="flex items-center">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-md text-gray-400 dark:text-gray-300 hover:text-gray-500 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 lg:hidden transition-colors duration-200"
        >
          <span className="sr-only">Otwórz menu</span>
          <svg
            className="h-6 w-6"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
        <h1 className="ml-3 text-xl font-semibold text-gray-900 dark:text-white transition-colors duration-200">
          SZN - System Zarządzania Narzędziownią
        </h1>
      </div>

      <div className="flex items-center space-x-4">
        {/* User Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={toggleDropdown}
            className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors duration-200"
          >
            <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-white">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="hidden md:block text-left">
              <div className="text-sm font-medium text-gray-900 dark:text-white transition-colors duration-200">
                {user?.full_name || user?.username || 'Użytkownik'}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 transition-colors duration-200">
                {user?.role || 'Rola'}
              </div>
            </div>
            <svg
              className={`w-4 h-4 text-gray-400 dark:text-gray-300 transition-all duration-200 ${
                isDropdownOpen ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50 transition-colors duration-200">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center">
                    <span className="text-base font-medium text-white">
                      {user?.username?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white transition-colors duration-200">
                      {user?.full_name || user?.username || 'Użytkownik'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 transition-colors duration-200">
                      @{user?.username || 'username'}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold mb-1 transition-colors duration-200">
                  Rola
                </div>
                <div className="text-sm text-gray-900 dark:text-white font-medium transition-colors duration-200">
                  {user?.role === 'administrator' ? 'Administrator' : 
                   user?.role === 'manager' ? 'Menedżer' : 
                   user?.role === 'user' ? 'Użytkownik' : 
                   user?.role || 'Nieznana'}
                </div>
              </div>

              <div className="py-1">
                <button
                  onClick={handleThemeToggle}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white flex items-center justify-between transition-colors duration-200"
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {isDarkMode ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                      )}
                    </svg>
                    <span>{isDarkMode ? 'Tryb jasny' : 'Tryb ciemny'}</span>
                  </div>
                  <div className={`w-10 h-5 rounded-full p-1 transition-colors duration-200 ${isDarkMode ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                    <div className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 ${isDarkMode ? 'translate-x-5' : 'translate-x-0'}`}></div>
                  </div>
                </button>
                
                <button
                  onClick={handleLogoutClick}
                  className="w-full text-left px-4 py-2 text-sm text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-900 flex items-center space-x-2 transition-colors duration-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Wyloguj się</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopBar;
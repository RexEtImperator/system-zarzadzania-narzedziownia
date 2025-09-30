import React from 'react';

const TopBar = ({ user, onLogout, onToggleSidebar, isSidebarOpen }) => {
  return (
    <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 lg:hidden"
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
        <h1 className="ml-3 text-xl font-semibold text-gray-900">
          System Zarządzania Pracownikami
        </h1>
      </div>

      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-white">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <div className="hidden md:block">
            <div className="text-sm font-medium text-gray-900">
              {user?.username || 'Użytkownik'}
            </div>
            <div className="text-xs text-gray-500">
              {user?.role || 'Rola'}
            </div>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Wyloguj
        </button>
      </div>
    </div>
  );
};

export default TopBar;
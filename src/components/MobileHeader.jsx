import React from 'react';
import { Bars3Icon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';

const MobileHeader = ({ user, onLogout, onToggleSidebar }) => {
  return (
    <div className="lg:hidden bg-white shadow-sm border-b border-gray-200">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
          >
            <span className="sr-only">Otwórz menu</span>
            <Bars3Icon className="h-6 w-6" aria-hidden="true" />
          </button>
          <h1 className="ml-3 text-lg font-semibold text-gray-900 truncate">
            Zarządzanie
          </h1>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-white">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-medium text-gray-900 truncate max-w-24">
                {user?.username || 'Użytkownik'}
              </div>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="inline-flex items-center p-2 border border-transparent rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
            title="Wyloguj"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileHeader;
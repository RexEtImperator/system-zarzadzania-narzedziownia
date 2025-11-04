import React, { useEffect, useState } from 'react';
import { PERMISSIONS, hasPermission } from '../constants';
import { HomeIcon, UsersIcon, WrenchScrewdriverIcon, ChartBarIcon, Cog6ToothIcon, ClipboardDocumentListIcon, Cog8ToothIcon } from '@heroicons/react/24/outline';

const Sidebar = ({ 
  onNav, 
  current, 
  user, 
  isMobileOpen, 
  onMobileClose 
}) => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  const formattedDateTime = now.toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'medium' });
  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: (<HomeIcon className="w-5 h-5" aria-hidden="true" />),
      permission: null
    },
    {
      id: 'employees',
      label: 'Pracownicy',
      icon: (<UsersIcon className="w-5 h-5" aria-hidden="true" />),
      permission: PERMISSIONS.VIEW_USERS
    },
    {
      id: 'tools',
      label: 'Narzędzia',
      icon: (<WrenchScrewdriverIcon className="w-5 h-5" aria-hidden="true" />),
      permission: PERMISSIONS.VIEW_TOOLS
    },
    {
      id: 'analytics',
      label: 'Analityka',
      icon: (<ChartBarIcon className="w-5 h-5" aria-hidden="true" />),
      permission: PERMISSIONS.VIEW_ANALYTICS
    },
    {
      id: 'config',
      label: 'Konfiguracja',
      icon: (<Cog6ToothIcon className="w-5 h-5" aria-hidden="true" />),
      permission: PERMISSIONS.SYSTEM_SETTINGS
    },
    {
      id: 'audit',
      label: 'Dziennik audytu',
      icon: (<ClipboardDocumentListIcon className="w-5 h-5" aria-hidden="true" />),
      permission: PERMISSIONS.VIEW_AUDIT_LOG
    },
    {
      id: 'admin',
      label: 'Ustawienia',
      icon: (<Cog8ToothIcon className="w-5 h-5" aria-hidden="true" />),
      permission: PERMISSIONS.VIEW_ADMIN
    }
  ];

  const filteredMenuItems = menuItems.filter(item => 
    !item.permission || hasPermission(user, item.permission)
  );

  const handleItemClick = (screenId) => {
    onNav(screenId);
    if (onMobileClose) {
      onMobileClose();
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 px-4 bg-indigo-600">
            <img src="/logo.png" alt="Logo" className="h-10 object-contain" />
          </div>
          {/* Date & time under logo */}
          <div className="px-4 py-2 text-xs text-gray-600 border-b border-gray-200 bg-gray-50">
            {formattedDateTime}
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
            {filteredMenuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`
                  w-full flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors duration-150
                  ${current === item.id
                    ? 'bg-indigo-100 text-indigo-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                <span className="mr-3">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          {/* User info */}
          <div className="flex-shrink-0 p-4 border-t border-gray-200">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-white">
                  {user?.username?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">
                  {user?.username || 'Użytkownik'}
                </p>
                <p className="text-xs text-gray-500">
                  {user?.role || 'Rola'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
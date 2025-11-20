import React, { useEffect, useState } from 'react';
import { PERMISSIONS, hasPermission } from '../constants';
import { HomeIcon, UsersIcon, WrenchScrewdriverIcon, ChartBarIcon, Cog6ToothIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/solid';
import { useLanguage } from '../contexts/LanguageContext';

const Sidebar = ({ 
  onNav, 
  current, 
  user, 
  isMobileOpen, 
  onMobileClose,
  collapsed = false
}) => {
  const { t, language } = useLanguage();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  const locale = language === 'de' ? 'de-DE' : (language === 'en' ? 'en-GB' : 'pl-PL');
  const menuItems = [
    {
      id: 'dashboard',
      label: t('sidebar.dashboard'),
      icon: (<HomeIcon className="w-5 h-5" aria-hidden="true" />),
      permission: null
    },
    {
      id: 'employees',
      label: t('sidebar.employees'),
      icon: (<UsersIcon className="w-5 h-5" aria-hidden="true" />),
      permission: PERMISSIONS.VIEW_USERS
    },
    {
      id: 'tools',
      label: t('sidebar.tools'),
      icon: (<WrenchScrewdriverIcon className="w-5 h-5" aria-hidden="true" />),
      permission: PERMISSIONS.VIEW_TOOLS
    },
    {
      id: 'analytics',
      label: t('sidebar.analytics'),
      icon: (<ChartBarIcon className="w-5 h-5" aria-hidden="true" />),
      permission: PERMISSIONS.VIEW_ANALYTICS
    },
    {
      id: 'config',
      label: t('screens.config'),
      icon: (<Cog6ToothIcon className="w-5 h-5" aria-hidden="true" />),
      permission: PERMISSIONS.SYSTEM_SETTINGS
    },
    {
      id: 'audit',
      label: t('screens.audit'),
      icon: (<ClipboardDocumentListIcon className="w-5 h-5" aria-hidden="true" />),
      permission: PERMISSIONS.VIEW_AUDIT_LOG
    },
    {
      id: 'admin',
      label: t('sidebar.admin'),
      icon: (<Cog6ToothIcon className="w-5 h-5" aria-hidden="true" />),
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

      <div className={`fixed inset-y-0 left-0 z-50 ${collapsed ? 'w-16' : 'w-64'} bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} `}>
        <div className="flex flex-col h-full">
          <div className={`flex items-center justify-center h-16 ${collapsed ? 'px-1' : 'px-4'} bg-indigo-600`}>
            <img src="/logo.png" alt="Logo" className={`${collapsed ? 'h-8' : 'h-10'} object-contain`} />
          </div>
          <nav className={`flex-1 ${collapsed ? 'px-1' : 'px-2'} py-4 space-y-1 overflow-y-auto`}>
            {filteredMenuItems.map((item) => (
              <div key={item.id} className="relative">
                <button
                  onClick={() => handleItemClick(item.id)}
                  className={`
                    w-full flex items-center ${collapsed ? 'justify-center' : ''} px-2 py-2 text-sm font-medium rounded-md transition-colors duration-150
                    ${current === item.id
                      ? 'bg-indigo-100 text-indigo-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                  {...(collapsed ? { 'data-tooltip-target': `tooltip-${item.id}`, 'data-tooltip-placement': 'right' } : {})}
                >
                  <span className={`${collapsed ? '' : 'mr-3'}`}>{item.icon}</span>
                  {!collapsed && (
                    <span>{item.label}</span>
                  )}
                </button>
                {collapsed && (
                  <div
                    id={`tooltip-${item.id}`}
                    role="tooltip"
                    className={(() => {
                      const isLong = String(item.label || '').length > 16;
                      const base = 'absolute z-50 inline-block font-medium text-white bg-gray-900 rounded-lg shadow-sm opacity-0 tooltip dark:bg-gray-700';
                      const size = isLong ? 'px-4 py-3 text-sm whitespace-nowrap' : 'px-3 py-2 text-xs whitespace-nowrap';
                      return `${base} ${size}`;
                    })()}
                  >
                    {item.label}
                    <div className="tooltip-arrow" data-popper-arrow></div>
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* User info */}
          <div className={`flex-shrink-0 ${collapsed ? 'p-2' : 'p-4'} border-t border-gray-200`}>
            <div className="flex items-center">
              <div className={`${collapsed ? 'w-8 h-8' : 'w-8 h-8'} bg-indigo-500 rounded-full flex items-center justify-center`}>
                <span className="text-sm font-medium text-white">
                  {user?.username?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              {!collapsed && (
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">
                    {user?.username || t('topbar.user')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {user?.role || t('topbar.role')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
import React, { useState, useRef, useEffect } from 'react';
import { WrenchIcon, Bars3Icon, ChevronDownIcon, ChevronUpIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon, SunIcon, MoonIcon, BellIcon, CircleStackIcon, ShieldExclamationIcon, ClockIcon, CheckIcon, CheckCircleIcon, ArrowLeftStartOnRectangleIcon } from '@heroicons/react/24/outline';
import api from '../api';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { hasPermission, PERMISSIONS } from '../constants';

const TopBar = ({ user, onLogout, onToggleSidebar, isSidebarCollapsed, onToggleSidebarCollapse, onNavigate }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { isDarkMode, toggleTheme } = useTheme();
  const [bellOpen, setBellOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const bellRef = useRef(null);

  const { t, language } = useLanguage();

  // Helper for formatting and calculations in the notification UI
  const parseDateFlexibleUI = (val) => {
    if (!val) return null;
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      const d = new Date(str);
      return isNaN(d.getTime()) ? null : d;
    }
    const m = str.match(/^(\d{2})[.\/-](\d{2})[.\/-](\d{4})/);
    if (m) {
      const [, dd, mm, yyyy] = m;
      const d = new Date(`${yyyy}-${mm}-${dd}`);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  };

  const calcDaysOverdue = (dateStr) => {
    const d = parseDateFlexibleUI(dateStr);
    if (!d) return null;
    const today = new Date();
    const diffMs = d.setHours(0,0,0,0) - today.setHours(0,0,0,0);
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return days < 0 ? Math.abs(days) : 0;
  };

  const formatDatePL = (dateStr) => {
    const d = parseDateFlexibleUI(dateStr);
    if (!d) return String(dateStr || '-');
    try {
      const locale = language === 'de' ? 'de-DE' : (language === 'en' ? 'en-US' : 'pl-PL');
      return d.toLocaleDateString(locale);
    } catch (_) {
      return String(dateStr || '-');
    }
  };

  // Close dropdown when clicking outside of it
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

  // Close notifications (bell) when clicking outside of its area
  useEffect(() => {
    const handleClickOutsideBell = (event) => {
      if (bellRef.current && !bellRef.current.contains(event.target)) {
        setBellOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutsideBell);
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideBell);
    };
  }, []);

  // Close dropdown notifications when clicking Escape
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        setBellOpen(false);
      }
    };

    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  // Close dropdown user when clicking Escape
  useEffect(() => {
    const handleUserDropdownEsc = (event) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('keydown', handleUserDropdownEsc);
    return () => {
      document.removeEventListener('keydown', handleUserDropdownEsc);
    };
  }, []);

  // Load notifications:
  // - If user has management/admin perms: include overdue inspections (BHP/Tools)
  // - Always include user-specific notifications (e.g., return requests)
  // Do not mark as read automatically — user does it manually
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const canSeeOverdue = (
          hasPermission(user, PERMISSIONS.MANAGE_TOOLS) ||
          hasPermission(user, PERMISSIONS.MANAGE_BHP) ||
          hasPermission(user, PERMISSIONS.SYSTEM_SETTINGS)
        );

        // Fetch user-specific notifications
        const userNotifsRaw = await api.get('/api/notifications').catch(() => []);
        const userNotifs = (Array.isArray(userNotifsRaw) ? userNotifsRaw : []).map(n => ({
          id: String(n.id || `${n.item_type || 'tool'}-${n.item_id || Math.random()}`),
          type: 'return_request',
          itemType: String(n.item_type || 'tool'),
          inventory_number: n.inventory_number || '-',
          manufacturer: n.manufacturer || '',
          model: n.model || '',
          employee_id: n.employee_id || null,
          employee_brand_number: n.employee_brand_number || '',
          message: n.message || '',
          created_at: n.created_at || n.createdAt || null,
          read: !!n.read
        }));

        let overdueNotifs = [];
        if (canSeeOverdue) {
          const [bhpItems, tools] = await Promise.all([
            api.get('/api/bhp?sortBy=inspection_date&sortDir=asc').catch(() => []),
            api.get('/api/tools?sortBy=inventory_number&sortDir=asc').catch(() => [])
          ]);
          const today = new Date();
          const parseDateFlexible = (val) => {
            if (!val) return null;
            const str = String(val).trim();
            if (/^\d{4}-\d{2}-\d{2}/.test(str)) { // ISO: yyyy-mm-dd
              const d = new Date(str);
              return isNaN(d.getTime()) ? null : d;
            }
            const m = str.match(/^(\d{2})[.\/-](\d{2})[.\/-](\d{4})/); // dd.mm.yyyy
            if (m) {
              const [, dd, mm, yyyy] = m;
              const d = new Date(`${yyyy}-${mm}-${dd}`);
              return isNaN(d.getTime()) ? null : d;
            }
            const d = new Date(str);
            return isNaN(d.getTime()) ? null : d;
          };
          const onlyOverdue = (arr, pick) => (Array.isArray(arr) ? arr : []).filter(i => {
            const dateStr = pick(i);
            const d = parseDateFlexible(dateStr);
            return !!d && d < today;
          });

          const bhpList = Array.isArray(bhpItems) ? bhpItems : (Array.isArray(bhpItems?.data) ? bhpItems.data : []);
          const overdueBhp = onlyOverdue(bhpList, x => x.inspection_date);
          const toolsList = Array.isArray(tools) ? tools : (Array.isArray(tools?.data) ? tools.data : []);
          const overdueTools = onlyOverdue(toolsList, x => x.inspection_date);

          const ackBhpRaw = localStorage.getItem('bhp_overdue_ack_v2') || '{}';
          const ackToolsRaw = localStorage.getItem('tools_overdue_ack_v2') || '{}';
          const ackBhp = JSON.parse(ackBhpRaw);
          const ackTools = JSON.parse(ackToolsRaw);

          overdueNotifs = [];
          overdueBhp.forEach(i => {
            const key = String(i.id);
            const dateVal = String(i.inspection_date);
            const read = ackBhp[key] === dateVal;
            overdueNotifs.push({
              id: `bhp-${i.id}`,
              type: 'bhp',
              inventory_number: i.inventory_number || '-',
              inspection_date: i.inspection_date,
              manufacturer: i.manufacturer || '',
              model: i.model || '',
              read
            });
          });
          overdueTools.forEach(t => {
            const key = String(t.id);
            const dateVal = String(t.inspection_date);
            const read = ackTools[key] === dateVal;
            overdueNotifs.push({
              id: `tool-${t.id}`,
              type: 'tool',
              inventory_number: t.inventory_number || t.sku || '-',
              inspection_date: t.inspection_date,
              manufacturer: '',
              model: t.name || '',
              read
            });
          });
        }

        if (mounted) {
          setNotifications([ ...userNotifs, ...overdueNotifs ]);
        }
      } catch (err) {
        if (mounted) setNotifications([]);
        console.warn('Failed to load notifications:', err?.message || err);
      }
    };
    load();
    return () => { mounted = false; };
  }, [user]);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleLogoutClick = () => {
    setIsDropdownOpen(false);
    onLogout();
  };

  const handleOpenSettings = () => {
    setIsDropdownOpen(false);
    if (onNavigate) {
      onNavigate('user-settings');
    }
  };

  const handleThemeToggle = () => {
    toggleTheme();
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm px-4 py-3 flex items-center justify-between transition-colors duration-200">
      <div className="flex items-center">
        <button
          onClick={onToggleSidebarCollapse}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors duration-200 hidden lg:inline-flex"
          aria-label={isSidebarCollapsed ? t('topbar.expandSidebar') : t('topbar.collapseSidebar')}
          title={isSidebarCollapsed ? t('topbar.expandSidebar') : t('topbar.collapseSidebar')}
        >
          {isSidebarCollapsed ? (
            <ChevronDoubleRightIcon className="w-5 h-5 text-gray-500 dark:text-gray-300" aria-hidden="true" />
          ) : (
            <ChevronDoubleLeftIcon className="w-5 h-5 text-gray-500 dark:text-gray-300" aria-hidden="true" />
          )}
        </button>
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-md text-gray-400 dark:text-gray-300 hover:text-gray-500 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 lg:hidden transition-colors duration-200"
        >
          <span className="sr-only">{t('topbar.openMenu')}</span>
          <Bars3Icon className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-center space-x-4">
        {/* Bell icon with notifications for BHP */}
        <div className="relative" ref={bellRef}>
          <button
            onClick={() => setBellOpen(prev => !prev)}
            className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors duration-200"
            aria-label={t('topbar.notifications')}
          >
            <BellIcon className="w-6 h-6 text-gray-500 dark:text-gray-300" aria-hidden="true" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
          {bellOpen && (
            <div className="fixed inset-x-3 top-14 mx-auto max-w-[calc(100vw-1.5rem)] sm:absolute sm:right-0 sm:w-96 sm:inset-auto sm:top-full sm:mt-2 sm:mx-0 sm:max-w-none bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50">
              <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">{t('topbar.notifications')}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{
                      (hasPermission(user, PERMISSIONS.MANAGE_TOOLS) || hasPermission(user, PERMISSIONS.MANAGE_BHP) || hasPermission(user, PERMISSIONS.SYSTEM_SETTINGS))
                        ? t('topbar.overdueInspections')
                        : t('topbar.userNotifications')
                    }</div>
                  </div>
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          const ackBhpRaw = localStorage.getItem('bhp_overdue_ack_v2') || '{}';
                          const ackToolsRaw = localStorage.getItem('tools_overdue_ack_v2') || '{}';
                          const ackBhp = JSON.parse(ackBhpRaw);
                          const ackTools = JSON.parse(ackToolsRaw);
                          notifications.forEach(n => {
                            const dateVal = String(n.inspection_date);
                            if (n.type === 'bhp') {
                              const key = n.id.replace('bhp-', '');
                              ackBhp[key] = dateVal;
                            } else {
                              const key = n.id.replace('tool-', '');
                              ackTools[key] = dateVal;
                            }
                          });
                          localStorage.setItem('bhp_overdue_ack_v2', JSON.stringify(ackBhp));
                          localStorage.setItem('tools_overdue_ack_v2', JSON.stringify(ackTools));
                          setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                        } catch (_) {}
                      }}
                      className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600"
                    >
                      {t('topbar.markAllRead')}
                    </button>
                  )}
                </div>
              </div>
              <div className="max-h-[70vh] sm:max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">{t('topbar.noNotifications')}</div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      className={`px-4 py-3 transition-colors border-l-4 ${
                        n.read
                          ? 'bg-slate-50 dark:bg-slate-700/30 border-slate-300 dark:border-slate-600 opacity-75'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 border-red-500 dark:border-red-600'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300">
                            {n.type === 'bhp' ? (
                              <ShieldExclamationIcon className="w-5 h-5" aria-hidden="true" />
                            ) : n.type === 'tool' ? (
                              <WrenchIcon className="w-5 h-5" aria-hidden="true" />
                            ) : (
                              <BellIcon className="w-5 h-5" aria-hidden="true" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  try {
                                    const screen = n.type === 'bhp' ? 'bhp' : (n.type === 'tool' ? 'tools' : (n.itemType === 'bhp' ? 'bhp' : 'tools'));
                                    const q = n.inventory_number || n.model || '';
                                    window.dispatchEvent(new CustomEvent('navigate', { detail: { screen, q } }));
                                    setBellOpen(false);
                                  } catch (_) {}
                                }}
                                className="text-sm font-medium text-gray-900 dark:text-white hover:underline"
                              >
                                {n.type === 'return_request' 
                                  ? (n.inventory_number || n.model || t('topbar.returnRequest')) 
                                  : (n.inventory_number || n.model || '-')}
                              </button>
                              {n.type === 'bhp' || n.type === 'tool' ? (
                                <span className="inline-flex items-center px-2 py-0.5 text-[11px] rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                  {n.type === 'bhp' ? t('topbar.type.bhp') : t('topbar.type.tools')}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 text-[11px] rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                  {n.itemType === 'bhp' ? t('topbar.type.bhp') : t('topbar.type.tools')}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-300">{[n.manufacturer, n.model].filter(Boolean).join(' ')}</div>
                            {n.employee_brand_number ? (
                              <div className="text-[11px] text-gray-600 dark:text-gray-300 mt-0.5">
                                {t('employees.brandNumber')}: <span className="font-mono">{n.employee_brand_number}</span>
                              </div>
                            ) : null}
                            {n.message ? (
                              <div className="text-xs text-gray-700 dark:text-gray-200 mt-1">{n.message}</div>
                            ) : null}
                          </div>
                        </div>
                        <div className="text-right">
                          {n.type === 'bhp' || n.type === 'tool' ? (
                            <>
                              <div className="flex items-center justify-end gap-1 text-xs font-medium text-red-600 dark:text-red-400">
                                <ClockIcon className="w-4 h-4" aria-hidden="true" />
                                <span>{t('topbar.overdue')}: {calcDaysOverdue(n.inspection_date) ?? '-'} {t('common.days')}</span>
                              </div>
                              <div className="text-[11px] text-gray-500 dark:text-gray-400">{formatDatePL(n.inspection_date)}</div>
                            </>
                          ) : (
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">{n.created_at ? formatDatePL(n.created_at) : ''}</div>
                          )}
                          <div className="mt-2 flex items-center justify-end gap-2">
                            {n.read ? (
                              <span className="inline-flex items-center" title={t('topbar.read')} aria-label={t('topbar.read')}>
                                <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400" aria-hidden="true" />
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  try {
                                    if (n.type === 'bhp' || n.type === 'tool') {
                                      const ackKey = n.type === 'bhp' ? 'bhp_overdue_ack_v2' : 'tools_overdue_ack_v2';
                                      const raw = localStorage.getItem(ackKey) || '{}';
                                      const map = JSON.parse(raw);
                                      const id = n.id.replace(n.type === 'bhp' ? 'bhp-' : 'tool-', '');
                                      map[id] = String(n.inspection_date);
                                      localStorage.setItem(ackKey, JSON.stringify(map));
                                    } else {
                                      // User-specific notifications: notify backend about read state if available
                                      api.post(`/api/notifications/${encodeURIComponent(n.id)}/read`, {}).catch(() => {});
                                    }
                                    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
                                  } catch (_) {}
                                }}
                                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                                title={t('topbar.markRead')}
                                aria-label={t('topbar.markRead')}
                              >
                                <CheckIcon className="w-5 h-5 text-slate-700 dark:text-slate-200" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        {/* User Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={toggleDropdown}
            className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors duration-200"
          >
            <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-white">
                {user?.full_name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="hidden md:block text-left">
              <div className="text-sm font-medium text-gray-900 dark:text-white transition-colors duration-200">
                {user?.full_name || user?.username}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 transition-colors duration-200">
                {user?.role === 'administrator' ? t('topbar.roles.administrator') :
                  user?.role === 'manager' ? t('topbar.roles.manager') :
                  user?.role === 'employee' ? t('topbar.roles.employee') :
                  (user?.role || t('topbar.roles.unknown'))}
              </div>
            </div>
            <ChevronDownIcon
              className={`w-4 h-4 text-gray-400 dark:text-gray-300 transition-all duration-200 ${
                isDropdownOpen ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50 transition-colors duration-200">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center">
                    <span className="text-base font-medium text-white">
                      {user?.full_name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white transition-colors duration-200">
                      {user?.full_name || user?.username || t('topbar.user')}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 transition-colors duration-200">
                      @{user?.username || 'username'}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold mb-1 transition-colors duration-200">
                  {t('topbar.role')}
                </div>
                <div className="text-sm text-gray-900 dark:text-white font-medium transition-colors duration-200">
                  {user?.role === 'administrator' ? t('topbar.roles.administrator') :
                   user?.role === 'manager' ? t('topbar.roles.manager') :
                   user?.role === 'employee' ? t('topbar.roles.employee') :
                   user?.role || t('topbar.roles.unknown')}
                </div>
              </div>

              <div className="py-1">
                <button
                  onClick={handleOpenSettings}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white flex items-center space-x-2 transition-colors duration-200"
                >
                  <WrenchIcon className="w-5 h-5" aria-hidden="true" />
                  <span>{t('topbar.settings')}</span>
                </button>
                {user?.role === 'administrator' && (
                  <button
                    onClick={() => { setIsDropdownOpen(false); onNavigate && onNavigate('db-viewer'); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white flex items-center space-x-2 transition-colors duration-200"
                  >
                    <CircleStackIcon className="w-5 h-5" aria-hidden="true" />
                    <span>{t('topbar.dbViewer')}</span>
                  </button>
                )}
                <button
                  onClick={handleThemeToggle}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white flex items-center justify-between transition-colors duration-200"
                >
                  <div className="flex items-center space-x-2">
                    {isDarkMode ? (
                      <SunIcon className="w-5 h-5" aria-hidden="true" />
                    ) : (
                      <MoonIcon className="w-5 h-5" aria-hidden="true" />
                    )}
                    <span>{isDarkMode ? t('topbar.themeLight') : t('topbar.themeDark')}</span>
                  </div>
                  <div className={`w-10 h-5 rounded-full p-1 transition-colors duration-200 ${isDarkMode ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                    <div className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 ${isDarkMode ? 'translate-x-5' : 'translate-x-0'}`}></div>
                  </div>
                </button>
                
                <button
                  onClick={handleLogoutClick}
                  className="w-full text-left px-4 py-2 text-sm text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-900 flex items-center space-x-2 transition-colors duration-200"
                >
                  <ArrowLeftStartOnRectangleIcon className="w-5 h-5" aria-hidden="true" />
                  <span>{t('topbar.logout')}</span>
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
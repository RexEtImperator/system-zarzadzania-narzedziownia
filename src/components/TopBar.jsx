import React, { useState, useRef, useEffect } from 'react';
import { WrenchIcon, Bars3Icon, ChevronDownIcon, SunIcon, MoonIcon, ArrowRightOnRectangleIcon, BellIcon, ShieldExclamationIcon, ClockIcon, CheckIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import api from '../api';
import { useTheme } from '../contexts/ThemeContext';

const TopBar = ({ user, onLogout, onToggleSidebar, isSidebarOpen, appName, onNavigate }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { isDarkMode, toggleTheme } = useTheme();
  const [bellOpen, setBellOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const bellRef = useRef(null);

  // Helpers do formatowania i obliczeń w UI powiadomień
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
      return d.toLocaleDateString('pl-PL');
    } catch (_) {
      return String(dateStr || '-');
    }
  };

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

  // Zamknij powiadomienia (dzwonek) po kliknięciu poza jego obszarem
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

  // Zamykanie dropdownu powiadomień po wciśnięciu Escape
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

  // Zamykanie dropdownu użytkownika po wciśnięciu Escape
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

  // Powiadomienia o przeglądach po terminie (BHP i Narzędzia)
  // Nie oznaczaj automatycznie jako przeczytane — użytkownik robi to ręcznie
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [bhpItems, tools] = await Promise.all([
          api.get('/api/bhp').catch(() => []),
          api.get('/api/tools').catch(() => [])
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

        const overdueBhp = onlyOverdue(bhpItems, x => x.inspection_date);
        const overdueTools = onlyOverdue(tools, x => x.inspection_date);

        // Użyj nowego klucza ACK (v2), aby uniknąć starego auto-ack
        const ackBhpRaw = localStorage.getItem('bhp_overdue_ack_v2') || '{}';
        const ackToolsRaw = localStorage.getItem('tools_overdue_ack_v2') || '{}';
        const ackBhp = JSON.parse(ackBhpRaw);
        const ackTools = JSON.parse(ackToolsRaw);

        const fresh = [];
        overdueBhp.forEach(i => {
          const key = String(i.id);
          const dateVal = String(i.inspection_date);
          const read = ackBhp[key] === dateVal;
          fresh.push({
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
          fresh.push({
            id: `tool-${t.id}`,
            type: 'tool',
            inventory_number: t.inventory_number || t.sku || '-',
            inspection_date: t.inspection_date,
            manufacturer: '',
            model: t.name || '',
            read
          });
        });

        if (mounted) {
          setNotifications(fresh);
        }
      } catch (err) {
        // Brak powiadomień w razie błędu
        if (mounted) setNotifications([]);
        console.warn('Nie udało się pobrać powiadomień BHP:', err?.message || err);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

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
    <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between transition-colors duration-200">
      <div className="flex items-center">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-md text-gray-400 dark:text-gray-300 hover:text-gray-500 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 lg:hidden transition-colors duration-200"
        >
          <span className="sr-only">Otwórz menu</span>
          <Bars3Icon className="h-6 w-6" aria-hidden="true" />
        </button>
        <h1 className="ml-3 text-xl font-semibold text-gray-900 dark:text-white transition-colors duration-200">
          {appName || 'SZN - System Zarządzania Narzędziownią'}
        </h1>
      </div>

      <div className="flex items-center space-x-4">
        {/* Dzwonek z powiadomieniami BHP */}
        <div className="relative" ref={bellRef}>
          <button
            onClick={() => setBellOpen(prev => !prev)}
            className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors duration-200"
            aria-label="Powiadomienia"
          >
            <BellIcon className="w-6 h-6 text-gray-500 dark:text-gray-300" aria-hidden="true" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
          {bellOpen && (
            <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50">
              <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">Powiadomienia</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Przeglądy po terminie (BHP i Narzędzia)</div>
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
                      Oznacz wszystkie jako przeczytane
                    </button>
                  )}
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">Brak nowych powiadomień</div>
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
                            ) : (
                              <WrenchIcon className="w-5 h-5" aria-hidden="true" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  try {
                                    const screen = n.type === 'bhp' ? 'bhp' : 'tools';
                                    const q = n.inventory_number || n.model || '';
                                    window.dispatchEvent(new CustomEvent('navigate', { detail: { screen, q } }));
                                    setBellOpen(false);
                                  } catch (_) {}
                                }}
                                className="text-sm font-medium text-gray-900 dark:text-white hover:underline"
                              >
                                {n.inventory_number}
                              </button>
                              <span className="inline-flex items-center px-2 py-0.5 text-[11px] rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                {n.type === 'bhp' ? 'BHP' : 'Narzędzia'}
                              </span>
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-300">{[n.manufacturer, n.model].filter(Boolean).join(' ')}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center justify-end gap-1 text-xs font-medium text-red-600 dark:text-red-400">
                            <ClockIcon className="w-4 h-4" aria-hidden="true" />
                            <span>Po terminie: {calcDaysOverdue(n.inspection_date) ?? '-'} dni</span>
                          </div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400">{formatDatePL(n.inspection_date)}</div>
                          <div className="mt-2 flex items-center justify-end gap-2">
                            {n.read ? (
                              <span className="inline-flex items-center" title="Przeczytano" aria-label="Przeczytano">
                                <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400" aria-hidden="true" />
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  try {
                                    const ackKey = n.type === 'bhp' ? 'bhp_overdue_ack_v2' : 'tools_overdue_ack_v2';
                                    const raw = localStorage.getItem(ackKey) || '{}';
                                    const map = JSON.parse(raw);
                                    const id = n.id.replace(n.type === 'bhp' ? 'bhp-' : 'tool-', '');
                                    map[id] = String(n.inspection_date);
                                    localStorage.setItem(ackKey, JSON.stringify(map));
                                    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
                                  } catch (_) {}
                                }}
                                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                                title="Oznacz jako przeczytane"
                                aria-label="Oznacz jako przeczytane"
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
                  onClick={handleOpenSettings}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white flex items-center space-x-2 transition-colors duration-200"
               >
                  {/** Ikona klucza (wrench) z Heroicons */}
                  <WrenchIcon className="w-5 h-5 flex-shrink-0 text-gray-500" aria-hidden="true" />
                  <span>Ustawienia</span>
                </button>
                {user?.role === 'administrator' && (
                  <button
                    onClick={() => { setIsDropdownOpen(false); onNavigate && onNavigate('db-viewer'); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white flex items-center space-x-2 transition-colors duration-200"
                  >
                    <span className="w-5 h-5 flex-shrink-0 text-gray-500" aria-hidden="true">📄</span>
                    <span>Podgląd bazy danych</span>
                  </button>
                )}
                <button
                  onClick={handleThemeToggle}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white flex items-center justify-between transition-colors duration-200"
                >
                  <div className="flex items-center space-x-2">
                    {isDarkMode ? (
                      <SunIcon className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <MoonIcon className="w-4 h-4" aria-hidden="true" />
                    )}
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
                  <ArrowRightOnRectangleIcon className="w-4 h-4" aria-hidden="true" />
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
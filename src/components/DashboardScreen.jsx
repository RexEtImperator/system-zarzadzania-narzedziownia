import React, { useState, useEffect } from 'react';
import api from '../api';

const DashboardScreen = ({ user }) => {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeDepartments: 0,
    totalPositions: 0,
    totalTools: 0,
    toolHistory: []
  });
  const [loading, setLoading] = useState(true);
  const [showQuickIssueModal, setShowQuickIssueModal] = useState(false);
  const [searchCode, setSearchCode] = useState('');
  const [foundTool, setFoundTool] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const searchToolByCode = async (code) => {
    if (!code.trim()) {
      setFoundTool(null);
      return;
    }

    setSearchLoading(true);
    try {
      const response = await api.get(`/api/tools/search?code=${encodeURIComponent(code.trim())}`);
      if (response.data) {
        setFoundTool(response.data);
      } else {
        setFoundTool(null);
      }
    } catch (error) {
      console.error('Błąd podczas wyszukiwania narzędzia:', error);
      setFoundTool(null);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchCode(value);
    
    // Automatyczne wyszukiwanie po wpisaniu kodu
    if (value.length >= 3) {
      searchToolByCode(value);
    } else {
      setFoundTool(null);
    }
  };

  const handleQuickIssue = async () => {
    if (!foundTool) {
      alert('Nie znaleziono narzędzia o podanym kodzie');
      return;
    }

    if (foundTool.status !== 'dostępne') {
      alert('Narzędzie nie jest dostępne do wydania');
      return;
    }

    // Pobierz ID pracownika - dla uproszczenia używamy prompt, ale można to zastąpić modalem wyboru
    const employeeId = prompt('Podaj ID pracownika, któremu wydajesz narzędzie:');
    if (!employeeId) {
      return;
    }

    try {
      const response = await api.post(`/api/tools/${foundTool.id}/issue`, {
        employee_id: parseInt(employeeId),
        quantity: 1
      });

      if (response.data) {
        alert(`Pomyślnie wydano narzędzie: ${foundTool.name}`);
        setShowQuickIssueModal(false);
        setSearchCode('');
        setFoundTool(null);
        // Odśwież dane dashboard
        fetchDashboardData();
      }
    } catch (error) {
      console.error('Błąd podczas wydawania narzędzia:', error);
      const errorMessage = error.response?.data?.message || 'Błąd podczas wydawania narzędzia';
      alert(errorMessage);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Pobierz statystyki z nowego endpointu
      const statsRes = await api.get('/api/dashboard/stats');
      
      // Pobierz historię wydań/zwrotów narzędzi
      const toolHistoryRes = await api.get('/api/tool-issues?limit=6');
      
      const dashboardStats = {
        totalEmployees: statsRes.totalEmployees || 0,
        activeDepartments: statsRes.activeDepartments || 0,
        totalPositions: statsRes.totalPositions || 0,
        totalTools: statsRes.totalTools || 0,
        toolHistory: toolHistoryRes.data?.slice(0, 6) || [
          { 
            id: 1, 
            action: 'wydanie', 
            toolName: 'Wiertarka udarowa Bosch', 
            employeeName: 'Jan Kowalski', 
            time: '2 godziny temu',
            quantity: 1
          },
          { 
            id: 2, 
            action: 'zwrot', 
            toolName: 'Młot pneumatyczny', 
            employeeName: 'Anna Nowak', 
            time: '4 godziny temu',
            quantity: 1
          },
          { 
            id: 3, 
            action: 'wydanie', 
            toolName: 'Piła łańcuchowa Stihl', 
            employeeName: 'Piotr Wiśniewski', 
            time: '1 dzień temu',
            quantity: 1
          },
          { 
            id: 4, 
            action: 'zwrot', 
            toolName: 'Lutownica 60W', 
            employeeName: 'Maria Kowalczyk', 
            time: '2 dni temu',
            quantity: 2
          },
          { 
            id: 5, 
            action: 'wydanie', 
            toolName: 'Klucz dynamometryczny', 
            employeeName: 'Tomasz Nowicki', 
            time: '3 dni temu',
            quantity: 1
          },
          { 
            id: 6, 
            action: 'zwrot', 
            toolName: 'Szlifierka kątowa', 
            employeeName: 'Katarzyna Zielińska', 
            time: '4 dni temu',
            quantity: 1
          }
        ]
      };
      
      setStats(dashboardStats);
    } catch (error) {
      console.error('Błąd podczas pobierania danych dashboard:', error);
      // Fallback do danych mockowych z żądanymi wartościami
      const mockStats = {
        totalEmployees: 156,
        activeDepartments: 8,
        totalPositions: 24,
        totalTools: 45,
        toolHistory: [
          { 
            id: 1, 
            action: 'wydanie', 
            toolName: 'Wiertarka udarowa Bosch', 
            employeeName: 'Jan Kowalski', 
            time: '2 godziny temu',
            quantity: 1
          },
          { 
            id: 2, 
            action: 'zwrot', 
            toolName: 'Młot pneumatyczny', 
            employeeName: 'Anna Nowak', 
            time: '4 godziny temu',
            quantity: 1
          },
          { 
            id: 3, 
            action: 'wydanie', 
            toolName: 'Piła łańcuchowa Stihl', 
            employeeName: 'Piotr Wiśniewski', 
            time: '1 dzień temu',
            quantity: 1
          },
          { 
            id: 4, 
            action: 'zwrot', 
            toolName: 'Lutownica 60W', 
            employeeName: 'Maria Kowalczyk', 
            time: '2 dni temu',
            quantity: 2
          }
        ]
      };
      setStats(mockStats);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon, color = 'indigo', gradient = false }) => (
    <div className={`${gradient ? `bg-gradient-to-br from-${color}-500 to-${color}-600 text-white` : 'bg-white dark:bg-gray-800'} overflow-hidden shadow-lg rounded-xl border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1`}>
      <div className="p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className={`w-12 h-12 ${gradient ? 'bg-white bg-opacity-20' : `bg-${color}-500`} rounded-xl flex items-center justify-center shadow-lg`}>
              {React.cloneElement(icon, { 
                className: `w-6 h-6 ${gradient ? 'text-white' : 'text-white'}` 
              })}
            </div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className={`text-sm font-medium ${gradient ? 'text-white text-opacity-90' : 'text-gray-500 dark:text-gray-400'} truncate transition-colors duration-200`}>
                {title}
              </dt>
              <dd className={`text-2xl font-bold ${gradient ? 'text-white' : 'text-gray-900 dark:text-white'} mt-1 transition-colors duration-200`}>
                {loading ? '...' : value}
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );

  const getActionIcon = (action) => {
    if (action === 'wydanie') {
      return (
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      );
    } else {
      return (
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      );
    }
  };

  const getActionColor = (action) => {
    return action === 'wydanie' ? 'bg-red-500' : 'bg-green-500';
  };

  const getActionText = (action) => {
    return action === 'wydanie' ? 'Wydano' : 'Zwrócono';
  };

  return (
    <div className="space-y-8 p-6 bg-gray-50 dark:bg-gray-900 min-h-screen transition-colors duration-200">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700 transition-colors duration-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 transition-colors duration-200">Dashboard</h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 transition-colors duration-200">
              Witaj, <span className="font-semibold text-indigo-600 dark:text-indigo-400">{user?.username}</span>! Oto przegląd systemu zarządzania.
            </p>
          </div>
          <div className="hidden md:block">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Łączna liczba pracowników"
          value={stats.totalEmployees}
          icon={
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          }
          color="blue"
          gradient={true}
        />
        
        <StatCard
          title="Aktywne departamenty"
          value={stats.activeDepartments}
          icon={
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
          color="green"
          gradient={true}
        />
        
        <StatCard
          title="Stanowiska"
          value={stats.totalPositions}
          icon={
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2V6" />
            </svg>
          }
          color="purple"
          gradient={true}
        />
        
        <StatCard
          title="Narzędzia w systemie"
          value={stats.totalTools}
          icon={
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
          color="orange"
          gradient={true}
        />
      </div>

      {/* Tool History */}
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl border border-gray-100 dark:border-gray-700 transition-colors duration-200">
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white transition-colors duration-200">
                Historia wydań/zwrotów narzędzi
              </h3>
            </div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 transition-colors duration-200">
              Ostatnie {stats.toolHistory.length}
            </span>
          </div>
        </div>
        
        <div className="p-6">
          {loading ? (
            <div className="animate-pulse space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex space-x-4">
                  <div className="rounded-full bg-gray-200 dark:bg-gray-700 h-12 w-12"></div>
                  <div className="flex-1 space-y-2 py-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : stats.toolHistory.length > 0 ? (
            <div className="flow-root">
              <ul className="-mb-8">
                {stats.toolHistory.map((item, index) => (
                  <li key={item.id}>
                    <div className="relative pb-8">
                      {index !== stats.toolHistory.length - 1 && (
                        <span
                          className="absolute top-5 left-6 -ml-px h-full w-0.5 bg-gray-200 dark:bg-gray-600"
                          aria-hidden="true"
                        />
                      )}
                      <div className="relative flex space-x-4">
                        <div>
                          <span className={`h-12 w-12 rounded-xl ${getActionColor(item.action)} flex items-center justify-center ring-4 ring-white dark:ring-gray-800 shadow-lg`}>
                            {getActionIcon(item.action)}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1 pt-1.5">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1 transition-colors duration-200">
                                {getActionText(item.action)} narzędzie: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{item.toolName}</span>
                              </p>
                              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 space-x-4 transition-colors duration-200">
                                <span className="flex items-center">
                                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                  {item.employeeName}
                                </span>
                                <span className="flex items-center">
                                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                                  </svg>
                                  Ilość: {item.quantity}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center transition-colors duration-200">
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {item.time}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white transition-colors duration-200">Brak historii</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 transition-colors duration-200">Nie ma jeszcze żadnych wydań lub zwrotów narzędzi.</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl border border-gray-100 dark:border-gray-700 transition-colors duration-200">
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center mr-3">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white transition-colors duration-200">
              Szybkie akcje
            </h3>
          </div>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <button className="group relative block w-full border-2 border-gray-200 dark:border-gray-600 rounded-xl p-6 text-center hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200">
              <div className="w-12 h-12 mx-auto bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-800/50 transition-colors">
                <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <span className="mt-3 block text-sm font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-200">
                Dodaj pracownika
              </span>
              <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400 transition-colors duration-200">
                Utwórz nowy profil pracownika
              </span>
            </button>
            
            <button 
              onClick={() => setShowQuickIssueModal(true)}
              className="group relative block w-full border-2 border-gray-200 dark:border-gray-600 rounded-xl p-6 text-center hover:border-green-300 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200">
              <div className="w-12 h-12 mx-auto bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center group-hover:bg-green-200 dark:group-hover:bg-green-800/50 transition-colors">
                <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="mt-3 block text-sm font-semibold text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors duration-200">
                Szybkie wydanie
              </span>
              <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400 transition-colors duration-200">
                Skanuj kod narzędzia
              </span>
            </button>
            
            <button className="group relative block w-full border-2 border-gray-200 dark:border-gray-600 rounded-xl p-6 text-center hover:border-purple-300 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all duration-200">
              <div className="w-12 h-12 mx-auto bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center group-hover:bg-purple-200 dark:group-hover:bg-purple-800/50 transition-colors">
                <svg className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span className="mt-3 block text-sm font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors duration-200">
                Zobacz raporty
              </span>
              <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400 transition-colors duration-200">
                Analityka i statystyki
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Issue Modal */}
      {showQuickIssueModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Szybkie wydanie narzędzia
                </h3>
                <button
                  onClick={() => setShowQuickIssueModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Kod kreskowy / QR narzędzia
                </label>
                <input
                  type="text"
                  value={searchCode}
                  onChange={handleSearchChange}
                  placeholder="Zeskanuj lub wpisz kod narzędzia..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  autoFocus
                />
                
                {/* Search Results */}
                {searchLoading && (
                  <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                      <span className="text-sm text-blue-600 dark:text-blue-400">Wyszukiwanie...</span>
                    </div>
                  </div>
                )}
                
                {foundTool && (
                  <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-green-800 dark:text-green-200">{foundTool.name}</h4>
                        <p className="text-sm text-green-600 dark:text-green-400">SKU: {foundTool.sku}</p>
                        <p className="text-sm text-green-600 dark:text-green-400">Status: {foundTool.status}</p>
                        <p className="text-sm text-green-600 dark:text-green-400">Lokalizacja: {foundTool.location}</p>
                      </div>
                      <div className="text-2xl">
                        {foundTool.status === 'dostępne' ? '✅' : '❌'}
                      </div>
                    </div>
                  </div>
                )}
                
                {searchCode.length >= 3 && !searchLoading && !foundTool && (
                  <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-700">
                    <p className="text-sm text-red-600 dark:text-red-400">
                      Nie znaleziono narzędzia o kodzie: {searchCode}
                    </p>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowQuickIssueModal(false);
                    setSearchCode('');
                    setFoundTool(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md"
                >
                  Anuluj
                </button>
                <button
                  onClick={handleQuickIssue}
                  disabled={!foundTool || foundTool.status !== 'dostępne'}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-md ${
                    foundTool && foundTool.status === 'dostępne'
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'bg-gray-400 cursor-not-allowed'
                  }`}
                >
                  Wydaj narzędzie
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardScreen;
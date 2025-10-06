import React, { createContext, useContext, useState, useLayoutEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme musi być używany w ramach ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Sprawdź localStorage przy inicjalizacji
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    // Sprawdź preferencje systemowe
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useLayoutEffect(() => {
    // Zapisz preferencje w localStorage
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');

    // Dodaj/usuń klasę dark z elementu html synchronicznie przed malowaniem
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const temporarilyDisableTransitions = () => {
    // Wyłącz przejścia kolorów podczas przełączania motywu, aby uniknąć efektu "po chwili"
    const root = document.documentElement;
    root.classList.add('notransition');
    // krótka przerwa na zastosowanie stylów, następnie usuń klasę
    setTimeout(() => {
      root.classList.remove('notransition');
    }, 50);
  };

  const toggleTheme = () => {
    temporarilyDisableTransitions();
    setIsDarkMode(prev => !prev);
  };

  const value = {
    isDarkMode,
    toggleTheme,
    theme: isDarkMode ? 'dark' : 'light'
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
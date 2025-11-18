import React, { createContext, useContext, useState, useLayoutEffect } from 'react';
import pl from '../i18n/pl.json';
import en from '../i18n/en.json';
import de from '../i18n/de.json';

const dictionaries = { pl, en, de };

const resolveKey = (dict, key) => {
  if (!dict || !key) return key;
  const parts = key.split('.');
  let cur = dict;
  for (const p of parts) {
    if (cur && Object.prototype.hasOwnProperty.call(cur, p)) {
      cur = cur[p];
    } else {
      return key;
    }
  }
  return typeof cur === 'string' ? cur : key;
};

const tImmediate = (key) => {
  try {
    const lang = localStorage.getItem('language');
    const dict = dictionaries[lang] || dictionaries.pl;
    return resolveKey(dict, key);
  } catch (_) {
    return key;
  }
};

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error(tImmediate('Theme.useThemeProvider'));
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
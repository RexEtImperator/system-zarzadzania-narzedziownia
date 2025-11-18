import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api';
import pl from '../i18n/pl.json';
import en from '../i18n/en.json';
import de from '../i18n/de.json';

const dictionaries = { pl, en, de };

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function interpolate(template, params) {
  if (!template || typeof template !== 'string' || !params) return template;
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    const re = new RegExp(`\\{${escapeRegExp(key)}\\}`, 'g');
    result = result.replace(re, String(value));
  }
  return result;
}

function resolveKey(dict, key) {
  if (!dict || !key) return key;
  const parts = key.split('.');
  let cur = dict;
  for (const p of parts) {
    if (cur && Object.prototype.hasOwnProperty.call(cur, p)) {
      cur = cur[p];
    } else {
      return key; // fallback to key when missing
    }
  }
  return typeof cur === 'string' ? cur : key;
}

const LanguageContext = createContext({
  language: 'pl',
  setLanguage: () => {},
  t: (k, params) => (params ? interpolate(k, params) : k),
});

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState('pl');
  const [overrides, setOverrides] = useState({});

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const stored = localStorage.getItem('language');
        if (stored && dictionaries[stored]) {
          if (mounted) setLanguageState(stored);
          return;
        }
        const general = await api.get('/api/config/general');
        const lang = general?.language;
        if (lang && dictionaries[lang]) {
          if (mounted) {
            setLanguageState(lang);
            localStorage.setItem('language', lang);
          }
        }
      } catch (err) {
        // silent fallback to default 'pl'
      }
    };
    init();
    const onLangChanged = (e) => {
      const lang = e?.detail?.language;
      if (lang && dictionaries[lang]) {
        setLanguageState(lang);
        localStorage.setItem('language', lang);
      }
    };
    window.addEventListener('language:changed', onLangChanged);
    return () => {
      mounted = false;
      window.removeEventListener('language:changed', onLangChanged);
    };
  }, []);

  // Pobierz nadpisania tłumaczeń z backendu dla bieżącego języka
  useEffect(() => {
    let ignore = false;
    const loadOverrides = async () => {
      try {
        const resp = await api.get(`/api/translations/${language}`);
        const map = resp?.translations || {};
        if (!ignore) setOverrides(map);
      } catch (_) {
        if (!ignore) setOverrides({});
      }
    };
    loadOverrides();
    return () => { ignore = true; };
  }, [language]);

  const setLanguage = (lang) => {
    if (dictionaries[lang]) {
      setLanguageState(lang);
      localStorage.setItem('language', lang);
      window.dispatchEvent(new CustomEvent('language:changed', { detail: { language: lang } }));
    }
  };

  const t = useMemo(() => {
    const dict = dictionaries[language] || dictionaries.pl;
    return (key, params) => {
      const raw = Object.prototype.hasOwnProperty.call(overrides, key)
        ? overrides[key]
        : resolveKey(dict, key);
      return interpolate(raw, params);
    };
  }, [language, overrides]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, t]);
  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
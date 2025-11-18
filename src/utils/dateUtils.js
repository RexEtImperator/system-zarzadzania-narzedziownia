const getLanguage = () => {
  const lang = typeof window !== 'undefined' ? window.localStorage.getItem('language') : null;
  return lang === 'en' || lang === 'de' ? lang : 'pl';
};

const getLocale = (lang) => {
  switch (lang) {
    case 'en':
      return 'en-GB';
    case 'de':
      return 'de-DE';
    default:
      return 'pl-PL';
  }
};

const isValidDate = (d) => d instanceof Date && !isNaN(d.getTime());

const pluralCategoryPl = (n) => {
  if (n === 1) return 'one';
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'few';
  return 'many';
};

const formatUnit = (lang, unit, count) => {
  if (lang === 'pl') {
    const cat = pluralCategoryPl(count);
    if (unit === 'minutes') {
      if (cat === 'one') return `${count} minuta temu`;
      if (cat === 'few') return `${count} minuty temu`;
      return `${count} minut temu`;
    }
    if (unit === 'hours') {
      if (cat === 'one') return `${count} godzina temu`;
      if (cat === 'few') return `${count} godziny temu`;
      return `${count} godzin temu`;
    }
    if (unit === 'days') {
      if (cat === 'one') return `${count} dzień temu`;
      return `${count} dni temu`;
    }
  }
  if (lang === 'en') {
    const isOne = count === 1;
    if (unit === 'minutes') return `${count} ${isOne ? 'minute' : 'minutes'} ago`;
    if (unit === 'hours') return `${count} ${isOne ? 'hour' : 'hours'} ago`;
    if (unit === 'days') return `${count} ${isOne ? 'day' : 'days'} ago`;
  }
  // de
  if (unit === 'minutes') return `vor ${count} ${count === 1 ? 'Minute' : 'Minuten'}`;
  if (unit === 'hours') return `vor ${count} ${count === 1 ? 'Stunde' : 'Stunden'}`;
  if (unit === 'days') return `vor ${count} ${count === 1 ? 'Tag' : 'Tagen'}`;
  return '';
};

export const formatTimeAgo = (dateString) => {
  const lang = getLanguage();
  if (!dateString) return lang === 'en' ? 'Unknown date' : lang === 'de' ? 'Unbekanntes Datum' : 'Nieznana data';

  const now = new Date();
  const date = new Date(dateString);
  if (!isValidDate(date)) return lang === 'en' ? 'Unknown date' : lang === 'de' ? 'Unbekanntes Datum' : 'Nieznana data';

  const diffInMs = now - date;
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMinutes < 1) {
    return lang === 'en' ? 'Just now' : lang === 'de' ? 'Gerade eben' : 'Przed chwilą';
  } else if (diffInMinutes < 60) {
    return formatUnit(lang, 'minutes', diffInMinutes);
  } else if (diffInHours < 24) {
    return formatUnit(lang, 'hours', diffInHours);
  } else if (diffInDays < 7) {
    return formatUnit(lang, 'days', diffInDays);
  } else {
    return date.toLocaleDateString(getLocale(lang));
  }
};

// Funkcja do formatowania daty w formacie polskim
export const formatDate = (dateString) => {
  const lang = getLanguage();
  if (!dateString) return lang === 'en' ? 'Unknown date' : lang === 'de' ? 'Unbekanntes Datum' : 'Nieznana data';

  const date = new Date(dateString);
  if (!isValidDate(date)) return lang === 'en' ? 'Unknown date' : lang === 'de' ? 'Unbekanntes Datum' : 'Nieznana data';
  return date.toLocaleDateString(getLocale(lang), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Funkcja do formatowania tylko daty (bez czasu)
export const formatDateOnly = (dateString) => {
  const lang = getLanguage();
  if (!dateString) return lang === 'en' ? 'Unknown date' : lang === 'de' ? 'Unbekanntes Datum' : 'Nieznana data';

  const date = new Date(dateString);
  if (!isValidDate(date)) return lang === 'en' ? 'Unknown date' : lang === 'de' ? 'Unbekanntes Datum' : 'Nieznana data';
  return date.toLocaleDateString(getLocale(lang));
};
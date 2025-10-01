// Funkcja do formatowania czasu względnego (np. "2 godziny temu")
export const formatTimeAgo = (dateString) => {
  if (!dateString) return 'Nieznana data';
  
  const now = new Date();
  const date = new Date(dateString);
  const diffInMs = now - date;
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  
  if (diffInMinutes < 1) {
    return 'Przed chwilą';
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes} ${diffInMinutes === 1 ? 'minuta' : diffInMinutes < 5 ? 'minuty' : 'minut'} temu`;
  } else if (diffInHours < 24) {
    return `${diffInHours} ${diffInHours === 1 ? 'godzina' : diffInHours < 5 ? 'godziny' : 'godzin'} temu`;
  } else if (diffInDays < 7) {
    return `${diffInDays} ${diffInDays === 1 ? 'dzień' : 'dni'} temu`;
  } else {
    return date.toLocaleDateString('pl-PL');
  }
};

// Funkcja do formatowania daty w formacie polskim
export const formatDate = (dateString) => {
  if (!dateString) return 'Nieznana data';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Funkcja do formatowania tylko daty (bez czasu)
export const formatDateOnly = (dateString) => {
  if (!dateString) return 'Nieznana data';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('pl-PL');
};
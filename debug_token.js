// Skrypt do sprawdzenia tokenu w localStorage
// Uruchom w konsoli przeglądarki

console.log('=== Debug tokenu w localStorage ===');

// Sprawdź czy token istnieje
const token = localStorage.getItem('token');
console.log('Token w localStorage:', token ? 'ISTNIEJE' : 'BRAK');

if (token) {
  console.log('Token (pierwsze 50 znaków):', token.substring(0, 50) + '...');
  
  // Sprawdź czy token jest ważny
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    console.log('Payload tokenu:', payload);
    
    const now = Math.floor(Date.now() / 1000);
    const exp = payload.exp;
    
    console.log('Czas teraz:', now);
    console.log('Token wygasa:', exp);
    console.log('Token ważny:', exp > now ? 'TAK' : 'NIE');
    
    if (exp <= now) {
      console.log('Token wygasł!');
    }
  } catch (e) {
    console.error('Błąd parsowania tokenu:', e);
  }
} else {
  console.log('Brak tokenu - użytkownik prawdopodobnie nie jest zalogowany');
}

// Sprawdź dane użytkownika
const userData = localStorage.getItem('user');
console.log('Dane użytkownika:', userData ? JSON.parse(userData) : 'BRAK');

// Test API call
console.log('\n=== Test API call z tokenu z localStorage ===');
if (token) {
  fetch('http://localhost:3000/api/departments', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
  .then(response => {
    console.log('Status odpowiedzi:', response.status);
    return response.json();
  })
  .then(data => {
    console.log('Dane z API:', data);
  })
  .catch(error => {
    console.error('Błąd API:', error);
  });
} else {
  console.log('Nie można wykonać testu API - brak tokenu');
}
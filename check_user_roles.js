const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.db');

console.log('=== Sprawdzanie ról użytkowników w bazie danych ===');

db.all('SELECT id, username, role, full_name FROM users', (err, rows) => {
  if (err) {
    console.error('Błąd:', err.message);
  } else {
    console.log('Użytkownicy i ich role:');
    rows.forEach(user => {
      console.log(`- ID: ${user.id}, Username: ${user.username}, Role: ${user.role || 'BRAK ROLI'}, Full Name: ${user.full_name || 'BRAK'}`);
    });
  }
  
  db.close();
});
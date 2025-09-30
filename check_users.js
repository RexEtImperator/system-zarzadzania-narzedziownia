const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.db');

console.log('=== Sprawdzanie użytkowników w bazie danych ===');

db.all('SELECT * FROM users', (err, rows) => {
  if (err) {
    console.error('Błąd:', err.message);
  } else {
    console.log('Użytkownicy:');
    rows.forEach(user => {
      console.log(`- ID: ${user.id}, Username: ${user.username}, Password: ${user.password}`);
    });
  }
  
  db.close();
});
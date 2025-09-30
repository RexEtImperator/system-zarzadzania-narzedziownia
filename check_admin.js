const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

// Połączenie z bazą danych
const db = new sqlite3.Database(path.join(__dirname, 'database.db'), (err) => {
  if (err) {
    console.error('Błąd połączenia z bazą danych:', err.message);
    return;
  }
  console.log('Połączono z bazą danych SQLite');
});

// Sprawdzenie użytkownika admin
db.get('SELECT * FROM users WHERE username = ?', ['admin'], (err, user) => {
  if (err) {
    console.error('Błąd podczas pobierania użytkownika admin:', err.message);
    return;
  }
  
  if (!user) {
    console.log('Użytkownik admin nie istnieje w bazie danych');
    return;
  }
  
  console.log('\n=== UŻYTKOWNIK ADMIN ===');
  console.log('ID:', user.id);
  console.log('Username:', user.username);
  console.log('Role:', user.role);
  console.log('Password hash:', user.password);
  
  // Testowanie różnych haseł
  const testPasswords = ['admin', 'admin123', 'natalka9'];
  
  console.log('\n=== TESTOWANIE HASEŁ ===');
  testPasswords.forEach(password => {
    const isValid = bcrypt.compareSync(password, user.password);
    console.log(`Hasło "${password}": ${isValid ? 'PRAWIDŁOWE' : 'NIEPRAWIDŁOWE'}`);
  });
});

// Zamknięcie połączenia
setTimeout(() => {
  db.close((err) => {
    if (err) {
      console.error('Błąd podczas zamykania bazy danych:', err.message);
    }
  });
}, 1000);
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('Błąd połączenia z bazą danych:', err.message);
    return;
  }
  console.log('Połączono z bazą danych');
});

// Sprawdź wszystkie tabele
db.all('SELECT name FROM sqlite_master WHERE type="table"', (err, tables) => {
  if (err) {
    console.error('Błąd:', err);
  } else {
    console.log('Tabele w bazie danych:', tables.map(t => t.name));
    
    // Sprawdź czy istnieją tabele departments i positions
    const tableNames = tables.map(t => t.name);
    console.log('Czy istnieje tabela departments:', tableNames.includes('departments'));
    console.log('Czy istnieje tabela positions:', tableNames.includes('positions'));
    
    // Jeśli istnieją, sprawdź ich zawartość
    if (tableNames.includes('departments')) {
      db.all('SELECT * FROM departments', (err, rows) => {
        if (err) {
          console.error('Błąd pobierania departments:', err);
        } else {
          console.log('Departments:', rows);
        }
      });
    }
    
    if (tableNames.includes('positions')) {
      db.all('SELECT * FROM positions', (err, rows) => {
        if (err) {
          console.error('Błąd pobierania positions:', err);
        } else {
          console.log('Positions:', rows);
        }
        db.close();
      });
    } else {
      db.close();
    }
  }
});
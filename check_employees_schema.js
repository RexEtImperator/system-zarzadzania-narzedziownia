const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Połączenie z bazą danych
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('Sprawdzanie struktury tabeli employees...');

db.serialize(() => {
  // Sprawdzenie czy tabela istnieje
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='employees'", (err, row) => {
    if (err) {
      console.error('❌ Błąd sprawdzania tabeli:', err.message);
      return;
    }
    
    if (row) {
      console.log('✅ Tabela employees istnieje');
      
      // Sprawdzenie struktury tabeli
      db.all("PRAGMA table_info(employees)", (err, rows) => {
        if (err) {
          console.error('❌ Błąd pobierania struktury tabeli:', err.message);
          return;
        }
        
        console.log('\n📋 Struktura tabeli employees:');
        rows.forEach(column => {
          console.log(`- ${column.name}: ${column.type} ${column.notnull ? 'NOT NULL' : ''} ${column.pk ? 'PRIMARY KEY' : ''}`);
        });
        
        // Sprawdzenie liczby rekordów
        db.get('SELECT COUNT(*) as count FROM employees', (err, row) => {
          if (err) {
            console.error('❌ Błąd sprawdzania liczby rekordów:', err.message);
          } else {
            console.log(`\n📊 Liczba rekordów w tabeli: ${row.count}`);
          }
          
          db.close();
        });
      });
    } else {
      console.log('❌ Tabela employees nie istnieje');
      db.close();
    }
  });
});
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.db');

console.log('=== Sprawdzanie struktury bazy danych ===\n');

db.serialize(() => {
  // Sprawdź wszystkie tabele
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
    if (err) {
      console.error('Błąd podczas pobierania listy tabel:', err);
      return;
    }
    
    console.log('Tabele w bazie danych:');
    rows.forEach(row => {
      console.log('- ' + row.name);
    });
    
    console.log('\n=== Szczegóły struktury tabel ===\n');
    
    // Sprawdź strukturę każdej tabeli
    let completed = 0;
    const total = rows.length;
    
    rows.forEach(row => {
      db.all(`PRAGMA table_info(${row.name})`, (err, columns) => {
        if (err) {
          console.error(`Błąd podczas pobierania struktury tabeli ${row.name}:`, err);
        } else {
          console.log(`Tabela: ${row.name}`);
          columns.forEach(col => {
            console.log(`  - ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}${col.pk ? ' PRIMARY KEY' : ''}`);
          });
          console.log('');
        }
        
        completed++;
        if (completed === total) {
          db.close();
        }
      });
    });
  });
});
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.db');

console.log('=== SPRAWDZANIE DZIAŁÓW I POZYCJI ===\n');

// Sprawdzenie działów
db.all('SELECT * FROM departments', (err, rows) => {
  if (err) {
    console.error('Błąd przy pobieraniu działów:', err);
  } else {
    console.log('=== DZIAŁY ===');
    console.log('Liczba działów:', rows.length);
    if (rows.length > 0) {
      rows.forEach(row => {
        console.log(`ID: ${row.id}, Nazwa: ${row.name}`);
      });
    } else {
      console.log('Brak działów w bazie danych');
    }
  }
  
  // Sprawdzenie pozycji
  db.all('SELECT * FROM positions', (err, rows) => {
    if (err) {
      console.error('Błąd przy pobieraniu pozycji:', err);
    } else {
      console.log('\n=== POZYCJE ===');
      console.log('Liczba pozycji:', rows.length);
      if (rows.length > 0) {
        rows.forEach(row => {
          console.log(`ID: ${row.id}, Nazwa: ${row.name}`);
        });
      } else {
        console.log('Brak pozycji w bazie danych');
      }
    }
    
    // Sprawdzenie pracowników z działami i pozycjami
    db.all(`
      SELECT e.id, e.name, e.surname, d.name as department_name, p.name as position_name
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN positions p ON e.position_id = p.id
      LIMIT 10
    `, (err, rows) => {
      if (err) {
        console.error('Błąd przy pobieraniu pracowników:', err);
      } else {
        console.log('\n=== PRACOWNICY Z DZIAŁAMI I POZYCJAMI (pierwsze 10) ===');
        if (rows.length > 0) {
          rows.forEach(row => {
            console.log(`ID: ${row.id}, ${row.name} ${row.surname}, Dział: ${row.department_name || 'Brak'}, Pozycja: ${row.position_name || 'Brak'}`);
          });
        } else {
          console.log('Brak pracowników w bazie danych');
        }
      }
      
      db.close();
    });
  });
});
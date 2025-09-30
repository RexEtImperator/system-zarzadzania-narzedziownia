const sqlite3 = require('sqlite3').verbose();

// Sprawdź dostępnych pracowników
function checkEmployees() {
  const db = new sqlite3.Database('./tools.db');
  
  console.log('=== Sprawdzanie pracowników ===');
  
  db.all('SELECT * FROM employees', (err, rows) => {
    if (err) {
      console.error('Błąd zapytania:', err);
      return;
    }
    
    console.log(`Znaleziono ${rows.length} pracowników:`);
    rows.forEach(employee => {
      console.log(`- ID: ${employee.id}, Imię: ${employee.first_name}, Nazwisko: ${employee.last_name}, Stanowisko: ${employee.position}`);
    });
    
    db.close();
  });
}

checkEmployees();
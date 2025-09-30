const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'database.db'));

console.log('=== Szczegółowe sprawdzenie lutownicy ===');

// Sprawdź wszystkie wydania lutownicy (nie tylko aktywne)
db.all(`
  SELECT ti.*, e.first_name, e.last_name, u.username as issued_by
  FROM tool_issues ti
  LEFT JOIN employees e ON ti.employee_id = e.id
  LEFT JOIN users u ON ti.issued_by_user_id = u.id
  WHERE ti.tool_id = 6
  ORDER BY ti.issued_at DESC
`, (err, issues) => {
  if (err) {
    console.error('Błąd:', err);
    return;
  }
  
  console.log(`\nWszystkie wydania lutownicy (${issues.length}):`);
  if (issues.length === 0) {
    console.log('Brak wydań w bazie danych');
  } else {
    issues.forEach(issue => {
      console.log(`\n--- Wydanie ID: ${issue.id} ---`);
      console.log(`Pracownik: ${issue.first_name} ${issue.last_name} (ID: ${issue.employee_id})`);
      console.log(`Ilość: ${issue.quantity}`);
      console.log(`Status: ${issue.status}`);
      console.log(`Data wydania: ${issue.issued_at}`);
      console.log(`Data zwrotu: ${issue.returned_at || 'Nie zwrócone'}`);
      console.log(`Wydał: ${issue.issued_by}`);
    });
  }
  
  // Sprawdź czy lutownica ma stary system wydań
  db.get('SELECT * FROM tools WHERE id = 6', (err, tool) => {
    if (err) {
      console.error('Błąd:', err);
      return;
    }
    
    console.log('\n=== Status narzędzia ===');
    console.log(`Nazwa: ${tool.name}`);
    console.log(`Status: ${tool.status}`);
    console.log(`Ilość: ${tool.quantity}`);
    console.log(`issued_to_employee_id: ${tool.issued_to_employee_id || 'NULL'}`);
    console.log(`issued_at: ${tool.issued_at || 'NULL'}`);
    console.log(`issued_by_user_id: ${tool.issued_by_user_id || 'NULL'}`);
    
    db.close();
  });
});
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'database.db'));

console.log('=== Sprawdzanie wszystkich wydań w bazie danych ===');

// Sprawdź wszystkie wydania
db.all(`
  SELECT ti.*, t.name as tool_name, e.first_name, e.last_name, u.username as issued_by
  FROM tool_issues ti
  LEFT JOIN tools t ON ti.tool_id = t.id
  LEFT JOIN employees e ON ti.employee_id = e.id
  LEFT JOIN users u ON ti.issued_by_user_id = u.id
  ORDER BY ti.issued_at DESC
`, (err, issues) => {
  if (err) {
    console.error('Błąd:', err);
    return;
  }
  
  console.log(`\nZnaleziono ${issues.length} wydań:`);
  
  if (issues.length === 0) {
    console.log('Brak wydań w bazie danych');
  } else {
    issues.forEach(issue => {
      console.log(`\n--- Wydanie ID: ${issue.id} ---`);
      console.log(`Narzędzie: ${issue.tool_name} (ID: ${issue.tool_id})`);
      console.log(`Pracownik: ${issue.first_name} ${issue.last_name} (ID: ${issue.employee_id})`);
      console.log(`Ilość: ${issue.quantity}`);
      console.log(`Status: ${issue.status}`);
      console.log(`Data wydania: ${issue.issued_at}`);
      console.log(`Data zwrotu: ${issue.returned_at || 'Nie zwrócone'}`);
      console.log(`Wydał: ${issue.issued_by}`);
    });
  }
  
  // Sprawdź strukturę tabeli tool_issues
  console.log('\n=== Struktura tabeli tool_issues ===');
  db.all("PRAGMA table_info(tool_issues)", (err, columns) => {
    if (err) {
      console.error('Błąd:', err);
      return;
    }
    
    console.log('Kolumny:');
    columns.forEach(col => {
      console.log(`- ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
    });
    
    db.close();
  });
});
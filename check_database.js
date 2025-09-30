const sqlite3 = require('sqlite3').verbose();

// Połącz z bazą danych
const db = new sqlite3.Database('./database.db');

console.log('=== SPRAWDZANIE STRUKTURY BAZY DANYCH ===\n');

// Sprawdź czy tabela tool_issues istnieje
db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='tool_issues'", (err, tables) => {
  if (err) {
    console.error('Błąd:', err);
    return;
  }
  
  if (tables.length > 0) {
    console.log('✓ Tabela tool_issues istnieje');
    
    // Sprawdź strukturę tabeli
    db.all("PRAGMA table_info(tool_issues)", (err, columns) => {
      if (err) {
        console.error('Błąd:', err);
        return;
      }
      
      console.log('\nStruktura tabeli tool_issues:');
      columns.forEach(col => {
        console.log(`- ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
      });
      
      // Sprawdź wszystkie rekordy w tool_issues
      db.all("SELECT * FROM tool_issues", (err, issues) => {
        if (err) {
          console.error('Błąd:', err);
          return;
        }
        
        console.log(`\nLiczba rekordów w tool_issues: ${issues.length}`);
        if (issues.length > 0) {
          console.log('Rekordy:');
          issues.forEach((issue, index) => {
            console.log(`${index + 1}. ID: ${issue.id}, Tool: ${issue.tool_id}, Employee: ${issue.employee_id}, Quantity: ${issue.quantity}, Status: ${issue.status}, Issued: ${issue.issued_at}`);
          });
        }
        
        // Sprawdź piłę łańcuchową
        console.log('\n=== PIŁA ŁAŃCUCHOWA ===');
        db.get("SELECT * FROM tools WHERE id = 5", (err, tool) => {
          if (err) {
            console.error('Błąd:', err);
            return;
          }
          
          if (tool) {
            console.log(`Nazwa: ${tool.name}`);
            console.log(`Ilość: ${tool.quantity}`);
            console.log(`Status: ${tool.status}`);
            console.log(`Wydane dla: ${tool.issued_to_employee_id || 'brak'}`);
            console.log(`Data wydania: ${tool.issued_at || 'brak'}`);
            console.log(`Wydane przez: ${tool.issued_by_user_id || 'brak'}`);
          }
          
          db.close();
        });
      });
    });
  } else {
    console.log('✗ Tabela tool_issues nie istnieje!');
    db.close();
  }
});
const sqlite3 = require('sqlite3').verbose();

// Połącz z bazą danych
const db = new sqlite3.Database('./database.db');

console.log('=== SPRAWDZANIE STANU PIŁY ŁAŃCUCHOWEJ ===\n');

// Sprawdź aktualne narzędzia
db.all("SELECT * FROM tools WHERE name LIKE '%piła%' OR name LIKE '%Piła%'", (err, tools) => {
  if (err) {
    console.error('Błąd podczas pobierania narzędzi:', err);
    return;
  }
  
  console.log('Znalezione piły:');
  tools.forEach(tool => {
    console.log(`- ID: ${tool.id}, Nazwa: ${tool.name}, Ilość: ${tool.quantity}, Status: ${tool.status}`);
  });
  
  // Sprawdź wydania narzędzi
  console.log('\n=== AKTUALNE WYDANIA ===');
  db.all("SELECT * FROM tool_issues WHERE status = 'active'", (err, issues) => {
    if (err) {
      console.error('Błąd podczas pobierania wydań:', err);
      return;
    }
    
    if (issues.length === 0) {
      console.log('Brak aktywnych wydań');
    } else {
      console.log('Aktywne wydania:');
      issues.forEach(issue => {
        console.log(`- Tool ID: ${issue.tool_id}, Employee ID: ${issue.employee_id}, Ilość: ${issue.quantity}, Data: ${issue.issued_at}`);
      });
    }
    
    // Sprawdź pracowników
    console.log('\n=== DOSTĘPNI PRACOWNICY ===');
    db.all("SELECT id, first_name, last_name FROM employees LIMIT 5", (err, employees) => {
      if (err) {
        console.error('Błąd podczas pobierania pracowników:', err);
        return;
      }
      
      console.log('Pierwsi 5 pracowników:');
      employees.forEach(emp => {
        console.log(`- ID: ${emp.id}, Imię: ${emp.first_name}, Nazwisko: ${emp.last_name}`);
      });
      
      db.close();
    });
  });
});
const sqlite3 = require('sqlite3').verbose();

// Sprawdź stan wiertarki Bosch
function checkWiertarka() {
  const db = new sqlite3.Database('./database.db');
  
  console.log('=== Sprawdzanie stanu wiertarki Bosch ===');
  
  // Sprawdź narzędzie
  db.get('SELECT * FROM tools WHERE name LIKE "%Wiertarka%" OR name LIKE "%Bosch%"', (err, tool) => {
    if (err) {
      console.error('Błąd zapytania:', err);
      return;
    }
    
    if (!tool) {
      console.log('Nie znaleziono wiertarki Bosch');
      db.close();
      return;
    }
    
    console.log(`Narzędzie: ${tool.name} (ID: ${tool.id})`);
    console.log(`Status: ${tool.status}`);
    console.log(`Ilość: ${tool.quantity}`);
    console.log(`Dostępna ilość: ${tool.available_quantity}`);
    
    // Sprawdź aktywne wydania
    db.all(`
      SELECT ti.*, e.first_name, e.last_name 
      FROM tool_issues ti 
      JOIN employees e ON ti.employee_id = e.id 
      WHERE ti.tool_id = ? AND ti.returned_at IS NULL
    `, [tool.id], (err, issues) => {
      if (err) {
        console.error('Błąd zapytania o wydania:', err);
        db.close();
        return;
      }
      
      console.log(`Aktywne wydania wiertarki (${issues.length}):`);
      if (issues.length === 0) {
        console.log('Brak aktywnych wydań');
      } else {
        issues.forEach(issue => {
          console.log(`- ID wydania: ${issue.id}, Pracownik: ${issue.first_name} ${issue.last_name}, Ilość: ${issue.quantity}, Data wydania: ${issue.issued_at}`);
        });
      }
      
      db.close();
    });
  });
}

checkWiertarka();
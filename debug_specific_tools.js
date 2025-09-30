const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'database.db'));

console.log('=== Sprawdzanie stanu wydań młota pneumatycznego i lutownicy ===');

// Sprawdź młot pneumatyczny (ID: 2)
console.log('\n--- MŁOT PNEUMATYCZNY ---');
db.get('SELECT * FROM tools WHERE name LIKE "%Młot%" OR name LIKE "%pneumatyczny%"', (err, tool) => {
  if (err) {
    console.error('Błąd:', err);
    return;
  }
  
  if (tool) {
    console.log(`Narzędzie: ${tool.name} (ID: ${tool.id})`);
    console.log(`Status: ${tool.status}`);
    console.log(`Ilość: ${tool.quantity}`);
    
    // Sprawdź aktywne wydania młota
    db.all(`
      SELECT ti.*, e.first_name, e.last_name, u.username as issued_by
      FROM tool_issues ti
      LEFT JOIN employees e ON ti.employee_id = e.id
      LEFT JOIN users u ON ti.issued_by_user_id = u.id
      WHERE ti.tool_id = ? AND ti.status = 'wydane'
      ORDER BY ti.issued_at DESC
    `, [tool.id], (err, issues) => {
      if (err) {
        console.error('Błąd:', err);
        return;
      }
      
      console.log(`Aktywne wydania młota (${issues.length}):`);
      if (issues.length === 0) {
        console.log('Brak aktywnych wydań');
      } else {
        issues.forEach(issue => {
          console.log(`- ID wydania: ${issue.id}, Pracownik: ${issue.first_name} ${issue.last_name}, Ilość: ${issue.quantity}`);
        });
      }
      
      // Sprawdź lutownicę
      checkLutownica();
    });
  } else {
    console.log('Nie znaleziono młota pneumatycznego');
    checkLutownica();
  }
});

function checkLutownica() {
  console.log('\n--- LUTOWNICA ---');
  db.get('SELECT * FROM tools WHERE name LIKE "%Lutownica%"', (err, tool) => {
    if (err) {
      console.error('Błąd:', err);
      return;
    }
    
    if (tool) {
      console.log(`Narzędzie: ${tool.name} (ID: ${tool.id})`);
      console.log(`Status: ${tool.status}`);
      console.log(`Ilość: ${tool.quantity}`);
      
      // Sprawdź aktywne wydania lutownicy
      db.all(`
        SELECT ti.*, e.first_name, e.last_name, u.username as issued_by
        FROM tool_issues ti
        LEFT JOIN employees e ON ti.employee_id = e.id
        LEFT JOIN users u ON ti.issued_by_user_id = u.id
        WHERE ti.tool_id = ? AND ti.status = 'wydane'
        ORDER BY ti.issued_at DESC
      `, [tool.id], (err, issues) => {
        if (err) {
          console.error('Błąd:', err);
          return;
        }
        
        console.log(`Aktywne wydania lutownicy (${issues.length}):`);
        if (issues.length === 0) {
          console.log('Brak aktywnych wydań');
        } else {
          issues.forEach(issue => {
            console.log(`- ID wydania: ${issue.id}, Pracownik: ${issue.first_name} ${issue.last_name}, Ilość: ${issue.quantity}`);
          });
        }
        
        db.close();
      });
    } else {
      console.log('Nie znaleziono lutownicy');
      db.close();
    }
  });
}
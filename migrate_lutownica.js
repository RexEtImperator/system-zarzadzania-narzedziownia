const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'database.db'));

console.log('=== Migracja lutownicy ze starego systemu do nowego ===');

// Znajdź lutownicę ze starym systemem wydań
db.get(`
  SELECT * FROM tools 
  WHERE id = 6 
  AND status = 'wydane' 
  AND issued_to_employee_id IS NOT NULL
`, (err, tool) => {
  if (err) {
    console.error('Błąd:', err);
    return;
  }
  
  if (!tool) {
    console.log('Lutownica nie wymaga migracji');
    db.close();
    return;
  }
  
  console.log('Znaleziono lutownicę do migracji:');
  console.log(`- Nazwa: ${tool.name}`);
  console.log(`- Wydana dla pracownika ID: ${tool.issued_to_employee_id}`);
  console.log(`- Data wydania: ${tool.issued_at}`);
  console.log(`- Wydał użytkownik ID: ${tool.issued_by_user_id}`);
  
  // Sprawdź czy już nie ma wpisu w tool_issues
  db.get('SELECT * FROM tool_issues WHERE tool_id = 6 AND status = "wydane"', (err, existingIssue) => {
    if (err) {
      console.error('Błąd:', err);
      return;
    }
    
    if (existingIssue) {
      console.log('Wydanie już istnieje w nowym systemie, pomijam migrację');
      db.close();
      return;
    }
    
    // Utwórz wpis w tool_issues
    console.log('\nTworzę wpis w tool_issues...');
    db.run(`
      INSERT INTO tool_issues (
        tool_id, 
        employee_id, 
        issued_by_user_id, 
        quantity, 
        issued_at, 
        status
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      tool.id,
      tool.issued_to_employee_id,
      tool.issued_by_user_id,
      1, // lutownica ma quantity = 1
      tool.issued_at,
      'wydane'
    ], function(err) {
      if (err) {
        console.error('Błąd podczas tworzenia wpisu:', err);
        return;
      }
      
      console.log(`Utworzono wpis w tool_issues z ID: ${this.lastID}`);
      
      // Wyczyść stare kolumny
      console.log('Czyszczę stare kolumny...');
      db.run(`
        UPDATE tools 
        SET issued_to_employee_id = NULL,
            issued_at = NULL,
            issued_by_user_id = NULL
        WHERE id = ?
      `, [tool.id], function(err) {
        if (err) {
          console.error('Błąd podczas czyszczenia:', err);
          return;
        }
        
        console.log('Migracja zakończona pomyślnie!');
        console.log('Lutownica może być teraz zwrócona przez nowy system');
        
        db.close();
      });
    });
  });
});
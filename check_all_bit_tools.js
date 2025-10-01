const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'database.db'), (err) => {
  if (err) {
    console.error('Błąd połączenia z bazą danych:', err.message);
    return;
  }
  console.log('Połączono z bazą danych SQLite.');
});

console.log('=== SPRAWDZANIE WSZYSTKICH NARZĘDZI Z "BIT" W NAZWIE ===\n');

// Sprawdź wszystkie narzędzia zawierające "bit" w nazwie
db.all("SELECT id, name, status, quantity FROM tools WHERE name LIKE '%bit%' OR name LIKE '%Bit%'", (err, tools) => {
  if (err) {
    console.error('Błąd przy pobieraniu narzędzi:', err.message);
    db.close();
    return;
  }
  
  if (tools.length === 0) {
    console.log('❌ Nie znaleziono narzędzi zawierających "bit" w nazwie');
    db.close();
    return;
  }
  
  console.log(`📋 ZNALEZIONO ${tools.length} NARZĘDZI:\n`);
  
  let processedCount = 0;
  
  tools.forEach((tool, index) => {
    console.log(`${index + 1}. ${tool.name} (ID: ${tool.id})`);
    console.log(`   Status: ${tool.status} | Ilość: ${tool.quantity}`);
    
    // Sprawdź historię wydań i zwrotów dla każdego narzędzia
    db.get(`
      SELECT 
        COALESCE(SUM(CASE WHEN status = 'wydane' THEN quantity ELSE 0 END), 0) as issued_quantity,
        COALESCE(SUM(CASE WHEN status = 'zwrócone' THEN quantity ELSE 0 END), 0) as returned_quantity
      FROM tool_issues 
      WHERE tool_id = ?
    `, [tool.id], (err, summary) => {
      if (err) {
        console.error(`   Błąd przy obliczaniu ilości dla ${tool.name}:`, err.message);
      } else {
        // Określ jaki powinien być status
        let expectedStatus;
        if (summary.issued_quantity === 0) {
          expectedStatus = 'dostępne';
        } else if (summary.issued_quantity < tool.quantity) {
          expectedStatus = 'częściowo wydane';
        } else {
          expectedStatus = 'wydane';
        }
        
        console.log(`   Wydane: ${summary.issued_quantity} | Zwrócone: ${summary.returned_quantity} | Dostępne: ${tool.quantity - summary.issued_quantity}`);
        console.log(`   Oczekiwany status: ${expectedStatus}`);
        
        if (tool.status !== expectedStatus) {
          console.log(`   ❌ STATUS NIEPOPRAWNY! Aktualny: ${tool.status}, Powinien być: ${expectedStatus}`);
        } else {
          console.log(`   ✅ Status poprawny`);
        }
      }
      
      console.log('');
      processedCount++;
      
      // Zamknij połączenie gdy wszystkie narzędzia zostały przetworzone
      if (processedCount === tools.length) {
        db.close();
      }
    });
  });
});
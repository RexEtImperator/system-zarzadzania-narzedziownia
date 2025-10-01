const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'database.db'), (err) => {
  if (err) {
    console.error('Błąd połączenia z bazą danych:', err.message);
    return;
  }
  console.log('Połączono z bazą danych SQLite.');
});

console.log('=== SPRAWDZANIE NARZĘDZIA "Bit do wkrętarki 8" ===\n');

// Sprawdź narzędzie w tabeli tools
db.get("SELECT id, name, status, quantity FROM tools WHERE name LIKE '%Bit do wkrętarki 8%'", (err, tool) => {
  if (err) {
    console.error('Błąd przy pobieraniu narzędzia:', err.message);
    return;
  }
  
  if (!tool) {
    console.log('❌ Nie znaleziono narzędzia "Bit do wkrętarki 8"');
    db.close();
    return;
  }
  
  console.log('📋 INFORMACJE O NARZĘDZIU:');
  console.log(`ID: ${tool.id}`);
  console.log(`Nazwa: ${tool.name}`);
  console.log(`Status: ${tool.status}`);
  console.log(`Ilość całkowita: ${tool.quantity}`);
  console.log('');
  
  // Sprawdź historię wydań i zwrotów
  console.log('📊 HISTORIA WYDAŃ I ZWROTÓW:');
  db.all(`
    SELECT 
      ti.id,
      ti.status,
      ti.quantity,
      ti.issued_at,
      ti.returned_at,
      e.first_name || ' ' || e.last_name as employee_name
    FROM tool_issues ti
    LEFT JOIN employees e ON ti.employee_id = e.id
    WHERE ti.tool_id = ?
    ORDER BY ti.issued_at DESC
  `, [tool.id], (err, issues) => {
    if (err) {
      console.error('Błąd przy pobieraniu historii:', err.message);
      db.close();
      return;
    }
    
    if (issues.length === 0) {
      console.log('Brak historii wydań dla tego narzędzia.');
    } else {
      issues.forEach((issue, index) => {
        console.log(`${index + 1}. ID: ${issue.id} | Status: ${issue.status} | Ilość: ${issue.quantity}`);
        console.log(`   Pracownik: ${issue.employee_name || 'Nieznany'}`);
        console.log(`   Wydano: ${issue.issued_at}`);
        console.log(`   Zwrócono: ${issue.returned_at || 'Nie zwrócono'}`);
        console.log('');
      });
    }
    
    // Oblicz aktualną ilość wydaną
    console.log('🔢 ANALIZA ILOŚCI:');
    db.get(`
      SELECT 
        COALESCE(SUM(CASE WHEN status = 'wydane' THEN quantity ELSE 0 END), 0) as issued_quantity,
        COALESCE(SUM(CASE WHEN status = 'zwrócone' THEN quantity ELSE 0 END), 0) as returned_quantity
      FROM tool_issues 
      WHERE tool_id = ?
    `, [tool.id], (err, summary) => {
      if (err) {
        console.error('Błąd przy obliczaniu ilości:', err.message);
        db.close();
        return;
      }
      
      console.log(`Aktualnie wydane: ${summary.issued_quantity}`);
      console.log(`Zwrócone: ${summary.returned_quantity}`);
      console.log(`Dostępne: ${tool.quantity - summary.issued_quantity}`);
      console.log('');
      
      // Określ jaki powinien być status
      let expectedStatus;
      if (summary.issued_quantity === 0) {
        expectedStatus = 'dostępne';
      } else if (summary.issued_quantity < tool.quantity) {
        expectedStatus = 'częściowo wydane';
      } else {
        expectedStatus = 'wydane';
      }
      
      console.log('🎯 ANALIZA STATUSU:');
      console.log(`Aktualny status: ${tool.status}`);
      console.log(`Oczekiwany status: ${expectedStatus}`);
      
      if (tool.status !== expectedStatus) {
        console.log('❌ STATUS JEST NIEPOPRAWNY!');
      } else {
        console.log('✅ Status jest poprawny.');
      }
      
      db.close();
    });
  });
});
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'database.db'), (err) => {
  if (err) {
    console.error('Błąd połączenia z bazą danych:', err.message);
    return;
  }
  console.log('Połączono z bazą danych SQLite.');
});

console.log('=== SPRAWDZANIE WSZYSTKICH NARZĘDZI O STATUSIE "CZĘŚCIOWO WYDANE" ===\n');

// Sprawdź wszystkie narzędzia ze statusem "częściowo wydane"
db.all("SELECT id, name, status, quantity FROM tools WHERE status = 'częściowo wydane'", (err, tools) => {
  if (err) {
    console.error('Błąd przy pobieraniu narzędzi:', err.message);
    db.close();
    return;
  }
  
  if (tools.length === 0) {
    console.log('✅ Nie znaleziono narzędzi ze statusem "częściowo wydane"');
    db.close();
    return;
  }
  
  console.log(`📋 ZNALEZIONO ${tools.length} NARZĘDZI ZE STATUSEM "CZĘŚCIOWO WYDANE":\n`);
  
  let processedCount = 0;
  
  tools.forEach((tool, index) => {
    console.log(`${index + 1}. ${tool.name} (ID: ${tool.id})`);
    console.log(`   Status: ${tool.status} | Ilość całkowita: ${tool.quantity}`);
    
    // Sprawdź szczegółową historię wydań i zwrotów
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
        console.error(`   Błąd przy pobieraniu historii dla ${tool.name}:`, err.message);
      } else {
        console.log(`   📊 Historia wydań (${issues.length} rekordów):`);
        
        let issuedTotal = 0;
        let returnedTotal = 0;
        
        issues.forEach((issue, idx) => {
          console.log(`     ${idx + 1}. ID: ${issue.id} | Status: ${issue.status} | Ilość: ${issue.quantity}`);
          console.log(`        Pracownik: ${issue.employee_name || 'Nieznany'}`);
          console.log(`        Wydano: ${issue.issued_at}`);
          console.log(`        Zwrócono: ${issue.returned_at || 'Nie zwrócono'}`);
          
          if (issue.status === 'wydane') {
            issuedTotal += issue.quantity;
          } else if (issue.status === 'zwrócone') {
            returnedTotal += issue.quantity;
          }
        });
        
        console.log(`   🔢 Podsumowanie:`);
        console.log(`     Aktualnie wydane: ${issuedTotal}`);
        console.log(`     Zwrócone: ${returnedTotal}`);
        console.log(`     Dostępne: ${tool.quantity - issuedTotal}`);
        
        // Określ jaki powinien być status
        let expectedStatus;
        if (issuedTotal === 0) {
          expectedStatus = 'dostępne';
        } else if (issuedTotal < tool.quantity) {
          expectedStatus = 'częściowo wydane';
        } else {
          expectedStatus = 'wydane';
        }
        
        console.log(`   🎯 Analiza statusu:`);
        console.log(`     Aktualny status: ${tool.status}`);
        console.log(`     Oczekiwany status: ${expectedStatus}`);
        
        if (tool.status !== expectedStatus) {
          console.log(`     ❌ STATUS NIEPOPRAWNY!`);
        } else {
          console.log(`     ✅ Status poprawny`);
        }
      }
      
      console.log('\n' + '='.repeat(60) + '\n');
      processedCount++;
      
      // Zamknij połączenie gdy wszystkie narzędzia zostały przetworzone
      if (processedCount === tools.length) {
        db.close();
      }
    });
  });
});
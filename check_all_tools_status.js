const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.db');

console.log('=== Sprawdzanie wszystkich narzędzi i ich statusu wydania ===\n');

// Sprawdź wszystkie narzędzia
db.all('SELECT * FROM tools ORDER BY id', (err, tools) => {
  if (err) {
    console.error('Błąd:', err.message);
    db.close();
    return;
  }

  console.log(`Znaleziono ${tools.length} narzędzi:\n`);

  let toolsToMigrate = [];
  let processedCount = 0;

  tools.forEach((tool, index) => {
    console.log(`--- NARZĘDZIE ${tool.id}: ${tool.name} ---`);
    console.log(`Status: ${tool.status}`);
    console.log(`Ilość: ${tool.quantity}`);
    
    // Sprawdź czy ma stare pola wydania
    if (tool.issued_to || tool.issued_at) {
      console.log(`⚠️  STARY SYSTEM - Wydane do: ${tool.issued_to}, Data: ${tool.issued_at}`);
      toolsToMigrate.push(tool);
    }

    // Sprawdź wydania w nowej tabeli
    db.all('SELECT ti.*, e.first_name, e.last_name FROM tool_issues ti LEFT JOIN employees e ON ti.employee_id = e.id WHERE ti.tool_id = ? AND ti.status = "wydane"', 
      [tool.id], (err, issues) => {
        if (err) {
          console.error('Błąd sprawdzania wydań:', err.message);
        } else {
          if (issues.length > 0) {
            console.log(`✅ NOWY SYSTEM - Aktywne wydania (${issues.length}):`);
            issues.forEach(issue => {
              console.log(`   - ID wydania: ${issue.id}, Pracownik: ${issue.first_name} ${issue.last_name}, Ilość: ${issue.quantity}`);
            });
          } else {
            console.log('📋 Brak aktywnych wydań w nowym systemie');
          }
        }
        
        // Sprawdź czy status narzędzia jest zgodny z wydaniami
        if (tool.status === 'wydane' && issues.length === 0 && !tool.issued_to) {
          console.log('❌ PROBLEM: Narzędzie ma status "wydane" ale brak wydań w obu systemach!');
        }
        
        console.log(''); // Pusta linia dla czytelności
        
        processedCount++;
        if (processedCount === tools.length) {
          // Wszystkie narzędzia zostały przetworzone
          console.log('\n=== PODSUMOWANIE ===');
          console.log(`Narzędzia do migracji ze starego systemu: ${toolsToMigrate.length}`);
          if (toolsToMigrate.length > 0) {
            console.log('Lista narzędzi do migracji:');
            toolsToMigrate.forEach(tool => {
              console.log(`- ID: ${tool.id}, Nazwa: ${tool.name}`);
            });
          }
          db.close();
        }
      });
  });
});
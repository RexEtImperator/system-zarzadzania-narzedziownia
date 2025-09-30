const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.db');

console.log('=== Naprawa statusów narzędzi ===\n');

// Funkcja do aktualizacji statusu narzędzia
function updateToolStatus(toolId, callback) {
  // Sprawdź aktywne wydania
  db.get(`
    SELECT 
      COUNT(*) as active_issues,
      SUM(quantity) as issued_quantity
    FROM tool_issues 
    WHERE tool_id = ? AND status = 'wydane'
  `, [toolId], (err, result) => {
    if (err) {
      console.error(`Błąd sprawdzania wydań dla narzędzia ${toolId}:`, err.message);
      callback();
      return;
    }

    // Pobierz dane narzędzia
    db.get('SELECT * FROM tools WHERE id = ?', [toolId], (err, tool) => {
      if (err) {
        console.error(`Błąd pobierania narzędzia ${toolId}:`, err.message);
        callback();
        return;
      }

      let newStatus;
      const totalQuantity = tool.quantity;
      const issuedQuantity = result.issued_quantity || 0;

      if (issuedQuantity === 0) {
        newStatus = 'dostępne';
      } else if (issuedQuantity >= totalQuantity) {
        newStatus = 'wydane';
      } else {
        newStatus = 'częściowo wydane';
      }

      console.log(`Narzędzie ${toolId} (${tool.name}):`);
      console.log(`  Obecny status: ${tool.status}`);
      console.log(`  Całkowita ilość: ${totalQuantity}`);
      console.log(`  Wydana ilość: ${issuedQuantity}`);
      console.log(`  Nowy status: ${newStatus}`);

      if (tool.status !== newStatus) {
        console.log(`  ✅ Aktualizuję status z "${tool.status}" na "${newStatus}"`);
        
        db.run('UPDATE tools SET status = ? WHERE id = ?', [newStatus, toolId], (err) => {
          if (err) {
            console.error(`  ❌ Błąd aktualizacji:`, err.message);
          } else {
            console.log(`  ✅ Status zaktualizowany pomyślnie`);
          }
          callback();
        });
      } else {
        console.log(`  ℹ️  Status jest już prawidłowy`);
        callback();
      }
      console.log('');
    });
  });
}

// Pobierz wszystkie narzędzia i napraw ich statusy
db.all('SELECT id FROM tools ORDER BY id', (err, tools) => {
  if (err) {
    console.error('Błąd pobierania narzędzi:', err.message);
    db.close();
    return;
  }

  let processedCount = 0;
  const totalTools = tools.length;

  if (totalTools === 0) {
    console.log('Brak narzędzi do przetworzenia');
    db.close();
    return;
  }

  tools.forEach(tool => {
    updateToolStatus(tool.id, () => {
      processedCount++;
      if (processedCount === totalTools) {
        console.log('=== Naprawa statusów zakończona ===');
        db.close();
      }
    });
  });
});
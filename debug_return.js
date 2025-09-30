const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'database.db'));

console.log('=== Sprawdzanie stanu wydań piły łańcuchowej ===');

// Sprawdź aktualne wydania
db.all(`
  SELECT ti.*, e.first_name, e.last_name, u.username as issued_by
  FROM tool_issues ti
  LEFT JOIN employees e ON ti.employee_id = e.id
  LEFT JOIN users u ON ti.issued_by_user_id = u.id
  WHERE ti.tool_id = 5 AND ti.status = 'wydane'
  ORDER BY ti.issued_at DESC
`, (err, issues) => {
  if (err) {
    console.error('Błąd:', err);
    return;
  }
  
  console.log('\nAktywne wydania piły łańcuchowej (ID: 5):');
  if (issues.length === 0) {
    console.log('Brak aktywnych wydań');
  } else {
    issues.forEach(issue => {
      console.log(`- ID wydania: ${issue.id}`);
      console.log(`  Pracownik: ${issue.first_name} ${issue.last_name} (ID: ${issue.employee_id})`);
      console.log(`  Ilość: ${issue.quantity}`);
      console.log(`  Data wydania: ${issue.issued_at}`);
      console.log(`  Wydał: ${issue.issued_by}`);
      console.log(`  Status: ${issue.status}`);
      console.log('---');
    });
  }
  
  // Sprawdź status narzędzia
  db.get('SELECT * FROM tools WHERE id = 5', (err, tool) => {
    if (err) {
      console.error('Błąd:', err);
      return;
    }
    
    console.log('\nStatus narzędzia:');
    console.log(`- Nazwa: ${tool.name}`);
    console.log(`- Ilość całkowita: ${tool.quantity}`);
    console.log(`- Status: ${tool.status}`);
    
    db.close();
  });
});
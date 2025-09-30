const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Połączenie z bazą danych
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('Aktualizacja struktury tabeli employees...');

db.serialize(() => {
  // Dodanie brakujących kolumn
  const alterCommands = [
    'ALTER TABLE employees ADD COLUMN email TEXT',
    'ALTER TABLE employees ADD COLUMN salary REAL',
    'ALTER TABLE employees ADD COLUMN hire_date DATE',
    'ALTER TABLE employees ADD COLUMN status TEXT DEFAULT "active"',
    'ALTER TABLE employees ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP'
  ];

  let completed = 0;
  
  alterCommands.forEach((command, index) => {
    db.run(command, function(err) {
      if (err && !err.message.includes('duplicate column name')) {
        console.error(`❌ Błąd wykonywania: ${command}`, err.message);
      } else if (err && err.message.includes('duplicate column name')) {
        console.log(`⚠️  Kolumna już istnieje: ${command.split(' ')[4]}`);
      } else {
        console.log(`✅ Dodano kolumnę: ${command.split(' ')[4]}`);
      }
      
      completed++;
      if (completed === alterCommands.length) {
        // Aktualizacja istniejących rekordów
        console.log('\n🔄 Aktualizacja istniejących rekordów...');
        
        // Dodanie przykładowych emaili dla istniejących pracowników
        db.all('SELECT id, first_name, last_name FROM employees WHERE email IS NULL', (err, rows) => {
          if (err) {
            console.error('❌ Błąd pobierania pracowników:', err.message);
            db.close();
            return;
          }
          
          if (rows.length === 0) {
            console.log('✅ Wszyscy pracownicy mają już emaile');
            checkFinalStructure();
            return;
          }
          
          let updateCompleted = 0;
          rows.forEach(row => {
            const email = `${row.first_name.toLowerCase()}.${row.last_name.toLowerCase()}@firma.pl`;
            const salary = Math.floor(Math.random() * 3000) + 3000; // 3000-6000
            const hireDate = '2023-01-01';
            
            db.run(
              'UPDATE employees SET email = ?, salary = ?, hire_date = ?, status = ? WHERE id = ?',
              [email, salary, hireDate, 'active', row.id],
              function(err) {
                if (err) {
                  console.error(`❌ Błąd aktualizacji pracownika ${row.first_name} ${row.last_name}:`, err.message);
                } else {
                  console.log(`✅ Zaktualizowano: ${row.first_name} ${row.last_name} (${email})`);
                }
                
                updateCompleted++;
                if (updateCompleted === rows.length) {
                  checkFinalStructure();
                }
              }
            );
          });
        });
      }
    });
  });
  
  function checkFinalStructure() {
    console.log('\n📋 Sprawdzanie końcowej struktury tabeli...');
    db.all("PRAGMA table_info(employees)", (err, rows) => {
      if (err) {
        console.error('❌ Błąd pobierania struktury:', err.message);
      } else {
        console.log('\n📋 Aktualna struktura tabeli employees:');
        rows.forEach(column => {
          console.log(`- ${column.name}: ${column.type} ${column.notnull ? 'NOT NULL' : ''} ${column.pk ? 'PRIMARY KEY' : ''}`);
        });
      }
      
      // Sprawdzenie liczby pracowników
      db.get('SELECT COUNT(*) as count FROM employees', (err, row) => {
        if (err) {
          console.error('❌ Błąd sprawdzania liczby pracowników:', err.message);
        } else {
          console.log(`\n📊 Liczba pracowników w bazie: ${row.count}`);
        }
        
        // Wyświetlenie kilku przykładowych pracowników
        db.all('SELECT * FROM employees LIMIT 3', (err, rows) => {
          if (err) {
            console.error('❌ Błąd pobierania przykładów:', err.message);
          } else {
            console.log('\n👥 Przykładowi pracownicy:');
            rows.forEach(emp => {
              console.log(`${emp.brand_number || emp.id} - ${emp.first_name} ${emp.last_name} (${emp.email || 'brak email'})`);
            });
          }
          
          db.close((err) => {
            if (err) {
              console.error('❌ Błąd zamykania bazy:', err.message);
            } else {
              console.log('\n🔒 Połączenie z bazą danych zostało zamknięte');
            }
          });
        });
      });
    });
  }
});
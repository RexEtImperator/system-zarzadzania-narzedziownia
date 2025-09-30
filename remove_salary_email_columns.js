const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Połączenie z bazą danych
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('Usuwanie kolumn salary i email z tabeli employees...');

db.serialize(() => {
  // SQLite nie obsługuje DROP COLUMN bezpośrednio, więc musimy:
  // 1. Utworzyć nową tabelę bez niepotrzebnych kolumn
  // 2. Skopiować dane
  // 3. Usunąć starą tabelę
  // 4. Zmienić nazwę nowej tabeli

  console.log('🔄 Tworzenie nowej tabeli bez kolumn salary i email...');
  
  const createNewTable = `
    CREATE TABLE IF NOT EXISTS employees_temp (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      phone TEXT,
      position TEXT NOT NULL,
      department TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      brand_number TEXT,
      hire_date DATE,
      status TEXT DEFAULT 'active',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  // Najpierw usuń tabelę tymczasową jeśli istnieje
  db.run('DROP TABLE IF EXISTS employees_temp', function(err) {
    if (err) {
      console.error('❌ Błąd usuwania tabeli tymczasowej:', err.message);
      db.close();
      return;
    }
    
    db.run(createNewTable, function(err) {
    if (err) {
      console.error('❌ Błąd tworzenia nowej tabeli:', err.message);
      db.close();
      return;
    }
    
    console.log('✅ Nowa tabela została utworzona');
    
    // Kopiowanie danych (bez kolumn salary i email)
    console.log('🔄 Kopiowanie danych...');
    
    const copyData = `
        INSERT INTO employees_temp (id, first_name, last_name, phone, position, department, created_at, brand_number, hire_date, status)
        SELECT id, first_name, last_name, phone, position, department, created_at, brand_number, hire_date, status
        FROM employees
      `;
    
    db.run(copyData, function(err) {
      if (err) {
        console.error('❌ Błąd kopiowania danych:', err.message);
        db.close();
        return;
      }
      
      console.log(`✅ Skopiowano ${this.changes} rekordów`);
      
      // Usunięcie starej tabeli
      console.log('🔄 Usuwanie starej tabeli...');
      
      db.run('DROP TABLE employees', function(err) {
        if (err) {
          console.error('❌ Błąd usuwania starej tabeli:', err.message);
          db.close();
          return;
        }
        
        console.log('✅ Stara tabela została usunięta');
        
        // Zmiana nazwy nowej tabeli
          console.log('🔄 Zmiana nazwy tabeli...');
          
          db.run('ALTER TABLE employees_temp RENAME TO employees', function(err) {
          if (err) {
            console.error('❌ Błąd zmiany nazwy tabeli:', err.message);
            db.close();
            return;
          }
          
          console.log('✅ Tabela została przemianowana');
          
          // Sprawdzenie końcowej struktury
          console.log('\n📋 Sprawdzanie końcowej struktury tabeli...');
          
          db.all("PRAGMA table_info(employees)", (err, rows) => {
            if (err) {
              console.error('❌ Błąd pobierania struktury:', err.message);
            } else {
              console.log('\n📋 Nowa struktura tabeli employees:');
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
              db.all('SELECT id, first_name, last_name, brand_number FROM employees LIMIT 5', (err, rows) => {
                if (err) {
                  console.error('❌ Błąd pobierania przykładów:', err.message);
                } else {
                  console.log('\n👥 Przykładowi pracownicy:');
                  rows.forEach(emp => {
                    console.log(`ID: ${emp.id} | ${emp.brand_number || 'Brak'} - ${emp.first_name} ${emp.last_name}`);
                  });
                }
                
                db.close((err) => {
                  if (err) {
                    console.error('❌ Błąd zamykania bazy:', err.message);
                  } else {
                    console.log('\n🔒 Połączenie z bazą danych zostało zamknięte');
                    console.log('\n✅ Kolumny salary i email zostały pomyślnie usunięte!');
                  }
                });
              });
            });
          });
          });
        });
      });
    });
  });
});
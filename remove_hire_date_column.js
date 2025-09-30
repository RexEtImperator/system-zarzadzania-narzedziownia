const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');

console.log('Usuwanie kolumny hire_date z tabeli employees...');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Błąd połączenia z bazą danych:', err.message);
    return;
  }
  console.log('✅ Połączono z bazą danych SQLite');
});

async function removeHireDateColumn() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Sprawdź aktualną strukturę
      console.log('\n📋 Sprawdzanie aktualnej struktury tabeli...');
      db.all("PRAGMA table_info(employees)", (err, columns) => {
        if (err) {
          console.error('❌ Błąd podczas sprawdzania struktury:', err.message);
          reject(err);
          return;
        }
        
        console.log('Aktualne kolumny:');
        columns.forEach(col => {
          console.log(`- ${col.name}: ${col.type}${col.pk ? ' PRIMARY KEY' : ''}${col.notnull ? ' NOT NULL' : ''}`);
        });

        // Usuń tabelę tymczasową jeśli istnieje
        db.run("DROP TABLE IF EXISTS employees_temp", (err) => {
          if (err) {
            console.error('❌ Błąd podczas usuwania tabeli tymczasowej:', err.message);
            reject(err);
            return;
          }

          // Utwórz nową tabelę bez kolumny hire_date
          const createTableSQL = `
            CREATE TABLE employees_temp (
              id INTEGER PRIMARY KEY,
              first_name TEXT NOT NULL,
              last_name TEXT NOT NULL,
              phone TEXT,
              position TEXT NOT NULL,
              department TEXT NOT NULL,
              created_at DATETIME,
              brand_number TEXT,
              status TEXT,
              updated_at DATETIME
            )
          `;

          console.log('\n🔨 Tworzenie nowej tabeli bez kolumny hire_date...');
          db.run(createTableSQL, (err) => {
            if (err) {
              console.error('❌ Błąd podczas tworzenia nowej tabeli:', err.message);
              reject(err);
              return;
            }
            console.log('✅ Utworzono nową tabelę employees_temp');

            // Skopiuj dane (bez kolumny hire_date)
            const copyDataSQL = `
              INSERT INTO employees_temp (
                id, first_name, last_name, phone, position, department, 
                created_at, brand_number, status, updated_at
              )
              SELECT 
                id, first_name, last_name, phone, position, department, 
                created_at, brand_number, status, updated_at
              FROM employees
            `;

            console.log('📋 Kopiowanie danych do nowej tabeli...');
            db.run(copyDataSQL, function(err) {
              if (err) {
                console.error('❌ Błąd podczas kopiowania danych:', err.message);
                reject(err);
                return;
              }
              console.log(`✅ Skopiowano ${this.changes} rekordów`);

              // Usuń starą tabelę
              console.log('🗑️ Usuwanie starej tabeli...');
              db.run("DROP TABLE employees", (err) => {
                if (err) {
                  console.error('❌ Błąd podczas usuwania starej tabeli:', err.message);
                  reject(err);
                  return;
                }
                console.log('✅ Usunięto starą tabelę employees');

                // Zmień nazwę nowej tabeli
                console.log('🔄 Zmiana nazwy nowej tabeli...');
                db.run("ALTER TABLE employees_temp RENAME TO employees", (err) => {
                  if (err) {
                    console.error('❌ Błąd podczas zmiany nazwy tabeli:', err.message);
                    reject(err);
                    return;
                  }
                  console.log('✅ Zmieniono nazwę tabeli na employees');

                  // Sprawdź finalną strukturę
                  console.log('\n📋 Sprawdzanie finalnej struktury tabeli...');
                  db.all("PRAGMA table_info(employees)", (err, finalColumns) => {
                    if (err) {
                      console.error('❌ Błąd podczas sprawdzania finalnej struktury:', err.message);
                      reject(err);
                      return;
                    }
                    
                    console.log('Finalna struktura tabeli employees:');
                    finalColumns.forEach(col => {
                      console.log(`- ${col.name}: ${col.type}${col.pk ? ' PRIMARY KEY' : ''}${col.notnull ? ' NOT NULL' : ''}`);
                    });

                    // Sprawdź liczbę rekordów
                    db.get("SELECT COUNT(*) as count FROM employees", (err, row) => {
                      if (err) {
                        console.error('❌ Błąd podczas sprawdzania liczby rekordów:', err.message);
                        reject(err);
                        return;
                      }
                      
                      console.log(`\n📊 Liczba pracowników w tabeli: ${row.count}`);
                      console.log('\n🎉 Pomyślnie usunięto kolumnę hire_date z tabeli employees!');
                      resolve();
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
}

// Wykonaj operację
removeHireDateColumn()
  .then(() => {
    db.close((err) => {
      if (err) {
        console.error('Błąd podczas zamykania bazy danych:', err.message);
      } else {
        console.log('✅ Zamknięto połączenie z bazą danych');
      }
    });
  })
  .catch((error) => {
    console.error('❌ Operacja nie powiodła się:', error.message);
    db.close();
  });
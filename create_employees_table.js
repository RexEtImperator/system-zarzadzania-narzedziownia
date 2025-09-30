const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Połączenie z bazą danych
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('Tworzenie tabeli employees...');

// Tworzenie tabeli employees
const createEmployeesTable = `
  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    department TEXT,
    position TEXT,
    brand_number TEXT,
    salary REAL,
    hire_date DATE,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

db.serialize(() => {
  db.run(createEmployeesTable, (err) => {
    if (err) {
      console.error('❌ Błąd tworzenia tabeli:', err.message);
      return;
    }
    console.log('✅ Tabela employees została utworzona pomyślnie');

    // Dodanie przykładowych pracowników
    const insertEmployee = db.prepare(`
      INSERT INTO employees (first_name, last_name, email, phone, department, position, brand_number, salary, hire_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const employees = [
      ['Jan', 'Kowalski', 'jan.kowalski@firma.pl', '+48 123 456 789', 'IT', 'Administrator systemu', '001', 5000, '2023-01-15', 'active'],
      ['Anna', 'Nowak', 'anna.nowak@firma.pl', '+48 987 654 321', 'Produkcja', 'Kierownik działu', '002', 6000, '2022-03-10', 'active'],
      ['Piotr', 'Wiśniewski', 'piotr.wisniewski@firma.pl', '+48 555 123 456', 'Produkcja', 'Spawacz', '003', 4500, '2023-06-01', 'active'],
      ['Maria', 'Dąbrowska', 'maria.dabrowska@firma.pl', '+48 777 888 999', 'Kontrola jakości', 'Kontroler jakości', '004', 4200, '2023-02-20', 'active'],
      ['Tomasz', 'Lewandowski', 'tomasz.lewandowski@firma.pl', '+48 111 222 333', 'Produkcja', 'Elektryk', '005', 4800, '2022-11-05', 'active']
    ];

    let completed = 0;
    employees.forEach((employee, index) => {
      insertEmployee.run(...employee, function(err) {
        if (err) {
          if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            console.log(`⚠️  Pracownik ${employee[0]} ${employee[1]} już istnieje`);
          } else {
            console.error(`❌ Błąd dodawania pracownika ${employee[0]} ${employee[1]}:`, err.message);
          }
        } else {
          console.log(`✅ Dodano pracownika: ${employee[0]} ${employee[1]}`);
        }
        
        completed++;
        if (completed === employees.length) {
          insertEmployee.finalize();
          
          // Sprawdzenie liczby pracowników
          db.get('SELECT COUNT(*) as count FROM employees', (err, row) => {
            if (err) {
              console.error('❌ Błąd sprawdzania liczby pracowników:', err.message);
            } else {
              console.log(`\n📊 Liczba pracowników w bazie: ${row.count}`);
            }
            
            // Wyświetlenie wszystkich pracowników
            db.all('SELECT * FROM employees ORDER BY brand_number', (err, rows) => {
              if (err) {
                console.error('❌ Błąd pobierania pracowników:', err.message);
              } else {
                console.log('\n👥 Lista pracowników:');
                rows.forEach(emp => {
                  console.log(`${emp.brand_number} - ${emp.first_name} ${emp.last_name} (${emp.department} - ${emp.position})`);
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
        }
      });
    });
  });
});
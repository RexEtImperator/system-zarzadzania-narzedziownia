const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.db');

console.log('=== Migracja: Dodawanie tabel departments i positions ===\n');

// Domyślne działy i pozycje
const DEFAULT_DEPARTMENTS = [
  'Produkcja',
  'Magazyn', 
  'Konserwacja',
  'Administracja',
  'IT',
  'HR'
];

const DEFAULT_POSITIONS = [
  'Specjalista ds. narzędzi',
  'Kierownik działu',
  'Operator maszyn',
  'Magazynier',
  'Konserwator',
  'Administrator systemu',
  'Specjalista HR',
  'Pracownik produkcji',
  'Kontroler jakości',
  'Logistyk'
];

db.serialize(() => {
  // Tworzenie tabeli departments
  db.run(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Błąd podczas tworzenia tabeli departments:', err);
    } else {
      console.log('✅ Tabela departments została utworzona');
    }
  });

  // Tworzenie tabeli positions
  db.run(`
    CREATE TABLE IF NOT EXISTS positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Błąd podczas tworzenia tabeli positions:', err);
    } else {
      console.log('✅ Tabela positions została utworzona');
    }
  });

  // Wstawianie domyślnych działów
  console.log('\n=== Dodawanie domyślnych działów ===');
  const insertDepartment = db.prepare(`
    INSERT OR IGNORE INTO departments (name) VALUES (?)
  `);

  DEFAULT_DEPARTMENTS.forEach(dept => {
    insertDepartment.run(dept, (err) => {
      if (err) {
        console.error(`Błąd podczas dodawania działu ${dept}:`, err);
      } else {
        console.log(`✅ Dodano dział: ${dept}`);
      }
    });
  });

  insertDepartment.finalize();

  // Wstawianie domyślnych pozycji
  console.log('\n=== Dodawanie domyślnych pozycji ===');
  const insertPosition = db.prepare(`
    INSERT OR IGNORE INTO positions (name) VALUES (?)
  `);

  DEFAULT_POSITIONS.forEach(pos => {
    insertPosition.run(pos, (err) => {
      if (err) {
        console.error(`Błąd podczas dodawania pozycji ${pos}:`, err);
      } else {
        console.log(`✅ Dodano pozycję: ${pos}`);
      }
    });
  });

  insertPosition.finalize(() => {
    console.log('\n=== Migracja zakończona ===');
    
    // Sprawdź wyniki
    db.all('SELECT COUNT(*) as count FROM departments', (err, rows) => {
      if (!err) {
        console.log(`📊 Liczba działów w bazie: ${rows[0].count}`);
      }
    });

    db.all('SELECT COUNT(*) as count FROM positions', (err, rows) => {
      if (!err) {
        console.log(`📊 Liczba pozycji w bazie: ${rows[0].count}`);
      }
      db.close();
    });
  });
});
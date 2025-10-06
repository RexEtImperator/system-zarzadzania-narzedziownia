const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

// Inicjalizacja aplikacji Express
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'system-ewidencji-narzedzi-secret-key';

// Middleware
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3000', 'https://localhost:3001', 'https://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Połączenie z bazą danych
const db = new sqlite3.Database(path.join(__dirname, 'database.db'), (err) => {
  if (err) {
    console.error('Błąd podczas łączenia z bazą danych:', err.message);
  } else {
    console.log('Połączono z bazą danych SQLite');
    initializeDatabase();
  }
});

// Inicjalizacja bazy danych
function initializeDatabase() {
  // Tabela konfiguracji aplikacji (ustawienia ogólne)
  db.run(`CREATE TABLE IF NOT EXISTS app_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    app_name TEXT NOT NULL,
    company_name TEXT,
    timezone TEXT,
    language TEXT,
    date_format TEXT,
    backup_frequency TEXT,
    last_backup_at DATETIME,
    updated_at DATETIME DEFAULT (datetime('now'))
  )`, (err) => {
    if (err) {
      console.error('Błąd podczas tworzenia tabeli app_config:', err.message);
    } else {
      // Dodaj brakujące kolumny jeśli nie istnieją
      db.all("PRAGMA table_info(app_config)", (err, columns) => {
        if (err) {
          console.error('Błąd podczas sprawdzania struktury tabeli app_config:', err.message);
        } else {
          const columnNames = columns.map(col => col.name);
          if (!columnNames.includes('backup_frequency')) {
            db.run('ALTER TABLE app_config ADD COLUMN backup_frequency TEXT', (err) => {
              if (err) console.error('Błąd dodawania kolumny backup_frequency:', err.message);
            });
          }
          if (!columnNames.includes('last_backup_at')) {
            db.run('ALTER TABLE app_config ADD COLUMN last_backup_at DATETIME', (err) => {
              if (err) console.error('Błąd dodawania kolumny last_backup_at:', err.message);
            });
          }
          // Usuń kolumnę currency jeśli istnieje (SQLite wymaga przebudowy tabeli)
          if (columnNames.includes('currency')) {
            db.serialize(() => {
              db.run('BEGIN TRANSACTION');
              db.run(`CREATE TABLE IF NOT EXISTS app_config_new (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                app_name TEXT NOT NULL,
                company_name TEXT,
                timezone TEXT,
                language TEXT,
                date_format TEXT,
                backup_frequency TEXT,
                last_backup_at DATETIME,
                updated_at DATETIME DEFAULT (datetime('now'))
              )`);
              db.run(`INSERT INTO app_config_new (id, app_name, company_name, timezone, language, date_format, backup_frequency, last_backup_at, updated_at)
                      SELECT id, app_name, company_name, timezone, language, date_format, backup_frequency, last_backup_at, updated_at FROM app_config WHERE id = 1`);
              db.run('DROP TABLE app_config');
              db.run('ALTER TABLE app_config_new RENAME TO app_config');
              db.run('COMMIT');
              console.log('Usunięto kolumnę currency z app_config');
            });
          }
        }
      });
      // Upewnij się, że istnieje rekord z domyślnymi ustawieniami
      db.get('SELECT COUNT(*) as count FROM app_config WHERE id = 1', [], (err, row) => {
        if (err) {
          console.error('Błąd podczas sprawdzania app_config:', err.message);
        } else if (row.count === 0) {
          db.run(
            `INSERT INTO app_config (id, app_name, company_name, timezone, language, date_format, backup_frequency) 
             VALUES (1, ?, ?, ?, ?, ?, ?)`,
            [
              'SZN - System Zarządzania Narzędziownią',
              'Moja Firma',
              'Europe/Warsaw',
              'pl',
              'DD/MM/YYYY',
              'daily'
            ],
            (err) => {
              if (err) {
                console.error('Błąd podczas inicjalizacji app_config:', err.message);
              } else {
                console.log('Zainicjalizowano domyślną konfigurację aplikacji (app_config)');
              }
            }
          );
        }
      });
    }
  });
  // Inicjuj harmonogram kopii zapasowych
  initBackupScheduler();
  // Tabela użytkowników
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    full_name TEXT,
    created_at DATETIME DEFAULT (datetime('now')),
    updated_at DATETIME DEFAULT (datetime('now'))
  )`, (err) => {
    if (err) {
      console.error('Błąd podczas tworzenia tabeli users:', err.message);
    } else {
      // Sprawdź czy tabela ma nowe kolumny, jeśli nie - dodaj je
      db.all("PRAGMA table_info(users)", (err, columns) => {
        if (err) {
          console.error('Błąd podczas sprawdzania struktury tabeli users:', err.message);
        } else {
          const columnNames = columns.map(col => col.name);
          
          // Dodaj brakujące kolumny jeśli nie istnieją
          if (!columnNames.includes('full_name')) {
            db.run('ALTER TABLE users ADD COLUMN full_name TEXT', (err) => {
              if (err) console.error('Błąd dodawania kolumny full_name:', err.message);
            });
          }
          if (!columnNames.includes('created_at')) {
            db.run('ALTER TABLE users ADD COLUMN created_at DATETIME', (err) => {
              if (err) console.error('Błąd dodawania kolumny created_at:', err.message);
            });
          }
          if (!columnNames.includes('updated_at')) {
            db.run('ALTER TABLE users ADD COLUMN updated_at DATETIME', (err) => {
              if (err) console.error('Błąd dodawania kolumny updated_at:', err.message);
            });
          }
        }
      });

      // Dodanie domyślnego użytkownika dbrzezinsky/natalka9
      const hashedPassword = bcrypt.hashSync('natalka9', 10);
      
      // Poczekaj na dodanie kolumn przed sprawdzeniem użytkownika
      setTimeout(() => {
        db.get('SELECT * FROM users WHERE username = ?', ['dbrzezinsky'], (err, user) => {
          if (err) {
            console.error('Błąd podczas sprawdzania użytkownika:', err.message);
          } else if (!user) {
            db.run('INSERT INTO users (username, password, role, full_name, created_at, updated_at) VALUES (?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'))', 
              ['dbrzezinsky', hashedPassword, 'administrator', 'Dawid Brzeziński'], 
              (err) => {
                if (err) {
                  console.error('Błąd podczas dodawania użytkownika dbrzezinsky:', err.message);
                } else {
                  console.log('Dodano domyślnego użytkownika dbrzezinsky');
                }
              });
          } else if (!user.full_name) {
            // Aktualizuj istniejącego użytkownika o brakujące dane
            db.run('UPDATE users SET full_name = ?, role = ?, updated_at = datetime(\'now\') WHERE username = ?', 
              ['Dawid Brzeziński', 'administrator', 'dbrzezinsky'], 
              (err) => {
                if (err) {
                  console.error('Błąd podczas aktualizacji użytkownika dbrzezinsky:', err.message);
                } else {
                  console.log('Zaktualizowano dane użytkownika dbrzezinsky');
                }
              });
          }
        });
      }, 100);
    }
  });

  // Tabela narzędzi
  db.run(`CREATE TABLE IF NOT EXISTS tools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    quantity INTEGER DEFAULT 1,
    location TEXT,
    category TEXT,
    description TEXT,
    barcode TEXT,
    qr_code TEXT,
    serial_number TEXT,
    inventory_number TEXT,
    created_at DATETIME DEFAULT (datetime('now')),
    updated_at DATETIME DEFAULT (datetime('now'))
  )`, (err) => {
    if (err) {
      console.error('Błąd podczas tworzenia tabeli tools:', err.message);
    } else {
      // Sprawdź czy tabela ma nowe kolumny, jeśli nie - dodaj je
      db.all("PRAGMA table_info(tools)", (err, columns) => {
        if (err) {
          console.error('Błąd podczas sprawdzania struktury tabeli:', err.message);
        } else {
          const columnNames = columns.map(col => col.name);
          
          // Dodaj brakujące kolumny jeśli nie istnieją
          if (!columnNames.includes('sku')) {
            db.run('ALTER TABLE tools ADD COLUMN sku TEXT', (err) => {
              if (err) console.error('Błąd dodawania kolumny sku:', err.message);
            });
          }
          if (!columnNames.includes('quantity')) {
            db.run('ALTER TABLE tools ADD COLUMN quantity INTEGER DEFAULT 1', (err) => {
              if (err) console.error('Błąd dodawania kolumny quantity:', err.message);
            });
          }
          if (!columnNames.includes('description')) {
            db.run('ALTER TABLE tools ADD COLUMN description TEXT', (err) => {
              if (err) console.error('Błąd dodawania kolumny description:', err.message);
            });
          }
          if (!columnNames.includes('barcode')) {
            db.run('ALTER TABLE tools ADD COLUMN barcode TEXT', (err) => {
              if (err) console.error('Błąd dodawania kolumny barcode:', err.message);
            });
          }
          if (!columnNames.includes('qr_code')) {
            db.run('ALTER TABLE tools ADD COLUMN qr_code TEXT', (err) => {
              if (err) console.error('Błąd dodawania kolumny qr_code:', err.message);
            });
          }
          if (!columnNames.includes('serial_unreadable')) {
            db.run('ALTER TABLE tools ADD COLUMN serial_unreadable INTEGER DEFAULT 0', (err) => {
              if (err) console.error('Błąd dodawania kolumny serial_unreadable:', err.message);
            });
          }
          if (!columnNames.includes('status')) {
            db.run('ALTER TABLE tools ADD COLUMN status TEXT DEFAULT "dostępne"', (err) => {
              if (err) console.error('Błąd dodawania kolumny status:', err.message);
            });
          }
          if (!columnNames.includes('issued_to_employee_id')) {
            db.run('ALTER TABLE tools ADD COLUMN issued_to_employee_id INTEGER', (err) => {
              if (err) console.error('Błąd dodawania kolumny issued_to_employee_id:', err.message);
            });
          }
          if (!columnNames.includes('issued_at')) {
            db.run('ALTER TABLE tools ADD COLUMN issued_at DATETIME', (err) => {
              if (err) console.error('Błąd dodawania kolumny issued_at:', err.message);
            });
          }
          if (!columnNames.includes('issued_by_user_id')) {
            db.run('ALTER TABLE tools ADD COLUMN issued_by_user_id INTEGER', (err) => {
              if (err) console.error('Błąd dodawania kolumny issued_by_user_id:', err.message);
            });
          }
          if (!columnNames.includes('serial_number')) {
            db.run('ALTER TABLE tools ADD COLUMN serial_number TEXT', (err) => {
              if (err) console.error('Błąd dodawania kolumny serial_number:', err.message);
            });
          }
          if (!columnNames.includes('inventory_number')) {
            db.run('ALTER TABLE tools ADD COLUMN inventory_number TEXT', (err) => {
              if (err) console.error('Błąd dodawania kolumny inventory_number:', err.message);
            });
          }

          // Serwis: ilość wysłana na serwis oraz data wysyłki
          if (!columnNames.includes('service_quantity')) {
            db.run('ALTER TABLE tools ADD COLUMN service_quantity INTEGER DEFAULT 0', (err) => {
              if (err) console.error('Błąd dodawania kolumny service_quantity:', err.message);
            });
          }
          if (!columnNames.includes('service_sent_at')) {
            db.run('ALTER TABLE tools ADD COLUMN service_sent_at DATETIME NULL', (err) => {
              if (err) console.error('Błąd dodawania kolumny service_sent_at:', err.message);
            });
          }
          if (!columnNames.includes('service_order_number')) {
            db.run('ALTER TABLE tools ADD COLUMN service_order_number TEXT', (err) => {
              if (err) console.error('Błąd dodawania kolumny service_order_number:', err.message);
            });
          }

          // Utwórz unikalny indeks dla numeru ewidencyjnego (jeśli nie istnieje)
          // Używamy indeksu częściowego, aby zezwolić na NULL w inventory_number
          db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_tools_inventory_number_unique ON tools(inventory_number) WHERE inventory_number IS NOT NULL', (err) => {
            if (err) {
              console.error('Błąd tworzenia unikalnego indeksu dla inventory_number:', err.message);
            } else {
              console.log('Zapewniono unikalny indeks dla inventory_number w tabeli tools');
            }
          });
        }
      });

      // Dodanie przykładowych narzędzi z nową strukturą
      db.get('SELECT COUNT(*) as count FROM tools', (err, result) => {
        if (err) {
          console.error('Błąd podczas sprawdzania narzędzi:', err.message);
        } else if (result.count === 0) {
          const sampleTools = [
            ['Wiertarka Bosch', 'QR17590493791001', 2, 'Magazyn A', 'Elektronarzędzia', 'Wiertarka udarowa 18V', 'QR17590493791001', 'QR17590493791001', 'SN-BOSCH-001'],
            ['Młot pneumatyczny', 'QR17590493791002', 1, 'Budowa 1', 'Pneumatyczne', 'Młot pneumatyczny 5kg', 'QR17590493791002', 'QR17590493791002', 'SN-PNEUM-002'],
            ['Szlifierka kątowa', 'QR17590493791003', 3, 'Magazyn B', 'Elektronarzędzia', 'Szlifierka 125mm', 'QR17590493791003', 'QR17590493791003', 'SN-SZLIF-003'],
            ['Spawarka', 'QR17590493791004', 1, 'Magazyn B', 'Spawalnicze', 'Spawarka MIG/MAG 200A', 'QR17590493791004', 'QR17590493791004', 'SN-SPAWN-004'],
            ['Piła łańcuchowa', 'QR17590493791005', 2, 'Budowa 2', 'Elektronarzędzia', 'Piła łańcuchowa 40cm', 'QR17590493791005', 'QR17590493791005', 'SN-PILA-005']
          ];

          const stmt = db.prepare('INSERT INTO tools (name, sku, quantity, location, category, description, barcode, qr_code, serial_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
          sampleTools.forEach(tool => {
            stmt.run(tool, (err) => {
              if (err) {
                console.error('Błąd podczas dodawania narzędzia:', err.message);
              }
            });
          });
          stmt.finalize();
          console.log('Dodano przykładowe narzędzia z kodami');
        }
      });
    }
  });

  // Tabela wydań narzędzi (nowa struktura dla wydawania pojedynczych sztuk)
  db.run(`CREATE TABLE IF NOT EXISTS tool_issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tool_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    issued_by_user_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    issued_at DATETIME DEFAULT (datetime('now', 'localtime')),
    returned_at DATETIME NULL,
    status TEXT DEFAULT 'wydane',
    FOREIGN KEY (tool_id) REFERENCES tools (id),
    FOREIGN KEY (employee_id) REFERENCES employees (id),
    FOREIGN KEY (issued_by_user_id) REFERENCES users (id)
  )`, (err) => {
    if (err) {
      console.error('Błąd podczas tworzenia tabeli tool_issues:', err.message);
    } else {
      console.log('Tabela tool_issues została utworzona lub już istnieje');
    }
  });

  // Tabela historii serwisowania narzędzi
  db.run(`CREATE TABLE IF NOT EXISTS tool_service_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tool_id INTEGER NOT NULL,
    action TEXT NOT NULL, -- 'sent' | 'received'
    quantity INTEGER NOT NULL,
    order_number TEXT,
    created_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (tool_id) REFERENCES tools (id)
  )`, (err) => {
    if (err) {
      console.error('Błąd podczas tworzenia tabeli tool_service_history:', err.message);
    } else {
      console.log('Tabela tool_service_history została utworzona lub już istnieje');
    }
  });

  // Tabela BHP (sprzęt BHP)
  db.run(`CREATE TABLE IF NOT EXISTS bhp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inventory_number TEXT UNIQUE NOT NULL,
    manufacturer TEXT,
    model TEXT,
    serial_number TEXT,
    catalog_number TEXT,
    inspection_date DATETIME,
    is_set INTEGER DEFAULT 0,
    harness_serial TEXT,
    shock_absorber_serial TEXT,
    shock_absorber_name TEXT,
    shock_absorber_model TEXT,
    status TEXT DEFAULT 'dostępne',
    created_at DATETIME DEFAULT (datetime('now')),
    updated_at DATETIME DEFAULT (datetime('now'))
  )`, (err) => {
    if (err) {
      console.error('Błąd podczas tworzenia tabeli bhp:', err.message);
    } else {
      // Sprawdź i dodaj brakujące kolumny
      db.all("PRAGMA table_info(bhp)", (err, columns) => {
        if (err) {
          console.error('Błąd podczas sprawdzania struktury tabeli bhp:', err.message);
        } else {
          const columnNames = columns.map(col => col.name);
          const ensureColumn = (name, ddl) => {
            if (!columnNames.includes(name)) {
              db.run(`ALTER TABLE bhp ADD COLUMN ${ddl}`, (err) => {
                if (err) console.error(`Błąd dodawania kolumny ${name}:`, err.message);
              });
            }
          };
          ensureColumn('inventory_number', 'inventory_number TEXT UNIQUE');
          ensureColumn('manufacturer', 'manufacturer TEXT');
          ensureColumn('model', 'model TEXT');
          ensureColumn('serial_number', 'serial_number TEXT');
          ensureColumn('catalog_number', 'catalog_number TEXT');
          ensureColumn('inspection_date', 'inspection_date DATETIME');
          ensureColumn('is_set', 'is_set INTEGER DEFAULT 0');
          ensureColumn('harness_serial', 'harness_serial TEXT');
          ensureColumn('shock_absorber_serial', 'shock_absorber_serial TEXT');
          ensureColumn('shock_absorber_name', 'shock_absorber_name TEXT');
          ensureColumn('shock_absorber_model', 'shock_absorber_model TEXT');
          ensureColumn('shock_absorber_catalog_number', 'shock_absorber_catalog_number TEXT');
          ensureColumn('harness_start_date', 'harness_start_date DATETIME');
          ensureColumn('shock_absorber_start_date', 'shock_absorber_start_date DATETIME');
          ensureColumn('shock_absorber_production_date', 'shock_absorber_production_date DATETIME');
          ensureColumn('production_date', 'production_date DATETIME');
          // Urządzenie samohamowne (SRD) dodatkowe pola
          ensureColumn('srd_manufacturer', 'srd_manufacturer TEXT');
          ensureColumn('srd_model', 'srd_model TEXT');
          ensureColumn('srd_serial_number', 'srd_serial_number TEXT');
          ensureColumn('srd_catalog_number', 'srd_catalog_number TEXT');
          ensureColumn('srd_production_date', 'srd_production_date DATETIME');
          ensureColumn('status', 'status TEXT DEFAULT "dostępne"');
        }
      });
    }
  });

  // Tabela wydań/zwrotów BHP
  db.run(`CREATE TABLE IF NOT EXISTS bhp_issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bhp_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    issued_by_user_id INTEGER NOT NULL,
    issued_at DATETIME DEFAULT (datetime('now', 'localtime')),
    returned_at DATETIME NULL,
    status TEXT DEFAULT 'wydane',
    FOREIGN KEY (bhp_id) REFERENCES bhp (id),
    FOREIGN KEY (employee_id) REFERENCES employees (id),
    FOREIGN KEY (issued_by_user_id) REFERENCES users (id)
  )`, (err) => {
    if (err) {
      console.error('Błąd podczas tworzenia tabeli bhp_issues:', err.message);
    } else {
      console.log('Tabela bhp_issues została utworzona lub już istnieje');
    }
  });
  // Tabela pracowników
  db.run(`CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    position TEXT NOT NULL,
    department TEXT NOT NULL,
    brand_number TEXT,
    created_at DATETIME DEFAULT (datetime('now'))
  )`, (err) => {
    if (err) {
      console.error('Błąd podczas tworzenia tabeli employees:', err.message);
    } else {
      // Sprawdź czy tabela ma nowe kolumny, jeśli nie - dodaj je
      db.all("PRAGMA table_info(employees)", (err, columns) => {
        if (err) {
          console.error('Błąd podczas sprawdzania struktury tabeli employees:', err.message);
        } else {
          const columnNames = columns.map(col => col.name);
          
          // Dodaj brakujące kolumny jeśli nie istnieją
          if (!columnNames.includes('first_name')) {
            db.run('ALTER TABLE employees ADD COLUMN first_name TEXT', (err) => {
              if (err) console.error('Błąd dodawania kolumny first_name:', err.message);
            });
          }
          if (!columnNames.includes('last_name')) {
            db.run('ALTER TABLE employees ADD COLUMN last_name TEXT', (err) => {
              if (err) console.error('Błąd dodawania kolumny last_name:', err.message);
            });
          }
          if (!columnNames.includes('phone')) {
            db.run('ALTER TABLE employees ADD COLUMN phone TEXT', (err) => {
              if (err) console.error('Błąd dodawania kolumny phone:', err.message);
            });
          }
          if (!columnNames.includes('created_at')) {
            db.run('ALTER TABLE employees ADD COLUMN created_at DATETIME DEFAULT (datetime(\'now\'))', (err) => {
              if (err) console.error('Błąd dodawania kolumny created_at:', err.message);
            });
          }
          if (!columnNames.includes('brand_number')) {
            db.run('ALTER TABLE employees ADD COLUMN brand_number TEXT', (err) => {
              if (err) console.error('Błąd dodawania kolumny brand_number:', err.message);
            });
          }
        }
      });

      // Dodanie prawdziwych pracowników
      const realEmployees = [
        ['Dawid', 'Brzeziński', '+48 516 991 404', 'Narzędziowiec', 'Narzędziownia', '43'],
        ['Piotr', 'Mędela', '+48 661 916 914', 'Narzędziowiec', 'Narzędziownia', '-'],
      ];

      db.get('SELECT COUNT(*) as count FROM employees', (err, result) => {
        if (err) {
          console.error('Błąd podczas sprawdzania pracowników:', err.message);
        } else if (result.count === 0) {
          const stmt = db.prepare('INSERT INTO employees (first_name, last_name, phone, position, department, brand_number) VALUES (?, ?, ?, ?, ?, ?)');
          realEmployees.forEach(employee => {
            stmt.run(employee, (err) => {
              if (err) {
                console.error('Błąd podczas dodawania pracownika:', err.message);
              }
            });
          });
          stmt.finalize();
          console.log('Dodano prawdziwych pracowników');
        }
      });
    }
  });

  // Tabela logów audytu
  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    user_agent TEXT,
    timestamp DATETIME DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`, (err) => {
    if (err) {
      console.error('Błąd podczas tworzenia tabeli audit_logs:', err.message);
    } else {
      console.log('Tabela audit_logs została utworzona lub już istnieje');
    }
  });

  // Tabela działów
  db.run(`CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT (datetime('now'))
  )`, (err) => {
    if (err) {
      console.error('Błąd podczas tworzenia tabeli departments:', err.message);
    } else {
      console.log('Tabela departments została utworzona lub już istnieje');
      // Dodaj brakujące kolumny jeśli nie istnieją
      db.all("PRAGMA table_info(departments)", (err, columns) => {
        if (err) {
          console.error('Błąd podczas sprawdzania struktury tabeli departments:', err.message);
        } else {
          const columnNames = columns.map(col => col.name);
          if (!columnNames.includes('manager_id')) {
            db.run('ALTER TABLE departments ADD COLUMN manager_id INTEGER', (err) => {
              if (err) console.error('Błąd dodawania kolumny manager_id:', err.message);
            });
          }
          if (!columnNames.includes('status')) {
            db.run('ALTER TABLE departments ADD COLUMN status TEXT DEFAULT "active"', (err) => {
              if (err) console.error('Błąd dodawania kolumny status:', err.message);
            });
          }
          if (!columnNames.includes('updated_at')) {
            db.run('ALTER TABLE departments ADD COLUMN updated_at DATETIME', (err) => {
              if (err) console.error('Błąd dodawania kolumny updated_at:', err.message);
            });
          }

          // Migracja: ustaw status='active' dla istniejących rekordów bez statusu
          db.run('UPDATE departments SET status = COALESCE(NULLIF(status, ""), "active") WHERE status IS NULL OR TRIM(status) = ""', (err) => {
            if (err) console.error('Błąd migracji status w departments:', err.message);
          });
        }
      });
    }
  });

  // Tabela pozycji
  db.run(`CREATE TABLE IF NOT EXISTS positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT (datetime('now'))
  )`, (err) => {
    if (err) {
      console.error('Błąd podczas tworzenia tabeli positions:', err.message);
    } else {
      console.log('Tabela positions została utworzona lub już istnieje');
      // Dodaj brakujące kolumny jeśli nie istnieją
      db.all("PRAGMA table_info(positions)", (err, columns) => {
        if (err) {
          console.error('Błąd podczas sprawdzania struktury tabeli positions:', err.message);
        } else {
          const columnNames = columns.map(col => col.name);
          if (!columnNames.includes('description')) {
            db.run('ALTER TABLE positions ADD COLUMN description TEXT', (err) => {
              if (err) console.error('Błąd dodawania kolumny description:', err.message);
            });
          }
          if (!columnNames.includes('department_id')) {
            db.run('ALTER TABLE positions ADD COLUMN department_id INTEGER', (err) => {
              if (err) console.error('Błąd dodawania kolumny department_id:', err.message);
            });
          }
          if (!columnNames.includes('requirements')) {
            db.run('ALTER TABLE positions ADD COLUMN requirements TEXT', (err) => {
              if (err) console.error('Błąd dodawania kolumny requirements:', err.message);
            });
          }
          if (!columnNames.includes('status')) {
            db.run('ALTER TABLE positions ADD COLUMN status TEXT DEFAULT "active"', (err) => {
              if (err) console.error('Błąd dodawania kolumny status:', err.message);
            });
          }
          if (!columnNames.includes('updated_at')) {
            db.run('ALTER TABLE positions ADD COLUMN updated_at DATETIME', (err) => {
              if (err) console.error('Błąd dodawania kolumny updated_at:', err.message);
            });
          }

          // Migracja: ustaw status='active' dla istniejących rekordów bez statusu
          db.run('UPDATE positions SET status = COALESCE(NULLIF(status, ""), "active") WHERE status IS NULL OR TRIM(status) = ""', (err) => {
            if (err) console.error('Błąd migracji status w positions:', err.message);
          });
        }
      });
    }
  });

  // Tabela uprawnień ról
  db.run(`CREATE TABLE IF NOT EXISTS role_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    permission TEXT NOT NULL,
    created_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(role, permission)
  )`, (err) => {
    if (err) {
      console.error('Błąd podczas tworzenia tabeli role_permissions:', err.message);
    } else {
      console.log('Tabela role_permissions została utworzona lub już istnieje');
      
      // Inicjalizacja domyślnych uprawnień dla ról
      const defaultPermissions = {
        'administrator': ['VIEW_USERS', 'CREATE_USERS', 'EDIT_USERS', 'DELETE_USERS', 'VIEW_ANALYTICS', 'ACCESS_TOOLS', 'MANAGE_DEPARTMENTS', 'MANAGE_POSITIONS', 'SYSTEM_SETTINGS', 'VIEW_ADMIN', 'MANAGE_USERS', 'VIEW_AUDIT_LOG', 'VIEW_BHP', 'MANAGE_BHP', 'DELETE_ISSUE_HISTORY', 'DELETE_SERVICE_HISTORY', 'MANAGE_EMPLOYEES'],
        'manager': ['VIEW_USERS', 'CREATE_USERS', 'EDIT_USERS', 'MANAGE_DEPARTMENTS', 'MANAGE_POSITIONS', 'VIEW_ANALYTICS', 'ACCESS_TOOLS', 'VIEW_BHP', 'MANAGE_BHP', 'MANAGE_EMPLOYEES'],
        'employee': ['ACCESS_TOOLS', 'VIEW_USERS', 'VIEW_BHP'],
        'user': ['ACCESS_TOOLS', 'VIEW_USERS', 'VIEW_ANALYTICS', 'VIEW_AUDIT_LOG', 'VIEW_BHP'],
        'viewer': ['VIEW_USERS', 'VIEW_BHP']
      };

      // Sprawdź czy uprawnienia już istnieją
      db.get('SELECT COUNT(*) as count FROM role_permissions', (err, row) => {
        if (err) {
          console.error('Błąd podczas sprawdzania uprawnień:', err.message);
        } else if (row.count === 0) {
          // Dodaj domyślne uprawnienia
          Object.entries(defaultPermissions).forEach(([role, permissions]) => {
            permissions.forEach(permission => {
              db.run('INSERT OR IGNORE INTO role_permissions (role, permission) VALUES (?, ?)', 
                [role, permission], (err) => {
                  if (err) {
                    console.error(`Błąd podczas dodawania uprawnienia ${permission} dla roli ${role}:`, err.message);
                  }
                });
            });
          });
          console.log('Domyślne uprawnienia ról zostały dodane');
        }

        // Automatyczna migracja: wstaw brakujące BHP-permissions dla istniejących ról
        const bhpPermissionsInit = {
          'administrator': ['VIEW_BHP', 'MANAGE_BHP'],
          'manager': ['VIEW_BHP', 'MANAGE_BHP'],
          'employee': ['VIEW_BHP'],
          'user': ['VIEW_BHP'],
          'viewer': ['VIEW_BHP']
        };
        Object.entries(bhpPermissionsInit).forEach(([role, permissions]) => {
          permissions.forEach(permission => {
            db.run('INSERT OR IGNORE INTO role_permissions (role, permission) VALUES (?, ?)', 
              [role, permission], (err) => {
                if (err) {
                  console.error(`Błąd migracji: nie udało się dodać ${permission} dla roli ${role}:`, err.message);
                }
              });
          });
        });
        console.log('Automatyczna migracja BHP-permissions zakończona');
      });
    }
  });
}

// Middleware do weryfikacji tokenu JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Brak tokenu uwierzytelniającego' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.warn('JWT verification failed:', {
        error: err.message,
        name: err.name,
        authHeader,
        tokenSnippet: token ? token.substring(0, 20) + '...' : null
      });
      return res.status(403).json({ message: 'Nieprawidłowy token' });
    }
    req.user = user;
    next();
  });
}

// Pomocnicza funkcja: upewnij się, że tabela departments ma wymagane kolumny
function ensureDepartmentColumns(callback) {
  db.all("PRAGMA table_info(departments)", (err, columns) => {
    if (err) {
      console.error('Błąd podczas sprawdzania struktury tabeli departments:', err.message);
      return callback && callback(err);
    }
    const columnNames = columns.map(col => col.name);
    const tasks = [];
    if (!columnNames.includes('manager_id')) {
      tasks.push({ sql: 'ALTER TABLE departments ADD COLUMN manager_id INTEGER', name: 'manager_id' });
    }
    if (!columnNames.includes('description')) {
      tasks.push({ sql: 'ALTER TABLE departments ADD COLUMN description TEXT', name: 'description' });
    }
    if (!columnNames.includes('status')) {
      tasks.push({ sql: 'ALTER TABLE departments ADD COLUMN status TEXT DEFAULT "active"', name: 'status' });
    }
    if (!columnNames.includes('updated_at')) {
      tasks.push({ sql: 'ALTER TABLE departments ADD COLUMN updated_at DATETIME', name: 'updated_at' });
    }

    const runNext = () => {
      if (tasks.length === 0) {
        return callback && callback();
      }
      const task = tasks.shift();
      db.run(task.sql, (alterErr) => {
        if (alterErr && !String(alterErr.message).toLowerCase().includes('duplicate column')) {
          console.error(`Błąd dodawania kolumny ${task.name}:`, alterErr.message);
        }
        runNext();
      });
    };
    runNext();
  });
}

// Endpoint logowania
app.post('/api/login', (req, res) => {
  console.log('=== LOGIN REQUEST ===');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  console.log('Body type:', typeof req.body);
  
  const { username, password } = req.body;
  
  console.log('Extracted username:', username);
  console.log('Extracted password:', password ? '[HIDDEN]' : 'undefined');

  if (!username || !password) {
    console.log('Missing username or password');
    return res.status(400).json({ message: 'Wymagane są nazwa użytkownika i hasło' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      console.log('Database error:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }

    if (!user) {
      console.log('User not found:', username);
      return res.status(401).json({ message: 'Nieprawidłowa nazwa użytkownika lub hasło' });
    }

    const passwordIsValid = bcrypt.compareSync(password, user.password);
    console.log('Password valid:', passwordIsValid);

    if (!passwordIsValid) {
      return res.status(401).json({ message: 'Nieprawidłowa nazwa użytkownika lub hasło' });
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, {
      expiresIn: 86400 // 24 godziny
    });

    console.log('Login successful for user:', username);
    res.status(200).json({
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      token: token
    });
  });
});

// Endpoint pobierania wszystkich wydań narzędzi z paginacją
app.get('/api/tool-issues', authenticateToken, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  // Zapytanie do pobrania całkowitej liczby rekordów
  const countQuery = `
    SELECT COUNT(*) as total
    FROM tool_issues ti
    LEFT JOIN tools t ON ti.tool_id = t.id
    LEFT JOIN employees e ON ti.employee_id = e.id
    LEFT JOIN users u ON ti.issued_by_user_id = u.id
  `;

  // Zapytanie do pobrania danych z paginacją
  const dataQuery = `
    SELECT 
      ti.*,
      t.name as tool_name,
      e.first_name as employee_first_name,
      e.last_name as employee_last_name,
      u.full_name as issued_by_user_name
    FROM tool_issues ti
    LEFT JOIN tools t ON ti.tool_id = t.id
    LEFT JOIN employees e ON ti.employee_id = e.id
    LEFT JOIN users u ON ti.issued_by_user_id = u.id
    ORDER BY ti.issued_at DESC
    LIMIT ? OFFSET ?
  `;

  // Najpierw pobieramy całkowitą liczbę rekordów
  db.get(countQuery, [], (err, countResult) => {
    if (err) {
      console.error('Błąd przy pobieraniu liczby wydań narzędzi:', err);
      return res.status(500).json({ message: 'Błąd serwera', error: err.message });
    }

    const total = countResult.total;
    const totalPages = Math.ceil(total / limit);

    // Następnie pobieramy dane dla aktualnej strony
    db.all(dataQuery, [limit, offset], (err, issues) => {
      if (err) {
        console.error('Błąd przy pobieraniu wydań narzędzi:', err);
        return res.status(500).json({ message: 'Błąd serwera', error: err.message });
      }

      res.json({
        data: issues,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalItems: total,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        }
      });
    });
  });
});

// Endpoint rejestracji (tylko dla administratorów)
app.post('/api/register', authenticateToken, (req, res) => {
  const { username, password, role } = req.body;

  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Tylko administrator może dodawać nowych użytkowników' });
  }

  if (!username || !password || !role) {
    return res.status(400).json({ message: 'Wszystkie pola są wymagane' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', 
    [username, hashedPassword, role], 
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ message: 'Użytkownik o tej nazwie już istnieje' });
        }
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      res.status(201).json({ message: 'Użytkownik został zarejestrowany', id: this.lastID });
    });
});

// Endpoint wyszukiwania narzędzia po kodzie kreskowym/QR
app.get('/api/tools/search', authenticateToken, (req, res) => {
  console.log('=== TOOLS SEARCH REQUEST ===');
  console.log('Query params:', req.query);
  console.log('Headers:', req.headers);
  
  const { code } = req.query;
  
  if (!code) {
    console.log('No code provided');
    return res.status(400).json({ message: 'Kod jest wymagany' });
  }

  console.log('Searching for tool with code:', code);

  // Wyszukaj narzędzie po SKU, kodzie kreskowym lub kodzie QR
  db.get(
    'SELECT * FROM tools WHERE sku = ? OR barcode = ? OR qr_code = ? OR inventory_number = ? LIMIT 1',
    [code, code, code, code],
    (err, tool) => {
      if (err) {
        console.error('Błąd podczas wyszukiwania narzędzia:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }
      
      console.log('Search result:', tool);
      
      if (!tool) {
        console.log('No tool found for code:', code);
        return res.status(404).json({ message: 'Nie znaleziono narzędzia o podanym kodzie' });
      }
      
      console.log('Returning tool:', tool);
      res.status(200).json(tool);
    }
  );
});

// Endpoint pobierania narzędzi
app.get('/api/tools', authenticateToken, (req, res) => {
  db.all('SELECT * FROM tools', [], (err, tools) => {
    if (err) {
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    res.status(200).json(tools);
  });
});

// Endpoint dodawania narzędzia
app.post('/api/tools', authenticateToken, (req, res) => {
  const { name, sku, quantity, location, category, description, barcode, qr_code, serial_number, serial_unreadable, inventory_number } = req.body;

  if (!name || !sku) {
    return res.status(400).json({ message: 'Wymagane są nazwa i SKU' });
  }

  // Wymagaj numeru fabrycznego, chyba że zaznaczono, że jest nieczytelny
  const serialProvided = serial_number && String(serial_number).trim().length > 0;
  const unreadableFlag = !!serial_unreadable;
  if (!serialProvided && !unreadableFlag) {
    return res.status(400).json({ message: 'Numer fabryczny jest wymagany lub zaznacz "Numer nieczytelny"' });
  }

  db.run(
    'INSERT INTO tools (name, sku, quantity, location, category, description, barcode, qr_code, serial_number, serial_unreadable, inventory_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [name, sku, quantity || 1, location, category, description, barcode || sku, qr_code || sku, serialProvided ? serial_number : null, unreadableFlag ? 1 : 0, inventory_number || null],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed: tools.inventory_number')) {
          return res.status(400).json({ message: 'Narzędzie o tym numerze ewidencyjnym już istnieje' });
        }
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ message: 'Narzędzie o tym SKU już istnieje' });
        }
        return res.status(500).json({ message: 'Błąd serwera' });
      }
      
      // Pobierz pełne dane dodanego narzędzia
      db.get('SELECT * FROM tools WHERE id = ?', [this.lastID], (err, tool) => {
        if (err) {
          return res.status(500).json({ message: 'Błąd podczas pobierania danych narzędzia' });
        }
        res.status(201).json(tool);
      });
    }
  );
});

// Endpoint aktualizacji narzędzia
app.put('/api/tools/:id', authenticateToken, (req, res) => {
  const { name, sku, quantity, location, category, description, barcode, qr_code, serial_number, serial_unreadable, status, inventory_number } = req.body;
  const id = req.params.id;

  if (!name || !sku) {
    return res.status(400).json({ message: 'Wymagane są nazwa i SKU' });
  }

  // W edycji: jeśli numer fabryczny pusty, wymagaj zaznaczenia nieczytelności
  const serialProvided = serial_number && String(serial_number).trim().length > 0;
  const unreadableFlag = !!serial_unreadable;
  if (!serialProvided && !unreadableFlag) {
    return res.status(400).json({ message: 'Numer fabryczny jest wymagany lub zaznacz "Numer nieczytelny"' });
  }

  db.run(
    'UPDATE tools SET name = ?, sku = ?, quantity = ?, location = ?, category = ?, description = ?, barcode = ?, qr_code = ?, serial_number = ?, serial_unreadable = ?, inventory_number = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name, sku, quantity || 1, location, category, description, barcode || sku, qr_code || sku, serialProvided ? serial_number : null, unreadableFlag ? 1 : 0, inventory_number || null, status || 'dostępne', id],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed: tools.inventory_number')) {
          return res.status(400).json({ message: 'Narzędzie o tym numerze ewidencyjnym już istnieje' });
        }
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ message: 'Narzędzie o tym SKU już istnieje' });
        }
        return res.status(500).json({ message: 'Błąd serwera' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ message: 'Narzędzie nie zostało znalezione' });
      }
      res.status(200).json({ message: 'Narzędzie zostało zaktualizowane' });
    }
  );
});

// Endpoint usuwania narzędzia
app.delete('/api/tools/:id', authenticateToken, (req, res) => {
  const id = req.params.id;

  db.run('DELETE FROM tools WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'Narzędzie nie zostało znalezione' });
    }
    res.status(200).json({ message: 'Narzędzie zostało usunięte' });
  });
});

// Endpoint wysyłki narzędzia na serwis (obsługa ilości)
app.post('/api/tools/:id/service', authenticateToken, (req, res) => {
  const toolId = req.params.id;
  const { quantity, service_order_number } = req.body;

  // Pobierz aktualne dane narzędzia
  db.get('SELECT id, quantity, COALESCE(service_quantity, 0) as service_quantity FROM tools WHERE id = ?', [toolId], (err, tool) => {
    if (err) {
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    if (!tool) {
      return res.status(404).json({ message: 'Narzędzie nie zostało znalezione' });
    }

    const sendQuantity = Math.max(1, parseInt(quantity || 1, 10));
    const availableForService = tool.quantity - tool.service_quantity;
    if (sendQuantity > availableForService) {
      return res.status(400).json({ message: `Maksymalnie można wysłać ${availableForService} szt.` });
    }

    const newServiceQuantity = tool.service_quantity + sendQuantity;

    // Ustal nowy status: jeśli całkowita ilość to 1 i coś wysłane -> 'serwis', w przeciwnym wypadku pozostaw bez zmian
    let updateStatusSql = '';
    let updateParams = [newServiceQuantity, new Date().toISOString(), toolId];
    if (tool.quantity === 1 && newServiceQuantity >= 1) {
      updateStatusSql = ', status = ?';
      updateParams = [newServiceQuantity, new Date().toISOString(), 'serwis', toolId];
    }

    // Aktualizuj również numer zlecenia serwisowego (jeśli przekazano)
    let updateSql = `UPDATE tools SET service_quantity = ?, service_sent_at = ?, service_order_number = COALESCE(?, service_order_number)`;
    let params = [newServiceQuantity, new Date().toISOString(), service_order_number || null];
    if (tool.quantity === 1 && newServiceQuantity >= 1) {
      updateSql += ', status = ?';
      params.push('serwis');
    }
    updateSql += ' WHERE id = ?';
    params.push(toolId);

    db.run(
      updateSql,
      params,
      function(updateErr) {
        if (updateErr) {
          return res.status(500).json({ message: 'Błąd serwera' });
        }

        // Zwróć zaktualizowane narzędzie
        db.get('SELECT * FROM tools WHERE id = ?', [toolId], (getErr, updatedTool) => {
          if (getErr) {
            return res.status(500).json({ message: 'Błąd podczas pobierania zaktualizowanego narzędzia' });
          }
          res.status(200).json({ 
            message: `Wysłano na serwis ${sendQuantity} szt.${service_order_number ? ` (zlecenie: ${service_order_number})` : ''}`, 
            tool: updatedTool 
          });
        });
      }
    );
  });
});

// Endpoint odbioru narzędzia z serwisu (obsługa ilości)
app.post('/api/tools/:id/service/receive', authenticateToken, (req, res) => {
  const toolId = req.params.id;
  const { quantity } = req.body || {};

  // Pobierz aktualne dane narzędzia
  db.get('SELECT id, quantity, COALESCE(service_quantity, 0) as service_quantity, service_order_number FROM tools WHERE id = ?', [toolId], (err, tool) => {
    if (err) {
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    if (!tool) {
      return res.status(404).json({ message: 'Narzędzie nie zostało znalezione' });
    }

    const current = tool.service_quantity;
    const receiveQuantity = Math.max(1, parseInt(quantity || current, 10));
    if (receiveQuantity > current) {
      return res.status(400).json({ message: `Maksymalnie można odebrać ${current} szt.` });
    }

    const remaining = current - receiveQuantity;

    let updateSql = 'UPDATE tools SET service_quantity = ?';
    const params = [remaining];
    if (remaining === 0) {
      updateSql += ', service_sent_at = NULL, service_order_number = NULL, status = "dostępne"';
    }
    updateSql += ' WHERE id = ?';
    params.push(toolId);

    db.run(updateSql, params, function(updateErr) {
      if (updateErr) {
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      // Zapisz historię odbioru
      db.run(
        'INSERT INTO tool_service_history (tool_id, action, quantity, order_number) VALUES (?, ?, ?, ?)',
        [toolId, 'received', receiveQuantity, tool.service_order_number || null],
        function(histErr) {
          if (histErr) {
            return res.status(500).json({ message: 'Błąd serwera' });
          }

          // Zwróć zaktualizowane narzędzie
          db.get('SELECT * FROM tools WHERE id = ?', [toolId], (getErr, updatedTool) => {
            if (getErr) {
              return res.status(500).json({ message: 'Błąd podczas pobierania zaktualizowanego narzędzia' });
            }
            res.status(200).json({ 
              message: `Odebrano z serwisu ${receiveQuantity} szt.`,
              tool: updatedTool,
              remaining
            });
          });
        }
      );
    });
  });
});

// Podsumowanie historii serwisowania do Analityki
app.get('/api/service-history/summary', authenticateToken, (req, res) => {
  const inServiceQuery = `
    SELECT id, name, sku, COALESCE(service_quantity,0) as service_quantity, service_order_number, service_sent_at
    FROM tools
    WHERE COALESCE(service_quantity,0) > 0
    ORDER BY service_sent_at DESC
  `;
  const recentEventsQuery = `
    SELECT h.id, h.tool_id, t.name, t.sku, h.action, h.quantity, h.order_number, h.created_at
    FROM tool_service_history h
    JOIN tools t ON t.id = h.tool_id
    ORDER BY h.created_at DESC
    LIMIT 50
  `;

  db.all(inServiceQuery, [], (err, inService) => {
    if (err) {
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    db.all(recentEventsQuery, [], (err2, events) => {
      if (err2) {
        return res.status(500).json({ message: 'Błąd serwera' });
      }
      res.json({ in_service: inService, recent_events: events });
    });
  });
});

// ====== BHP Endpoints ======
// Pobieranie sprzętu BHP
app.get('/api/bhp', authenticateToken, requirePermission('VIEW_BHP'), (req, res) => {
  const query = `
    SELECT 
      b.*, 
      (
        SELECT e.id 
        FROM bhp_issues bi 
        LEFT JOIN employees e ON e.id = bi.employee_id 
        WHERE bi.bhp_id = b.id AND bi.status = 'wydane' 
        ORDER BY bi.issued_at DESC 
        LIMIT 1
      ) AS assigned_employee_id,
      (
        SELECT e.first_name 
        FROM bhp_issues bi 
        LEFT JOIN employees e ON e.id = bi.employee_id 
        WHERE bi.bhp_id = b.id AND bi.status = 'wydane' 
        ORDER BY bi.issued_at DESC 
        LIMIT 1
      ) AS assigned_employee_first_name,
      (
        SELECT e.last_name 
        FROM bhp_issues bi 
        LEFT JOIN employees e ON e.id = bi.employee_id 
        WHERE bi.bhp_id = b.id AND bi.status = 'wydane' 
        ORDER BY bi.issued_at DESC 
        LIMIT 1
      ) AS assigned_employee_last_name
    FROM bhp b
    ORDER BY b.inventory_number
  `;
  db.all(query, [], (err, items) => {
    if (err) {
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    res.status(200).json(items);
  });
});

// Dodawanie sprzętu BHP
app.post('/api/bhp', authenticateToken, requirePermission('MANAGE_BHP'), (req, res) => {
  const { inventory_number, manufacturer, model, serial_number, catalog_number, production_date, inspection_date, is_set, harness_serial, shock_absorber_serial, shock_absorber_name, shock_absorber_model, shock_absorber_catalog_number, harness_start_date, shock_absorber_start_date, shock_absorber_production_date, srd_manufacturer, srd_model, srd_serial_number, srd_catalog_number, srd_production_date, status } = req.body;

  if (!inventory_number) {
    return res.status(400).json({ message: 'Wymagany numer ewidencyjny' });
  }

  const query = `INSERT INTO bhp (inventory_number, manufacturer, model, serial_number, catalog_number, production_date, inspection_date, is_set, harness_serial, shock_absorber_serial, shock_absorber_name, shock_absorber_model, shock_absorber_catalog_number, harness_start_date, shock_absorber_start_date, shock_absorber_production_date, srd_manufacturer, srd_model, srd_serial_number, srd_catalog_number, srd_production_date, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const params = [inventory_number, manufacturer, model, serial_number, catalog_number, production_date, inspection_date, is_set ? 1 : 0, harness_serial, shock_absorber_serial, shock_absorber_name, shock_absorber_model, shock_absorber_catalog_number, harness_start_date, shock_absorber_start_date, shock_absorber_production_date, srd_manufacturer, srd_model, srd_serial_number, srd_catalog_number, srd_production_date, status || 'dostępne'];

  db.run(query, params, function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ message: 'Pozycja o tym numerze ewidencyjnym już istnieje' });
      }
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    db.get('SELECT * FROM bhp WHERE id = ?', [this.lastID], (err, item) => {
      if (err) return res.status(500).json({ message: 'Błąd podczas pobierania nowej pozycji' });
      res.status(201).json(item);
    });
  });
});

// Aktualizacja sprzętu BHP
app.put('/api/bhp/:id', authenticateToken, requirePermission('MANAGE_BHP'), (req, res) => {
  const id = req.params.id;
  const {
    inventory_number,
    manufacturer,
    model,
    serial_number,
    catalog_number,
    production_date,
    inspection_date,
    is_set,
    harness_serial,
    shock_absorber_serial,
    shock_absorber_name,
    shock_absorber_model,
    shock_absorber_catalog_number,
    harness_start_date,
    shock_absorber_start_date,
    shock_absorber_production_date,
    srd_manufacturer,
    srd_model,
    srd_serial_number,
    srd_catalog_number,
    srd_production_date,
    status
  } = req.body;

  if (!inventory_number) {
    return res.status(400).json({ message: 'Wymagany numer ewidencyjny' });
  }

  // Nie nadpisuj istniejących wartości NULL-em/"" jeśli pole nie zostało podane.
  // Dla pól tekstowych traktuj pusty string jak brak zmiany.
  const query = `
    UPDATE bhp SET
      inventory_number = COALESCE(NULLIF(?, ''), inventory_number),
      manufacturer = COALESCE(NULLIF(?, ''), manufacturer),
      model = COALESCE(NULLIF(?, ''), model),
      serial_number = COALESCE(NULLIF(?, ''), serial_number),
      catalog_number = COALESCE(NULLIF(?, ''), catalog_number),
      production_date = COALESCE(?, production_date),
      inspection_date = COALESCE(?, inspection_date),
      is_set = COALESCE(?, is_set),
      harness_serial = COALESCE(NULLIF(?, ''), harness_serial),
      shock_absorber_serial = COALESCE(NULLIF(?, ''), shock_absorber_serial),
      shock_absorber_name = COALESCE(NULLIF(?, ''), shock_absorber_name),
      shock_absorber_model = COALESCE(NULLIF(?, ''), shock_absorber_model),
      shock_absorber_catalog_number = COALESCE(NULLIF(?, ''), shock_absorber_catalog_number),
      harness_start_date = COALESCE(?, harness_start_date),
      shock_absorber_start_date = COALESCE(?, shock_absorber_start_date),
      shock_absorber_production_date = COALESCE(?, shock_absorber_production_date),
      srd_manufacturer = COALESCE(NULLIF(?, ''), srd_manufacturer),
      srd_model = COALESCE(NULLIF(?, ''), srd_model),
      srd_serial_number = COALESCE(NULLIF(?, ''), srd_serial_number),
      srd_catalog_number = COALESCE(NULLIF(?, ''), srd_catalog_number),
      srd_production_date = COALESCE(?, srd_production_date),
      status = COALESCE(NULLIF(?, ''), status),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  const params = [
    inventory_number,
    manufacturer,
    model,
    serial_number,
    catalog_number,
    production_date,
    inspection_date,
    typeof is_set === 'number' ? is_set : (is_set ? 1 : 0),
    harness_serial,
    shock_absorber_serial,
    shock_absorber_name,
    shock_absorber_model,
    shock_absorber_catalog_number,
    harness_start_date,
    shock_absorber_start_date,
    shock_absorber_production_date,
    srd_manufacturer,
    srd_model,
    srd_serial_number,
    srd_catalog_number,
    srd_production_date,
    status || 'dostępne',
    id
  ];

  db.run(query, params, function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ message: 'Pozycja o tym numerze ewidencyjnym już istnieje' });
      }
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'Pozycja BHP nie została znaleziona' });
    }
    // Zwróć zaktualizowany rekord, aby łatwiej zweryfikować zapis
    db.get('SELECT * FROM bhp WHERE id = ?', [id], (getErr, row) => {
      if (getErr) {
        return res.status(500).json({ message: 'Błąd podczas pobierania zaktualizowanej pozycji' });
      }
      res.status(200).json({ message: 'Pozycja BHP została zaktualizowana', item: row });
    });
  });
});

// Usunięcie sprzętu BHP
app.delete('/api/bhp/:id', authenticateToken, requirePermission('MANAGE_BHP'), (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM bhp WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'Pozycja BHP nie została znaleziona' });
    }
    res.status(200).json({ message: 'Pozycja BHP została usunięta' });
  });
});

// Wydanie sprzętu BHP pracownikowi (pojedyncza sztuka)
app.post('/api/bhp/:id/issue', authenticateToken, requirePermission('MANAGE_BHP'), (req, res) => {
  const bhpId = req.params.id;
  const { employee_id } = req.body;
  const userId = req.user.id;

  if (!employee_id) {
    return res.status(400).json({ message: 'ID pracownika jest wymagane' });
  }

  db.get('SELECT * FROM bhp WHERE id = ?', [bhpId], (err, item) => {
    if (err) return res.status(500).json({ message: 'Błąd serwera' });
    if (!item) return res.status(404).json({ message: 'Pozycja BHP nie została znaleziona' });
    if (item.status === 'wydane') return res.status(400).json({ message: 'Pozycja BHP jest już wydana' });

    db.get('SELECT * FROM employees WHERE id = ?', [employee_id], (err, employee) => {
      if (err) return res.status(500).json({ message: 'Błąd serwera' });
      if (!employee) return res.status(404).json({ message: 'Pracownik nie został znaleziony' });

      db.run(
        'INSERT INTO bhp_issues (bhp_id, employee_id, issued_by_user_id) VALUES (?, ?, ?)',
        [bhpId, employee_id, userId],
        function(err) {
          if (err) return res.status(500).json({ message: 'Błąd serwera' });
          db.run('UPDATE bhp SET status = ? WHERE id = ?', ['wydane', bhpId], function(err) {
            if (err) return res.status(500).json({ message: 'Błąd serwera' });
            res.status(200).json({ message: 'Sprzęt BHP wydany', issue_id: this.lastID });
          });
        }
      );
    });
  });
});

// Zwrot sprzętu BHP
app.post('/api/bhp/:id/return', authenticateToken, requirePermission('MANAGE_BHP'), (req, res) => {
  const bhpId = req.params.id;
  const { issue_id } = req.body;

  if (!issue_id) {
    return res.status(400).json({ message: 'ID wydania jest wymagane' });
  }

  db.get('SELECT * FROM bhp_issues WHERE id = ? AND bhp_id = ? AND status = "wydane"', [issue_id, bhpId], (err, issue) => {
    if (err) return res.status(500).json({ message: 'Błąd serwera' });
    if (!issue) return res.status(404).json({ message: 'Wydanie nie zostało znalezione lub już zwrócone' });

    db.run('UPDATE bhp_issues SET status = "zwrócone", returned_at = datetime("now") WHERE id = ?', [issue_id], function(err) {
      if (err) return res.status(500).json({ message: 'Błąd serwera' });
      db.run('UPDATE bhp SET status = ? WHERE id = ?', ['dostępne', bhpId], function(err) {
        if (err) return res.status(500).json({ message: 'Błąd serwera' });
        res.status(200).json({ message: 'Sprzęt BHP zwrócony' });
      });
    });
  });
});

// Szczegóły BHP + aktywne wydania i status przypomnienia przeglądu
app.get('/api/bhp/:id/details', authenticateToken, (req, res) => {
  const bhpId = req.params.id;

  db.get('SELECT * FROM bhp WHERE id = ?', [bhpId], (err, item) => {
    if (err) return res.status(500).json({ message: 'Błąd serwera' });
    if (!item) return res.status(404).json({ message: 'Pozycja BHP nie została znaleziona' });

    const issuesQuery = `
      SELECT 
        bi.*, 
        e.first_name as employee_first_name, 
        e.last_name as employee_last_name, 
        u.full_name as issued_by_user_name
      FROM bhp_issues bi
      LEFT JOIN employees e ON bi.employee_id = e.id
      LEFT JOIN users u ON bi.issued_by_user_id = u.id
      WHERE bi.bhp_id = ?
      ORDER BY bi.issued_at DESC
    `;

    db.all(issuesQuery, [bhpId], (err, issues) => {
      if (err) return res.status(500).json({ message: 'Błąd serwera' });

      // Obliczenie dni do przeglądu
      let reviewReminder = null;
      if (item.inspection_date) {
        const now = new Date();
        const insp = new Date(item.inspection_date);
        const diffDays = Math.ceil((insp - now) / (1000 * 60 * 60 * 24));
        reviewReminder = {
          days_to_review: diffDays,
          status: diffDays < 0 ? 'po_terminie' : (diffDays <= 30 ? 'zbliża_się' : 'ok')
        };
      }

      res.json({ ...item, issues, reviewReminder });
    });
  });
});

// Historia wydań/zwrotów BHP (wszystkie wpisy)
app.get('/api/bhp/:id/history', authenticateToken, (req, res) => {
  const bhpId = req.params.id;
  const query = `
    SELECT 
      bi.*, 
      e.first_name as employee_first_name, 
      e.last_name as employee_last_name, 
      u.full_name as issued_by_user_name
    FROM bhp_issues bi
    LEFT JOIN employees e ON bi.employee_id = e.id
    LEFT JOIN users u ON bi.issued_by_user_id = u.id
    WHERE bi.bhp_id = ?
    ORDER BY bi.issued_at DESC
  `;
  db.all(query, [bhpId], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Błąd serwera' });
    res.json(rows);
  });
});

// Endpoint pobierania pracowników
app.get('/api/employees', authenticateToken, (req, res) => {
  db.all('SELECT * FROM employees', [], (err, employees) => {
    if (err) {
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    res.status(200).json(employees);
  });
});

// Endpoint dodawania pracownika
app.post('/api/employees', authenticateToken, requirePermission('MANAGE_EMPLOYEES'), (req, res) => {
  const { first_name, last_name, phone, position, department, brand_number } = req.body;

  if (!first_name || !last_name || !position || !department) {
    return res.status(400).json({ message: 'Wymagane są imię, nazwisko, stanowisko i dział' });
  }

  db.run(
    'INSERT INTO employees (first_name, last_name, phone, position, department, brand_number) VALUES (?, ?, ?, ?, ?, ?)',
    [first_name, last_name, phone, position, department, brand_number],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Błąd serwera' });
      }
      res.status(201).json({ 
        message: 'Pracownik został dodany',
        id: this.lastID
      });
    }
  );
});

// Endpoint aktualizacji pracownika
app.put('/api/employees/:id', authenticateToken, requirePermission('MANAGE_EMPLOYEES'), (req, res) => {
  const { first_name, last_name, phone, position, department, brand_number } = req.body;
  const id = req.params.id;

  if (!first_name || !last_name || !position || !department) {
    return res.status(400).json({ message: 'Wymagane są imię, nazwisko, stanowisko i dział' });
  }

  db.run(
    'UPDATE employees SET first_name = ?, last_name = ?, phone = ?, position = ?, department = ?, brand_number = ? WHERE id = ?',
    [first_name, last_name, phone, position, department, brand_number, id],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Błąd serwera' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ message: 'Pracownik nie został znaleziony' });
      }
      res.status(200).json({ message: 'Pracownik został zaktualizowany' });
    }
  );
});

// Endpoint usuwania pracownika
app.delete('/api/employees/:id', authenticateToken, requirePermission('MANAGE_EMPLOYEES'), (req, res) => {
  const id = req.params.id;

  db.run('DELETE FROM employees WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'Pracownik nie został znaleziony' });
    }
    res.status(200).json({ message: 'Pracownik został usunięty' });
  });
});

// Endpoint usuwania wszystkich pracowników
app.delete('/employees/all', authenticateToken, (req, res) => {
  // Sprawdź uprawnienia administratora
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Brak uprawnień' });
  }

  console.log('Rozpoczęcie usuwania wszystkich pracowników...');

  db.run('DELETE FROM employees', function(err) {
    if (err) {
      console.error('Błąd podczas usuwania pracowników:', err);
      return res.status(500).json({ message: 'Błąd serwera podczas usuwania pracowników' });
    }
    
    console.log(`Usunięto ${this.changes} pracowników`);
    
    // Dodaj wpis do dziennika audytu
    const auditQuery = `
      INSERT INTO audit_logs (user_id, action, details, timestamp)
      VALUES (?, ?, ?, datetime('now'))
    `;
    
    db.run(auditQuery, [
      req.user.id,
      'DELETE_ALL_EMPLOYEES',
      `Usunięto wszystkich pracowników (${this.changes} rekordów)`
    ], (auditErr) => {
      if (auditErr) {
        console.error('Błąd podczas dodawania wpisu do dziennika audytu:', auditErr);
      }
    });
    
    res.status(200).json({ 
      message: 'Wszyscy pracownicy zostali usunięci',
      deletedCount: this.changes
    });
  });
});

// Endpoint do usuwania historii wydań i zwrotów
app.delete('/tools/history', authenticateToken, requirePermission('DELETE_ISSUE_HISTORY'), (req, res) => {
  console.log('Rozpoczęcie usuwania historii wydań i zwrotów...');

  db.serialize(() => {
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) {
        console.error('Błąd rozpoczęcia transakcji:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      // Usuń wszystkie rekordy z tabeli tool_issues
      db.run('DELETE FROM tool_issues', function(err) {
        if (err) {
          console.error('Błąd usuwania z tabeli tool_issues:', err);
          db.run('ROLLBACK');
          return res.status(500).json({ message: 'Błąd podczas usuwania historii wydań' });
        }

        const deletedIssues = this.changes;
        console.log(`Usunięto ${deletedIssues} rekordów z tabeli tool_issues`);

        // Zresetuj status wszystkich narzędzi na 'dostępne'
        db.run('UPDATE tools SET status = ? WHERE status != ?', ['dostępne', 'dostępne'], function(err) {
          if (err) {
            console.error('Błąd resetowania statusów narzędzi:', err);
            db.run('ROLLBACK');
            return res.status(500).json({ message: 'Błąd podczas resetowania statusów narzędzi' });
          }

          const updatedTools = this.changes;
          console.log(`Zaktualizowano status ${updatedTools} narzędzi na 'dostępne'`);

          // Zatwierdź transakcję
          db.run('COMMIT', (err) => {
            if (err) {
              console.error('Błąd zatwierdzania transakcji:', err);
              return res.status(500).json({ message: 'Błąd podczas zatwierdzania operacji' });
            }

            console.log('Historia wydań i zwrotów została pomyślnie usunięta');
            res.json({ 
              message: 'Historia wydań i zwrotów została pomyślnie usunięta',
              deleted_issues: deletedIssues,
              updated_tools: updatedTools
            });
          });
        });
      });
    });
  });
});

// Endpoint do usuwania historii serwisowania
app.delete('/api/service-history', authenticateToken, requirePermission('DELETE_SERVICE_HISTORY'), (req, res) => {
  console.log('Rozpoczęcie usuwania historii serwisowania...');

  db.run('DELETE FROM tool_service_history', function(err) {
    if (err) {
      console.error('Błąd podczas usuwania historii serwisowania:', err);
      return res.status(500).json({ message: 'Błąd serwera podczas usuwania historii serwisowania' });
    }

    const deletedCount = this.changes || 0;
    console.log(`Usunięto ${deletedCount} rekordów z tabeli tool_service_history`);

    const auditQuery = `
      INSERT INTO audit_logs (user_id, action, details, timestamp)
      VALUES (?, ?, ?, datetime('now'))
    `;

    db.run(
      auditQuery,
      [
        req.user.id,
        'DELETE_SERVICE_HISTORY',
        `Usunięto historię serwisowania (${deletedCount} rekordów)`
      ],
      (auditErr) => {
        if (auditErr) {
          console.error('Błąd podczas dodawania wpisu do dziennika audytu:', auditErr);
        }
        return res.status(200).json({
          message: 'Historia serwisowania została usunięta',
          deleted_count: deletedCount
        });
      }
    );
  });
});

// Uruchomienie serwera
// Endpoints dla zarządzania użytkownikami

// Pobierz wszystkich użytkowników
app.get('/api/users', authenticateToken, (req, res) => {
  db.all('SELECT id, username, role, full_name, created_at, updated_at FROM users ORDER BY created_at DESC', (err, users) => {
    if (err) {
      console.error('Błąd podczas pobierania użytkowników:', err.message);
      res.status(500).json({ error: 'Błąd serwera' });
    } else {
      res.json(users);
    }
  });
});

// Dodaj nowego użytkownika
app.post('/api/users', authenticateToken, (req, res) => {
  const { username, password, role, full_name } = req.body;

  if (!username || !password || !role || !full_name) {
    return res.status(400).json({ error: 'Wszystkie pola są wymagane' });
  }

  // Sprawdź czy użytkownik już istnieje
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, existingUser) => {
    if (err) {
      console.error('Błąd podczas sprawdzania użytkownika:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }

    if (existingUser) {
      return res.status(400).json({ error: 'Użytkownik o tej nazwie już istnieje' });
    }

    // Hashuj hasło
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Dodaj użytkownika
    db.run('INSERT INTO users (username, password, role, full_name, created_at, updated_at) VALUES (?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'))', 
      [username, hashedPassword, role, full_name], 
      function(err) {
        if (err) {
          console.error('Błąd podczas dodawania użytkownika:', err.message);
          res.status(500).json({ error: 'Błąd podczas dodawania użytkownika' });
        } else {
          // Pobierz dodanego użytkownika
          db.get('SELECT id, username, role, full_name, created_at, updated_at FROM users WHERE id = ?', [this.lastID], (err, newUser) => {
            if (err) {
              console.error('Błąd podczas pobierania nowego użytkownika:', err.message);
              res.status(500).json({ error: 'Błąd serwera' });
            } else {
              res.status(201).json(newUser);
            }
          });
        }
      });
  });
});

// Aktualizuj użytkownika
app.put('/api/users/:id', authenticateToken, (req, res) => {
  const userId = req.params.id;
  const { username, password, role, full_name } = req.body;

  if (!username || !role || !full_name) {
    return res.status(400).json({ error: 'Nazwa użytkownika, rola i pełne imię są wymagane' });
  }

  // Sprawdź czy użytkownik istnieje
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      console.error('Błąd podczas sprawdzania użytkownika:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }

    if (!user) {
      return res.status(404).json({ error: 'Użytkownik nie został znaleziony' });
    }

    // Przygotuj zapytanie aktualizacji
    let updateQuery = 'UPDATE users SET role = ?, full_name = ?, updated_at = datetime(\'now\')';
    let params = [role, full_name];

    // Jeśli podano nowe hasło, dodaj je do aktualizacji
    if (password && password.trim() !== '') {
      const hashedPassword = bcrypt.hashSync(password, 10);
      updateQuery += ', password = ?';
      params.push(hashedPassword);
    }

    updateQuery += ' WHERE id = ?';
    params.push(userId);

    // Wykonaj aktualizację
    db.run(updateQuery, params, function(err) {
      if (err) {
        console.error('Błąd podczas aktualizacji użytkownika:', err.message);
        res.status(500).json({ error: 'Błąd podczas aktualizacji użytkownika' });
      } else {
        // Pobierz zaktualizowanego użytkownika
        db.get('SELECT id, username, role, full_name, created_at, updated_at FROM users WHERE id = ?', [userId], (err, updatedUser) => {
          if (err) {
            console.error('Błąd podczas pobierania zaktualizowanego użytkownika:', err.message);
            res.status(500).json({ error: 'Błąd serwera' });
          } else {
            res.json(updatedUser);
          }
        });
      }
    });
  });
});

// Usuń użytkownika
app.delete('/api/users/:id', authenticateToken, (req, res) => {
  const userId = req.params.id;

  // Sprawdź czy użytkownik istnieje
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      console.error('Błąd podczas sprawdzania użytkownika:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }

    if (!user) {
      return res.status(404).json({ error: 'Użytkownik nie został znaleziony' });
    }

    // Usuń użytkownika
    db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
      if (err) {
        console.error('Błąd podczas usuwania użytkownika:', err.message);
        res.status(500).json({ error: 'Błąd podczas usuwania użytkownika' });
      } else {
        res.json({ message: 'Użytkownik został usunięty', deletedId: userId });
      }
    });
  });
});

// API endpoints dla działów
app.get('/api/departments', authenticateToken, (req, res) => {
  db.all('SELECT * FROM departments ORDER BY name', (err, rows) => {
    if (err) {
      console.error('Błąd podczas pobierania działów:', err.message);
      res.status(500).json({ error: 'Błąd serwera' });
    } else {
      res.json(rows);
    }
  });
});

app.post('/api/departments', authenticateToken, (req, res) => {
  const { name, description, manager_id, status } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Nazwa działu jest wymagana' });
  }
  // Walidacja: jeśli podano manager_id, sprawdź czy istnieje pracownik o tym ID
  const insertDepartment = () => {
    db.run(
      'INSERT INTO departments (name, description, manager_id, status) VALUES (?, ?, ?, COALESCE(?, "active"))',
      [name.trim(), description || null, manager_id || null, status || null],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            res.status(400).json({ error: 'Dział o tej nazwie już istnieje' });
          } else {
            console.error('Błąd podczas dodawania działu:', err.message);
            res.status(500).json({ error: 'Błąd serwera' });
          }
        } else {
          db.get('SELECT * FROM departments WHERE id = ?', [this.lastID], (err, row) => {
            if (err) {
              return res.status(500).json({ error: 'Błąd podczas pobierania danych działu' });
            }
            res.status(201).json(row);
          });
        }
      }
    );
  };
  ensureDepartmentColumns(() => {
    if (manager_id) {
      db.get('SELECT id FROM employees WHERE id = ?', [manager_id], (err, emp) => {
        if (err) {
          console.error('Błąd podczas weryfikacji manager_id:', err.message);
          return res.status(500).json({ error: 'Błąd serwera' });
        }
        if (!emp) {
          return res.status(400).json({ error: 'Nieprawidłowy manager_id: pracownik nie istnieje' });
        }
        insertDepartment();
      });
    } else {
      insertDepartment();
    }
  });
});

app.put('/api/departments/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { name, description, manager_id, status } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Nazwa działu jest wymagana' });
  }
  const updateDepartment = () => {
    db.run(
      'UPDATE departments SET name = ?, description = ?, manager_id = ?, status = COALESCE(?, status), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name.trim(), description || null, manager_id || null, status || null, id],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            res.status(400).json({ error: 'Dział o tej nazwie już istnieje' });
          } else {
            console.error('Błąd podczas aktualizacji działu:', err.message);
            res.status(500).json({ error: 'Błąd serwera' });
          }
        } else if (this.changes === 0) {
          res.status(404).json({ error: 'Dział nie został znaleziony' });
        } else {
          db.get('SELECT * FROM departments WHERE id = ?', [id], (err, row) => {
            if (err) {
              return res.status(500).json({ error: 'Błąd podczas pobierania danych działu' });
            }
            res.json(row);
          });
        }
      }
    );
  };
  ensureDepartmentColumns(() => {
    if (manager_id) {
      db.get('SELECT id FROM employees WHERE id = ?', [manager_id], (err, emp) => {
        if (err) {
          console.error('Błąd podczas weryfikacji manager_id:', err.message);
          return res.status(500).json({ error: 'Błąd serwera' });
        }
        if (!emp) {
          return res.status(400).json({ error: 'Nieprawidłowy manager_id: pracownik nie istnieje' });
        }
        updateDepartment();
      });
    } else {
      updateDepartment();
    }
  });
});

app.delete('/api/departments/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  // Najpierw pobierz nazwę działu, aby odczepić pracowników
  db.get('SELECT id, name FROM departments WHERE id = ?', [id], (err, dept) => {
    if (err) {
      console.error('Błąd podczas wyszukiwania działu:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
    if (!dept) {
      return res.status(404).json({ error: 'Dział nie został znaleziony' });
    }

    // Ustaw dział pracowników na '-' dla przypisanych do usuwanego działu
    db.run('UPDATE employees SET department = ? WHERE department = ?', ['-', dept.name], function(updateErr) {
      if (updateErr) {
        console.error('Błąd podczas odczepiania pracowników od działu:', updateErr.message);
        return res.status(500).json({ error: 'Błąd serwera podczas odczepiania pracowników' });
      }

      const detachedCount = this.changes || 0;

      // Następnie usuń dział
      db.run('DELETE FROM departments WHERE id = ?', [id], function(deleteErr) {
        if (deleteErr) {
          console.error('Błąd podczas usuwania działu:', deleteErr.message);
          return res.status(500).json({ error: 'Błąd serwera' });
        }
        res.json({ message: 'Dział został usunięty pomyślnie', detachedEmployees: detachedCount });
      });
    });
  });
});

// Usunięcie działu po nazwie (obsługa elementów "brak w bazie")
app.delete('/api/departments/by-name/:name', authenticateToken, (req, res) => {
  const { name } = req.params;
  const normalized = (name || '').trim();
  if (!normalized) {
    return res.status(400).json({ error: 'Nazwa działu jest wymagana' });
  }

  // Odczep pracowników przypisanych do tego działu (case-insensitive)
  db.run('UPDATE employees SET department = ? WHERE LOWER(department) = LOWER(?)', ['-', normalized], function(updateErr) {
    if (updateErr) {
      console.error('Błąd podczas odczepiania pracowników od działu (by-name):', updateErr.message);
      return res.status(500).json({ error: 'Błąd serwera podczas odczepiania pracowników' });
    }

    const detachedCount = this.changes || 0;

    // Jeśli istnieje rekord działu o tej nazwie, usuń go również
    db.get('SELECT id FROM departments WHERE LOWER(name) = LOWER(?)', [normalized], (findErr, dept) => {
      if (findErr) {
        console.error('Błąd podczas wyszukiwania działu po nazwie:', findErr.message);
        return res.status(500).json({ error: 'Błąd serwera' });
      }
      if (!dept) {
        return res.json({ message: 'Odczepiono pracowników od działu (rekord nie istnieje)', detachedEmployees: detachedCount, deleted: false });
      }
      db.run('DELETE FROM departments WHERE id = ?', [dept.id], function(deleteErr) {
        if (deleteErr) {
          console.error('Błąd podczas usuwania działu po nazwie:', deleteErr.message);
          return res.status(500).json({ error: 'Błąd serwera' });
        }
        res.json({ message: 'Dział został usunięty pomyślnie (by-name)', detachedEmployees: detachedCount, deleted: true });
      });
    });
  });
});

// API endpoints dla pozycji
app.get('/api/positions', authenticateToken, (req, res) => {
  db.all('SELECT * FROM positions ORDER BY name', (err, rows) => {
    if (err) {
      console.error('Błąd podczas pobierania pozycji:', err.message);
      res.status(500).json({ error: 'Błąd serwera' });
    } else {
      res.json(rows);
    }
  });
});

app.post('/api/positions', authenticateToken, (req, res) => {
  const { name, description, department_id, requirements, status } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Nazwa pozycji jest wymagana' });
  }
  const insertPosition = () => {
    db.run(
      'INSERT INTO positions (name, description, department_id, requirements, status) VALUES (?, ?, ?, ?, COALESCE(?, "active"))',
      [name.trim(), description || null, department_id || null, requirements || null, status || null],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            res.status(400).json({ error: 'Pozycja o tej nazwie już istnieje' });
          } else {
            console.error('Błąd podczas dodawania pozycji:', err.message);
            res.status(500).json({ error: 'Błąd serwera' });
          }
        } else {
          db.get('SELECT * FROM positions WHERE id = ?', [this.lastID], (err, row) => {
            if (err) {
              return res.status(500).json({ error: 'Błąd podczas pobierania danych pozycji' });
            }
            res.status(201).json(row);
          });
        }
      }
    );
  };

  if (department_id) {
    db.get('SELECT id FROM departments WHERE id = ?', [department_id], (err, dept) => {
      if (err) {
        console.error('Błąd podczas weryfikacji department_id:', err.message);
        return res.status(500).json({ error: 'Błąd serwera' });
      }
      if (!dept) {
        return res.status(400).json({ error: 'Nieprawidłowy department_id: dział nie istnieje' });
      }
      insertPosition();
    });
  } else {
    insertPosition();
  }
});

app.put('/api/positions/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { name, description, department_id, requirements, status } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Nazwa pozycji jest wymagana' });
  }
  const updatePosition = () => {
    db.run(
      'UPDATE positions SET name = ?, description = ?, department_id = ?, requirements = ?, status = COALESCE(?, status), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name.trim(), description || null, department_id || null, requirements || null, status || null, id],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            res.status(400).json({ error: 'Pozycja o tej nazwie już istnieje' });
          } else {
            console.error('Błąd podczas aktualizacji pozycji:', err.message);
            res.status(500).json({ error: 'Błąd serwera' });
          }
        } else if (this.changes === 0) {
          res.status(404).json({ error: 'Pozycja nie została znaleziona' });
        } else {
          db.get('SELECT * FROM positions WHERE id = ?', [id], (err, row) => {
            if (err) {
              return res.status(500).json({ error: 'Błąd podczas pobierania danych pozycji' });
            }
            res.json(row);
          });
        }
      }
    );
  };

  if (department_id) {
    db.get('SELECT id FROM departments WHERE id = ?', [department_id], (err, dept) => {
      if (err) {
        console.error('Błąd podczas weryfikacji department_id:', err.message);
        return res.status(500).json({ error: 'Błąd serwera' });
      }
      if (!dept) {
        return res.status(400).json({ error: 'Nieprawidłowy department_id: dział nie istnieje' });
      }
      updatePosition();
    });
  } else {
    updatePosition();
  }
});

app.delete('/api/positions/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  // Najpierw pobierz nazwę stanowiska, aby odczepić pracowników
  db.get('SELECT id, name FROM positions WHERE id = ?', [id], (err, pos) => {
    if (err) {
      console.error('Błąd podczas wyszukiwania stanowiska:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
    if (!pos) {
      return res.status(404).json({ error: 'Pozycja nie została znaleziona' });
    }

    // Ustaw stanowisko pracowników na '-' dla przypisanych do usuwanego stanowiska
    db.run('UPDATE employees SET position = ? WHERE position = ?', ['-', pos.name], function(updateErr) {
      if (updateErr) {
        console.error('Błąd podczas odczepiania pracowników od stanowiska:', updateErr.message);
        return res.status(500).json({ error: 'Błąd serwera podczas odczepiania pracowników' });
      }

      const detachedCount = this.changes || 0;

      // Następnie usuń stanowisko
      db.run('DELETE FROM positions WHERE id = ?', [id], function(deleteErr) {
        if (deleteErr) {
          console.error('Błąd podczas usuwania pozycji:', deleteErr.message);
          return res.status(500).json({ error: 'Błąd serwera' });
        }
        res.json({ message: 'Pozycja została usunięta pomyślnie', detachedEmployees: detachedCount });
      });
    });
  });
});

// Usunięcie stanowiska po nazwie (obsługa elementów "brak w bazie")
app.delete('/api/positions/by-name/:name', authenticateToken, (req, res) => {
  const { name } = req.params;
  const normalized = (name || '').trim();
  if (!normalized) {
    return res.status(400).json({ error: 'Nazwa stanowiska jest wymagana' });
  }

  // Odczep pracowników przypisanych do tego stanowiska (case-insensitive)
  db.run('UPDATE employees SET position = ? WHERE LOWER(position) = LOWER(?)', ['-', normalized], function(updateErr) {
    if (updateErr) {
      console.error('Błąd podczas odczepiania pracowników od stanowiska (by-name):', updateErr.message);
      return res.status(500).json({ error: 'Błąd serwera podczas odczepiania pracowników' });
    }

    const detachedCount = this.changes || 0;

    // Jeśli istnieje rekord pozycji o tej nazwie, usuń go również
    db.get('SELECT id FROM positions WHERE LOWER(name) = LOWER(?)', [normalized], (findErr, pos) => {
      if (findErr) {
        console.error('Błąd podczas wyszukiwania stanowiska po nazwie:', findErr.message);
        return res.status(500).json({ error: 'Błąd serwera' });
      }
      if (!pos) {
        return res.json({ message: 'Odczepiono pracowników od stanowiska (rekord nie istnieje)', detachedEmployees: detachedCount, deleted: false });
      }
      db.run('DELETE FROM positions WHERE id = ?', [pos.id], function(deleteErr) {
        if (deleteErr) {
          console.error('Błąd podczas usuwania stanowiska po nazwie:', deleteErr.message);
          return res.status(500).json({ error: 'Błąd serwera' });
        }
        res.json({ message: 'Stanowisko zostało usunięte pomyślnie (by-name)', detachedEmployees: detachedCount, deleted: true });
      });
    });
  });
});

// ===== ENDPOINT STATYSTYK DASHBOARDU =====

// Endpoint pobierania statystyk dla dashboardu
app.get('/api/dashboard/stats', authenticateToken, (req, res) => {
  const queries = {
    totalEmployees: 'SELECT COUNT(*) as count FROM employees',
    activeDepartments: 'SELECT COUNT(DISTINCT name) as count FROM departments',
    totalPositions: 'SELECT COUNT(DISTINCT name) as count FROM positions',
    totalTools: 'SELECT COUNT(*) as count FROM tools'
  };

  const stats = {};
  let completedQueries = 0;
  const totalQueries = Object.keys(queries).length;

  // Wykonaj wszystkie zapytania równolegle
  Object.entries(queries).forEach(([key, query]) => {
    db.get(query, [], (err, result) => {
      if (err) {
        console.error(`Błąd podczas pobierania ${key}:`, err.message);
        stats[key] = 0; // Fallback do 0 w przypadku błędu
      } else {
        stats[key] = result.count;
      }
      
      completedQueries++;
      
      // Gdy wszystkie zapytania są zakończone, wyślij odpowiedź
      if (completedQueries === totalQueries) {
        res.json(stats);
      }
    });
  });
});

// ===== ENDPOINTY SYSTEMU AUDYTU =====

// Endpoint pobierania logów audytu
app.get('/api/audit', authenticateToken, (req, res) => {
  const { page = 1, limit = 50, action, username, startDate, endDate } = req.query;
  const offset = (page - 1) * limit;

  let query = `
    SELECT 
      al.*,
      u.full_name as user_full_name
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    WHERE 1=1
  `;
  
  const params = [];

  // Filtrowanie po akcji
  if (action && action !== 'all') {
    query += ` AND al.action = ?`;
    params.push(action);
  }

  // Filtrowanie po nazwie użytkownika
  if (username) {
    query += ` AND (al.username LIKE ? OR u.full_name LIKE ?)`;
    params.push(`%${username}%`, `%${username}%`);
  }

  // Filtrowanie po dacie rozpoczęcia
  if (startDate) {
    query += ` AND DATE(al.timestamp) >= DATE(?)`;
    params.push(startDate);
  }

  // Filtrowanie po dacie zakończenia
  if (endDate) {
    query += ` AND DATE(al.timestamp) <= DATE(?)`;
    params.push(endDate);
  }

  query += ` ORDER BY al.timestamp DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));

  db.all(query, params, (err, logs) => {
    if (err) {
      console.error('Błąd podczas pobierania logów audytu:', err.message);
      return res.status(500).json({ message: 'Błąd serwera', error: err.message });
    }

    // Pobierz całkowitą liczbę rekordów dla paginacji
    let countQuery = `
      SELECT COUNT(*) as total
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    
    const countParams = [];
    
    if (action && action !== 'all') {
      countQuery += ` AND al.action = ?`;
      countParams.push(action);
    }

    if (username) {
      countQuery += ` AND (al.username LIKE ? OR u.full_name LIKE ?)`;
      countParams.push(`%${username}%`, `%${username}%`);
    }

    if (startDate) {
      countQuery += ` AND DATE(al.timestamp) >= DATE(?)`;
      countParams.push(startDate);
    }

    if (endDate) {
      countQuery += ` AND DATE(al.timestamp) <= DATE(?)`;
      countParams.push(endDate);
    }

    db.get(countQuery, countParams, (err, countResult) => {
      if (err) {
        console.error('Błąd podczas liczenia logów audytu:', err.message);
        return res.status(500).json({ message: 'Błąd serwera', error: err.message });
      }

      res.json({
        logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / limit)
        }
      });
    });
  });
});

// Endpoint dodawania wpisu do audytu
app.post('/api/audit', authenticateToken, (req, res) => {
  const { action, details } = req.body;
  const user_id = req.user.id;
  const username = req.user.username;
  const ip_address = req.ip || req.connection.remoteAddress;
  const user_agent = req.get('User-Agent');

  if (!action) {
    return res.status(400).json({ message: 'Akcja jest wymagana' });
  }

  const query = `
    INSERT INTO audit_logs (user_id, username, action, details, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.run(query, [user_id, username, action, details || null, ip_address, user_agent], function(err) {
    if (err) {
      console.error('Błąd podczas dodawania wpisu audytu:', err.message);
      return res.status(500).json({ message: 'Błąd serwera', error: err.message });
    }

    res.status(201).json({ 
      message: 'Wpis audytu został dodany',
      id: this.lastID 
    });
  });
});

// Endpoint pobierania statystyk audytu
app.get('/api/audit/stats', authenticateToken, (req, res) => {
  const { days = 30 } = req.query;

  const queries = {
    // Statystyki ogólne
    totalLogs: `SELECT COUNT(*) as count FROM audit_logs WHERE DATE(timestamp) >= DATE('now', '-${days} days')`,
    
    // Statystyki po akcjach
    actionStats: `
      SELECT action, COUNT(*) as count 
      FROM audit_logs 
      WHERE DATE(timestamp) >= DATE('now', '-${days} days')
      GROUP BY action 
      ORDER BY count DESC
    `,
    
    // Statystyki po użytkownikach
    userStats: `
      SELECT 
        al.username,
        u.full_name,
        COUNT(*) as count 
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE DATE(al.timestamp) >= DATE('now', '-${days} days')
      GROUP BY al.user_id, al.username, u.full_name
      ORDER BY count DESC
      LIMIT 10
    `,
    
    // Aktywność dzienna
    dailyActivity: `
      SELECT 
        DATE(timestamp) as date,
        COUNT(*) as count
      FROM audit_logs 
      WHERE DATE(timestamp) >= DATE('now', '-${days} days')
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
    `
  };

  const results = {};
  let completed = 0;
  const totalQueries = Object.keys(queries).length;

  Object.entries(queries).forEach(([key, query]) => {
    db.all(query, (err, rows) => {
      if (err) {
        console.error(`Błąd podczas pobierania statystyk ${key}:`, err.message);
        results[key] = [];
      } else {
        results[key] = key === 'totalLogs' ? rows[0] : rows;
      }

      completed++;
      if (completed === totalQueries) {
        res.json(results);
      }
    });
  });
});

// ===== ENDPOINTY KONFIGURACJI APLIKACJI =====
// Upload logo (PNG) do katalogu public/logos z wersjonowaniem
let multer;
try {
  multer = require('multer');
} catch (_) {
  // multer jest opcjonalny w zależnościach backendu; w root jest dostępny
}

// Konfiguracja uploadu tylko jeśli multer jest dostępny
const LOGO_DIR = path.join(__dirname, 'public', 'logos');
const CURRENT_LOGO_PATH = path.join(__dirname, 'public', 'logo.png');

function ensureLogoDir() {
  try {
    if (!fs.existsSync(LOGO_DIR)) {
      fs.mkdirSync(LOGO_DIR, { recursive: true });
      console.log('Utworzono katalog wersji logo:', LOGO_DIR);
    }
  } catch (err) {
    console.error('Nie udało się utworzyć katalogu logo:', err.message);
  }
}

function getPngSize(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    if (buf.length < 24) return null;
    const sig = buf.slice(0, 8);
    const pngSig = Buffer.from([137,80,78,71,13,10,26,10]);
    if (!sig.equals(pngSig)) return null;
    const chunkType = buf.slice(12, 16).toString('ascii');
    if (chunkType !== 'IHDR') return null;
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    return { width, height };
  } catch (err) {
    return null;
  }
}

const MIN_LOGO_WIDTH = 64;
const MIN_LOGO_HEIGHT = 64;
const MAX_LOGO_WIDTH = 1024;
const MAX_LOGO_HEIGHT = 1024;
let upload;
if (multer) {
  ensureLogoDir();
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, LOGO_DIR);
    },
    filename: (req, file, cb) => {
      const ts = Date.now();
      cb(null, `logo-${ts}.png`);
    }
  });

  const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('ONLY_PNG'));
    }
  };

  upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 2 * 1024 * 1024 } // 2MB
  });
}

// Pobieranie ustawień ogólnych (publiczne)
app.get('/api/config/general', (req, res) => {
  db.get('SELECT app_name, company_name, timezone, language, date_format, backup_frequency, last_backup_at FROM app_config WHERE id = 1', [], (err, row) => {
    if (err) {
      console.error('Błąd podczas pobierania ustawień ogólnych:', err.message);
      return res.status(500).json({ message: 'Błąd serwera', error: err.message });
    }
    if (!row) {
      return res.status(404).json({ message: 'Ustawienia nie zostały znalezione' });
    }
    res.json({
      appName: row.app_name,
      companyName: row.company_name,
      timezone: row.timezone,
      language: row.language,
      dateFormat: row.date_format,
      backupFrequency: row.backup_frequency || 'daily',
      lastBackupAt: row.last_backup_at || null
    });
  });
});

// Upload logo aplikacji (tylko administrator)
app.post('/api/config/logo', authenticateToken, (req, res) => {
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Brak uprawnień do aktualizacji logo' });
  }

  if (!upload) {
    return res.status(500).json({ message: 'Upload nie jest dostępny (brak konfiguracji multer)' });
  }

  upload.single('logo')(req, res, (err) => {
    if (err) {
      if (err.message === 'ONLY_PNG') {
        return res.status(400).json({ message: 'Dozwolone są tylko pliki PNG' });
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Plik jest za duży (maks. 2MB)' });
      }
      return res.status(500).json({ message: 'Błąd uploadu', error: err.message });
    }

    // Jeżeli nie ma pliku
    if (!req.file) {
      return res.status(400).json({ message: 'Nie przesłano pliku logo' });
    }

    // Walidacja wymiarów PNG na backendzie
    const size = getPngSize(req.file.path);
    if (!size) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
      return res.status(400).json({ message: 'Nieprawidłowy plik PNG' });
    }
    const { width, height } = size;
    if (
      width < MIN_LOGO_WIDTH || height < MIN_LOGO_HEIGHT ||
      width > MAX_LOGO_WIDTH || height > MAX_LOGO_HEIGHT
    ) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
      return res.status(400).json({
        message: `Wymiary logo poza zakresem: min ${MIN_LOGO_WIDTH}x${MIN_LOGO_HEIGHT}, max ${MAX_LOGO_WIDTH}x${MAX_LOGO_HEIGHT}. Otrzymano ${width}x${height}`
      });
    }

    // Ustaw aktualne logo
    try {
      fs.copyFileSync(req.file.path, CURRENT_LOGO_PATH);
    } catch (copyErr) {
      return res.status(500).json({ message: 'Nie udało się zapisać aktualnego logo', error: copyErr.message });
    }

    const timestamp = Date.now();
    return res.json({
      message: 'Logo zostało zaktualizowane',
      url: '/logo.png',
      timestamp,
      version: path.basename(req.file.path),
      size: { width, height }
    });
  });
});

// Lista historii wersji logo (tylko administrator)
app.get('/api/config/logo/history', authenticateToken, (req, res) => {
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Brak uprawnień' });
  }
  try {
    ensureLogoDir();
    const files = fs.readdirSync(LOGO_DIR)
      .filter(name => name.startsWith('logo-') && name.endsWith('.png'))
      .map(name => {
        const full = path.join(LOGO_DIR, name);
        const stat = fs.statSync(full);
        return {
          filename: name,
          url: `/logos/${name}`,
          uploadedAt: stat.mtimeMs
        };
      })
      .sort((a, b) => b.uploadedAt - a.uploadedAt);
    res.json({ currentUrl: '/logo.png', versions: files });
  } catch (err) {
    res.status(500).json({ message: 'Błąd pobierania historii logo', error: err.message });
  }
});

// Przywrócenie wybranej wersji logo (tylko administrator)
app.post('/api/config/logo/rollback', authenticateToken, (req, res) => {
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Brak uprawnień' });
  }
  const { filename } = req.body || {};
  if (!filename || typeof filename !== 'string') {
    return res.status(400).json({ message: 'Brak poprawnej nazwy pliku wersji' });
  }
  const target = path.join(LOGO_DIR, filename);
  try {
    if (!fs.existsSync(target)) {
      return res.status(404).json({ message: 'Wybrana wersja nie istnieje' });
    }
    const size = getPngSize(target);
    if (!size) {
      return res.status(400).json({ message: 'Wybrana wersja ma nieprawidłowy plik PNG' });
    }
    const { width, height } = size;
    if (
      width < MIN_LOGO_WIDTH || height < MIN_LOGO_HEIGHT ||
      width > MAX_LOGO_WIDTH || height > MAX_LOGO_HEIGHT
    ) {
      return res.status(400).json({
        message: `Wymiary wersji poza zakresem: min ${MIN_LOGO_WIDTH}x${MIN_LOGO_HEIGHT}, max ${MAX_LOGO_WIDTH}x${MAX_LOGO_HEIGHT}. Otrzymano ${width}x${height}`
      });
    }
    fs.copyFileSync(target, CURRENT_LOGO_PATH);
    const timestamp = Date.now();
    res.json({ message: 'Przywrócono wybraną wersję logo', url: '/logo.png', timestamp, size });
  } catch (err) {
    res.status(500).json({ message: 'Błąd przywracania wersji', error: err.message });
  }
});

// Aktualizacja ustawień ogólnych (tylko administrator)
app.put('/api/config/general', authenticateToken, (req, res) => {
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Brak uprawnień do aktualizacji ustawień' });
  }

  const { appName, companyName, timezone, language, dateFormat, backupFrequency } = req.body || {};

  if (!appName || !timezone || !language || !dateFormat) {
    return res.status(400).json({ message: 'Brak wymaganych pól: appName, timezone, language, dateFormat' });
  }

  const query = `
    UPDATE app_config 
    SET app_name = ?, company_name = ?, timezone = ?, language = ?, date_format = ?, backup_frequency = COALESCE(?, backup_frequency), updated_at = datetime('now')
    WHERE id = 1
  `;
 
  db.run(query, [appName, companyName || null, timezone, language, dateFormat, backupFrequency || null], function(err) {
    if (err) {
      console.error('Błąd podczas aktualizacji ustawień ogólnych:', err.message);
      return res.status(500).json({ message: 'Błąd serwera', error: err.message });
    }

    // Zwróć zaktualizowane ustawienia
    db.get('SELECT app_name, company_name, timezone, language, date_format, backup_frequency, last_backup_at FROM app_config WHERE id = 1', [], (err, row) => {
      if (err) {
        return res.status(500).json({ message: 'Błąd serwera', error: err.message });
      }
      res.json({
        appName: row.app_name,
        companyName: row.company_name,
        timezone: row.timezone,
        language: row.language,
        dateFormat: row.date_format,
        backupFrequency: row.backup_frequency || 'daily',
        lastBackupAt: row.last_backup_at || null
      });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});

// Obsługa zamknięcia aplikacji

// ===== BACKUPY BAZY DANYCH =====
const BACKUP_DIR = path.join(__dirname, 'backups');

function ensureBackupDir() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      console.log('Utworzono katalog kopii zapasowych:', BACKUP_DIR);
    }
  } catch (err) {
    console.error('Nie udało się utworzyć katalogu kopii zapasowych:', err.message);
  }
}

function formatTimestamp(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function performBackup(callback) {
  ensureBackupDir();
  const src = path.join(__dirname, 'database.db');
  const stamp = formatTimestamp(new Date());
  const dest = path.join(BACKUP_DIR, `database-${stamp}.db`);
  try {
    fs.copyFileSync(src, dest);
    console.log('Wykonano kopię bazy danych:', dest);
    // Zaktualizuj last_backup_at
    db.run('UPDATE app_config SET last_backup_at = datetime("now"), updated_at = datetime("now") WHERE id = 1');
    if (callback) callback(null, dest);
  } catch (err) {
    console.error('Błąd podczas wykonywania kopii zapasowej:', err.message);
    if (callback) callback(err);
  }
}

function shouldRunBackup(frequency, lastBackupAt) {
  const now = new Date();
  let thresholdMs;
  switch ((frequency || 'daily')) {
    case 'weekly':
      thresholdMs = 7 * 24 * 60 * 60 * 1000; // 7 dni
      break;
    case 'monthly':
      thresholdMs = 30 * 24 * 60 * 60 * 1000; // ~30 dni
      break;
    case 'daily':
    default:
      thresholdMs = 24 * 60 * 60 * 1000; // 1 dzień
  }
  if (!lastBackupAt) return true;
  const last = new Date(lastBackupAt);
  return (now - last) >= thresholdMs;
}

function checkAndRunBackup() {
  db.get('SELECT backup_frequency, last_backup_at FROM app_config WHERE id = 1', [], (err, row) => {
    if (err) {
      console.error('Błąd odczytu konfiguracji kopii zapasowych:', err.message);
      return;
    }
    const freq = row?.backup_frequency || 'daily';
    const last = row?.last_backup_at || null;
    if (shouldRunBackup(freq, last)) {
      performBackup();
    }
  });
}

function initBackupScheduler() {
  ensureBackupDir();
  // Uruchom co godzinę sprawdzanie czy należy wykonać kopię
  setInterval(checkAndRunBackup, 60 * 60 * 1000);
  console.log('Uruchomiono harmonogram kopii zapasowych (sprawdzanie co godzinę).');
}

// Ręczne wywołanie kopii (tylko administrator)
app.post('/api/backup/run', authenticateToken, (req, res) => {
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Brak uprawnień do uruchomienia kopii zapasowej' });
  }
  performBackup((err, dest) => {
    if (err) return res.status(500).json({ message: 'Błąd serwera', error: err.message });
    return res.json({ message: 'Kopia zapasowa wykonana', file: path.basename(dest) });
  });
});

// Lista kopii (tylko administrator)
app.get('/api/backup/list', authenticateToken, (req, res) => {
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Brak uprawnień do przeglądania kopii zapasowych' });
  }
  ensureBackupDir();
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('database-') && f.endsWith('.db'))
      .map(f => ({ file: f }));
    res.json({ backups: files });
  } catch (err) {
    res.status(500).json({ message: 'Błąd serwera', error: err.message });
  }
});
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Błąd podczas zamykania bazy danych:', err.message);
    } else {
      console.log('Połączenie z bazą danych zostało zamknięte');
    }
    process.exit(0);
  });
});

// Endpoint wydawania narzędzia pracownikowi (z obsługą ilości)
app.post('/api/tools/:id/issue', authenticateToken, (req, res) => {
  const toolId = req.params.id;
  const { employee_id, quantity = 1 } = req.body;
  const userId = req.user.id;

  if (!employee_id) {
    return res.status(400).json({ message: 'ID pracownika jest wymagane' });
  }

  if (quantity < 1) {
    return res.status(400).json({ message: 'Ilość musi być większa od 0' });
  }

  // Sprawdź czy narzędzie istnieje i ma wystarczającą ilość dostępną
  db.get('SELECT * FROM tools WHERE id = ?', [toolId], (err, tool) => {
    if (err) {
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    if (!tool) {
      return res.status(404).json({ message: 'Narzędzie nie zostało znalezione' });
    }

    // Sprawdź aktualnie wydaną ilość
    db.get('SELECT COALESCE(SUM(quantity), 0) as issued_quantity FROM tool_issues WHERE tool_id = ? AND status = "wydane"', [toolId], (err, result) => {
      if (err) {
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      const availableQuantity = tool.quantity - result.issued_quantity;
      
      if (availableQuantity < quantity) {
        return res.status(400).json({ 
          message: `Niewystarczająca ilość dostępna. Dostępne: ${availableQuantity}, żądane: ${quantity}` 
        });
      }

      // Sprawdź czy pracownik istnieje
      db.get('SELECT * FROM employees WHERE id = ?', [employee_id], (err, employee) => {
        if (err) {
          return res.status(500).json({ message: 'Błąd serwera' });
        }
        if (!employee) {
          return res.status(404).json({ message: 'Pracownik nie został znaleziony' });
        }

        // Dodaj wpis do tabeli wydań
        db.run(
          'INSERT INTO tool_issues (tool_id, employee_id, issued_by_user_id, quantity) VALUES (?, ?, ?, ?)',
          [toolId, employee_id, userId, quantity],
          function(err) {
            if (err) {
              return res.status(500).json({ message: 'Błąd serwera' });
            }

            // Zaktualizuj status narzędzia jeśli wszystkie sztuki zostały wydane
            const newIssuedQuantity = result.issued_quantity + quantity;
            const newStatus = newIssuedQuantity >= tool.quantity ? 'wydane' : 'częściowo wydane';
            
            db.run(
              'UPDATE tools SET status = ? WHERE id = ?',
              [newStatus, toolId],
              function(err) {
                if (err) {
                  return res.status(500).json({ message: 'Błąd serwera' });
                }
                
                res.status(200).json({ 
                  message: `Wydano ${quantity} sztuk narzędzia`,
                  issue_id: this.lastID,
                  available_quantity: availableQuantity - quantity
                });
              }
            );
          }
        );
      });
    });
  });
});

// Endpoint zwracania narzędzia (z obsługą ilości)
app.post('/api/tools/:id/return', authenticateToken, (req, res) => {
  const toolId = req.params.id;
  const { issue_id, quantity } = req.body;

  if (!issue_id) {
    return res.status(400).json({ message: 'ID wydania jest wymagane' });
  }

  // Sprawdź czy wydanie istnieje i jest aktywne
  db.get('SELECT * FROM tool_issues WHERE id = ? AND tool_id = ? AND status = "wydane"', [issue_id, toolId], (err, issue) => {
    if (err) {
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    if (!issue) {
      return res.status(404).json({ message: 'Wydanie nie zostało znalezione lub już zostało zwrócone' });
    }

    const returnQuantity = quantity || issue.quantity;

    if (returnQuantity > issue.quantity) {
      return res.status(400).json({ message: 'Nie można zwrócić więcej niż zostało wydane' });
    }

    if (returnQuantity === issue.quantity) {
      // Zwróć całe wydanie
      db.run(
        'UPDATE tool_issues SET status = "zwrócone", returned_at = datetime("now") WHERE id = ?',
        [issue_id],
        function(err) {
          if (err) {
            return res.status(500).json({ message: 'Błąd serwera' });
          }
          
          // Sprawdź czy wszystkie wydania zostały zwrócone i zaktualizuj status narzędzia
          updateToolStatus(toolId, res, returnQuantity);
        }
      );
    } else {
      // Częściowy zwrot - zmniejsz ilość w wydaniu i utwórz nowy wpis zwrotu
      db.run(
        'UPDATE tool_issues SET quantity = ? WHERE id = ?',
        [issue.quantity - returnQuantity, issue_id],
        function(err) {
          if (err) {
            return res.status(500).json({ message: 'Błąd serwera' });
          }

          // Utwórz wpis zwrotu
          db.run(
            'INSERT INTO tool_issues (tool_id, employee_id, issued_by_user_id, quantity, status, returned_at) VALUES (?, ?, ?, ?, "zwrócone", datetime("now"))',
            [toolId, issue.employee_id, issue.issued_by_user_id, returnQuantity],
            function(err) {
              if (err) {
                return res.status(500).json({ message: 'Błąd serwera' });
              }
              
              updateToolStatus(toolId, res, returnQuantity);
            }
          );
        }
      );
    }
  });

  function updateToolStatus(toolId, res, returnedQuantity) {
    // Sprawdź aktualny status wydań dla narzędzia
    db.get('SELECT COALESCE(SUM(quantity), 0) as issued_quantity FROM tool_issues WHERE tool_id = ? AND status = "wydane"', [toolId], (err, result) => {
      if (err) {
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      db.get('SELECT quantity FROM tools WHERE id = ?', [toolId], (err, tool) => {
        if (err) {
          return res.status(500).json({ message: 'Błąd serwera' });
        }

        let newStatus;
        if (result.issued_quantity === 0) {
          newStatus = 'dostępne';
        } else if (result.issued_quantity < tool.quantity) {
          newStatus = 'częściowo wydane';
        } else {
          newStatus = 'wydane';
        }

        db.run(
          'UPDATE tools SET status = ? WHERE id = ?',
          [newStatus, toolId],
          function(err) {
            if (err) {
              return res.status(500).json({ message: 'Błąd serwera' });
            }
            
            res.status(200).json({ 
              message: `Zwrócono ${returnedQuantity} sztuk narzędzia`,
              new_status: newStatus,
              available_quantity: tool.quantity - result.issued_quantity
            });
          }
        );
      });
    });
  }
});

// Endpoint pobierania szczegółów narzędzia z informacjami o wydaniach
app.get('/api/tools/:id/details', authenticateToken, (req, res) => {
  const toolId = req.params.id;

  console.log(`Pobieranie szczegółów narzędzia ID: ${toolId}`);

  const query = `
    SELECT 
      t.*,
      COALESCE(SUM(CASE WHEN ti.status = 'wydane' THEN ti.quantity ELSE 0 END), 0) as issued_quantity
    FROM tools t
    LEFT JOIN tool_issues ti ON t.id = ti.tool_id
    WHERE t.id = ?
    GROUP BY t.id
  `;

  db.get(query, [toolId], (err, tool) => {
    if (err) {
      console.error(`Błąd bazy danych przy pobieraniu narzędzia ID ${toolId}:`, err);
      return res.status(500).json({ message: 'Błąd serwera', error: err.message });
    }
    if (!tool) {
      console.log(`Narzędzie o ID ${toolId} nie zostało znalezione`);
      return res.status(404).json({ message: 'Narzędzie nie zostało znalezione' });
    }

    // Pobierz szczegóły wydań
    const issuesQuery = `
      SELECT 
        ti.*,
        e.first_name as employee_first_name,
        e.last_name as employee_last_name,
        u.full_name as issued_by_user_name
      FROM tool_issues ti
      LEFT JOIN employees e ON ti.employee_id = e.id
      LEFT JOIN users u ON ti.issued_by_user_id = u.id
      WHERE ti.tool_id = ? AND ti.status = 'wydane'
      ORDER BY ti.issued_at DESC
    `;

    db.all(issuesQuery, [toolId], (err, issues) => {
      if (err) {
        console.error(`Błąd przy pobieraniu wydań narzędzia ID ${toolId}:`, err);
        return res.status(500).json({ message: 'Błąd serwera', error: err.message });
      }

      const result = {
        ...tool,
        available_quantity: tool.quantity - tool.issued_quantity,
        issues: issues
      };

      console.log(`Znaleziono narzędzie:`, tool.name);
      res.json(result);
    });
  });
});

// Endpointy do zarządzania uprawnieniami ról

// Pobieranie uprawnień dla wszystkich ról
app.get('/api/role-permissions', authenticateToken, (req, res) => {
  // Sprawdź czy użytkownik ma uprawnienia administratora
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Brak uprawnień do zarządzania rolami' });
  }

  const query = `
    SELECT role, permission 
    FROM role_permissions 
    ORDER BY role, permission
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Błąd podczas pobierania uprawnień ról:', err.message);
      return res.status(500).json({ message: 'Błąd serwera', error: err.message });
    }

    // Grupuj uprawnienia według ról
    const rolePermissions = {};
    rows.forEach(row => {
      if (!rolePermissions[row.role]) {
        rolePermissions[row.role] = [];
      }
      rolePermissions[row.role].push(row.permission);
    });

    res.json(rolePermissions);
  });
});

// Aktualizacja uprawnień dla konkretnej roli
app.put('/api/role-permissions/:role', authenticateToken, (req, res) => {
  // Sprawdź czy użytkownik ma uprawnienia administratora
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Brak uprawnień do zarządzania rolami' });
  }

  const role = req.params.role;
  const { permissions } = req.body;

  if (!permissions || !Array.isArray(permissions)) {
    return res.status(400).json({ message: 'Nieprawidłowe dane - wymagana jest tablica uprawnień' });
  }

  // Rozpocznij transakcję
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // Usuń wszystkie istniejące uprawnienia dla tej roli
    db.run('DELETE FROM role_permissions WHERE role = ?', [role], (err) => {
      if (err) {
        console.error(`Błąd podczas usuwania uprawnień dla roli ${role}:`, err.message);
        db.run('ROLLBACK');
        return res.status(500).json({ message: 'Błąd serwera', error: err.message });
      }

      // Dodaj nowe uprawnienia
      const stmt = db.prepare('INSERT INTO role_permissions (role, permission) VALUES (?, ?)');
      let errorOccurred = false;

      permissions.forEach(permission => {
        stmt.run([role, permission], (err) => {
          if (err && !errorOccurred) {
            console.error(`Błąd podczas dodawania uprawnienia ${permission} dla roli ${role}:`, err.message);
            errorOccurred = true;
            db.run('ROLLBACK');
            return res.status(500).json({ message: 'Błąd serwera', error: err.message });
          }
        });
      });

      stmt.finalize((err) => {
        if (err || errorOccurred) {
          if (!errorOccurred) {
            console.error('Błąd podczas finalizacji statement:', err.message);
            db.run('ROLLBACK');
            return res.status(500).json({ message: 'Błąd serwera', error: err.message });
          }
        } else {
          db.run('COMMIT', (err) => {
            if (err) {
              console.error('Błąd podczas zatwierdzania transakcji:', err.message);
              return res.status(500).json({ message: 'Błąd serwera', error: err.message });
            }

            // Dodaj wpis do audit log
            const auditData = {
              user_id: req.user.id,
              action: 'UPDATE_ROLE_PERMISSIONS',
              target_type: 'role',
              target_id: role,
              details: JSON.stringify({ 
                role: role, 
                permissions: permissions,
                updated_by: req.user.username 
              })
            };

            db.run(`INSERT INTO audit_logs (user_id, action, target_type, target_id, details, timestamp) 
                    VALUES (?, ?, ?, ?, ?, datetime('now'))`,
              [auditData.user_id, auditData.action, auditData.target_type, auditData.target_id, auditData.details],
              (err) => {
                if (err) {
                  console.error('Błąd podczas zapisywania do audit log:', err.message);
                }
              }
            );

            console.log(`Uprawnienia dla roli ${role} zostały zaktualizowane`);
            res.json({ 
              message: 'Uprawnienia zostały zaktualizowane pomyślnie',
              role: role,
              permissions: permissions
            });
          });
        }
      });
    });
  });
});

// Pobieranie dostępnych uprawnień
app.get('/api/permissions', authenticateToken, (req, res) => {
  // Sprawdź czy użytkownik ma uprawnienia administratora
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Brak uprawnień do zarządzania rolami' });
  }

  const availablePermissions = [
    'VIEW_USERS',
    'CREATE_USERS', 
    'EDIT_USERS',
    'DELETE_USERS',
    'VIEW_ANALYTICS',
    'ACCESS_TOOLS',
    'MANAGE_DEPARTMENTS',
    'MANAGE_POSITIONS',
    'SYSTEM_SETTINGS',
    'VIEW_ADMIN',
    'MANAGE_USERS',
    'VIEW_AUDIT_LOG',
    'VIEW_BHP',
    'MANAGE_BHP',
    'DELETE_ISSUE_HISTORY',
    'DELETE_SERVICE_HISTORY',
    'MANAGE_EMPLOYEES'
  ];

  res.json(availablePermissions);
});

// Middleware: wymagane uprawnienie z role_permissions (administrator ma pełny dostęp)
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Nieautoryzowany' });
    }
    if (req.user.role === 'administrator') {
      return next();
    }
    db.get('SELECT 1 as ok FROM role_permissions WHERE role = ? AND permission = ?',
      [req.user.role, permission],
      (err, row) => {
        if (err) {
          console.error('Błąd podczas sprawdzania uprawnień:', err.message);
          return res.status(500).json({ message: 'Błąd serwera' });
        }
        if (row && row.ok) {
          return next();
        }
        return res.status(403).json({ message: 'Brak uprawnień' });
      }
    );
  };
}
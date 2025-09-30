const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

// Inicjalizacja aplikacji Express
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'system-ewidencji-narzedzi-secret-key';

// Middleware
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3000'],
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
      return res.status(403).json({ message: 'Nieprawidłowy token' });
    }
    req.user = user;
    next();
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
  const { name, sku, quantity, location, category, description, barcode, qr_code, serial_number } = req.body;

  if (!name || !sku) {
    return res.status(400).json({ message: 'Wymagane są nazwa i SKU' });
  }

  db.run(
    'INSERT INTO tools (name, sku, quantity, location, category, description, barcode, qr_code, serial_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [name, sku, quantity || 1, location, category, description, barcode || sku, qr_code || sku, serial_number],
    function(err) {
      if (err) {
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
  const { name, sku, quantity, location, category, description, barcode, qr_code, serial_number } = req.body;
  const id = req.params.id;

  if (!name || !sku) {
    return res.status(400).json({ message: 'Wymagane są nazwa i SKU' });
  }

  db.run(
    'UPDATE tools SET name = ?, sku = ?, quantity = ?, location = ?, category = ?, description = ?, barcode = ?, qr_code = ?, serial_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name, sku, quantity || 1, location, category, description, barcode || sku, qr_code || sku, serial_number, id],
    function(err) {
      if (err) {
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
app.post('/api/employees', authenticateToken, (req, res) => {
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
app.put('/api/employees/:id', authenticateToken, (req, res) => {
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
app.delete('/api/employees/:id', authenticateToken, (req, res) => {
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
  const { name } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Nazwa działu jest wymagana' });
  }

  db.run('INSERT INTO departments (name) VALUES (?)', [name.trim()], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        res.status(400).json({ error: 'Dział o tej nazwie już istnieje' });
      } else {
        console.error('Błąd podczas dodawania działu:', err.message);
        res.status(500).json({ error: 'Błąd serwera' });
      }
    } else {
      res.status(201).json({ 
        id: this.lastID, 
        name: name.trim(),
        message: 'Dział został dodany pomyślnie' 
      });
    }
  });
});

app.put('/api/departments/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Nazwa działu jest wymagana' });
  }

  db.run('UPDATE departments SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
    [name.trim(), id], function(err) {
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
      res.json({ message: 'Dział został zaktualizowany pomyślnie' });
    }
  });
});

app.delete('/api/departments/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM departments WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('Błąd podczas usuwania działu:', err.message);
      res.status(500).json({ error: 'Błąd serwera' });
    } else if (this.changes === 0) {
      res.status(404).json({ error: 'Dział nie został znaleziony' });
    } else {
      res.json({ message: 'Dział został usunięty pomyślnie' });
    }
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
  const { name } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Nazwa pozycji jest wymagana' });
  }

  db.run('INSERT INTO positions (name) VALUES (?)', [name.trim()], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        res.status(400).json({ error: 'Pozycja o tej nazwie już istnieje' });
      } else {
        console.error('Błąd podczas dodawania pozycji:', err.message);
        res.status(500).json({ error: 'Błąd serwera' });
      }
    } else {
      res.status(201).json({ 
        id: this.lastID, 
        name: name.trim(),
        message: 'Pozycja została dodana pomyślnie' 
      });
    }
  });
});

app.put('/api/positions/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Nazwa pozycji jest wymagana' });
  }

  db.run('UPDATE positions SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
    [name.trim(), id], function(err) {
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
      res.json({ message: 'Pozycja została zaktualizowana pomyślnie' });
    }
  });
});

app.delete('/api/positions/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM positions WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('Błąd podczas usuwania pozycji:', err.message);
      res.status(500).json({ error: 'Błąd serwera' });
    } else if (this.changes === 0) {
      res.status(404).json({ error: 'Pozycja nie została znaleziona' });
    } else {
      res.json({ message: 'Pozycja została usunięta pomyślnie' });
    }
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

app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});

// Obsługa zamknięcia aplikacji
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
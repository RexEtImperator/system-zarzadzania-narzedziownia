const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const net = require('net');
let nodemailerOptional = null;
try {
  nodemailerOptional = require('nodemailer');
} catch (_) {
  nodemailerOptional = null;
}
let ipp;
try {
  ipp = require('ipp');
} catch (_) {
  ipp = null;
}

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'system-ewidencji-narzedzi-secret-key';

// Middleware
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:8082',
  'http://127.0.0.1:8082',
  'https://localhost:3000',
  'https://localhost:3001',
  // Allow LAN origins during development (e.g., Expo Web on another IP)
  'http://192.168.10.99:8082',
  'http://192.168.10.99:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow missing origin (e.g., CLI tools) and local/LAN origins
    const lanPattern = /^http:\/\/192\.168\.\d+\.\d+:\d+$/;
    const localhostPattern = /^https?:\/\/localhost:\d+$/;
    if (!origin || allowedOrigins.includes(origin) || lanPattern.test(origin) || localhostPattern.test(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight for API routes (Express 5: using a regular expression)
app.options(/^\/api\/.*$/, cors());

app.use(express.json());

// Database connection
const db = new sqlite3.Database(path.join(__dirname, 'database.db'), (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Endpoint health check API
app.get('/api/health', (req, res) => {
  db.get('SELECT 1', [], (err) => {
    const dbOk = !err;
    res.status(dbOk ? 200 : 500).json({
      status: dbOk ? 'ok' : 'error',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      db: dbOk ? 'ok' : (err?.message || 'unknown')
    });
  });
});

function initializeDatabase() {
  db.run(`CREATE TABLE IF NOT EXISTS app_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    app_name TEXT NOT NULL,
    company_name TEXT,
    timezone TEXT,
    language TEXT,
    date_format TEXT,
    backup_frequency TEXT,
    last_backup_at DATETIME,
    tools_code_prefix TEXT,
    bhp_code_prefix TEXT,
    tool_category_prefixes TEXT,
    updated_at DATETIME DEFAULT (datetime('now'))
  )`, (err) => {
    if (err) {
      console.error('Error creating app_config table:', err.message);
    } else {
      // Add missing columns if they do not exist
      db.all("PRAGMA table_info(app_config)", (err, columns) => {
        if (err) {
          console.error('Error checking app_config table structure:', err.message);
        } else {
          const columnNames = columns.map(col => col.name);
          if (!columnNames.includes('backup_frequency')) {
            db.run('ALTER TABLE app_config ADD COLUMN backup_frequency TEXT', (err) => {
              if (err) console.error('Error adding backup_frequency column:', err.message);
            });
          }
          if (!columnNames.includes('last_backup_at')) {
            db.run('ALTER TABLE app_config ADD COLUMN last_backup_at DATETIME', (err) => {
              if (err) console.error('Error adding last_backup_at column:', err.message);
            });
          }
          if (!columnNames.includes('tools_code_prefix')) {
            db.run('ALTER TABLE app_config ADD COLUMN tools_code_prefix TEXT', (err) => {
              if (err) console.error('Error adding tools_code_prefix column:', err.message);
            });
          }
          if (!columnNames.includes('bhp_code_prefix')) {
            db.run('ALTER TABLE app_config ADD COLUMN bhp_code_prefix TEXT', (err) => {
              if (err) console.error('Error adding bhp_code_prefix column:', err.message);
            });
          }
          if (!columnNames.includes('tool_category_prefixes')) {
            db.run('ALTER TABLE app_config ADD COLUMN tool_category_prefixes TEXT', (err) => {
              if (err) console.error('Error adding tool_category_prefixes column:', err.message);
            });
          }
          // SMTP configuration columns
          if (!columnNames.includes('smtp_host')) {
            db.run('ALTER TABLE app_config ADD COLUMN smtp_host TEXT', (err) => {
              if (err) console.error('Error adding smtp_host column:', err.message);
            });
          }
          if (!columnNames.includes('smtp_port')) {
            db.run('ALTER TABLE app_config ADD COLUMN smtp_port INTEGER', (err) => {
              if (err) console.error('Error adding smtp_port column:', err.message);
            });
          }
          if (!columnNames.includes('smtp_secure')) {
            db.run('ALTER TABLE app_config ADD COLUMN smtp_secure INTEGER', (err) => {
              if (err) console.error('Error adding smtp_secure column:', err.message);
            });
          }
          if (!columnNames.includes('smtp_user')) {
            db.run('ALTER TABLE app_config ADD COLUMN smtp_user TEXT', (err) => {
              if (err) console.error('Error adding smtp_user column:', err.message);
            });
          }
          if (!columnNames.includes('smtp_pass')) {
            db.run('ALTER TABLE app_config ADD COLUMN smtp_pass TEXT', (err) => {
              if (err) console.error('Error adding smtp_pass column:', err.message);
            });
          }
          if (!columnNames.includes('smtp_from')) {
            db.run('ALTER TABLE app_config ADD COLUMN smtp_from TEXT', (err) => {
              if (err) console.error('Error adding smtp_from column:', err.message);
            });
          }
          // Migration: remove legacy columns code_prefix and default_item_name if present
          if (columnNames.includes('code_prefix') || columnNames.includes('default_item_name')) {
            console.log('Starting app_config migration: removing code_prefix and default_item_name');
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
                tools_code_prefix TEXT,
                bhp_code_prefix TEXT,
                tool_category_prefixes TEXT,
                updated_at DATETIME DEFAULT (datetime('now'))
              )`, (err1) => {
                if (err1) {
                  console.error('Error creating app_config_new:', err1.message);
                  db.run('ROLLBACK');
                  return;
                }
                db.run(`INSERT INTO app_config_new (id, app_name, company_name, timezone, language, date_format, backup_frequency, last_backup_at, tools_code_prefix, bhp_code_prefix, tool_category_prefixes, updated_at)
                        SELECT id, app_name, company_name, timezone, language, date_format, backup_frequency, last_backup_at, tools_code_prefix, bhp_code_prefix, tool_category_prefixes, updated_at
                        FROM app_config WHERE id = 1`, (err2) => {
                  if (err2) {
                    console.error('Error copying data to app_config_new:', err2.message);
                    db.run('ROLLBACK');
                    return;
                  }
                  db.run('DROP TABLE app_config', (err3) => {
                    if (err3) {
                      console.error('Error dropping old app_config table:', err3.message);
                      db.run('ROLLBACK');
                      return;
                    }
                    db.run('ALTER TABLE app_config_new RENAME TO app_config', (err4) => {
                      if (err4) {
                        console.error('Error renaming app_config_new to app_config:', err4.message);
                        db.run('ROLLBACK');
                        return;
                      }
                      db.run('COMMIT', (err5) => {
                        if (err5) {
                          console.error('Error committing app_config migration:', err5.message);
                        } else {
                          console.log('app_config migration completed successfully.');
                        }
                      });
                    });
                  });
                });
              });
            });
          }
        }
      });
      // Ensure a default configuration record exists
      db.get('SELECT COUNT(*) as count FROM app_config WHERE id = 1', [], (err, row) => {
        if (err) {
          console.error('Error checking app_config:', err.message);
        } else if (row.count === 0) {
          db.run(
            `INSERT INTO app_config (id, app_name, company_name, timezone, language, date_format, backup_frequency) 
             VALUES (1, ?, ?, ?, ?, ?, ?)`,
            [
              'Management System',
              'My Company',
              'Europe/Warsaw',
              'pl',
              'DD/MM/YYYY',
              'daily'
            ],
            (err) => {
              if (err) {
                console.error('Error initializing app_config:', err.message);
              } else {
                console.log('Initialized default application configuration (app_config)');
              }
            }
          );
        }
      });
    }
  });

  initBackupScheduler();

  db.run(`CREATE TABLE IF NOT EXISTS tool_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT (datetime('now')),
    updated_at DATETIME DEFAULT (datetime('now'))
  )`, (err) => {
    if (err) {
      console.error('Error creating tool_categories table:', err.message);
    } else {
      db.get('SELECT COUNT(*) as count FROM tool_categories', [], (err, row) => {
        if (err) {
          console.error('Error checking tool_categories:', err.message);
        } else if ((row?.count || 0) === 0) {
          const defaults = ['Hand Tools', 'Power Tools', 'Welding', 'Pneumatic', 'Battery Powered'];
          const stmt = db.prepare('INSERT INTO tool_categories (name) VALUES (?)');
          defaults.forEach((name) => stmt.run(name));
          stmt.finalize();
          console.log('Initialized default tool categories');
        }
      });
    }
  });
  // Users table
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
      console.error('Error creating users table:', err.message);
    } else {
      // Check if the table has new columns; if not, add them
      db.all("PRAGMA table_info(users)", (err, columns) => {
        if (err) {
          console.error('Error checking users table structure:', err.message);
        } else {
          const columnNames = columns.map(col => col.name);
          
          // Add missing columns if they don't exist
          if (!columnNames.includes('full_name')) {
            db.run('ALTER TABLE users ADD COLUMN full_name TEXT', (err) => {
              if (err) console.error('Error adding full_name column:', err.message);
            });
          }
          if (!columnNames.includes('created_at')) {
            db.run('ALTER TABLE users ADD COLUMN created_at DATETIME', (err) => {
              if (err) console.error('Error adding created_at column:', err.message);
            });
          }
          if (!columnNames.includes('updated_at')) {
            db.run('ALTER TABLE users ADD COLUMN updated_at DATETIME', (err) => {
              if (err) console.error('Error adding updated_at column:', err.message);
            });
          }
        }
      });

      // Add default user
      const hashedPassword = bcrypt.hashSync('admin', 5);
      
      // Wait for columns to be added before checking the user
      setTimeout(() => {
        db.get('SELECT * FROM users WHERE username = ?', ['admintest'], (err, user) => {
          if (err) {
            console.error('Error checking user:', err.message);
          } else if (!user) {
            db.run('INSERT INTO users (username, password, role, full_name, created_at, updated_at) VALUES (?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'))', 
              ['admintest', hashedPassword, 'administrator', 'Gall Anonim'], 
              (err) => {
                if (err) {
                  console.error('Error adding user admintest:', err.message);
                } else {
                  console.log('Added default user admintest');
                }
              });
          } else if (!user.full_name) {
            // Update existing user with missing data
            db.run('UPDATE users SET full_name = ?, role = ?, updated_at = datetime(\'now\') WHERE username = ?', 
              ['Gall Anonim', 'administrator', 'admintest'], 
              (err) => {
                if (err) {
                  console.error('Error updating user admintest:', err.message);
                } else {
                  console.log('Updated user admintest');
                }
              });
          }
        });
      }, 100);
    }
  });
  
  // Tools table
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
    min_stock INTEGER,
    max_stock INTEGER,
    is_consumable INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT (datetime('now')),
    updated_at DATETIME DEFAULT (datetime('now'))
  )`, (err) => {
    if (err) {
      console.error('Error creating tools table:', err.message);
    } else {
      // Check if the table has new columns; if not, add them
      db.all("PRAGMA table_info(tools)", (err, columns) => {
        if (err) {
          console.error('Error checking tools table structure:', err.message);
        } else {
          const columnNames = columns.map(col => col.name);
          
          // Add missing columns if they don't exist
          if (!columnNames.includes('sku')) {
            db.run('ALTER TABLE tools ADD COLUMN sku TEXT', (err) => {
              if (err) console.error('Error adding sku column:', err.message);
            });
          }
          if (!columnNames.includes('quantity')) {
            db.run('ALTER TABLE tools ADD COLUMN quantity INTEGER DEFAULT 1', (err) => {
              if (err) console.error('Error adding quantity column:', err.message);
            });
          }
          if (!columnNames.includes('description')) {
            db.run('ALTER TABLE tools ADD COLUMN description TEXT', (err) => {
              if (err) console.error('Error adding description column:', err.message);
            });
          }
          if (!columnNames.includes('barcode')) {
            db.run('ALTER TABLE tools ADD COLUMN barcode TEXT', (err) => {
              if (err) console.error('Error adding barcode column:', err.message);
            });
          }
          if (!columnNames.includes('qr_code')) {
            db.run('ALTER TABLE tools ADD COLUMN qr_code TEXT', (err) => {
              if (err) console.error('Error adding qr_code column:', err.message);
            });
          }
          if (!columnNames.includes('serial_unreadable')) {
            db.run('ALTER TABLE tools ADD COLUMN serial_unreadable INTEGER DEFAULT 0', (err) => {
              if (err) console.error('Error adding serial_unreadable column:', err.message);
            });
          }
          if (!columnNames.includes('status')) {
            db.run('ALTER TABLE tools ADD COLUMN status TEXT DEFAULT "dostępne"', (err) => {
              if (err) console.error('Error adding status column:', err.message);
            });
          }
          if (!columnNames.includes('issued_to_employee_id')) {
            db.run('ALTER TABLE tools ADD COLUMN issued_to_employee_id INTEGER', (err) => {
              if (err) console.error('Error adding issued_to_employee_id column:', err.message);
            });
          }
          if (!columnNames.includes('issued_at')) {
            db.run('ALTER TABLE tools ADD COLUMN issued_at DATETIME', (err) => {
              if (err) console.error('Error adding issued_at column:', err.message);
            });
          }
          if (!columnNames.includes('issued_by_user_id')) {
            db.run('ALTER TABLE tools ADD COLUMN issued_by_user_id INTEGER', (err) => {
              if (err) console.error('Error adding issued_by_user_id column:', err.message);
            });
          }
          if (!columnNames.includes('serial_number')) {
            db.run('ALTER TABLE tools ADD COLUMN serial_number TEXT', (err) => {
              if (err) console.error('Error adding serial_number column:', err.message);
            });
          }
          if (!columnNames.includes('inventory_number')) {
            db.run('ALTER TABLE tools ADD COLUMN inventory_number TEXT', (err) => {
              if (err) console.error('Error adding inventory_number column:', err.message);
            });
          }
          if (!columnNames.includes('service_quantity')) {
            db.run('ALTER TABLE tools ADD COLUMN service_quantity INTEGER DEFAULT 0', (err) => {
              if (err) console.error('Error adding service_quantity column:', err.message);
            });
          }
          if (!columnNames.includes('service_sent_at')) {
            db.run('ALTER TABLE tools ADD COLUMN service_sent_at DATETIME NULL', (err) => {
              if (err) console.error('Error adding service_sent_at column:', err.message);
            });
          }
          if (!columnNames.includes('service_order_number')) {
            db.run('ALTER TABLE tools ADD COLUMN service_order_number TEXT', (err) => {
              if (err) console.error('Error adding service_order_number column:', err.message);
            });
          }
          if (!columnNames.includes('inspection_date')) {
            db.run('ALTER TABLE tools ADD COLUMN inspection_date DATETIME', (err) => {
              if (err) console.error('Error adding inspection_date column:', err.message);
            });
          }
          if (!columnNames.includes('manufacturer')) {
            db.run('ALTER TABLE tools ADD COLUMN manufacturer TEXT', (err) => {
              if (err) console.error('Error adding manufacturer column:', err.message);
            });
          }
          if (!columnNames.includes('model')) {
            db.run('ALTER TABLE tools ADD COLUMN model TEXT', (err) => {
              if (err) console.error('Error adding model column:', err.message);
            });
          }
          if (!columnNames.includes('production_year')) {
            db.run('ALTER TABLE tools ADD COLUMN production_year INTEGER', (err) => {
              if (err) console.error('Error adding production_year column:', err.message);
            });
          }

          // Stock levels for consumables
          if (!columnNames.includes('min_stock')) {
            db.run('ALTER TABLE tools ADD COLUMN min_stock INTEGER', (err) => {
              if (err) console.error('Error adding min_stock column:', err.message);
            });
          }
          if (!columnNames.includes('max_stock')) {
            db.run('ALTER TABLE tools ADD COLUMN max_stock INTEGER', (err) => {
              if (err) console.error('Error adding max_stock column:', err.message);
            });
          }
          if (!columnNames.includes('is_consumable')) {
            db.run('ALTER TABLE tools ADD COLUMN is_consumable INTEGER DEFAULT 0', (err) => {
              if (err) console.error('Error adding is_consumable column:', err.message);
            });
          }

          // Create a unique index for inventory_number (if it doesn't exist)
          // We use a partial index to allow NULL values ​​in inventory_number
          db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_tools_inventory_number_unique ON tools(inventory_number) WHERE inventory_number IS NOT NULL', (err) => {
            if (err) {
              console.error('Error creating unique index for inventory_number:', err.message);
            } else {
              console.log('Ensured unique index for inventory_number in tools table');
            }
          });
        }
      });

      // Insert sample tools with the new structure
      db.get('SELECT COUNT(*) as count FROM tools', (err, result) => {
        if (err) {
          console.error('Error checking tools:', err.message);
        } else if (result.count === 0) {
          const sampleTools = [
            ['Bosch Drill', 'QR17590493791001', 2, 'Warehouse A', 'Power Tools', 'Hammer drill 18V', 'QR17590493791001', 'QR17590493791001', 'SN-BOSCH-001'],
            ['Pneumatic Hammer', 'QR17590493791002', 1, 'Site 1', 'Pneumatic', 'Pneumatic hammer 5kg', 'QR17590493791002', 'QR17590493791002', 'SN-PNEUM-002'],
            ['Angle Grinder', 'QR17590493791003', 3, 'Warehouse B', 'Power Tools', 'Grinder 125mm', 'QR17590493791003', 'QR17590493791003', 'SN-GRIND-003'],
            ['Welder', 'QR17590493791004', 1, 'Warehouse B', 'Welding', 'MIG/MAG welder 200A', 'QR17590493791004', 'QR17590493791004', 'SN-WELD-004'],
            ['Chainsaw', 'QR17590493791005', 2, 'Site 2', 'Power Tools', 'Chainsaw 40cm', 'QR17590493791005', 'QR17590493791005', 'SN-SAW-005']
          ];

          const stmt = db.prepare('INSERT INTO tools (name, sku, quantity, location, category, description, barcode, qr_code, serial_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
          sampleTools.forEach(tool => {
            stmt.run(tool, (err) => {
              if (err) {
                console.error('Error adding tool:', err.message);
              }
            });
          });
          stmt.finalize();
          console.log('Inserted sample tools with codes');
        }
      });
    }
  });

// Tool issues table (new structure for issuing single items)
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
      console.error('Error creating table tool_issues:', err.message);
    } else {
      console.log('Table tool_issues has been created or already exists');
    }
  });

// Tool service history table
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
      console.error('Error creating table tool_service_history:', err.message);
    } else {
      console.log('Table tool_service_history has been created or already exists');
    }
  });

// PPE (BHP) table
  db.run(`CREATE TABLE IF NOT EXISTS bhp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inventory_number TEXT UNIQUE NOT NULL,
    manufacturer TEXT,
    model TEXT,
    serial_number TEXT,
    catalog_number TEXT,
    inspection_date DATETIME,
    is_set INTEGER DEFAULT 0,
    shock_absorber_serial TEXT,
    shock_absorber_name TEXT,
    shock_absorber_model TEXT,
    status TEXT DEFAULT 'dostępne',
    created_at DATETIME DEFAULT (datetime('now')),
    updated_at DATETIME DEFAULT (datetime('now'))
  )`, (err) => {
    if (err) {
      console.error('Error creating table bhp:', err.message);
    } else {
// Check and add missing columns
      db.all("PRAGMA table_info(bhp)", (err, columns) => {
        if (err) {
          console.error('Error checking bhp table structure:', err.message);
        } else {
          const columnNames = columns.map(col => col.name);
          const ensureColumn = (name, ddl) => {
            if (!columnNames.includes(name)) {
              db.run(`ALTER TABLE bhp ADD COLUMN ${ddl}`, (err) => {
                if (err) console.error(`Error adding column ${name}:`, err.message);
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
          ensureColumn('shock_absorber_serial', 'shock_absorber_serial TEXT');
          ensureColumn('shock_absorber_name', 'shock_absorber_name TEXT');
          ensureColumn('shock_absorber_model', 'shock_absorber_model TEXT');
          ensureColumn('shock_absorber_catalog_number', 'shock_absorber_catalog_number TEXT');
          ensureColumn('harness_start_date', 'harness_start_date DATETIME');
          ensureColumn('shock_absorber_start_date', 'shock_absorber_start_date DATETIME');
          ensureColumn('shock_absorber_production_date', 'shock_absorber_production_date DATETIME');
          ensureColumn('production_date', 'production_date DATETIME');
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

// PPE issue/return table
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
      console.error('Error creating table bhp_issues:', err.message);
    } else {
      console.log('Table bhp_issues has been created or already exists');
    }
  });
// Employees table
  db.run(`CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    position TEXT NOT NULL,
    department TEXT NOT NULL,
    brand_number TEXT,
    email TEXT,
    login TEXT,
    created_at DATETIME DEFAULT (datetime('now'))
  )`, (err) => {
    if (err) {
      console.error('Error creating table employees:', err.message);
    } else {
// Check if table has new columns; add if missing
      db.all("PRAGMA table_info(employees)", (err, columns) => {
        if (err) {
          console.error('Error checking employees table structure:', err.message);
        } else {
          const columnNames = columns.map(col => col.name);
          
// Add missing columns if they do not exist
          if (!columnNames.includes('first_name')) {
            db.run('ALTER TABLE employees ADD COLUMN first_name TEXT', (err) => {
              if (err) console.error('Error adding column first_name:', err.message);
            });
          }
          if (!columnNames.includes('last_name')) {
            db.run('ALTER TABLE employees ADD COLUMN last_name TEXT', (err) => {
              if (err) console.error('Error adding column last_name:', err.message);
            });
          }
          if (!columnNames.includes('phone')) {
            db.run('ALTER TABLE employees ADD COLUMN phone TEXT', (err) => {
              if (err) console.error('Error adding column phone:', err.message);
            });
          }
          if (!columnNames.includes('created_at')) {
            db.run('ALTER TABLE employees ADD COLUMN created_at DATETIME DEFAULT (datetime(\'now\'))', (err) => {
              if (err) console.error('Error adding column created_at:', err.message);
            });
          }
          if (!columnNames.includes('brand_number')) {
            db.run('ALTER TABLE employees ADD COLUMN brand_number TEXT', (err) => {
              if (err) console.error('Error adding column brand_number:', err.message);
            });
          }
          if (!columnNames.includes('email')) {
            db.run('ALTER TABLE employees ADD COLUMN email TEXT', (err) => {
              if (err) console.error('Error adding column email:', err.message);
            });
          }
          if (!columnNames.includes('login')) {
            db.run('ALTER TABLE employees ADD COLUMN login TEXT', (err) => {
              if (err) console.error('Error adding column login:', err.message);
            });
          }
        }
      });

// Insert real employees
      const realEmployees = [
        ['Dawid', 'Brzeziński', '+48 516 991 404', 'Narzędziowiec', 'Narzędziownia', '43'],
        ['Piotr', 'Mędela', '+48 661 916 914', 'Narzędziowiec', 'Narzędziownia', '-'],
      ];

      db.get('SELECT COUNT(*) as count FROM employees', (err, result) => {
        if (err) {
          console.error('Error checking employees:', err.message);
        } else if (result.count === 0) {
          const stmt = db.prepare('INSERT INTO employees (first_name, last_name, phone, position, department, brand_number) VALUES (?, ?, ?, ?, ?, ?)');
          realEmployees.forEach(employee => {
            stmt.run(employee, (err) => {
              if (err) {
                console.error('Error adding employee:', err.message);
              }
            });
          });
          stmt.finalize();
          console.log('Added real employees');
        }
      });
    }
  });

// Audit logs table
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
      console.error('Error creating table audit_logs:', err.message);
    } else {
      console.log('Table audit_logs has been created or already exists');
// Migration: add missing columns in audit_logs
      db.all("PRAGMA table_info(audit_logs)", (infoErr, columns) => {
        if (infoErr) {
          console.error('Error checking audit_logs table structure:', infoErr.message);
          return;
        }
        const columnNames = (columns || []).map(c => c.name);
        if (!columnNames.includes('target_type')) {
          db.run('ALTER TABLE audit_logs ADD COLUMN target_type TEXT', (alterErr) => {
            if (alterErr) console.error('Error adding column target_type:', alterErr.message);
          });
        }
        if (!columnNames.includes('target_id')) {
          db.run('ALTER TABLE audit_logs ADD COLUMN target_id TEXT', (alterErr) => {
            if (alterErr) console.error('Error adding column target_id:', alterErr.message);
          });
        }
      });
    }
  });

// Departments table
  db.run(`CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT (datetime('now'))
  )`, (err) => {
    if (err) {
      console.error('Error creating table departments:', err.message);
    } else {
      console.log('Table departments has been created or already exists');
// Add missing columns if they do not exist
      db.all("PRAGMA table_info(departments)", (err, columns) => {
        if (err) {
          console.error('Error checking departments table structure:', err.message);
        } else {
          const columnNames = columns.map(col => col.name);
          if (!columnNames.includes('manager_id')) {
            db.run('ALTER TABLE departments ADD COLUMN manager_id INTEGER', (err) => {
              if (err) console.error('Error adding column manager_id:', err.message);
            });
          }
          if (!columnNames.includes('status')) {
            db.run('ALTER TABLE departments ADD COLUMN status TEXT DEFAULT "active"', (err) => {
              if (err) console.error('Error adding column status:', err.message);
            });
          }
          if (!columnNames.includes('updated_at')) {
            db.run('ALTER TABLE departments ADD COLUMN updated_at DATETIME', (err) => {
              if (err) console.error('Error adding column updated_at:', err.message);
            });
          }

// Migration: set status='active' for existing records without status
          db.run('UPDATE departments SET status = COALESCE(NULLIF(status, ""), "active") WHERE status IS NULL OR TRIM(status) = ""', (err) => {
            if (err) console.error('Error migrating status in departments:', err.message);
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
      console.error('Error creating table positions:', err.message);
    } else {
      console.log('Table positions has been created or already exists');
// Add missing columns if they do not exist
      db.all("PRAGMA table_info(positions)", (err, columns) => {
        if (err) {
          console.error('Error checking positions table structure:', err.message);
        } else {
          const columnNames = columns.map(col => col.name);
          if (!columnNames.includes('description')) {
            db.run('ALTER TABLE positions ADD COLUMN description TEXT', (err) => {
              if (err) console.error('Error adding column description:', err.message);
            });
          }
          if (!columnNames.includes('department_id')) {
            db.run('ALTER TABLE positions ADD COLUMN department_id INTEGER', (err) => {
              if (err) console.error('Error adding column department_id:', err.message);
            });
          }
          if (!columnNames.includes('requirements')) {
            db.run('ALTER TABLE positions ADD COLUMN requirements TEXT', (err) => {
              if (err) console.error('Error adding column requirements:', err.message);
            });
          }
          if (!columnNames.includes('status')) {
            db.run('ALTER TABLE positions ADD COLUMN status TEXT DEFAULT "active"', (err) => {
              if (err) console.error('Error adding column status:', err.message);
            });
          }
          if (!columnNames.includes('updated_at')) {
            db.run('ALTER TABLE positions ADD COLUMN updated_at DATETIME', (err) => {
              if (err) console.error('Error adding column updated_at:', err.message);
            });
          }

// Migration: set status='active' for existing records without status
          db.run('UPDATE positions SET status = COALESCE(NULLIF(status, ""), "active") WHERE status IS NULL OR TRIM(status) = ""', (err) => {
            if (err) console.error('Error migrating status in positions:', err.message);
          });
        }
      });
    }
  });

// Role permissions table
  db.run(`CREATE TABLE IF NOT EXISTS role_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    permission TEXT NOT NULL,
    created_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(role, permission)
  )`, (err) => {
    if (err) {
      console.error('Error creating table role_permissions:', err.message);
    } else {
      console.log('Table role_permissions has been created or already exists');
      
// Initialize default role permissions (excluding 'viewer' role)
      const defaultPermissions = {
        'administrator': ['VIEW_USERS', 'CREATE_USERS', 'EDIT_USERS', 'DELETE_USERS', 'VIEW_ANALYTICS', 'VIEW_TOOLS', 'VIEW_TOOL_HISTORY', 'MANAGE_DEPARTMENTS', 'MANAGE_POSITIONS', 'SYSTEM_SETTINGS', 'VIEW_ADMIN', 'MANAGE_USERS', 'VIEW_AUDIT_LOG', 'VIEW_BHP', 'VIEW_BHP_HISTORY', 'MANAGE_BHP', 'VIEW_QUICK_ACTIONS', 'DELETE_ISSUE_HISTORY', 'DELETE_RETURN_HISTORY', 'DELETE_SERVICE_HISTORY', 'MANAGE_EMPLOYEES', 'VIEW_DATABASE', 'MANAGE_DATABASE', 'VIEW_INVENTORY', 'INVENTORY_MANAGE_SESSIONS', 'INVENTORY_SCAN', 'INVENTORY_ACCEPT_CORRECTION', 'INVENTORY_DELETE_CORRECTION', 'INVENTORY_EXPORT_CSV'],
        'manager': ['VIEW_USERS', 'CREATE_USERS', 'EDIT_USERS', 'MANAGE_DEPARTMENTS', 'MANAGE_POSITIONS', 'VIEW_ANALYTICS', 'VIEW_TOOLS', 'VIEW_TOOL_HISTORY', 'VIEW_BHP', 'VIEW_BHP_HISTORY', 'MANAGE_BHP', 'VIEW_QUICK_ACTIONS', 'MANAGE_EMPLOYEES', 'VIEW_INVENTORY', 'INVENTORY_MANAGE_SESSIONS', 'INVENTORY_SCAN', 'INVENTORY_ACCEPT_CORRECTION', 'INVENTORY_EXPORT_CSV'],
        'employee': ['VIEW_TOOL_HISTORY', 'VIEW_BHP_HISTORY'],
        'hr': ['VIEW_USERS', 'CREATE_USERS', 'EDIT_USERS', 'MANAGE_DEPARTMENTS', 'MANAGE_POSITIONS'],
        'user': []
      };

// Seed default permissions if role_permissions table is empty
      db.get('SELECT COUNT(*) as count FROM role_permissions', [], (countErr, row) => {
        if (countErr) {
          console.error('Error checking role_permissions:', countErr.message);
        } else if ((row?.count || 0) === 0) {
          db.serialize(() => {
            const stmt = db.prepare('INSERT INTO role_permissions (role, permission) VALUES (?, ?)');
            try {
              Object.entries(defaultPermissions).forEach(([role, perms]) => {
                (perms || []).forEach((perm) => {
                  stmt.run([role, perm]);
                });
              });
              console.log('Initialized default role permissions in role_permissions');
            } catch (seedErr) {
              console.error('Error initializing role permissions:', seedErr.message);
            } finally {
              stmt.finalize();
            }
          });
        }
      });
    }
  });
  // ===== Inventory tables =====
  db.run(`CREATE TABLE IF NOT EXISTS inventory_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',  -- active | paused | ended
    owner_user_id INTEGER NOT NULL,
    started_at DATETIME DEFAULT (datetime('now')),
    paused_at DATETIME,
    finished_at DATETIME,
    notes TEXT
  )`, (err) => {
    if (err) {
      console.error('Error creating table inventory_sessions:', err.message);
    } else {
      console.log('Table inventory_sessions has been created or already exists');
    }
  });

  db.run(`CREATE TABLE IF NOT EXISTS inventory_counts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    tool_id INTEGER NOT NULL,
    code TEXT,
    counted_qty INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT (datetime('now')),
    updated_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(session_id, tool_id),
    FOREIGN KEY (session_id) REFERENCES inventory_sessions(id),
    FOREIGN KEY (tool_id) REFERENCES tools(id)
  )`, (err) => {
    if (err) {
      console.error('Error creating table inventory_counts:', err.message);
    } else {
      console.log('Table inventory_counts has been created or already exists');
      db.run('CREATE INDEX IF NOT EXISTS idx_inventory_counts_session ON inventory_counts(session_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_inventory_counts_tool ON inventory_counts(tool_id)');
    }
  });

  db.run(`CREATE TABLE IF NOT EXISTS inventory_corrections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    tool_id INTEGER NOT NULL,
    difference_qty INTEGER NOT NULL,
    reason TEXT,
    created_at DATETIME DEFAULT (datetime('now')),
    accepted_by_user_id INTEGER,
    accepted_at DATETIME,
    FOREIGN KEY (session_id) REFERENCES inventory_sessions(id),
    FOREIGN KEY (tool_id) REFERENCES tools(id)
  )`, (err) => {
    if (err) {
      console.error('Error creating table inventory_corrections:', err.message);
    } else {
      console.log('Table inventory_corrections has been created or already exists');
    }
  });

  // Reports table
  db.run(`CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_by_user_id INTEGER,
    created_by_username TEXT,
    type TEXT NOT NULL, -- employee | tool | bhp | other
    employee_id INTEGER,
    employee_name_manual TEXT,
    tool_id INTEGER,
    bhp_category TEXT,
    subject TEXT,
    description TEXT NOT NULL,
    severity TEXT NOT NULL, -- low | medium | high
    status TEXT NOT NULL DEFAULT 'Przyjęto', -- Przyjęto | Sprawdzanie | Rozwiązano
    attachments TEXT, -- JSON array
    created_at DATETIME DEFAULT (datetime('now')),
    updated_at DATETIME DEFAULT (datetime('now'))
  )`, (err) => {
    if (err) {
      console.error('Error creating table reports:', err.message);
    } else {
      db.run('CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type)');
      db.run('CREATE INDEX IF NOT EXISTS idx_reports_severity ON reports(severity)');
      db.run('CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status)');
      console.log('Table reports has been created or already exists');
      // Ensure missing columns are added (on-the-fly migrations)
      db.all("PRAGMA table_info(reports)", (infoErr, columns) => {
        if (infoErr) {
          console.error('Error checking reports table structure:', infoErr.message);
          return;
        }
        const names = (columns || []).map(c => c.name);
        if (!names.includes('employee_name_manual')) {
          db.run('ALTER TABLE reports ADD COLUMN employee_name_manual TEXT', (alterErr) => {
            if (alterErr) {
              console.error('Error adding column employee_name_manual:', alterErr.message);
            } else {
              console.log('Added column employee_name_manual to reports table');
            }
          });
        }
      });
    }
  });

  // i18n translations table (stores language key overrides)
  db.run(`CREATE TABLE IF NOT EXISTS translate (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lang TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(lang, key)
  )`, (err) => {
    if (err) {
      console.error('Error creating table translate:', err.message);
    } else {
      seedTranslationsFromFiles();
    }
  });
}

// Helpers to flatten/unflatten JSON objects (dot keys)
function flattenObject(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj || {})) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey));
    } else {
      result[newKey] = String(value);
    }
  }
  return result;
}

function readJsonSafe(jsonPath) {
  try {
    const raw = fs.readFileSync(jsonPath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to read JSON file:', jsonPath, e.message);
    return {};
  }
}

function seedTranslationsFromFiles() {
  try {
    db.get('SELECT COUNT(*) as cnt FROM translate', [], (err, row) => {
      if (err) {
        console.error('Error checking translate table contents:', err.message);
        return;
      }
      const cnt = row?.cnt || 0;
      if (cnt > 0) {
        return; // Records exist already; do not reseed
      }
      const plPath = path.join(__dirname, 'src', 'i18n', 'pl.json');
      const enPath = path.join(__dirname, 'src', 'i18n', 'en.json');
      const dePath = path.join(__dirname, 'src', 'i18n', 'de.json');
      const plDict = readJsonSafe(plPath);
      const enDict = readJsonSafe(enPath);
      const deDict = readJsonSafe(dePath);
      const plFlat = flattenObject(plDict);
      const enFlat = flattenObject(enDict);
      const deFlat = flattenObject(deDict);
      const insertStmt = db.prepare('INSERT OR IGNORE INTO translate (lang, key, value, updated_at) VALUES (?, ?, ?, datetime("now"))');
      db.serialize(() => {
        for (const [k, v] of Object.entries(plFlat)) {
          insertStmt.run('pl', k, v);
        }
        for (const [k, v] of Object.entries(enFlat)) {
          insertStmt.run('en', k, v);
        }
        for (const [k, v] of Object.entries(deFlat)) {
          insertStmt.run('de', k, v);
        }
        insertStmt.finalize();
      });
      console.log('Seeded translations from i18n files into translate table');
    });
  } catch (e) {
    console.error('Error seeding translations:', e.message);
  }
}

// JWT token verification middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Missing authentication token' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.warn('JWT verification failed:', {
        error: err.message,
        name: err.name,
        authHeader,
        tokenSnippet: token ? token.substring(0, 20) + '...' : null
      });
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

// Helper function: ensure departments table has required columns
function ensureDepartmentColumns(callback) {
  db.all("PRAGMA table_info(departments)", (err, columns) => {
    if (err) {
      console.error('Error checking departments table structure:', err.message);
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
          console.error(`Error adding column ${task.name}:`, alterErr.message);
        }
        runNext();
      });
    };
    runNext();
  });
}

// Login endpoint
app.post('/api/login', (req, res) => {
  console.log('=== LOGIN REQUEST ===');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  console.log('Body type:', typeof req.body);
  
  const { username, password} = req.body;
  
  console.log('Extracted username:', username);
  console.log('Extracted password:', password ? '[HIDDEN]' : 'undefined');

  if (!username || !password) {
    console.log('Missing username or password');
    return res.status(400).json({ message: 'Username and password are required' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      console.log('Database error:', err);
      return res.status(500).json({ message: 'Server error' });
    }

    if (!user) {
      console.log('User not found:', username);
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const passwordIsValid = bcrypt.compareSync(password, user.password);
    console.log('Password valid:', passwordIsValid);

    if (!passwordIsValid) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, {
      expiresIn: 86400 // 24 hours
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

// Fetch all tool issues with pagination
app.get('/api/tool-issues', authenticateToken, requirePermission('VIEW_TOOL_HISTORY'), (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const { status, employee_id } = req.query;

  // Dynamiczne filtry
  const whereClauses = [];
  const whereParams = [];
  if (status) {
    whereClauses.push('ti.status = ?');
    whereParams.push(status);
  }
  const isEmployeeRole = req.user.role === 'employee';
  if (!isEmployeeRole && employee_id) {
    whereClauses.push('ti.employee_id = ?');
    whereParams.push(employee_id);
  }
  if (isEmployeeRole) {
// Employee sees only own history (login → employees.login mapping)
    return db.get('SELECT id FROM employees WHERE login = ?', [req.user.username], (err, row) => {
      if (err) {
        console.error('Error mapping user to employee:', err);
        return res.status(500).json({ message: 'Server error', error: err.message });
      }
      if (!row || !row.id) {
        return res.json({
          data: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            totalItems: 0,
            itemsPerPage: limit,
            hasNextPage: false,
            hasPreviousPage: false
          }
        });
      }
      whereClauses.push('ti.employee_id = ?');
      whereParams.push(row.id);
      const whereSqlLocal = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const countQueryLocal = `
        SELECT COUNT(*) as total
        FROM tool_issues ti
        LEFT JOIN tools t ON ti.tool_id = t.id
        LEFT JOIN employees e ON ti.employee_id = e.id
        LEFT JOIN users u ON ti.issued_by_user_id = u.id
        ${whereSqlLocal}
      `;
      const dataQueryLocal = `
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
        ${whereSqlLocal}
        ORDER BY ti.issued_at DESC
        LIMIT ? OFFSET ?
      `;
      db.get(countQueryLocal, whereParams, (err2, countResult) => {
        if (err2) {
          console.error('Error fetching tool issues count:', err2);
          return res.status(500).json({ message: 'Server error', error: err2.message });
        }
        const total = countResult.total;
        const totalPages = Math.ceil(total / limit);
        db.all(dataQueryLocal, [...whereParams, limit, offset], (err3, issues) => {
          if (err3) {
            console.error('Error fetching tool issues:', err3);
            return res.status(500).json({ message: 'Server error', error: err3.message });
          }
          return res.json({
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
  }
  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countQuery = `
    SELECT COUNT(*) as total
    FROM tool_issues ti
    LEFT JOIN tools t ON ti.tool_id = t.id
    LEFT JOIN employees e ON ti.employee_id = e.id
    LEFT JOIN users u ON ti.issued_by_user_id = u.id
    ${whereSql}
  `;

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
    ${whereSql}
    ORDER BY ti.issued_at DESC
    LIMIT ? OFFSET ?
  `;

  db.get(countQuery, whereParams, (err, countResult) => {
    if (err) {
      console.error('Error fetching tool issues count:', err);
      return res.status(500).json({ message: 'Server error', error: err.message });
    }

    const total = countResult.total;
    const totalPages = Math.ceil(total / limit);

    db.all(dataQuery, [...whereParams, limit, offset], (err, issues) => {
      if (err) {
        console.error('Error fetching tool issues:', err);
        return res.status(500).json({ message: 'Server error', error: err.message });
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

// Endpoint: fetch all PPE issues/returns with pagination
app.get('/api/bhp-issues', authenticateToken, requirePermission('VIEW_BHP_HISTORY'), (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const { status, employee_id } = req.query;

  const whereClauses = [];
  const whereParams = [];
  if (status) {
    whereClauses.push('bi.status = ?');
    whereParams.push(status);
  }
  const isEmployeeRole = req.user.role === 'employee';
  if (!isEmployeeRole && employee_id) {
    whereClauses.push('bi.employee_id = ?');
    whereParams.push(employee_id);
  }
  if (isEmployeeRole) {
    return db.get('SELECT id FROM employees WHERE login = ?', [req.user.username], (err, row) => {
      if (err) {
        console.error('Error mapping user to employee (BHP):', err);
        return res.status(500).json({ message: 'Server error', error: err.message });
      }
      if (!row || !row.id) {
        return res.json({
          data: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            totalItems: 0,
            itemsPerPage: limit,
            hasNextPage: false,
            hasPreviousPage: false
          }
        });
      }
      whereClauses.push('bi.employee_id = ?');
      whereParams.push(row.id);
      const whereSqlLocal = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const countQueryLocal = `
        SELECT COUNT(*) as total
        FROM bhp_issues bi
        LEFT JOIN bhp b ON bi.bhp_id = b.id
        LEFT JOIN employees e ON bi.employee_id = e.id
        LEFT JOIN users u ON bi.issued_by_user_id = u.id
        ${whereSqlLocal}
      `;
      const dataQueryLocal = `
        SELECT 
          bi.*, 
          b.inventory_number AS bhp_inventory_number,
          b.model AS bhp_model,
          e.first_name AS employee_first_name,
          e.last_name AS employee_last_name,
          u.full_name AS issued_by_user_name
        FROM bhp_issues bi
        LEFT JOIN bhp b ON bi.bhp_id = b.id
        LEFT JOIN employees e ON bi.employee_id = e.id
        LEFT JOIN users u ON bi.issued_by_user_id = u.id
        ${whereSqlLocal}
        ORDER BY bi.issued_at DESC
        LIMIT ? OFFSET ?
      `;
      db.get(countQueryLocal, whereParams, (err2, countResult) => {
        if (err2) {
          console.error('Error fetching BHP issues count:', err2);
          return res.status(500).json({ message: 'Server error', error: err2.message });
        }
        const total = countResult.total;
        const totalPages = Math.ceil(total / limit);
        db.all(dataQueryLocal, [...whereParams, limit, offset], (err3, issues) => {
          if (err3) {
            console.error('Error fetching BHP issues:', err3);
            return res.status(500).json({ message: 'Server error', error: err3.message });
          }
          return res.json({
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
  }
  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countQuery = `
    SELECT COUNT(*) as total
    FROM bhp_issues bi
    LEFT JOIN bhp b ON bi.bhp_id = b.id
    LEFT JOIN employees e ON bi.employee_id = e.id
    LEFT JOIN users u ON bi.issued_by_user_id = u.id
    ${whereSql}
  `;

  const dataQuery = `
    SELECT 
      bi.*, 
      b.inventory_number AS bhp_inventory_number,
      b.model AS bhp_model,
      e.first_name AS employee_first_name,
      e.last_name AS employee_last_name,
      u.full_name AS issued_by_user_name
    FROM bhp_issues bi
    LEFT JOIN bhp b ON bi.bhp_id = b.id
    LEFT JOIN employees e ON bi.employee_id = e.id
    LEFT JOIN users u ON bi.issued_by_user_id = u.id
    ${whereSql}
    ORDER BY bi.issued_at DESC
    LIMIT ? OFFSET ?
  `;

  db.get(countQuery, whereParams, (err, countResult) => {
    if (err) {
      console.error('Error fetching BHP issues count:', err);
      return res.status(500).json({ message: 'Server error', error: err.message });
    }

    const total = countResult.total;
    const totalPages = Math.ceil(total / limit);

    db.all(dataQuery, [...whereParams, limit, offset], (err, issues) => {
      if (err) {
        console.error('Error fetching BHP issues:', err);
        return res.status(500).json({ message: 'Server error', error: err.message });
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

// Registration endpoint (administrators only)
app.post('/api/register', authenticateToken, (req, res) => {
  const { username, password, role } = req.body;

  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Only administrators can add new users' });
  }

  if (!username || !password || !role) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', 
    [username, hashedPassword, role], 
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ message: 'User with this username already exists' });
        }
        return res.status(500).json({ message: 'Server error' });
      }

      res.status(201).json({ message: 'User registered successfully', id: this.lastID });
    });
});

// Endpoint: search tool by barcode/QR
app.get('/api/tools/search', authenticateToken, (req, res) => {
  console.log('=== TOOLS SEARCH REQUEST ===');
  console.log('Query params:', req.query);
  console.log('Headers:', req.headers);
  
  const { code } = req.query;
  
  if (!code) {
    console.log('No code provided');
    return res.status(400).json({ message: 'Code is required' });
  }

  console.log('Searching for tool with code:', code);

// Search tool by SKU, barcode or QR code
  db.get(
    'SELECT * FROM tools WHERE sku = ? OR barcode = ? OR qr_code = ? OR inventory_number = ? LIMIT 1',
    [code, code, code, code],
    (err, tool) => {
      if (err) {
        console.error('Error searching for tool:', err);
        return res.status(500).json({ message: 'Server error' });
      }
      
      console.log('Search result:', tool);
      
      if (!tool) {
        console.log('No tool found for code:', code);
        return res.status(404).json({ message: 'Tool not found for the given code' });
      }
      
      console.log('Returning tool:', tool);
      res.status(200).json(tool);
    }
  );
});

// Tools fetch endpoint
app.get('/api/tools', authenticateToken, (req, res) => {
  db.all('SELECT * FROM tools', [], (err, tools) => {
    if (err) {
      return res.status(500).json({ message: 'Server error' });
    }
    res.status(200).json(tools);
  });
});

// Tool suggestions endpoint (distinct manufacturer/model/year) for given category
app.get('/api/tools/suggestions', authenticateToken, (req, res) => {
  const rawCategory = (req.query.category || '').trim();
  if (!rawCategory) {
    return res.status(400).json({ message: 'Category parameter is required' });
  }
  const sqlManufacturer = 'SELECT DISTINCT manufacturer FROM tools WHERE manufacturer IS NOT NULL AND TRIM(manufacturer) <> "" AND LOWER(category) = LOWER(?) ORDER BY manufacturer COLLATE NOCASE';
  const sqlModel = 'SELECT DISTINCT model FROM tools WHERE model IS NOT NULL AND TRIM(model) <> "" AND LOWER(category) = LOWER(?) ORDER BY model COLLATE NOCASE';
  const sqlYear = 'SELECT DISTINCT production_year FROM tools WHERE production_year IS NOT NULL AND LOWER(category) = LOWER(?) ORDER BY production_year ASC';

  const out = { manufacturer: [], model: [], production_year: [] };

  db.all(sqlManufacturer, [rawCategory], (errM, rowsM) => {
    if (errM) {
      return res.status(500).json({ message: 'Server error', error: errM.message });
    }
    out.manufacturer = (rowsM || []).map(r => r.manufacturer).filter(v => typeof v === 'string');
    db.all(sqlModel, [rawCategory], (errMo, rowsMo) => {
      if (errMo) {
        return res.status(500).json({ message: 'Server error', error: errMo.message });
      }
      out.model = (rowsMo || []).map(r => r.model).filter(v => typeof v === 'string');
      db.all(sqlYear, [rawCategory], (errY, rowsY) => {
        if (errY) {
          return res.status(500).json({ message: 'Server error', error: errY.message });
        }
        out.production_year = (rowsY || []).map(r => r.production_year).filter(v => v !== null && v !== undefined);
        res.json(out);
      });
    });
  });
});

// Endpoint: add tool
app.post('/api/tools', authenticateToken, (req, res) => {
  const { name, sku, quantity, location, category, description, barcode, qr_code, serial_number, serial_unreadable, inventory_number, inspection_date, min_stock, max_stock, is_consumable, manufacturer, model, production_year } = req.body;

  if (!name || !sku) {
    return res.status(400).json({ message: 'Name and SKU are required' });
  }

// Require serial number unless marked as illegible
  const serialProvided = serial_number && String(serial_number).trim().length > 0;
  const unreadableFlag = !!serial_unreadable;
  if (!serialProvided && !unreadableFlag) {
    return res.status(400).json({ message: 'Factory serial number is required or mark as unreadable' });
  }

// Validate stock levels
  const minStockSan = (min_stock === '' || min_stock === null || typeof min_stock === 'undefined') ? null : Math.max(0, parseInt(min_stock, 10));
  const maxStockSan = (max_stock === '' || max_stock === null || typeof max_stock === 'undefined') ? null : Math.max(0, parseInt(max_stock, 10));
  if (minStockSan !== null && maxStockSan !== null && maxStockSan < minStockSan) {
    return res.status(400).json({ message: 'Maximum stock cannot be less than minimum stock' });
  }

// Normalize production year: empty or integer
  let prodYearSan = null;
  if (typeof production_year !== 'undefined' && production_year !== null && String(production_year).trim() !== '') {
    const parsed = parseInt(production_year, 10);
    if (!Number.isNaN(parsed)) {
      prodYearSan = parsed;
    }
  }

  db.run(
    'INSERT INTO tools (name, sku, quantity, location, category, description, barcode, qr_code, serial_number, serial_unreadable, inventory_number, inspection_date, min_stock, max_stock, is_consumable, manufacturer, model, production_year) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [name, sku, quantity || 1, location, category, description, barcode || sku, qr_code || sku, serialProvided ? serial_number : null, unreadableFlag ? 1 : 0, inventory_number || null, inspection_date || null, minStockSan, maxStockSan, is_consumable ? 1 : 0, manufacturer || null, model || null, prodYearSan],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed: tools.inventory_number')) {
          return res.status(400).json({ message: 'Tool with this inventory number already exists' });
        }
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ message: 'Tool with this SKU already exists' });
        }
        return res.status(500).json({ message: 'Server error', error: err.message });
      }
      
      // Fetch full data of the inserted tool
      db.get('SELECT * FROM tools WHERE id = ?', [this.lastID], (err, tool) => {
        if (err) {
          return res.status(500).json({ message: 'Error fetching tool data' });
        }
        res.status(201).json(tool);
      });
    }
  );
});

// Endpoint: update tool
app.put('/api/tools/:id', authenticateToken, (req, res) => {
  const { name, sku, quantity, location, category, description, barcode, qr_code, serial_number, serial_unreadable, status, inventory_number, inspection_date, min_stock, max_stock, is_consumable, manufacturer, model, production_year } = req.body;
  const id = req.params.id;

  if (!name || !sku) {
    return res.status(400).json({ message: 'Name and SKU are required' });
  }

// On edit: if serial empty, require illegible flag
  const serialProvided = serial_number && String(serial_number).trim().length > 0;
  const unreadableFlag = !!serial_unreadable;
  if (!serialProvided && !unreadableFlag) {
    return res.status(400).json({ message: 'Factory serial number is required or mark as unreadable' });
  }

// Validate stock levels
  const minStockSan = (min_stock === '' || min_stock === null || typeof min_stock === 'undefined') ? null : Math.max(0, parseInt(min_stock, 10));
  const maxStockSan = (max_stock === '' || max_stock === null || typeof max_stock === 'undefined') ? null : Math.max(0, parseInt(max_stock, 10));
  if (minStockSan !== null && maxStockSan !== null && maxStockSan < minStockSan) {
    return res.status(400).json({ message: 'Maximum stock cannot be less than minimum stock' });
  }

  let prodYearSan = null;
  if (typeof production_year !== 'undefined' && production_year !== null && String(production_year).trim() !== '') {
    const parsed = parseInt(production_year, 10);
    if (!Number.isNaN(parsed)) {
      prodYearSan = parsed;
    }
  }

  db.run(
    'UPDATE tools SET name = ?, sku = ?, quantity = ?, location = ?, category = ?, description = ?, barcode = ?, qr_code = ?, serial_number = ?, serial_unreadable = ?, inventory_number = ?, inspection_date = ?, min_stock = ?, max_stock = ?, is_consumable = ?, status = ?, manufacturer = ?, model = ?, production_year = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name, sku, quantity || 1, location, category, description, barcode || sku, qr_code || sku, serialProvided ? serial_number : null, unreadableFlag ? 1 : 0, inventory_number || null, inspection_date || null, minStockSan, maxStockSan, is_consumable ? 1 : 0, status || 'dostępne', manufacturer || null, model || null, prodYearSan, id],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed: tools.inventory_number')) {
          return res.status(400).json({ message: 'Tool with this inventory number already exists' });
        }
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ message: 'Tool with this SKU already exists' });
        }
        return res.status(500).json({ message: 'Server error', error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ message: 'Tool not found' });
      }
      res.status(200).json({ message: 'Tool updated successfully' });
    }
  );
});

// Delete tool endpoint
app.delete('/api/tools/:id', authenticateToken, (req, res) => {
  const id = req.params.id;

  db.run('DELETE FROM tools WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ message: 'Server error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'Tool not found' });
    }
    res.status(200).json({ message: 'Tool deleted successfully' });
  });
});

// Endpoint: send tool to service (quantity supported)
app.post('/api/tools/:id/service', authenticateToken, (req, res) => {
  const toolId = req.params.id;
  const { quantity, service_order_number } = req.body;

// Fetch current tool data
  db.get('SELECT id, quantity, COALESCE(service_quantity, 0) as service_quantity FROM tools WHERE id = ?', [toolId], (err, tool) => {
    if (err) {
      return res.status(500).json({ message: 'Server error', error: err.message });
    }
    if (!tool) {
      return res.status(404).json({ message: 'Tool not found' });
    }

    const sendQuantity = Math.max(1, parseInt(quantity || 1, 10));
    const availableForService = tool.quantity - tool.service_quantity;
    if (sendQuantity > availableForService) {
      return res.status(400).json({ message: `Cannot send more than ${availableForService} items` });
    }

    const newServiceQuantity = tool.service_quantity + sendQuantity;

// Determine new status: if total qty is 1 and something sent → 'service'; otherwise leave unchanged
    let updateStatusSql = '';
    let updateParams = [newServiceQuantity, new Date().toISOString(), toolId];
    if (tool.quantity === 1 && newServiceQuantity >= 1) {
      updateStatusSql = ', status = ?';
      updateParams = [newServiceQuantity, new Date().toISOString(), 'serwis', toolId];
    }

// Also update service order number (if provided)
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
          return res.status(500).json({ message: 'Server error' });
        }

// Return updated tool
        db.get('SELECT * FROM tools WHERE id = ?', [toolId], (getErr, updatedTool) => {
          if (getErr) {
            return res.status(500).json({ message: 'Error fetching updated tool' });
          }
          res.status(200).json({ 
            message: `Sent ${sendQuantity} item(s) to service${service_order_number ? ` (order: ${service_order_number})` : ''}`, 
            tool: updatedTool 
          });
        });
      }
    );
  });
});

// Tool service receive endpoint (quantity handling)
app.post('/api/tools/:id/service/receive', authenticateToken, (req, res) => {
  const toolId = req.params.id;
  const { quantity } = req.body || {};

  // Fetch current tool data
  db.get('SELECT id, quantity, COALESCE(service_quantity, 0) as service_quantity, service_order_number FROM tools WHERE id = ?', [toolId], (err, tool) => {
    if (err) {
      return res.status(500).json({ message: 'Server error' });
    }
    if (!tool) {
      return res.status(404).json({ message: 'Tool not found' });
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
        return res.status(500).json({ message: 'Server error' });
      }

// Save receipt history
      db.run(
        'INSERT INTO tool_service_history (tool_id, action, quantity, order_number) VALUES (?, ?, ?, ?)',
        [toolId, 'received', receiveQuantity, tool.service_order_number || null],
        function(histErr) {
          if (histErr) {
            return res.status(500).json({ message: 'Server error' });
          }

// Return updated tool
          db.get('SELECT * FROM tools WHERE id = ?', [toolId], (getErr, updatedTool) => {
            if (getErr) {
              return res.status(500).json({ message: 'Error fetching updated tool' });
            }
            res.status(200).json({ 
              message: `Received ${receiveQuantity} item(s) from service`,
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
      return res.status(500).json({ message: 'Server error' });
    }
    db.all(recentEventsQuery, [], (err2, events) => {
      if (err2) {
        return res.status(500).json({ message: 'Server error' });
      }
      res.json({ in_service: inService, recent_events: events });
    });
  });
});

// ====== BHP Endpoints ======
// Fetch PPE equipment
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
      return res.status(500).json({ message: 'Server error' });
    }
    res.status(200).json(items);
  });
});

// Add BHP equipment
app.post('/api/bhp', authenticateToken, requirePermission('MANAGE_BHP'), (req, res) => {
  const { inventory_number, manufacturer, model, serial_number, catalog_number, production_date, inspection_date, is_set, shock_absorber_serial, shock_absorber_name, shock_absorber_model, shock_absorber_catalog_number, harness_start_date, shock_absorber_start_date, shock_absorber_production_date, srd_manufacturer, srd_model, srd_serial_number, srd_catalog_number, srd_production_date, status } = req.body;

  if (!inventory_number) {
    return res.status(400).json({ message: 'Inventory number is required' });
  }

  const query = `INSERT INTO bhp (inventory_number, manufacturer, model, serial_number, catalog_number, production_date, inspection_date, is_set, shock_absorber_serial, shock_absorber_name, shock_absorber_model, shock_absorber_catalog_number, harness_start_date, shock_absorber_start_date, shock_absorber_production_date, srd_manufacturer, srd_model, srd_serial_number, srd_catalog_number, srd_production_date, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const params = [inventory_number, manufacturer, model, serial_number, catalog_number, production_date, inspection_date, is_set ? 1 : 0, shock_absorber_serial, shock_absorber_name, shock_absorber_model, shock_absorber_catalog_number, harness_start_date, shock_absorber_start_date, shock_absorber_production_date, srd_manufacturer, srd_model, srd_serial_number, srd_catalog_number, srd_production_date, status || 'dostępne'];

  db.run(query, params, function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ message: 'An item with this inventory number already exists' });
      }
      return res.status(500).json({ message: 'Server error' });
    }
    db.get('SELECT * FROM bhp WHERE id = ?', [this.lastID], (err, item) => {
      if (err) return res.status(500).json({ message: 'Error fetching new item' });
      res.status(201).json(item);
    });
  });
});

// Update PPE equipment
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

// Do not overwrite existing values with NULL/"" if field not provided.
// For text fields treat empty string as no change.
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
        return res.status(400).json({ message: 'An item with this inventory number already exists' });
      }
      return res.status(500).json({ message: 'Server error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'BHP item not found' });
    }
// Return updated record for easier verification
    db.get('SELECT * FROM bhp WHERE id = ?', [id], (getErr, row) => {
      if (getErr) {
        return res.status(500).json({ message: 'Error fetching updated item' });
      }
      res.status(200).json({ message: 'BHP item updated', item: row });
    });
  });
});

// Delete PPE equipment
app.delete('/api/bhp/:id', authenticateToken, requirePermission('MANAGE_BHP'), (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM bhp WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ message: 'Server error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'BHP item not found' });
    }
    res.status(200).json({ message: 'BHP item deleted' });
  });
});

// Issue PPE item to employee (single piece)
app.post('/api/bhp/:id/issue', authenticateToken, requirePermission('MANAGE_BHP'), (req, res) => {
  const bhpId = req.params.id;
  const { employee_id } = req.body;
  const userId = req.user.id;

  if (!employee_id) {
    return res.status(400).json({ message: 'Employee ID is required' });
  }

  db.get('SELECT * FROM bhp WHERE id = ?', [bhpId], (err, item) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (!item) return res.status(404).json({ message: 'BHP item not found' });
    if (item.status === 'wydane') return res.status(400).json({ message: 'BHP item already issued' });

    db.get('SELECT * FROM employees WHERE id = ?', [employee_id], (err, employee) => {
      if (err) return res.status(500).json({ message: 'Server error' });
      if (!employee) return res.status(404).json({ message: 'Employee not found' });

      db.run(
        'INSERT INTO bhp_issues (bhp_id, employee_id, issued_by_user_id) VALUES (?, ?, ?)',
        [bhpId, employee_id, userId],
        function(err) {
          if (err) return res.status(500).json({ message: 'Server error' });
          db.run('UPDATE bhp SET status = ? WHERE id = ?', ['wydane', bhpId], function(err) {
            if (err) return res.status(500).json({ message: 'Server error' });
            res.status(200).json({ message: 'BHP item issued', issue_id: this.lastID });
          });
        }
      );
    });
  });
});

// Return PPE equipment
app.post('/api/bhp/:id/return', authenticateToken, requirePermission('MANAGE_BHP'), (req, res) => {
  const bhpId = req.params.id;
  const { issue_id } = req.body;

  if (!issue_id) {
    return res.status(400).json({ message: 'Issue ID is required' });
  }

  db.get('SELECT * FROM bhp_issues WHERE id = ? AND bhp_id = ? AND status = "wydane"', [issue_id, bhpId], (err, issue) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (!issue) return res.status(404).json({ message: 'Issue not found or already returned' });

    db.run('UPDATE bhp_issues SET status = "zwrócone", returned_at = datetime("now") WHERE id = ?', [issue_id], function(err) {
      if (err) return res.status(500).json({ message: 'Server error' });
      db.run('UPDATE bhp SET status = ? WHERE id = ?', ['dostępne', bhpId], function(err) {
        if (err) return res.status(500).json({ message: 'Server error' });
        res.status(200).json({ message: 'BHP item returned' });
      });
    });
  });
});

// PPE details + active issues and inspection reminder status
app.get('/api/bhp/:id/details', authenticateToken, (req, res) => {
  const bhpId = req.params.id;

  db.get('SELECT * FROM bhp WHERE id = ?', [bhpId], (err, item) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (!item) return res.status(404).json({ message: 'BHP item not found' });

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
      if (err) return res.status(500).json({ message: 'Server error' });

// Compute days to inspection
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

// BHP issue/return history (all entries)
app.get('/api/bhp/:id/history', authenticateToken, requirePermission('VIEW_BHP_HISTORY'), (req, res) => {
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
    if (err) return res.status(500).json({ message: 'Server error' });
    res.json(rows);
  });
});

// === DEBUG: List registered routes at startup ===
setTimeout(() => {
  try {
    const routes = [];
    if (app && app._router && app._router.stack) {
      app._router.stack.forEach((middleware) => {
        if (middleware.route) {
          const methods = Object.keys(middleware.route.methods)
            .filter((m) => middleware.route.methods[m])
            .map((m) => m.toUpperCase())
            .join(',');
          routes.push(`${methods} ${middleware.route.path}`);
        }
      });
    }
    console.log('Registered routes:', routes);
  } catch (e) {
    console.log('Error while listing routes:', e.message);
  }
}, 1000);

// Employees fetch endpoint
app.get('/api/employees', authenticateToken, (req, res) => {
  db.all('SELECT * FROM employees', [], (err, employees) => {
    if (err) {
      return res.status(500).json({ message: 'Server error' });
    }
    res.status(200).json(employees);
  });
});

// Add employee endpoint
app.post('/api/employees', authenticateToken, requirePermission('MANAGE_EMPLOYEES'), (req, res) => {
  const { first_name, last_name, phone, position, department, brand_number, email } = req.body;

  if (!first_name || !last_name || !position || !department) {
    return res.status(400).json({ message: 'First name, last name, position, and department are required' });
  }

  db.run(
    'INSERT INTO employees (first_name, last_name, phone, position, department, brand_number, email) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [first_name, last_name, phone, position, department, brand_number, email || null],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Server error' });
      }
      const employeeId = this.lastID;
      const fullName = `${first_name} ${last_name}`;
      generateEmployeeLogin(first_name, last_name, (loginErr, username) => {
        if (loginErr || !username) {
          console.error('Error generating login:', loginErr?.message || 'unknown');
          // Despite login generation error, return the employee
          return res.status(201).json({ message: 'Employee added', id: employeeId });
        }

        const rawPassword = generateRandomPassword(10);
        const hashedPassword = bcrypt.hashSync(rawPassword, 10);

        // Insert into users
        db.run(
          'INSERT INTO users (username, password, role, full_name, created_at, updated_at) VALUES (?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'))',
          [username, hashedPassword, 'employee', fullName],
          function(userErr) {
            if (userErr) {
              console.error('Error adding user for employee:', userErr.message);
              // Continue despite user creation error
            }

            // Update employee with login
            db.run('UPDATE employees SET login = ? WHERE id = ?', [username, employeeId], (updErr) => {
              if (updErr) {
                console.error('Error updating employee login:', updErr.message);
              }

              // Attempt email sending
              sendCredentialsEmail(email, username, rawPassword, fullName, (mailErr) => {
                if (mailErr) {
                  console.warn('Failed to send credentials email');
                }
                // Return full employee record after login update
                db.get('SELECT * FROM employees WHERE id = ?', [employeeId], (selErr, row) => {
                  if (selErr || !row) {
                    // Fallback: return basic info
                    return res.status(201).json({ 
                      message: 'Employee added',
                      id: employeeId,
                      login: username
                    });
                  }
                  return res.status(201).json(row);
                });
              });
            });
          }
        );
      });
    }
  );
});

// Update employee endpoint
app.put('/api/employees/:id', authenticateToken, requirePermission('MANAGE_EMPLOYEES'), (req, res) => {
  const { first_name, last_name, phone, position, department, brand_number, email } = req.body;
  const id = req.params.id;

  if (!first_name || !last_name || !position || !department) {
    return res.status(400).json({ message: 'First name, last name, position, and department are required' });
  }

  db.run(
    'UPDATE employees SET first_name = ?, last_name = ?, phone = ?, position = ?, department = ?, brand_number = ?, email = ? WHERE id = ?',
    [first_name, last_name, phone, position, department, brand_number, email || null, id],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Server error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ message: 'Employee not found' });
      }
      db.get('SELECT * FROM employees WHERE id = ?', [id], (selErr, row) => {
        if (selErr || !row) {
          return res.status(200).json({ message: 'Employee updated' });
        }
        res.status(200).json(row);
      });
    }
  );
});

// Delete employee endpoint
app.delete('/api/employees/:id', authenticateToken, requirePermission('MANAGE_EMPLOYEES'), (req, res) => {
  const id = req.params.id;

  db.run('DELETE FROM employees WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ message: 'Server error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    res.status(200).json({ message: 'Employee deleted' });
  });
});

// Endpoint: delete all employees
app.delete('/employees/all', authenticateToken, (req, res) => {
// Check administrator permissions
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Insufficient permissions' });
  }

  console.log('Rozpoczęcie usuwania wszystkich pracowników...');

  db.run('DELETE FROM employees', function(err) {
    if (err) {
      console.error('Błąd podczas usuwania pracowników:', err);
      return res.status(500).json({ message: 'Server error while deleting employees' });
    }
    
    console.log(`Usunięto ${this.changes} pracowników`);
    
    // Dodaj wpis do dziennika audytu
    const auditQuery = `
      INSERT INTO audit_logs (user_id, username, action, details, timestamp)
      VALUES (?, ?, ?, ?, datetime('now'))
    `;

    db.run(auditQuery, [
      req.user.id,
      req.user.username,
      'DELETE_ALL_EMPLOYEES',
      `Usunięto wszystkich pracowników (${this.changes} rekordów)`
    ], (auditErr) => {
      if (auditErr) {
        console.error('Błąd podczas dodawania wpisu do dziennika audytu:', auditErr);
      }
    });
    
    res.status(200).json({ 
      message: 'All employees have been deleted',
      deletedCount: this.changes
    });
  });
});

// Endpoint: generate logins for employees without a login (admin / MANAGE_EMPLOYEES)
app.post('/api/employees/generate-logins', authenticateToken, requirePermission('MANAGE_EMPLOYEES'), (req, res) => {
  db.all('SELECT * FROM employees WHERE login IS NULL OR login = ""', [], (err, employees) => {
    if (err) {
      return res.status(500).json({ message: 'Server error while fetching employees' });
    }
    if (!employees || employees.length === 0) {
      return res.status(200).json({ message: 'No employees without a login', created: 0, results: [] });
    }

    const results = [];
    let processed = 0;

    const processNext = () => {
      if (processed >= employees.length) {
        return res.status(200).json({ message: 'Generation completed', created: results.filter(r => r.success).length, results });
      }

      const emp = employees[processed++];
      const first_name = emp.first_name || '';
      const last_name = emp.last_name || '';
      const fullName = `${first_name} ${last_name}`.trim();

      generateEmployeeLogin(first_name, last_name, (loginErr, username) => {
        if (loginErr || !username) {
          results.push({ employee_id: emp.id, success: false, error: `Login generation error: ${loginErr?.message || 'unknown'}` });
          return processNext();
        }

        const rawPassword = generateRandomPassword(10);
        const hashedPassword = bcrypt.hashSync(rawPassword, 10);

        db.run(
          'INSERT INTO users (username, password, role, full_name, created_at, updated_at) VALUES (?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'))',
          [username, hashedPassword, 'employee', fullName],
          function(userErr) {
            if (userErr) {
              results.push({ employee_id: emp.id, success: false, username, error: `Error adding user: ${userErr.message}` });
              return processNext();
            }

            db.run('UPDATE employees SET login = ? WHERE id = ?', [username, emp.id], (updErr) => {
              if (updErr) {
                results.push({ employee_id: emp.id, success: false, username, error: `Error updating employee: ${updErr.message}` });
                return processNext();
              }

              // Attempt to send login credentials email if an address is provided
              sendCredentialsEmail(emp.email, username, rawPassword, fullName, (mailErr) => {
                results.push({ employee_id: emp.id, success: true, username, emailSent: !mailErr && !!emp.email });
                return processNext();
              });
            });
          }
        );
      });
    };

    processNext();
  });
});

// Send login credentials for a single employee (creates login if missing, resets password if existing)
app.post('/api/employees/:id/send-credentials', authenticateToken, requirePermission('MANAGE_EMPLOYEES'), (req, res) => {
  const employeeId = parseInt(req.params.id, 10);
  if (!employeeId) {
    return res.status(400).json({ message: 'Invalid employee ID' });
  }
  db.get('SELECT id, first_name, last_name, email, login FROM employees WHERE id = ?', [employeeId], (err, emp) => {
    if (err) {
      console.error('Error fetching employee:', err.message);
      return res.status(500).json({ message: 'Server error' });
    }
    if (!emp) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    if (!emp.email) {
// Audit attempt to send without email address
      const auditQuery = `INSERT INTO audit_logs (user_id, username, action, details, ip_address, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))`;
      db.run(auditQuery, [
        req.user.id,
        req.user.username,
        'EMPLOYEE_SEND_CREDENTIALS',
        `Attempted to send credentials for employee ID=${employeeId} without an email address`,
        req.ip || 'localhost'
      ], (auditErr) => {
        if (auditErr) {
          console.error('Audit error (no email):', auditErr);
        }
      });
      return res.status(400).json({ message: 'Employee has no email address' });
    }
    const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim();

    const proceed = (username, rawPassword, createdLogin) => {
      sendCredentialsEmail(emp.email, username, rawPassword, fullName, (mailErr) => {
        if (mailErr) {
          console.error('Error sending credentials:', mailErr.message || mailErr);
        }
        db.get('SELECT * FROM employees WHERE id = ?', [employeeId], (err2, updated) => {
          if (err2) {
            console.error('Error fetching updated employee:', err2.message);
// Audit sending login credentials (even if fetching employee update failed)
            const auditQuery = `INSERT INTO audit_logs (user_id, username, action, details, ip_address, created_at)
              VALUES (?, ?, ?, ?, ?, datetime('now'))`;
            const details = `Sent credentials: employeeId=${employeeId}, login=${username}, emailSent=${!mailErr}, createdLogin=${createdLogin}`;
            db.run(auditQuery, [req.user.id, req.user.username, 'EMPLOYEE_SEND_CREDENTIALS', details, req.ip || 'localhost'], (auditErr) => {
              if (auditErr) console.error('Audit error (send-credentials):', auditErr);
            });
            return res.json({ ok: true, emailSent: !mailErr, createdLogin, login: username });
          }
// Audit login credentials sending
          const auditQuery = `INSERT INTO audit_logs (user_id, username, action, details, ip_address, created_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))`;
          const details = `Sent credentials: employeeId=${employeeId}, login=${username}, emailSent=${!mailErr}, createdLogin=${createdLogin}`;
          db.run(auditQuery, [req.user.id, req.user.username, 'EMPLOYEE_SEND_CREDENTIALS', details, req.ip || 'localhost'], (auditErr) => {
            if (auditErr) console.error('Audit error (send-credentials):', auditErr);
          });
          return res.json({ ok: true, emailSent: !mailErr, createdLogin, login: username, employee: updated });
        });
      });
    };

    if (!emp.login) {
      generateEmployeeLogin(emp.first_name || '', emp.last_name || '', (genErr, username) => {
        if (genErr || !username) {
          console.error('Login generation error:', genErr?.message || genErr);
          return res.status(500).json({ message: 'Failed to generate login' });
        }
        const rawPassword = generateRandomPassword(10);
        const hashedPassword = bcrypt.hashSync(rawPassword, 10);
        db.run(
          'INSERT INTO users (username, password, role, full_name, created_at, updated_at) VALUES (?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'))',
          [username, hashedPassword, 'employee', fullName],
          function (insErr) {
            if (insErr) {
              console.error('Error creating user:', insErr.message);
              return res.status(500).json({ message: 'Failed to create user' });
            }
            db.run('UPDATE employees SET login = ? WHERE id = ?', [username, employeeId], function (updErr) {
              if (updErr) {
                console.error('Error updating employee login:', updErr.message);
                return res.status(500).json({ message: 'Failed to update employee' });
              }
              proceed(username, rawPassword, true);
            });
          }
        );
      });
      return;
    }

    const username = String(emp.login);
    const rawPassword = generateRandomPassword(10);
    const hashedPassword = bcrypt.hashSync(rawPassword, 10);
    db.get('SELECT id FROM users WHERE username = ?', [username], (uErr, userRow) => {
      if (uErr) {
        console.error('Error finding user:', uErr.message);
        return res.status(500).json({ message: 'Server error' });
      }
      const upsert = (cb) => {
        if (!userRow) {
          db.run(
            'INSERT INTO users (username, password, role, full_name, created_at, updated_at) VALUES (?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'))',
            [username, hashedPassword, 'employee', fullName],
            function (insErr) { return cb(insErr); }
          );
        } else {
          db.run(
            'UPDATE users SET password = ?, updated_at = datetime(\'now\') WHERE username = ?',
            [hashedPassword, username],
            function (updErr) { return cb(updErr); }
          );
        }
      };
      upsert((saveErr) => {
        if (saveErr) {
          console.error('Error saving password:', saveErr.message);
          return res.status(500).json({ message: 'Failed to save password' });
        }
        proceed(username, rawPassword, false);
      });
    });
  });
});

// Endpoint to delete issue and return history
app.delete('/tools/history', authenticateToken, requirePermission('DELETE_ISSUE_HISTORY'), (req, res) => {
  console.log('Starting deletion of issue and return history...');

  db.serialize(() => {
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) {
        console.error('Error starting transaction:', err);
        return res.status(500).json({ message: 'Server error' });
      }

// Delete all records from tool_issues table
      db.run('DELETE FROM tool_issues', function(err) {
        if (err) {
          console.error('Error deleting from tool_issues table:', err);
          db.run('ROLLBACK');
          return res.status(500).json({ message: 'Error deleting issue history' });
        }

        const deletedIssues = this.changes;
        console.log(`Deleted ${deletedIssues} records from tool_issues`);

// Reset all tools' status to 'available'
        db.run('UPDATE tools SET status = ? WHERE status != ?', ['dostępne', 'dostępne'], function(err) {
          if (err) {
            console.error('Error resetting tool statuses:', err);
            db.run('ROLLBACK');
            return res.status(500).json({ message: 'Error resetting tool statuses' });
          }

          const updatedTools = this.changes;
          console.log(`Updated status of ${updatedTools} tools to 'available'`);

// Commit transaction
          db.run('COMMIT', (err) => {
            if (err) {
              console.error('Error committing transaction:', err);
              return res.status(500).json({ message: 'Error committing operation' });
            }

            console.log('Issue and return history successfully deleted');
            res.json({ 
              message: 'Issue and return history successfully deleted',
              deleted_issues: deletedIssues,
              updated_tools: updatedTools
            });
          });
        });
      });
    });
  });
});

// Endpoint to delete tool ISSUE history (only entries with status "wydane")
app.delete('/api/tools/history/issues', authenticateToken, requirePermission('DELETE_ISSUE_HISTORY'), (req, res) => {
  console.log('Deleting tool ISSUE history...');

  db.serialize(() => {
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) {
        console.error('Error starting transaction (issues tools):', err);
        return res.status(500).json({ message: 'Server error' });
      }

      db.run('DELETE FROM tool_issues WHERE status = "wydane"', function(err) {
        if (err) {
          console.error('Error deleting ISSUE entries from tool_issues:', err);
          db.run('ROLLBACK');
          return res.status(500).json({ message: 'Error deleting tool issue history' });
        }

        const deletedCount = this.changes || 0;
        console.log(`Deleted ${deletedCount} ISSUE records from tool_issues`);

        // After deleting all ISSUES, tool status should be available
        db.run('UPDATE tools SET status = ? WHERE status != ?', ['dostępne', 'dostępne'], function(err) {
          if (err) {
            console.error('Error resetting tool statuses after deleting issues:', err);
            db.run('ROLLBACK');
            return res.status(500).json({ message: 'Error resetting tool statuses' });
          }

          const auditQuery = `
            INSERT INTO audit_logs (user_id, username, action, details, timestamp)
            VALUES (?, ?, ?, ?, datetime('now'))
          `;
          db.run(
            auditQuery,
            [
              req.user.id,
              req.user.username,
              'DELETE_ISSUE_HISTORY',
              `Deleted tool ISSUE history (${deletedCount} records)`
            ],
            (auditErr) => {
              if (auditErr) {
                console.error('Error adding entry to audit log:', auditErr);
              }
              db.run('COMMIT', (commitErr) => {
                if (commitErr) {
                  console.error('Error committing transaction (issues tools):', commitErr);
                  return res.status(500).json({ message: 'Error committing operation' });
                }
                res.json({
                  message: 'Deleted tool ISSUE history',
                  deleted_count: deletedCount
                });
              });
            }
          );
        });
      });
    });
  });
});

// Endpoint: delete tool RETURN history (only entries with status 'returned')
app.delete('/api/tools/history/returns', authenticateToken, requirePermission('DELETE_RETURN_HISTORY'), (req, res) => {
  console.log('Deleting tool RETURN history...');

  db.serialize(() => {
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) {
        console.error('Error starting transaction (returns tools):', err);
        return res.status(500).json({ message: 'Server error' });
      }

      db.run('DELETE FROM tool_issues WHERE status = "zwrócone"', function(err) {
        if (err) {
          console.error('Error deleting RETURN entries from tool_issues:', err);
          db.run('ROLLBACK');
          return res.status(500).json({ message: 'Error deleting tool return history' });
        }

        const deletedCount = this.changes || 0;
        console.log(`Deleted ${deletedCount} RETURN records from tool_issues`);

        const auditQuery = `
          INSERT INTO audit_logs (user_id, username, action, details, timestamp)
          VALUES (?, ?, ?, ?, datetime('now'))
        `;

        db.run(
          auditQuery,
          [
            req.user.id,
            req.user.username,
            'DELETE_RETURN_HISTORY',
            `Usunięto historię ZWROTÓW narzędzi (${deletedCount} rekordów)`
          ],
          (auditErr) => {
            if (auditErr) {
              console.error('Error adding entry to audit log:', auditErr);
            }
            db.run('COMMIT', (commitErr) => {
              if (commitErr) {
                console.error('Error committing transaction (returns tools):', commitErr);
                return res.status(500).json({ message: 'Error committing operation' });
              }
              res.json({
                message: 'Deleted tool RETURN history',
                deleted_count: deletedCount
              });
            });
          }
        );
      });
    });
  });
});

// Endpoint to delete BHP ISSUE history
app.delete('/api/bhp/history/issues', authenticateToken, requirePermission('DELETE_ISSUE_HISTORY'), (req, res) => {
  console.log('Deleting BHP ISSUE history...');

  db.serialize(() => {
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) {
        console.error('Error starting transaction (issues bhp):', err);
        return res.status(500).json({ message: 'Server error' });
      }

      db.run('DELETE FROM bhp_issues WHERE status = "wydane"', function(err) {
        if (err) {
          console.error('Error deleting ISSUE entries from bhp_issues:', err);
          db.run('ROLLBACK');
          return res.status(500).json({ message: 'Error deleting BHP issue history' });
        }

        const deletedCount = this.changes || 0;
        console.log(`Deleted ${deletedCount} ISSUE records from bhp_issues`);

        db.run('UPDATE bhp SET status = ? WHERE status != ?', ['dostępne', 'dostępne'], function(err) {
          if (err) {
            console.error('Error resetting BHP statuses after deleting issues:', err);
            db.run('ROLLBACK');
            return res.status(500).json({ message: 'Error resetting BHP statuses' });
          }

          const auditQuery = `
            INSERT INTO audit_logs (user_id, username, action, details, timestamp)
            VALUES (?, ?, ?, ?, datetime('now'))
          `;
          db.run(
            auditQuery,
            [
              req.user.id,
              req.user.username,
              'DELETE_ISSUE_HISTORY',
              `Deleted BHP ISSUE history (${deletedCount} records)`
            ],
            (auditErr) => {
              if (auditErr) {
                console.error('Error adding entry to audit log:', auditErr);
              }
              db.run('COMMIT', (commitErr) => {
                if (commitErr) {
                  console.error('Error committing transaction (issues bhp):', commitErr);
                  return res.status(500).json({ message: 'Error committing operation' });
                }
                res.json({
                  message: 'Deleted BHP ISSUE history',
                  deleted_count: deletedCount
                });
              });
            }
          );
        });
      });
    });
  });
});

// Endpoint to delete BHP RETURN history
app.delete('/api/bhp/history/returns', authenticateToken, requirePermission('DELETE_RETURN_HISTORY'), (req, res) => {
  console.log('Deleting BHP RETURN history...');

  db.serialize(() => {
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) {
        console.error('Error starting transaction (returns bhp):', err);
        return res.status(500).json({ message: 'Server error' });
      }

      db.run('DELETE FROM bhp_issues WHERE status = "zwrócone"', function(err) {
        if (err) {
          console.error('Error deleting RETURN entries from bhp_issues:', err);
          db.run('ROLLBACK');
          return res.status(500).json({ message: 'Error deleting BHP return history' });
        }

        const deletedCount = this.changes || 0;
        console.log(`Deleted ${deletedCount} RETURN records from bhp_issues`);

        const auditQuery = `
          INSERT INTO audit_logs (user_id, username, action, details, timestamp)
          VALUES (?, ?, ?, ?, datetime('now'))
        `;

        db.run(
          auditQuery,
          [
            req.user.id,
            req.user.username,
            'DELETE_RETURN_HISTORY',
            `Deleted BHP RETURN history (${deletedCount} records)`
          ],
          (auditErr) => {
            if (auditErr) {
              console.error('Error adding entry to audit log:', auditErr);
            }
            db.run('COMMIT', (commitErr) => {
              if (commitErr) {
                console.error('Error committing transaction (returns bhp):', commitErr);
                return res.status(500).json({ message: 'Error committing operation' });
              }
              res.json({
                message: 'Deleted BHP RETURN history',
                deleted_count: deletedCount
              });
            });
          }
        );
      });
    });
  });
});

// Endpoint do usuwania historii serwisowania
app.delete('/api/service-history', authenticateToken, requirePermission('DELETE_SERVICE_HISTORY'), (req, res) => {
  console.log('Starting deletion of service history...');

  db.run('DELETE FROM tool_service_history', function(err) {
    if (err) {
      console.error('Error deleting service history:', err);
      return res.status(500).json({ message: 'Server error while deleting service history' });
    }

    const deletedCount = this.changes || 0;
    console.log(`Deleted ${deletedCount} records from table tool_service_history`);

    const auditQuery = `
      INSERT INTO audit_logs (user_id, username, action, details, timestamp)
      VALUES (?, ?, ?, ?, datetime('now'))
    `;

    db.run(
      auditQuery,
      [
        req.user.id,
        req.user.username,
        'DELETE_SERVICE_HISTORY',
        `Deleted service history (${deletedCount} records)`
      ],
      (auditErr) => {
        if (auditErr) {
          console.error('Error adding audit log entry:', auditErr);
        }
        return res.status(200).json({
          message: 'Service history deleted',
          deleted_count: deletedCount
        });
      }
    );
  });
});

// Uruchomienie serwera
// Endpoints for user management

// Fetch all users
app.get('/api/users', authenticateToken, (req, res) => {
  db.all('SELECT id, username, role, full_name, created_at, updated_at FROM users ORDER BY created_at DESC', (err, users) => {
    if (err) {
      console.error('Error fetching users:', err.message);
      res.status(500).json({ error: 'Server error' });
    } else {
      res.json(users);
    }
  });
});

// Add new user
app.post('/api/users', authenticateToken, (req, res) => {
  const { username, password, role, full_name } = req.body;

  if (!username || !password || !role || !full_name) {
    return res.status(400).json({ error: 'All fields are required' });
  }

// Check if user already exists
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, existingUser) => {
    if (err) {
      console.error('Error checking user:', err.message);
      return res.status(500).json({ error: 'Server error' });
    }

    if (existingUser) {
      return res.status(400).json({ error: 'A user with this username already exists' });
    }

// Hash password
    const hashedPassword = bcrypt.hashSync(password, 10);

// Insert user
    db.run('INSERT INTO users (username, password, role, full_name, created_at, updated_at) VALUES (?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'))', 
      [username, hashedPassword, role, full_name], 
      function(err) {
        if (err) {
          console.error('Error adding user:', err.message);
          res.status(500).json({ error: 'Error adding user' });
        } else {
// Fetch inserted user
          db.get('SELECT id, username, role, full_name, created_at, updated_at FROM users WHERE id = ?', [this.lastID], (err, newUser) => {
            if (err) {
              console.error('Error fetching new user:', err.message);
              res.status(500).json({ error: 'Server error' });
            } else {
              res.status(201).json(newUser);
            }
          });
        }
      });
  });
});

// Update user
app.put('/api/users/:id', authenticateToken, (req, res) => {
  const userId = req.params.id;
  const { username, password, role, full_name } = req.body;

  if (!username || !role || !full_name) {
    return res.status(400).json({ error: 'Username, role, and full name are required' });
  }

// Check if user exists
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      console.error('Error checking user:', err.message);
      return res.status(500).json({ error: 'Server error' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Przygotuj zapytanie aktualizacji
    let updateQuery = 'UPDATE users SET role = ?, full_name = ?, updated_at = datetime(\'now\')';
    let params = [role, full_name];

// If new password provided, include it in update
    if (password && password.trim() !== '') {
      const hashedPassword = bcrypt.hashSync(password, 10);
      updateQuery += ', password = ?';
      params.push(hashedPassword);
    }

    updateQuery += ' WHERE id = ?';
    params.push(userId);

// Perform update
    db.run(updateQuery, params, function(err) {
      if (err) {
        console.error('Error updating user:', err.message);
        res.status(500).json({ error: 'Error updating user' });
      } else {
// Fetch updated user
        db.get('SELECT id, username, role, full_name, created_at, updated_at FROM users WHERE id = ?', [userId], (err, updatedUser) => {
          if (err) {
            console.error('Error fetching updated user:', err.message);
            res.status(500).json({ error: 'Server error' });
          } else {
            res.json(updatedUser);
          }
        });
      }
    });
  });
});

// Delete user
app.delete('/api/users/:id', authenticateToken, (req, res) => {
  const userId = req.params.id;

// Check if user exists
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      console.error('Error checking user:', err.message);
      return res.status(500).json({ error: 'Server error' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

// Delete user
    db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
      if (err) {
        console.error('Error deleting user:', err.message);
        res.status(500).json({ error: 'Error deleting user' });
      } else {
        res.json({ message: 'User deleted', deletedId: userId });
      }
    });
  });
});

// API endpoints for departments
app.get('/api/departments', authenticateToken, (req, res) => {
  db.all('SELECT * FROM departments ORDER BY name', (err, rows) => {
    if (err) {
      console.error('Error fetching departments:', err.message);
      res.status(500).json({ error: 'Server error' });
    } else {
      res.json(rows);
    }
  });
});

app.post('/api/departments', authenticateToken, (req, res) => {
  const { name, description, manager_id, status } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Department name is required' });
  }
// Validation: if manager_id provided, verify employee with that ID exists
  const insertDepartment = () => {
    db.run(
      'INSERT INTO departments (name, description, manager_id, status) VALUES (?, ?, ?, COALESCE(?, "active"))',
      [name.trim(), description || null, manager_id || null, status || null],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            res.status(400).json({ error: 'A department with this name already exists' });
          } else {
            console.error('Error adding department:', err.message);
            res.status(500).json({ error: 'Server error' });
          }
        } else {
          db.get('SELECT * FROM departments WHERE id = ?', [this.lastID], (err, row) => {
            if (err) {
              return res.status(500).json({ error: 'Error fetching department data' });
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
          console.error('Error verifying manager_id:', err.message);
          return res.status(500).json({ error: 'Server error' });
        }
        if (!emp) {
          return res.status(400).json({ error: 'Invalid manager_id: employee does not exist' });
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
    return res.status(400).json({ error: 'Department name is required' });
  }
  const updateDepartment = () => {
    db.run(
      'UPDATE departments SET name = ?, description = ?, manager_id = ?, status = COALESCE(?, status), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name.trim(), description || null, manager_id || null, status || null, id],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            res.status(400).json({ error: 'A department with this name already exists' });
          } else {
            console.error('Error updating department:', err.message);
            res.status(500).json({ error: 'Server error' });
          }
        } else if (this.changes === 0) {
          res.status(404).json({ error: 'Department not found' });
        } else {
          db.get('SELECT * FROM departments WHERE id = ?', [id], (err, row) => {
            if (err) {
              return res.status(500).json({ error: 'Error fetching department data' });
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
          console.error('Error verifying manager_id:', err.message);
          return res.status(500).json({ error: 'Server error' });
        }
        if (!emp) {
          return res.status(400).json({ error: 'Invalid manager_id: employee does not exist' });
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
// First fetch the department name to detach employees
  db.get('SELECT id, name FROM departments WHERE id = ?', [id], (err, dept) => {
    if (err) {
      console.error('Error finding department:', err.message);
      return res.status(500).json({ error: 'Server error' });
    }
    if (!dept) {
      return res.status(404).json({ error: 'Department not found' });
    }

// Set employees' department to '-' for those assigned to the deleted department
    db.run('UPDATE employees SET department = ? WHERE department = ?', ['-', dept.name], function(updateErr) {
      if (updateErr) {
        console.error('Error detaching employees from department:', updateErr.message);
        return res.status(500).json({ error: 'Server error while detaching employees' });
      }

      const detachedCount = this.changes || 0;

// Then delete the department
      db.run('DELETE FROM departments WHERE id = ?', [id], function(deleteErr) {
      if (deleteErr) {
        console.error('Error deleting department:', deleteErr.message);
        return res.status(500).json({ error: 'Server error' });
      }
      res.json({ message: 'Department deleted successfully', detachedEmployees: detachedCount });
      });
    });
  });
});

// Delete department by name (handles items 'missing in DB')
app.delete('/api/departments/by-name/:name', authenticateToken, (req, res) => {
  const { name } = req.params;
  const normalized = (name || '').trim();
  if (!normalized) {
    return res.status(400).json({ error: 'Department name is required' });
  }

// Detach employees assigned to this department (case-insensitive)
  db.run('UPDATE employees SET department = ? WHERE LOWER(department) = LOWER(?)', ['-', normalized], function(updateErr) {
    if (updateErr) {
      console.error('Error detaching employees from department (by-name):', updateErr.message);
      return res.status(500).json({ error: 'Server error while detaching employees' });
    }

    const detachedCount = this.changes || 0;

// If a department record exists with this name, delete it as well
    db.get('SELECT id FROM departments WHERE LOWER(name) = LOWER(?)', [normalized], (findErr, dept) => {
      if (findErr) {
        console.error('Error finding department by name:', findErr.message);
        return res.status(500).json({ error: 'Server error' });
      }
      if (!dept) {
        return res.json({ message: 'Odczepiono pracowników od działu (rekord nie istnieje)', detachedEmployees: detachedCount, deleted: false });
      }
      db.run('DELETE FROM departments WHERE id = ?', [dept.id], function(deleteErr) {
        if (deleteErr) {
          console.error('Error deleting department by name:', deleteErr.message);
          return res.status(500).json({ error: 'Server error' });
        }
        res.json({ message: 'Department deleted successfully (by-name)', detachedEmployees: detachedCount, deleted: true });
      });
    });
  });
});

// API endpoints for positions
app.get('/api/positions', authenticateToken, (req, res) => {
  db.all('SELECT * FROM positions ORDER BY name', (err, rows) => {
    if (err) {
      console.error('Error fetching positions:', err.message);
      res.status(500).json({ error: 'Server error' });
    } else {
      res.json(rows);
    }
  });
});

app.post('/api/positions', authenticateToken, (req, res) => {
  const { name, description, department_id, requirements, status } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Position name is required' });
  }
  const insertPosition = () => {
    db.run(
      'INSERT INTO positions (name, description, department_id, requirements, status) VALUES (?, ?, ?, ?, COALESCE(?, "active"))',
      [name.trim(), description || null, department_id || null, requirements || null, status || null],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            res.status(400).json({ error: 'A position with this name already exists' });
          } else {
            console.error('Error adding position:', err.message);
            res.status(500).json({ error: 'Server error' });
          }
        } else {
          db.get('SELECT * FROM positions WHERE id = ?', [this.lastID], (err, row) => {
            if (err) {
              return res.status(500).json({ error: 'Error fetching position data' });
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
        console.error('Error verifying department_id:', err.message);
        return res.status(500).json({ error: 'Server error' });
      }
      if (!dept) {
        return res.status(400).json({ error: 'Invalid department_id: department does not exist' });
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
    return res.status(400).json({ error: 'Position name is required' });
  }
  const updatePosition = () => {
    db.run(
      'UPDATE positions SET name = ?, description = ?, department_id = ?, requirements = ?, status = COALESCE(?, status), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name.trim(), description || null, department_id || null, requirements || null, status || null, id],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            res.status(400).json({ error: 'A position with this name already exists' });
          } else {
            console.error('Error updating position:', err.message);
            res.status(500).json({ error: 'Server error' });
          }
        } else if (this.changes === 0) {
          res.status(404).json({ error: 'Position not found' });
        } else {
          db.get('SELECT * FROM positions WHERE id = ?', [id], (err, row) => {
            if (err) {
              return res.status(500).json({ error: 'Error fetching position data' });
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
        console.error('Error verifying department_id:', err.message);
        return res.status(500).json({ error: 'Server error' });
      }
      if (!dept) {
        return res.status(400).json({ error: 'Invalid department_id: department does not exist' });
      }
      updatePosition();
    });
  } else {
    updatePosition();
  }
});

app.delete('/api/positions/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  // First fetch position name to detach associated employees
  db.get('SELECT id, name FROM positions WHERE id = ?', [id], (err, pos) => {
    if (err) {
      console.error('Error finding position:', err.message);
      return res.status(500).json({ error: 'Server error' });
    }
    if (!pos) {
      return res.status(404).json({ error: 'Position not found' });
    }

    // Set employees' position to '-' for those assigned to the deleted position
    db.run('UPDATE employees SET position = ? WHERE position = ?', ['-', pos.name], function(updateErr) {
      if (updateErr) {
        console.error('Error detaching employees from position:', updateErr.message);
        return res.status(500).json({ error: 'Server error while detaching employees' });
      }

      const detachedCount = this.changes || 0;

      // Then delete the position
      db.run('DELETE FROM positions WHERE id = ?', [id], function(deleteErr) {
        if (deleteErr) {
          console.error('Error deleting position:', deleteErr.message);
          return res.status(500).json({ error: 'Server error' });
        }
        res.json({ message: 'Position deleted successfully', detachedEmployees: detachedCount });
      });
    });
  });
});

// Delete position by name (handles items "missing in DB")
app.delete('/api/positions/by-name/:name', authenticateToken, (req, res) => {
  const { name } = req.params;
  const normalized = (name || '').trim();
  if (!normalized) {
    return res.status(400).json({ error: 'Position name is required' });
  }

  // Detach employees assigned to this position (case-insensitive)
  db.run('UPDATE employees SET position = ? WHERE LOWER(position) = LOWER(?)', ['-', normalized], function(updateErr) {
    if (updateErr) {
      console.error('Error detaching employees from position (by-name):', updateErr.message);
      return res.status(500).json({ error: 'Server error while detaching employees' });
    }

    const detachedCount = this.changes || 0;

    // If a position record exists with this name, delete it too
    db.get('SELECT id FROM positions WHERE LOWER(name) = LOWER(?)', [normalized], (findErr, pos) => {
      if (findErr) {
        console.error('Error finding position by name:', findErr.message);
        return res.status(500).json({ error: 'Server error' });
      }
      if (!pos) {
        return res.json({ message: 'Detached employees from position (record does not exist)', detachedEmployees: detachedCount, deleted: false });
      }
      db.run('DELETE FROM positions WHERE id = ?', [pos.id], function(deleteErr) {
        if (deleteErr) {
          console.error('Error deleting position by name:', deleteErr.message);
          return res.status(500).json({ error: 'Server error' });
        }
        res.json({ message: 'Position deleted successfully (by-name)', detachedEmployees: detachedCount, deleted: true });
      });
    });
  });
});

// ===== DASHBOARD STATISTICS ENDPOINT =====
// Dashboard statistics download endpoint
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

// Run all queries in parallel
  Object.entries(queries).forEach(([key, query]) => {
    db.get(query, [], (err, result) => {
      if (err) {
        console.error(`Błąd podczas pobierania ${key}:`, err.message);
stats[key] = 0; // Fallback to 0 in case of error
      } else {
        stats[key] = result.count;
      }
      
      completedQueries++;
      
// When all queries complete, send the response
      if (completedQueries === totalQueries) {
        res.json(stats);
      }
    });
  });
});

// ===== ENDPOINTY SYSTEMU AUDYTU =====
// Endpoint: fetch audit logs
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

// Filter by username
  if (username) {
    query += ` AND (al.username LIKE ? OR u.full_name LIKE ?)`;
    params.push(`%${username}%`, `%${username}%`);
  }

// Filter by start date
  if (startDate) {
    query += ` AND DATE(al.timestamp) >= DATE(?)`;
    params.push(startDate);
  }

// Filter by end date
  if (endDate) {
    query += ` AND DATE(al.timestamp) <= DATE(?)`;
    params.push(endDate);
  }

  query += ` ORDER BY al.timestamp DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));

  db.all(query, params, (err, logs) => {
    if (err) {
      console.error('Błąd podczas pobierania logów audytu:', err.message);
      return res.status(500).json({ message: 'Server error', error: err.message });
    }

// Get total record count for pagination
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
        return res.status(500).json({ message: 'Server error', error: err.message });
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
    return res.status(400).json({ message: 'Action is required' });
  }

  const query = `
    INSERT INTO audit_logs (user_id, username, action, details, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.run(query, [user_id, username, action, details || null, ip_address, user_agent], function(err) {
    if (err) {
      console.error('Błąd podczas dodawania wpisu audytu:', err.message);
      return res.status(500).json({ message: 'Server error', error: err.message });
    }

    res.status(201).json({ 
      message: 'Audit entry added',
      id: this.lastID 
    });
  });
});

// Endpoint pobierania statystyk audytu
app.get('/api/audit/stats', authenticateToken, (req, res) => {
  const { days = 30 } = req.query;

  const queries = {
// Overall statistics
    totalLogs: `SELECT COUNT(*) as count FROM audit_logs WHERE DATE(timestamp) >= DATE('now', '-${days} days')`,
    
    // Statystyki po akcjach
    actionStats: `
      SELECT action, COUNT(*) as count 
      FROM audit_logs 
      WHERE DATE(timestamp) >= DATE('now', '-${days} days')
      GROUP BY action 
      ORDER BY count DESC
    `,
    
// Statistics by users
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
    
// Daily activity
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

// Endpoint: delete all audit logs (admin only)
app.delete('/api/audit', authenticateToken, (req, res) => {
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Insufficient permissions' });
  }

  db.run('DELETE FROM audit_logs', function(err) {
    if (err) {
      console.error('Błąd podczas usuwania logów audytu:', err.message);
      return res.status(500).json({ message: 'Server error', error: err.message });
    }

    const deletedCount = this.changes || 0;
    return res.json({ message: 'Audit logs deleted', deleted_count: deletedCount });
  });
});

// ===== ENDPOINTY KONFIGURACJI APLIKACJI =====
// Upload logo (PNG) do katalogu public/logos z wersjonowaniem
let multer;
try {
  multer = require('multer');
} catch (_) {
// multer is optional in backend dependencies; available in project root
}

// Configure upload only if multer is available
const LOGO_DIR = path.join(__dirname, 'public', 'logos');
const CURRENT_LOGO_PATH = path.join(__dirname, 'public', 'logo.png');
const REPORT_ATTACHMENTS_DIR = path.join(__dirname, 'public', 'report_attachments');

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

function ensureReportAttachmentsDir() {
  try {
    if (!fs.existsSync(REPORT_ATTACHMENTS_DIR)) {
      fs.mkdirSync(REPORT_ATTACHMENTS_DIR, { recursive: true });
      console.log('Utworzono katalog załączników zgłoszeń:', REPORT_ATTACHMENTS_DIR);
    }
  } catch (err) {
    console.error('Nie udało się utworzyć katalogu załączników:', err.message);
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
let reportUpload;
if (multer) {
  ensureLogoDir();
  ensureReportAttachmentsDir();
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

  const reportStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, REPORT_ATTACHMENTS_DIR);
    },
    filename: (req, file, cb) => {
      const ts = Date.now();
      const safeName = (file.originalname || 'att').replace(/[^a-zA-Z0-9._-]+/g, '_');
      cb(null, `${ts}-${safeName}`);
    }
  });
  const reportFileFilter = (req, file, cb) => {
    if (String(file.mimetype || '').startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('ONLY_IMAGES'));
    }
  };
  reportUpload = multer({
    storage: reportStorage,
    fileFilter: reportFileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB per file
  });
}

// Fetch general settings (public)
app.get('/api/config/general', (req, res) => {
  db.get('SELECT app_name, company_name, timezone, language, date_format, backup_frequency, last_backup_at, tools_code_prefix, bhp_code_prefix, tool_category_prefixes FROM app_config WHERE id = 1', [], (err, row) => {
    if (err) {
      console.error('Błąd podczas pobierania ustawień ogólnych:', err.message);
      return res.status(500).json({ message: 'Server error', error: err.message });
    }
    if (!row) {
      return res.status(404).json({ message: 'Settings not found' });
    }
    let toolCategoryPrefixes = {};
    try {
      toolCategoryPrefixes = row.tool_category_prefixes ? JSON.parse(row.tool_category_prefixes) : {};
    } catch (_) {
      toolCategoryPrefixes = {};
    }
    res.json({
      appName: row.app_name,
      companyName: row.company_name,
      timezone: row.timezone,
      language: row.language,
      dateFormat: row.date_format,
      backupFrequency: row.backup_frequency || 'daily',
      lastBackupAt: row.last_backup_at || null,
      toolsCodePrefix: row.tools_code_prefix || '',
      bhpCodePrefix: row.bhp_code_prefix || '',
      toolCategoryPrefixes
    });
  });
});

// Public: fetch translations for the given language (DB overrides)
app.get('/api/translations/:lang', (req, res) => {
  const lang = String(req.params.lang || '').trim();
  if (!['pl', 'en', 'de'].includes(lang)) {
    return res.status(400).json({ message: 'Invalid language' });
  }
  db.all('SELECT key, value FROM translate WHERE lang = ? ORDER BY key', [lang], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Server error', error: err.message });
    }
    const map = {};
    for (const r of rows) {
      map[r.key] = r.value;
    }
    res.json({ lang, translations: map });
  });
});

// Admin: fetch translations with filtering options
app.get('/api/translate', authenticateToken, requirePermission('SYSTEM_SETTINGS'), (req, res) => {
  const lang = String(req.query.lang || '').trim();
  const search = String(req.query.search || '').trim();
  if (!['pl', 'en', 'de'].includes(lang)) {
    return res.status(400).json({ message: 'Invalid language' });
  }
  let sql = 'SELECT key, value FROM translate WHERE lang = ?';
  const params = [lang];
  if (search) {
    sql += ' AND key LIKE ?';
    params.push(`%${search}%`);
  }
  sql += ' ORDER BY key';
  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Server error', error: err.message });
    }
    res.json(rows);
  });
});

// Admin: bulk update translations
app.put('/api/translate/bulk', authenticateToken, requirePermission('SYSTEM_SETTINGS'), (req, res) => {
  const updates = Array.isArray(req.body?.updates) ? req.body.updates : [];
  if (updates.length === 0) {
    return res.status(400).json({ message: 'No updates provided' });
  }
  const validLang = (l) => ['pl', 'en', 'de'].includes(String(l || '').trim());
  const stmtSql = `INSERT INTO translate(lang, key, value, updated_at) VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(lang, key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`;
  const stmt = db.prepare(stmtSql);
  let count = 0;
  db.serialize(() => {
    for (const u of updates) {
      const lang = String(u.lang || '').trim();
      const key = String(u.key || '').trim();
      const value = String(u.value ?? '');
      if (!validLang(lang) || !key) continue;
      stmt.run(lang, key, value);
      count++;
    }
    stmt.finalize((err) => {
      if (err) {
        return res.status(500).json({ message: 'Error saving translations', error: err.message });
      }
      res.json({ updated: count });
    });
  });
});

// Pobieranie konfiguracji SMTP (tylko administrator)
app.get('/api/config/email', authenticateToken, (req, res) => {
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Insufficient permissions' });
  }
  db.get('SELECT smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, smtp_from FROM app_config WHERE id = 1', [], (err, row) => {
    if (err) {
      console.error('Błąd pobierania konfiguracji SMTP:', err.message);
      return res.status(500).json({ message: 'Server error', error: err.message });
    }
    if (!row) {
      return res.status(404).json({ message: 'Configuration not found' });
    }
    res.json({
      host: row.smtp_host || '',
      port: row.smtp_port || 587,
      secure: !!row.smtp_secure,
      user: row.smtp_user || '',
      pass: row.smtp_pass || '',
      from: row.smtp_from || 'no-reply@example.com'
    });
  });
});

// Serve report attachments
app.use('/attachments', express.static(REPORT_ATTACHMENTS_DIR));

// Upload logo aplikacji (tylko administrator)
app.post('/api/config/logo', authenticateToken, (req, res) => {
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Insufficient permissions to update logo' });
  }

  if (!upload) {
    return res.status(500).json({ message: 'Upload not available (multer not configured)' });
  }

  upload.single('logo')(req, res, (err) => {
    if (err) {
      if (err.message === 'ONLY_PNG') {
        return res.status(400).json({ message: 'Only PNG files are allowed' });
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File is too large (max 2MB)' });
      }
      return res.status(500).json({ message: 'Upload error', error: err.message });
    }

// If the file does not exist
    if (!req.file) {
      return res.status(400).json({ message: 'No logo file uploaded' });
    }

// Validate PNG dimensions on the backend
    const size = getPngSize(req.file.path);
    if (!size) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
      return res.status(400).json({ message: 'Invalid PNG file' });
    }
    const { width, height } = size;
    if (
      width < MIN_LOGO_WIDTH || height < MIN_LOGO_HEIGHT ||
      width > MAX_LOGO_WIDTH || height > MAX_LOGO_HEIGHT
    ) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
      return res.status(400).json({
        message: `Logo dimensions out of range: min ${MIN_LOGO_WIDTH}x${MIN_LOGO_HEIGHT}, max ${MAX_LOGO_WIDTH}x${MAX_LOGO_HEIGHT}. Received ${width}x${height}`
      });
    }

    // Ustaw aktualne logo
    try {
      fs.copyFileSync(req.file.path, CURRENT_LOGO_PATH);
    } catch (copyErr) {
      return res.status(500).json({ message: 'Failed to save current logo', error: copyErr.message });
    }

    const timestamp = Date.now();
    return res.json({
      message: 'Logo updated',
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
    return res.status(403).json({ message: 'Insufficient permissions' });
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
    res.status(500).json({ message: 'Error fetching logo history', error: err.message });
  }
});

// Restore selected logo version (admin only)
app.post('/api/config/logo/rollback', authenticateToken, (req, res) => {
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Insufficient permissions' });
  }
  const { filename } = req.body || {};
  if (!filename || typeof filename !== 'string') {
    return res.status(400).json({ message: 'Invalid version filename' });
  }
  const target = path.join(LOGO_DIR, filename);
  try {
    if (!fs.existsSync(target)) {
      return res.status(404).json({ message: 'Selected version does not exist' });
    }
    const size = getPngSize(target);
    if (!size) {
      return res.status(400).json({ message: 'Selected version has an invalid PNG file' });
    }
    const { width, height } = size;
    if (
      width < MIN_LOGO_WIDTH || height < MIN_LOGO_HEIGHT ||
      width > MAX_LOGO_WIDTH || height > MAX_LOGO_HEIGHT
    ) {
      return res.status(400).json({
        message: `Version dimensions out of range: min ${MIN_LOGO_WIDTH}x${MIN_LOGO_HEIGHT}, max ${MAX_LOGO_WIDTH}x${MAX_LOGO_HEIGHT}. Received ${width}x${height}`
      });
    }
    fs.copyFileSync(target, CURRENT_LOGO_PATH);
    const timestamp = Date.now();
    res.json({ message: 'Selected logo version restored', url: '/logo.png', timestamp, size });
  } catch (err) {
    res.status(500).json({ message: 'Error restoring version', error: err.message });
  }
});

// Delete selected logo version (admin only)
app.delete('/api/config/logo/:filename', authenticateToken, (req, res) => {
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Insufficient permissions' });
  }
  const { filename } = req.params || {};
  if (!filename || typeof filename !== 'string') {
    return res.status(400).json({ message: 'Invalid version filename' });
  }
  // Zabezpieczenie: dozwolone tylko pliki w formacie logo-*.png
  if (!/^logo-\d+\.png$/.test(filename)) {
    return res.status(400).json({ message: 'Invalid filename' });
  }
  const target = path.join(LOGO_DIR, filename);
  try {
    if (!fs.existsSync(target)) {
      return res.status(404).json({ message: 'Selected version does not exist' });
    }
    fs.unlinkSync(target);
    return res.json({ message: 'Logo version deleted', deleted: filename });
  } catch (err) {
    return res.status(500).json({ message: 'Error deleting logo version', error: err.message });
  }
});

// Update general settings (admin only)
app.put('/api/config/general', authenticateToken, (req, res) => {
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Insufficient permissions to update settings' });
  }

  const { appName, companyName, timezone, language, dateFormat, backupFrequency, toolsCodePrefix, bhpCodePrefix, toolCategoryPrefixes } = req.body || {};

  if (!appName || !timezone || !language || !dateFormat) {
    return res.status(400).json({ message: 'Missing required fields: appName, timezone, language, dateFormat' });
  }

  const query = `
    UPDATE app_config 
    SET app_name = ?, company_name = ?, timezone = ?, language = ?, date_format = ?, backup_frequency = COALESCE(?, backup_frequency), tools_code_prefix = COALESCE(?, tools_code_prefix), bhp_code_prefix = COALESCE(?, bhp_code_prefix), tool_category_prefixes = COALESCE(?, tool_category_prefixes), updated_at = datetime('now')
    WHERE id = 1
  `;
 
  let tcpJson = null;
  try {
    if (toolCategoryPrefixes && typeof toolCategoryPrefixes === 'object') {
      tcpJson = JSON.stringify(toolCategoryPrefixes);
    }
  } catch (_) {
    tcpJson = null;
  }

  db.run(query, [appName, companyName || null, timezone, language, dateFormat, backupFrequency || null, toolsCodePrefix || null, bhpCodePrefix || null, tcpJson || null], function(err) {
    if (err) {
      console.error('Błąd podczas aktualizacji ustawień ogólnych:', err.message);
      return res.status(500).json({ message: 'Server error', error: err.message });
    }

// Return updated settings
    db.get('SELECT app_name, company_name, timezone, language, date_format, backup_frequency, last_backup_at, tools_code_prefix, bhp_code_prefix, tool_category_prefixes FROM app_config WHERE id = 1', [], (err, row) => {
      if (err) {
        return res.status(500).json({ message: 'Server error', error: err.message });
      }
      let toolCategoryPrefixes = {};
      try {
        toolCategoryPrefixes = row.tool_category_prefixes ? JSON.parse(row.tool_category_prefixes) : {};
      } catch (_) {
        toolCategoryPrefixes = {};
      }
      res.json({
        appName: row.app_name,
        companyName: row.company_name,
        timezone: row.timezone,
        language: row.language,
        dateFormat: row.date_format,
        backupFrequency: row.backup_frequency || 'daily',
        lastBackupAt: row.last_backup_at || null,
        toolsCodePrefix: row.tools_code_prefix || '',
        bhpCodePrefix: row.bhp_code_prefix || '',
        toolCategoryPrefixes
      });
    });
  });
});

// Aktualizacja konfiguracji SMTP (tylko administrator)
app.put('/api/config/email', authenticateToken, (req, res) => {
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Insufficient permissions to update SMTP settings' });
  }
  const { host, port, secure, user, pass, from } = req.body || {};
  const query = `
    UPDATE app_config
    SET smtp_host = COALESCE(?, smtp_host),
        smtp_port = COALESCE(?, smtp_port),
        smtp_secure = COALESCE(?, smtp_secure),
        smtp_user = COALESCE(?, smtp_user),
        smtp_pass = COALESCE(?, smtp_pass),
        smtp_from = COALESCE(?, smtp_from),
        updated_at = datetime('now')
    WHERE id = 1
  `;
  db.run(query, [host || null, port || null, (secure ? 1 : 0), user || null, pass || null, from || null], function(err) {
    if (err) {
      console.error('Błąd aktualizacji ustawień SMTP:', err.message);
      return res.status(500).json({ message: 'Server error', error: err.message });
    }
    db.get('SELECT smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, smtp_from FROM app_config WHERE id = 1', [], (err2, row) => {
      if (err2) {
        return res.status(500).json({ message: 'Server error', error: err2.message });
      }
      res.json({
        host: row.smtp_host || '',
        port: row.smtp_port || 587,
        secure: !!row.smtp_secure,
        user: row.smtp_user || '',
        pass: row.smtp_pass || '',
        from: row.smtp_from || 'no-reply@example.com'
      });
    });
  });
});

// Send test email (admin only)
app.post('/api/config/email/test', authenticateToken, async (req, res) => {
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Insufficient permissions' });
  }
  const { to } = req.body || {};
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!to || typeof to !== 'string' || !emailRegex.test(to)) {
    return res.status(400).json({ message: 'Provide a valid recipient address (to)' });
  }

  try {
    const row = await new Promise((resolve, reject) => {
      db.get('SELECT smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, smtp_from FROM app_config WHERE id = 1', [], (err, r) => {
        if (err) return reject(err);
        resolve(r);
      });
    });
    const host = row?.smtp_host || process.env.SMTP_HOST || '';
    const port = row?.smtp_port || parseInt(process.env.SMTP_PORT || '0', 10) || 587;
    const secure = !!(row?.smtp_secure || (process.env.SMTP_SECURE === 'true'));
    const user = row?.smtp_user || process.env.SMTP_USER || '';
    const pass = row?.smtp_pass || process.env.SMTP_PASS || '';
    const from = row?.smtp_from || process.env.SMTP_FROM || '';

    if (!host || !port || !from || !emailRegex.test(String(from))) {
      return res.status(400).json({ message: 'Invalid SMTP configuration (host/port/from)' });
    }

    const nodemailer = require('nodemailer');
// Force secure=true for port 465 (implicit SSL) to avoid common configuration errors
    const effectiveSecure = port === 465 ? true : secure;
    const transporterOptions = {
      host,
      port,
      secure: effectiveSecure,
    };
    if (user && pass) {
      transporterOptions.auth = { user, pass };
    }
    const transporter = nodemailer.createTransport(transporterOptions);

    try { await transporter.verify(); } catch (_) {}

    await transporter.sendMail({
      from,
      to,
      subject: 'Test SMTP — System Zarządzania',
      text: 'To jest testowa wiadomość. Konfiguracja SMTP działa poprawnie.',
    });

    return res.json({ ok: true, message: 'Test message sent' });
  } catch (err) {
// Log more details to aid diagnosis (error code, server response)
    const more = {
      code: err && err.code,
      command: err && err.command,
      response: err && err.response,
    };
    console.error('Błąd wysyłki testowej wiadomości:', err.message, more);
// Return extended diagnostic data to the UI (no sensitive data)
    return res.status(500).json({
      message: 'Error sending test message',
      error: err.message,
      code: more.code,
      command: more.command,
      response: more.response,
      hint:
        'Ensure port/secure match (465→secure: true, 587→secure: false) and credentials are correct.'
    });
  }
});

// ===== Reports Endpoints =====
// Create a report (multipart, optional attachments)
app.post('/api/reports', authenticateToken, (req, res) => {
  if (!reportUpload) {
    return res.status(500).json({ message: 'Upload not available (multer not configured)' });
  }
  reportUpload.array('attachments', 8)(req, res, (err) => {
    if (err) {
      if (err.message === 'ONLY_IMAGES') {
        return res.status(400).json({ message: 'Only image files are allowed' });
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File is too large (max 10MB)' });
      }
      return res.status(500).json({ message: 'Upload error', error: err.message });
    }

    const body = req.body || {};
    const type = String(body.type || '').trim();
    const description = String(body.description || '').trim();
    const severity = String(body.severity || '').trim();
    if (!type || !description || !severity) {
      return res.status(400).json({ message: 'Type, description, and severity are required' });
    }
    const allowedTypes = ['employee', 'tool', 'bhpIssued', 'bhp', 'other'];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ message: 'Invalid report type' });
    }

    const employeeId = type === 'employee' ? (parseInt(body.employeeId) || null) : null;
    const employeeNameManual = (type === 'employee' && req.user.role === 'employee')
      ? String(body.employeeName || '').trim()
      : null;
    const toolId = type === 'tool' ? (parseInt(body.toolId) || null) : null;
    const bhpCategory = type === 'bhp' ? String(body.bhpCategory || '').trim() : String(body.bhpCategory || '').trim();
    const subject = String(body.subject || '').trim();

    if (type === 'employee' && req.user.role === 'employee') {
      if (!employeeNameManual) {
        return res.status(400).json({ message: 'Provide employee full name for the report' });
      }
    }

    const files = Array.isArray(req.files) ? req.files : [];
    const attachments = files.map(f => ({
      filename: path.basename(f.filename),
      originalName: f.originalname,
      size: f.size,
      url: `/attachments/${path.basename(f.filename)}`
    }));

    const sql = `INSERT INTO reports (created_by_user_id, created_by_username, type, employee_id, employee_name_manual, tool_id, bhp_category, subject, description, severity, status, attachments, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`;
    const params = [
      req.user.id || null,
      req.user.username || null,
      type,
      employeeId,
      employeeNameManual || null,
      toolId,
      bhpCategory || null,
      subject || null,
      description,
      severity,
      'Przyjęto',
      JSON.stringify(attachments)
    ];
    db.run(sql, params, function (insErr) {
      if (insErr) {
        console.error('Błąd dodawania zgłoszenia:', insErr.message);
        return res.status(500).json({ message: 'Error creating report' });
      }
      return res.json({ message: 'Report created', id: this.lastID });
    });
  });
});

// List reports (admin only) with filters
app.get('/api/reports', authenticateToken, (req, res) => {
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Only administrator can view reports' });
  }
  const { type, severity, status } = req.query || {};
  const where = [];
  const params = [];
  if (type) { where.push('type = ?'); params.push(String(type)); }
  if (severity) { where.push('severity = ?'); params.push(String(severity)); }
  if (status) { where.push('status = ?'); params.push(String(status)); }
  const sql = `SELECT r.*, 
    (CASE WHEN r.employee_id IS NOT NULL THEN (SELECT first_name || ' ' || last_name FROM employees WHERE id = r.employee_id) ELSE NULL END) AS employee_name,
    (CASE WHEN r.tool_id IS NOT NULL THEN (SELECT name FROM tools WHERE id = r.tool_id) ELSE NULL END) AS tool_name
    FROM reports r ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY r.created_at DESC`;
  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Błąd pobierania zgłoszeń:', err.message);
      return res.status(500).json({ message: 'Server error', error: err.message });
    }
    const items = (rows || []).map(r => {
      let atts = [];
      try { atts = r.attachments ? JSON.parse(r.attachments) : []; } catch (_) { atts = []; }
      return { ...r, attachments: atts };
    });
    return res.json({ items });
  });
});

// Update report status (admin)
app.put('/api/reports/:id/status', authenticateToken, (req, res) => {
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Insufficient permissions' });
  }
  const id = parseInt(req.params.id);
  const status = String((req.body || {}).status || '').trim();
  const allowed = ['Przyjęto', 'Sprawdzanie', 'Rozwiązano'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }
  db.run('UPDATE reports SET status = ?, updated_at = datetime(\'now\') WHERE id = ?', [status, id], function (updErr) {
    if (updErr) {
      console.error('Błąd aktualizacji statusu zgłoszenia:', updErr.message);
      return res.status(500).json({ message: 'Error updating status' });
    }
    if ((this.changes || 0) === 0) {
      return res.status(404).json({ message: 'Report not found' });
    }
    return res.json({ message: 'Report status updated' });
  });
});

// Delete report (admin) along with attachments
app.delete('/api/reports/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Insufficient permissions' });
  }
  const id = parseInt(req.params.id);
  if (Number.isNaN(id) || id <= 0) {
    return res.status(400).json({ message: 'Invalid report ID' });
  }

  db.get('SELECT id, type, subject, severity, status, created_at, attachments FROM reports WHERE id = ?', [id], (findErr, row) => {
    if (findErr) {
      console.error('Błąd wyszukiwania zgłoszenia do usunięcia:', findErr.message);
      return res.status(500).json({ message: 'Server error', error: findErr.message });
    }
    if (!row) {
      return res.status(404).json({ message: 'Report not found' });
    }

    let attachments = [];
    try {
      attachments = row.attachments ? JSON.parse(row.attachments) : [];
    } catch (_) {
      attachments = [];
    }

// Delete attachment files from disk
    if (Array.isArray(attachments) && attachments.length > 0) {
      attachments.forEach(att => {
        const filename = att && att.filename ? String(att.filename) : null;
        if (filename) {
          try {
            const target = path.join(REPORT_ATTACHMENTS_DIR, path.basename(filename));
            if (fs.existsSync(target)) {
              fs.unlinkSync(target);
            }
          } catch (err) {
            console.warn('Nie udało się usunąć załącznika zgłoszenia:', filename, err && err.message);
          }
        }
      });
    }

// Delete report record
    db.run('DELETE FROM reports WHERE id = ?', [id], function(delErr) {
      if (delErr) {
        console.error('Błąd usuwania zgłoszenia:', delErr.message);
        return res.status(500).json({ message: 'Error deleting report', error: delErr.message });
      }
      if ((this.changes || 0) === 0) {
        return res.status(404).json({ message: 'Report not found' });
      }
// Audit log: record who deleted what
      const details = `report_id:${id}; type:${row.type}; severity:${row.severity}; status:${row.status}; subject:${row.subject || ''}; attachments_deleted:${Array.isArray(attachments) ? attachments.length : 0}`;
      db.run(
        "INSERT INTO audit_logs (user_id, username, action, target_type, target_id, details, timestamp) VALUES (?, ?, 'report_delete', 'report', ?, ?, datetime('now'))",
        [req.user.id, req.user.username, String(id), details],
        (logErr) => {
          if (logErr) {
            console.error('Błąd zapisu do audit_logs (usunięcie zgłoszenia):', logErr.message);
          }
          return res.json({ message: 'Report deleted', id });
        }
      );
    });
  });
});

// ===== Inventory Endpoints =====
// Utworzenie nowej sesji inwentaryzacji (admin)
app.post('/api/inventory/sessions', authenticateToken, (req, res) => {
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Only administrator can create inventory sessions' });
  }
  const { name, notes } = req.body || {};
  const normalized = String(name || '').trim();
  if (!normalized) {
    return res.status(400).json({ message: 'Session name is required' });
  }
  db.run(
    "INSERT INTO inventory_sessions (name, owner_user_id, status, started_at, notes) VALUES (?, ?, 'active', datetime('now'), ?)",
    [normalized, req.user.id, notes || null],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Server error', error: err.message });
      }
      db.get('SELECT * FROM inventory_sessions WHERE id = ?', [this.lastID], (getErr, row) => {
        if (getErr) return res.status(500).json({ message: 'Error fetching session' });
        res.status(201).json(row);
      });
    }
  );
});

// Zmiana statusu sesji (pause/resume/end) - admin
app.put('/api/inventory/sessions/:id/status', authenticateToken, (req, res) => {
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Only administrator can change session status' });
  }
  const { action } = req.body || {};
  const id = req.params.id;
  let sql = null;
  let params = [id];
  if (action === 'pause') {
    sql = "UPDATE inventory_sessions SET status = 'paused', paused_at = datetime('now') WHERE id = ? AND status = 'active'";
  } else if (action === 'resume') {
    sql = "UPDATE inventory_sessions SET status = 'active', paused_at = NULL WHERE id = ? AND status = 'paused'";
  } else if (action === 'end') {
    sql = "UPDATE inventory_sessions SET status = 'ended', finished_at = datetime('now') WHERE id = ? AND status != 'ended'";
  } else {
    return res.status(400).json({ message: 'Invalid action (allowed: pause, resume, end)' });
  }
  db.run(sql, params, function(err) {
    if (err) return res.status(500).json({ message: 'Server error', error: err.message });
    if (this.changes === 0) return res.status(404).json({ message: 'Session not found or status unchanged' });
    db.get('SELECT * FROM inventory_sessions WHERE id = ?', [id], (getErr, row) => {
      if (getErr) return res.status(500).json({ message: 'Error fetching session' });
      res.json(row);
    });
  });
});

// Lista sesji + liczba zliczonych pozycji
app.get('/api/inventory/sessions', authenticateToken, (req, res) => {
  const sql = `
    SELECT s.*, (
      SELECT COUNT(*) FROM inventory_counts ic WHERE ic.session_id = s.id
    ) AS counted_items
    FROM inventory_sessions s
    ORDER BY s.started_at DESC
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Server error', error: err.message });
    res.json(rows);
  });
});

// Delete ended session (admin)
app.delete('/api/inventory/sessions/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Only administrator can delete inventory sessions' });
  }
  const id = req.params.id;
  db.get('SELECT * FROM inventory_sessions WHERE id = ?', [id], (findErr, session) => {
    if (findErr) return res.status(500).json({ message: 'Server error', error: findErr.message });
    if (!session) return res.status(404).json({ message: 'Session does not exist' });
    if (session.status !== 'ended') return res.status(400).json({ message: "Session status is not 'ended'" });

    let deletedCounts = 0;
    let deletedCorrections = 0;

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      db.run('DELETE FROM inventory_counts WHERE session_id = ?', [id], function(countErr) {
        if (countErr) {
          db.run('ROLLBACK');
          return res.status(500).json({ message: 'Error deleting counts', error: countErr.message });
        }
        deletedCounts = this.changes || 0;

        db.run('DELETE FROM inventory_corrections WHERE session_id = ?', [id], function(corrErr) {
          if (corrErr) {
            db.run('ROLLBACK');
            return res.status(500).json({ message: 'Error deleting corrections', error: corrErr.message });
          }
          deletedCorrections = this.changes || 0;

          db.run('DELETE FROM inventory_sessions WHERE id = ?', [id], function(sessErr) {
            if (sessErr) {
              db.run('ROLLBACK');
              return res.status(500).json({ message: 'Error deleting session', error: sessErr.message });
            }
            if (this.changes === 0) {
              db.run('ROLLBACK');
              return res.status(404).json({ message: 'Session not found' });
            }

            db.run('COMMIT', (commitErr) => {
              if (commitErr) {
                db.run('ROLLBACK');
                return res.status(500).json({ message: 'Error committing transaction', error: commitErr.message });
              }

              const details = `session:${id} name:${session.name} counts:${deletedCounts} corrections:${deletedCorrections}`;
              db.run(
                "INSERT INTO audit_logs (user_id, username, action, details, timestamp) VALUES (?, ?, 'inventory_session_delete', ?, datetime('now'))",
                [req.user.id, req.user.username, details],
                (auditErr) => {
                  if (auditErr) {
                    console.error('Błąd dodawania logu audytu:', auditErr.message);
                  }
                  return res.json({ 
                    message: 'Session permanently deleted', 
                    deleted: true,
                    session_id: Number(id),
                    deleted_counts: deletedCounts,
                    deleted_corrections: deletedCorrections
                  });
                }
              );
            });
          });
        });
      });
    });
  });
});

// Skanowanie i zliczanie w sesji
app.post('/api/inventory/sessions/:id/scan', authenticateToken, (req, res) => {
  const sessionId = req.params.id;
  const { code, quantity } = req.body || {};
  const qty = Math.max(1, parseInt(quantity || 1, 10));
  if (!code || String(code).trim() === '') {
    return res.status(400).json({ message: 'Code is required' });
  }

  db.get('SELECT * FROM inventory_sessions WHERE id = ?', [sessionId], (err, session) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (!session) return res.status(404).json({ message: 'Session does not exist' });
    if (session.status !== 'active') return res.status(400).json({ message: 'Session is not active' });

    const findToolSql = 'SELECT * FROM tools WHERE sku = ? OR barcode = ? OR qr_code = ? OR inventory_number = ? LIMIT 1';
    db.get(findToolSql, [code, code, code, code], (findErr, tool) => {
      if (findErr) return res.status(500).json({ message: 'Server error' });
      if (!tool) return res.status(404).json({ message: 'No tool found for the provided code' });

      db.get('SELECT id, counted_qty FROM inventory_counts WHERE session_id = ? AND tool_id = ?', [sessionId, tool.id], (getErr, countRow) => {
        if (getErr) return res.status(500).json({ message: 'Server error' });
        if (!countRow) {
          db.run(
            'INSERT INTO inventory_counts (session_id, tool_id, code, counted_qty) VALUES (?, ?, ?, ?)',
            [sessionId, tool.id, code, qty],
            function(insErr) {
              if (insErr) return res.status(500).json({ message: 'Server error', error: insErr.message });
              db.get('SELECT * FROM inventory_counts WHERE id = ?', [this.lastID], (cErr, newRow) => {
                if (cErr) return res.status(500).json({ message: 'Server error' });
                // Zapis audytu
                db.run(
                  "INSERT INTO audit_logs (user_id, username, action, details, timestamp) VALUES (?, ?, 'inventory_scan', ?, datetime('now'))",
                  [req.user.id, req.user.username, `session:${sessionId} tool:${tool.id} qty:${qty}`]
                );
                res.status(201).json({ message: 'Count added', count: newRow, tool });
              });
            }
          );
        } else {
          const updatedQty = (countRow.counted_qty || 0) + qty;
          db.run(
            "UPDATE inventory_counts SET counted_qty = ?, updated_at = datetime('now') WHERE id = ?",
            [updatedQty, countRow.id],
            function(updErr) {
              if (updErr) return res.status(500).json({ message: 'Server error', error: updErr.message });
              db.get('SELECT * FROM inventory_counts WHERE id = ?', [countRow.id], (cErr, row) => {
                if (cErr) return res.status(500).json({ message: 'Server error' });
                db.run(
                  "INSERT INTO audit_logs (user_id, username, action, details, timestamp) VALUES (?, ?, 'inventory_scan', ?, datetime('now'))",
                  [req.user.id, req.user.username, `session:${sessionId} tool:${tool.id} qty:+${qty}`]
                );
                res.json({ message: 'Count updated', count: row, tool });
              });
            }
          );
        }
      });
    });
  });
});

// Set counted quantity for a tool in the session (upsert)
app.put('/api/inventory/sessions/:id/counts/:toolId', authenticateToken, (req, res) => {
  const sessionId = req.params.id;
  const toolId = req.params.toolId;
  const { counted_qty } = req.body || {};
  const qty = Math.max(0, parseInt(counted_qty, 10));
  if (Number.isNaN(qty)) {
    return res.status(400).json({ message: 'Required: counted_qty (number)' });
  }

  db.get('SELECT * FROM inventory_sessions WHERE id = ?', [sessionId], (err, session) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (!session) return res.status(404).json({ message: 'Session does not exist' });

    db.get('SELECT * FROM tools WHERE id = ?', [toolId], (toolErr, tool) => {
      if (toolErr) return res.status(500).json({ message: 'Server error' });
      if (!tool) return res.status(404).json({ message: 'Tool not found' });

      db.get('SELECT id FROM inventory_counts WHERE session_id = ? AND tool_id = ?', [sessionId, toolId], (getErr, countRow) => {
        if (getErr) return res.status(500).json({ message: 'Server error' });
        if (!countRow) {
          db.run(
            'INSERT INTO inventory_counts (session_id, tool_id, code, counted_qty) VALUES (?, ?, ?, ?)',
            [sessionId, toolId, tool.sku || null, qty],
            function(insErr) {
              if (insErr) return res.status(500).json({ message: 'Server error', error: insErr.message });
              db.get('SELECT * FROM inventory_counts WHERE id = ?', [this.lastID], (cErr, newRow) => {
                if (cErr) return res.status(500).json({ message: 'Server error' });
                db.run(
                  "INSERT INTO audit_logs (user_id, username, action, details, timestamp) VALUES (?, ?, 'inventory_count_set', ?, datetime('now'))",
                  [req.user.id, req.user.username, `session:${sessionId} tool:${toolId} set:${qty}`]
                );
                res.status(201).json({ message: 'Count quantity set', count: newRow });
              });
            }
          );
        } else {
          db.run(
            "UPDATE inventory_counts SET counted_qty = ?, updated_at = datetime('now') WHERE id = ?",
            [qty, countRow.id],
            function(updErr) {
              if (updErr) return res.status(500).json({ message: 'Server error', error: updErr.message });
              db.get('SELECT * FROM inventory_counts WHERE id = ?', [countRow.id], (cErr, row) => {
                if (cErr) return res.status(500).json({ message: 'Server error' });
                db.run(
                  "INSERT INTO audit_logs (user_id, username, action, details, timestamp) VALUES (?, ?, 'inventory_count_set', ?, datetime('now'))",
                  [req.user.id, req.user.username, `session:${sessionId} tool:${toolId} set:${qty}`]
                );
                res.json({ message: 'Count quantity updated', count: row });
              });
            }
          );
        }
      });
    });
  });
});

// Session differences (also includes zero differences)
app.get('/api/inventory/sessions/:id/differences', authenticateToken, (req, res) => {
  const sessionId = req.params.id;
  const sql = `
    SELECT 
      t.id AS tool_id, t.name, t.sku, t.quantity AS system_qty, 
      COALESCE(ic.counted_qty, 0) AS counted_qty,
      (COALESCE(ic.counted_qty, 0) - COALESCE(t.quantity, 0)) AS difference
    FROM tools t
    LEFT JOIN inventory_counts ic ON ic.tool_id = t.id AND ic.session_id = ?
    ORDER BY ABS(difference) DESC, t.name
  `;
  db.all(sql, [sessionId], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Server error', error: err.message });
    res.json(rows);
  });
});

// History of counts and corrections
app.get('/api/inventory/sessions/:id/history', authenticateToken, (req, res) => {
  const sessionId = req.params.id;
  const countsQuery = `
    SELECT ic.*, t.name AS tool_name, t.sku AS tool_sku
    FROM inventory_counts ic
    JOIN tools t ON t.id = ic.tool_id
    WHERE ic.session_id = ?
    ORDER BY ic.updated_at DESC
  `;
  const correctionsQuery = `
    SELECT c.*, t.name AS tool_name, t.sku AS tool_sku, u.username AS accepted_by_username
    FROM inventory_corrections c
    JOIN tools t ON t.id = c.tool_id
    LEFT JOIN users u ON u.id = c.accepted_by_user_id
    WHERE c.session_id = ?
    ORDER BY c.created_at DESC
  `;
  db.all(countsQuery, [sessionId], (err, counts) => {
    if (err) return res.status(500).json({ message: 'Server error', error: err.message });
    db.all(correctionsQuery, [sessionId], (err2, corrections) => {
      if (err2) return res.status(500).json({ message: 'Server error', error: err2.message });
      res.json({ counts, corrections });
    });
  });
});

// Add difference correction
app.post('/api/inventory/sessions/:id/corrections', authenticateToken, (req, res) => {
  const sessionId = req.params.id;
  const { tool_id, difference_qty, reason } = req.body || {};
  if (!tool_id || typeof difference_qty !== 'number') {
    return res.status(400).json({ message: 'Required: tool_id and difference_qty (number)' });
  }
  db.run(
    'INSERT INTO inventory_corrections (session_id, tool_id, difference_qty, reason) VALUES (?, ?, ?, ?)',
    [sessionId, tool_id, difference_qty, reason || null],
    function(err) {
      if (err) return res.status(500).json({ message: 'Server error', error: err.message });
      db.get('SELECT * FROM inventory_corrections WHERE id = ?', [this.lastID], (getErr, row) => {
        if (getErr) return res.status(500).json({ message: 'Error fetching correction' });
        res.status(201).json(row);
      });
    }
  );
});

// Akceptacja korekty (admin)
app.post('/api/inventory/corrections/:id/accept', authenticateToken, (req, res) => {
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Only administrator can accept corrections' });
  }
  const id = req.params.id;
  db.run(
    "UPDATE inventory_corrections SET accepted_by_user_id = ?, accepted_at = datetime('now') WHERE id = ?",
    [req.user.id, id],
    function(err) {
      if (err) return res.status(500).json({ message: 'Server error', error: err.message });
      if (this.changes === 0) return res.status(404).json({ message: 'Correction not found' });

// After acceptance, apply the correction to the tool's system quantity
      db.get('SELECT * FROM inventory_corrections WHERE id = ?', [id], (getErr, corr) => {
        if (getErr || !corr) return res.status(500).json({ message: 'Error fetching correction to apply' });
        db.run(
          'UPDATE tools SET quantity = COALESCE(quantity, 0) + ? WHERE id = ?',
          [corr.difference_qty, corr.tool_id],
          function(updErr) {
            if (updErr) return res.status(500).json({ message: 'Error applying correction', error: updErr.message });
            // Zapisz zdarzenie w logach audytu
            db.run(
              "INSERT INTO audit_logs (user_id, username, action, details, timestamp) VALUES (?, ?, 'inventory_correction_accept', ?, datetime('now'))",
              [req.user.id, req.user.username, `correction:${id} tool:${corr.tool_id} diff:${corr.difference_qty}`]
            );
            res.json({ message: 'Correction accepted and applied', id, tool_id: corr.tool_id, applied_difference: corr.difference_qty });
          }
        );
      });
    }
  );
});

// Usuwanie korekty (admin)
app.delete('/api/inventory/corrections/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Only administrator can delete corrections' });
  }
  const id = req.params.id;
  db.get('SELECT * FROM inventory_corrections WHERE id = ?', [id], (findErr, corr) => {
    if (findErr) return res.status(500).json({ message: 'Server error', error: findErr.message });
    if (!corr) return res.status(404).json({ message: 'Correction does not exist' });
    if (corr.accepted_at) return res.status(400).json({ message: 'Cannot delete an approved correction' });

    db.run('DELETE FROM inventory_corrections WHERE id = ?', [id], function(delErr) {
      if (delErr) return res.status(500).json({ message: 'Error deleting correction', error: delErr.message });
      if (this.changes === 0) return res.status(404).json({ message: 'Correction not found' });
      db.run(
        "INSERT INTO audit_logs (user_id, username, action, details, timestamp) VALUES (?, ?, 'inventory_correction_delete', ?, datetime('now'))",
        [req.user.id, req.user.username, `correction:${id} session:${corr.session_id} tool:${corr.tool_id} diff:${corr.difference_qty}`],
        (auditErr) => {
          if (auditErr) console.error('Błąd dodawania logu audytu:', auditErr.message);
          res.json({ message: 'Correction deleted', id: Number(id), deleted: true });
        }
      );
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle application shutdown

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
thresholdMs = 24 * 60 * 60 * 1000; // 1 day
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
// Run an hourly check to determine whether to perform a backup
  setInterval(checkAndRunBackup, 60 * 60 * 1000);
  console.log('Backup scheduler started (checks hourly).');
}

// Manual backup trigger (admin only)
app.post('/api/backup/run', authenticateToken, (req, res) => {
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Insufficient permissions to run backup' });
  }
  performBackup((err, dest) => {
    if (err) return res.status(500).json({ message: 'Server error', error: err.message });
    return res.json({ message: 'Backup completed', file: path.basename(dest) });
  });
});

// Lista kopii (tylko administrator)
app.get('/api/backup/list', authenticateToken, (req, res) => {
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Insufficient permissions to view backups' });
  }
  ensureBackupDir();
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('database-') && f.endsWith('.db'))
      .map(f => ({ file: f }));
    res.json({ backups: files });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
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

// Endpoint: issue a tool to an employee (with quantity support)
app.post('/api/tools/:id/issue', authenticateToken, (req, res) => {
  const toolId = req.params.id;
  const { employee_id, quantity = 1 } = req.body;
  const userId = req.user.id;

  if (!employee_id) {
    return res.status(400).json({ message: 'Employee ID is required' });
  }

  if (quantity < 1) {
    return res.status(400).json({ message: 'Quantity must be greater than 0' });
  }

// Verify the tool exists and has sufficient available quantity
  db.get('SELECT * FROM tools WHERE id = ?', [toolId], (err, tool) => {
    if (err) {
      return res.status(500).json({ message: 'Server error' });
    }
    if (!tool) {
      return res.status(404).json({ message: 'Tool not found' });
    }

// Check currently issued quantity
    db.get('SELECT COALESCE(SUM(quantity), 0) as issued_quantity FROM tool_issues WHERE tool_id = ? AND status = "wydane"', [toolId], (err, result) => {
      if (err) {
        return res.status(500).json({ message: 'Server error' });
      }

      const availableQuantity = tool.quantity - result.issued_quantity;
      
      if (availableQuantity < quantity) {
        return res.status(400).json({ 
          message: `Insufficient quantity available. Available: ${availableQuantity}, requested: ${quantity}` 
        });
      }

// Check if employee exists
      db.get('SELECT * FROM employees WHERE id = ?', [employee_id], (err, employee) => {
        if (err) {
          return res.status(500).json({ message: 'Server error' });
        }
        if (!employee) {
          return res.status(404).json({ message: 'Employee not found' });
        }

// Add a record to the issues table
        db.run(
          'INSERT INTO tool_issues (tool_id, employee_id, issued_by_user_id, quantity) VALUES (?, ?, ?, ?)',
          [toolId, employee_id, userId, quantity],
          function(err) {
            if (err) {
              return res.status(500).json({ message: 'Server error' });
            }

// Update tool status if all items have been issued
            const newIssuedQuantity = result.issued_quantity + quantity;
            const newStatus = newIssuedQuantity >= tool.quantity ? 'wydane' : 'częściowo wydane';
            
            db.run(
              'UPDATE tools SET status = ? WHERE id = ?',
              [newStatus, toolId],
              function(err) {
              if (err) {
                return res.status(500).json({ message: 'Server error' });
              }
                
                res.status(200).json({ 
                  message: `Issued ${quantity} items of the tool`,
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

// Endpoint: return a tool (with quantity support)
app.post('/api/tools/:id/return', authenticateToken, (req, res) => {
  const toolId = req.params.id;
  const { issue_id, quantity } = req.body;

  if (!issue_id) {
    return res.status(400).json({ message: 'Issue ID is required' });
  }

// Check whether the issue exists and is active
  db.get('SELECT * FROM tool_issues WHERE id = ? AND tool_id = ? AND status = "wydane"', [issue_id, toolId], (err, issue) => {
    if (err) {
      return res.status(500).json({ message: 'Server error' });
    }
    if (!issue) {
      return res.status(404).json({ message: 'Issue not found or already returned' });
    }

    const returnQuantity = quantity || issue.quantity;

    if (returnQuantity > issue.quantity) {
      return res.status(400).json({ message: 'Cannot return more than was issued' });
    }

    if (returnQuantity === issue.quantity) {
// Return the entire issue
      db.run(
        'UPDATE tool_issues SET status = "zwrócone", returned_at = datetime("now") WHERE id = ?',
        [issue_id],
        function(err) {
          if (err) {
            return res.status(500).json({ message: 'Server error' });
          }
          
// Check whether all issues have been returned and update the tool status
          updateToolStatus(toolId, res, returnQuantity);
        }
      );
    } else {
// Partial return — decrease quantity in the issue and create a new return entry
      db.run(
        'UPDATE tool_issues SET quantity = ? WHERE id = ?',
        [issue.quantity - returnQuantity, issue_id],
        function(err) {
          if (err) {
            return res.status(500).json({ message: 'Błąd serwera' });
          }

// Create a return entry
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
// Check the current issue status for the tool
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
              return res.status(500).json({ message: 'Server error' });
            }
              
            res.status(200).json({ 
              message: `Returned ${returnedQuantity} items of the tool`,
              new_status: newStatus,
              available_quantity: tool.quantity - result.issued_quantity
            });
          }
        );
      });
    });
  }
});

// Endpoint: fetch tool details including issue information
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
      return res.status(500).json({ message: 'Server error', error: err.message });
    }
    if (!tool) {
      console.log(`Narzędzie o ID ${toolId} nie zostało znalezione`);
      return res.status(404).json({ message: 'Tool not found' });
    }

// Fetch issue details
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
        return res.status(500).json({ message: 'Server error', error: err.message });
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

// Endpoints for managing role permissions

// Fetch permissions for all roles
app.get('/api/role-permissions', authenticateToken, (req, res) => {
// Check whether the user has administrator permissions
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Insufficient permissions to manage roles' });
  }

  const query = `
    SELECT role, permission 
    FROM role_permissions 
    ORDER BY role, permission
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Błąd podczas pobierania uprawnień ról:', err.message);
      return res.status(500).json({ message: 'Server error', error: err.message });
    }

// Group permissions by role
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

// Update permissions for a specific role
app.put('/api/role-permissions/:role', authenticateToken, (req, res) => {
// Check whether the user has administrator permissions
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Insufficient permissions to manage roles' });
  }

  const role = req.params.role;
  const { permissions } = req.body;

  if (!permissions || !Array.isArray(permissions)) {
    return res.status(400).json({ message: 'Invalid data — permissions array required' });
  }

// Begin transaction
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

// Remove all existing permissions for this role
    db.run('DELETE FROM role_permissions WHERE role = ?', [role], (err) => {
        if (err) {
          console.error(`Błąd podczas usuwania uprawnień dla roli ${role}:`, err.message);
          db.run('ROLLBACK');
          return res.status(500).json({ message: 'Server error', error: err.message });
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
            return res.status(500).json({ message: 'Server error', error: err.message });
          }
        });
      });

      stmt.finalize((err) => {
        if (err || errorOccurred) {
          if (!errorOccurred) {
            console.error('Błąd podczas finalizacji statement:', err.message);
            db.run('ROLLBACK');
            return res.status(500).json({ message: 'Server error', error: err.message });
          }
        } else {
          db.run('COMMIT', (err) => {
            if (err) {
              console.error('Błąd podczas zatwierdzania transakcji:', err.message);
              return res.status(500).json({ message: 'Server error', error: err.message });
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

            db.run(`INSERT INTO audit_logs (user_id, username, action, target_type, target_id, details, timestamp) 
                    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
              [auditData.user_id, req.user.username, auditData.action, auditData.target_type, auditData.target_id, auditData.details],
              (err) => {
                if (err) {
                  console.error('Błąd podczas zapisywania do audit log:', err.message);
                }
              }
            );

            console.log(`Uprawnienia dla roli ${role} zostały zaktualizowane`);
            res.json({ 
              message: 'Role permissions updated successfully',
              role: role,
              permissions: permissions
            });
          });
        }
      });
    });
  });
});

// Fetch available permissions
app.get('/api/permissions', authenticateToken, (req, res) => {
// Check whether the user has administrator permissions
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Brak uprawnień do zarządzania rolami' });
  }

  const availablePermissions = [
    'VIEW_USERS',
    'CREATE_USERS',
    'MANAGE_USERS',
    'EDIT_USERS',
    'DELETE_USERS',
    'VIEW_ANALYTICS',
    'VIEW_TOOLS',
    'VIEW_LABELS',
    'MANAGE_DEPARTMENTS',
    'MANAGE_POSITIONS',
    'SYSTEM_SETTINGS',
    'VIEW_ADMIN',
    'VIEW_AUDIT_LOG',
    'VIEW_BHP',
    'VIEW_TOOL_HISTORY',
    'VIEW_BHP_HISTORY',
    'MANAGE_BHP',
    'VIEW_QUICK_ACTIONS',
    'DELETE_ISSUE_HISTORY',
    'DELETE_RETURN_HISTORY',
    'DELETE_SERVICE_HISTORY',
    'MANAGE_EMPLOYEES',
    'VIEW_DATABASE',
    'MANAGE_DATABASE',
    'VIEW_INVENTORY',
    'INVENTORY_MANAGE_SESSIONS',
    'INVENTORY_SCAN',
    'INVENTORY_ACCEPT_CORRECTION',
    'INVENTORY_DELETE_CORRECTION',
    'INVENTORY_EXPORT_CSV'
  ];

  res.json(availablePermissions);
});

// Admin/permission-only: Lista tabel w bazie danych
app.get('/api/db/tables', authenticateToken, requirePermission('VIEW_DATABASE'), (req, res) => {
  const sql = `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Błąd podczas pobierania listy tabel:', err.message);
      return res.status(500).json({ message: 'Error fetching table list' });
    }
    const tables = rows.map(r => r.name);
    res.json(tables);
  });
});

// Admin/permission-only: Preview selected table contents with pagination
app.get('/api/db/table/:name', authenticateToken, requirePermission('VIEW_DATABASE'), (req, res) => {
  const tableName = String(req.params.name || '').trim();
  const limit = Math.max(1, Math.min(500, parseInt(req.query.limit, 10) || 50));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

  // Walidacja nazwy tabeli przeciwko SQL injection – dopuszczamy tylko istniejące nazwy z sqlite_master
  const validateSql = `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`;
  db.get(validateSql, [tableName], (err, row) => {
    if (err) {
      console.error('Błąd walidacji nazwy tabeli:', err.message);
      return res.status(500).json({ message: 'Table name validation error' });
    }
    if (!row) {
      return res.status(400).json({ message: 'Invalid table name' });
    }

    // Pobierz schemat (kolumny)
    db.all(`PRAGMA table_info(${tableName})`, [], (errCols, cols) => {
      if (errCols) {
        console.error('Błąd pobierania schematu tabeli:', errCols.message);
        return res.status(500).json({ message: 'Error fetching table schema' });
      }

      const columnNames = (cols || []).map(c => c.name);
      const pkColumns = (cols || []).filter(c => c.pk).map(c => c.name);

      // Pobierz rekordy z paginacją
      const dataSql = `SELECT * FROM ${tableName} LIMIT ? OFFSET ?`;
      db.all(dataSql, [limit, offset], (errData, rows) => {
        if (errData) {
          console.error('Błąd pobierania danych tabeli:', errData.message);
          return res.status(500).json({ message: 'Error fetching table data' });
        }

        // Policz całkowitą liczbę rekordów
        const countSql = `SELECT COUNT(*) as count FROM ${tableName}`;
        db.get(countSql, [], (errCount, countRow) => {
          if (errCount) {
            console.error('Błąd liczenia rekordów tabeli:', errCount.message);
            return res.status(500).json({ message: 'Error counting table records' });
          }

          const columnTypes = {};
          (cols || []).forEach(c => { columnTypes[c.name] = c.type || null; });

          res.json({
            table: tableName,
            columns: columnNames,
            rows: rows || [],
            limit,
            offset,
            total: countRow?.count || 0,
            primaryKey: pkColumns,
            columnTypes
          });
        });
      });
    });
  });
});

// Admin-only: Usuwanie wybranej tabeli (z walidacją)
app.delete('/api/db/table/:name', authenticateToken, requirePermission('MANAGE_DATABASE'), (req, res) => {
  // Tylko administrator może usuwać tabele
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Insufficient permissions for database operations' });
  }

  const tableName = String(req.params.name || '').trim();

  // Prosta walidacja nazwy tabeli
  if (!/^[A-Za-z0-9_]+$/.test(tableName)) {
    return res.status(400).json({ message: 'Invalid table name' });
  }

  // Zabezpieczenie przed usunięciem krytycznych tabel
  const protectedTables = ['users', 'role_permissions', 'app_config'];
  if (protectedTables.includes(tableName)) {
    return res.status(400).json({ message: 'Table is protected and cannot be deleted' });
  }

  const validateSql = `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`;
  db.get(validateSql, [tableName], (err, row) => {
    if (err) {
      console.error('Błąd walidacji nazwy tabeli:', err.message);
      return res.status(500).json({ message: 'Table name validation error' });
    }
    if (!row) {
      return res.status(404).json({ message: 'Table does not exist' });
    }

    db.run(`DROP TABLE IF EXISTS ${tableName}`, (dropErr) => {
      if (dropErr) {
        console.error('Błąd usuwania tabeli:', dropErr.message);
        return res.status(500).json({ message: 'Error deleting table' });
      }

      // Opcjonalnie: zapis do audit_logs
      const auditData = {
        user_id: req.user.id || null,
        action: 'delete',
        target_type: 'table',
        target_id: tableName,
        details: `DROP TABLE ${tableName}`
      };
      db.run(
        "INSERT INTO audit_logs (user_id, username, action, target_type, target_id, details, timestamp) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))",
        [auditData.user_id, req.user.username, auditData.action, auditData.target_type, auditData.target_id, auditData.details],
        (logErr) => {
          if (logErr) {
            console.error('Błąd podczas zapisywania do audit log:', logErr.message);
          }
          return res.json({ message: `Table ${tableName} deleted` });
        }
      );
    });
  });
});

// Admin/permission-only: Aktualizacja wiersza w tabeli po primary key
app.put('/api/db/table/:name/row', authenticateToken, requirePermission('MANAGE_DATABASE'), (req, res) => {
  const tableName = String(req.params.name || '').trim();
  const pkName = String(req.body?.pk || req.body?.pkName || '').trim();
  const pkValue = req.body?.id ?? req.body?.pkValue;
  const updates = req.body?.updates || {};

  if (!/^[A-Za-z0-9_]+$/.test(tableName)) {
    return res.status(400).json({ message: 'Invalid table name' });
  }
  if (!pkName) {
    return res.status(400).json({ message: 'Missing primary key name' });
  }
  if (pkValue === undefined) {
    return res.status(400).json({ message: 'Missing primary key value' });
  }
  if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
    return res.status(400).json({ message: 'No update data provided' });
  }

  // Walidacja tabeli
  const validateSql = `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`;
  db.get(validateSql, [tableName], (err, row) => {
    if (err) {
      console.error('Błąd walidacji nazwy tabeli:', err.message);
      return res.status(500).json({ message: 'Table name validation error' });
    }
    if (!row) {
      return res.status(404).json({ message: 'Table does not exist' });
    }

    // Pobierz schemat, zweryfikuj kolumny i klucz główny
    db.all(`PRAGMA table_info(${tableName})`, [], (errCols, cols) => {
      if (errCols) {
        console.error('Błąd pobierania schematu tabeli:', errCols.message);
        return res.status(500).json({ message: 'Error fetching table schema' });
      }
      const columnNames = (cols || []).map(c => c.name);
      const pkColumns = (cols || []).filter(c => c.pk).map(c => c.name);
      const typesMap = {};
      const notNullMap = {};
      (cols || []).forEach(c => {
        typesMap[c.name] = (c.type || '').toUpperCase();
        notNullMap[c.name] = !!c.notnull;
      });
      if (!pkColumns.includes(pkName)) {
        return res.status(400).json({ message: 'Invalid primary key for this table' });
      }

      // Walidacja typów dla aktualizowanych pól
      for (const [col, val] of Object.entries(updates)) {
        if (!columnNames.includes(col)) {
          return res.status(400).json({ message: `Unknown column: ${col}` });
        }
        if (col === pkName) continue;
        const t = typesMap[col] || '';
        if (notNullMap[col] && (val === null || typeof val === 'undefined')) {
          return res.status(400).json({ message: `Column ${col} is required (NOT NULL)` });
        }
        if (val !== null && typeof val !== 'undefined') {
          if (t.includes('INT')) {
            if (isNaN(parseInt(val, 10))) {
              return res.status(400).json({ message: `Column ${col} expects an integer` });
            }
          } else if (t.includes('REAL') || t.includes('DOUBLE') || t.includes('FLOAT')) {
            if (isNaN(parseFloat(val))) {
              return res.status(400).json({ message: `Column ${col} expects a floating-point number` });
            }
          }
        }
      }

      // Zbuduj bezpieczne SQL
      const setClauses = [];
      const values = [];
      Object.entries(updates).forEach(([col, val]) => {
        if (columnNames.includes(col) && col !== pkName) {
          setClauses.push(`${col} = ?`);
          values.push(val);
        }
      });
      if (setClauses.length === 0) {
        return res.status(400).json({ message: 'No valid columns to update' });
      }
      const sql = `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE ${pkName} = ?`;
      values.push(pkValue);

      db.run(sql, values, function(updateErr) {
        if (updateErr) {
          console.error('Błąd aktualizacji wiersza:', updateErr.message);
          return res.status(500).json({ message: 'Error updating row' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ message: 'Row not found' });
        }
        return res.json({ message: 'Row updated', updated: this.changes });
      });
    });
  });
});

// Admin/permission-only: Usunięcie wiersza po primary key
app.delete('/api/db/table/:name/row', authenticateToken, requirePermission('MANAGE_DATABASE'), (req, res) => {
  const tableName = String(req.params.name || '').trim();
  const pkName = String(req.query?.pk || req.query?.pkName || '').trim();
  const pkValue = req.query?.id ?? req.query?.pkValue;

  if (!/^[A-Za-z0-9_]+$/.test(tableName)) {
    return res.status(400).json({ message: 'Nieprawidłowa nazwa tabeli' });
  }
  if (!pkName) {
    return res.status(400).json({ message: 'Brak nazwy klucza głównego' });
  }
  if (pkValue === undefined) {
    return res.status(400).json({ message: 'Brak wartości klucza głównego' });
  }

  const validateSql = `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`;
  db.get(validateSql, [tableName], (err, row) => {
    if (err) {
      console.error('Błąd walidacji nazwy tabeli:', err.message);
      return res.status(500).json({ message: 'Błąd walidacji nazwy tabeli' });
    }
    if (!row) {
      return res.status(404).json({ message: 'Tabela nie istnieje' });
    }

    db.all(`PRAGMA table_info(${tableName})`, [], (errCols, cols) => {
      if (errCols) {
        console.error('Błąd pobierania schematu tabeli:', errCols.message);
        return res.status(500).json({ message: 'Błąd pobierania schematu tabeli' });
      }
      const pkColumns = (cols || []).filter(c => c.pk).map(c => c.name);
      if (!pkColumns.includes(pkName)) {
        return res.status(400).json({ message: 'Nieprawidłowy klucz główny dla tej tabeli' });
      }

      const sql = `DELETE FROM ${tableName} WHERE ${pkName} = ?`;
      db.run(sql, [pkValue], function(delErr) {
        if (delErr) {
          console.error('Błąd usuwania wiersza:', delErr.message);
          return res.status(500).json({ message: 'Error deleting row' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ message: 'Row not found' });
        }
        return res.json({ message: 'Row deleted', deleted: this.changes });
      });
    });
  });
});

// Admin/permission-only: Dodanie wiersza do tabeli
app.post('/api/db/table/:name/row', authenticateToken, requirePermission('MANAGE_DATABASE'), (req, res) => {
  const tableName = String(req.params.name || '').trim();
  const values = req.body?.values || {};

  if (!/^[A-Za-z0-9_]+$/.test(tableName)) {
    return res.status(400).json({ message: 'Invalid table name' });
  }
  if (!values || typeof values !== 'object' || Object.keys(values).length === 0) {
    return res.status(400).json({ message: 'No row data to insert' });
  }

  const validateSql = `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`;
  db.get(validateSql, [tableName], (err, row) => {
    if (err) {
      console.error('Błąd walidacji nazwy tabeli:', err.message);
      return res.status(500).json({ message: 'Table name validation error' });
    }
    if (!row) {
      return res.status(404).json({ message: 'Table does not exist' });
    }

    db.all(`PRAGMA table_info(${tableName})`, [], (errCols, cols) => {
      if (errCols) {
        console.error('Błąd pobierania schematu tabeli:', errCols.message);
        return res.status(500).json({ message: 'Error fetching table schema' });
      }
      const availableColumns = (cols || []).map(c => c.name);
      const notNullCols = (cols || []).filter(c => c.notnull).map(c => c.name);
      const typesMap = {};
      (cols || []).forEach(c => { typesMap[c.name] = (c.type || '').toUpperCase(); });

      // Walidacja kolumn i prostych typów
      for (const [col, val] of Object.entries(values)) {
        if (!availableColumns.includes(col)) {
          return res.status(400).json({ message: `Unknown column: ${col}` });
        }
        const t = typesMap[col] || '';
        if (t.includes('INT')) {
          if (val !== null && val !== undefined && isNaN(parseInt(val, 10))) {
            return res.status(400).json({ message: `Column ${col} expects an integer` });
          }
        } else if (t.includes('REAL') || t.includes('DOUBLE') || t.includes('FLOAT')) {
          if (val !== null && val !== undefined && isNaN(parseFloat(val))) {
            return res.status(400).json({ message: `Column ${col} expects a floating-point number` });
          }
        }
      }

      // Sprawdź NOT NULL
      for (const col of notNullCols) {
        if (!(col in values)) {
          return res.status(400).json({ message: `Column ${col} is required (NOT NULL)` });
        }
      }

      const insertCols = Object.keys(values).filter(c => availableColumns.includes(c));
      if (insertCols.length === 0) {
        return res.status(400).json({ message: 'No valid columns to insert' });
      }
      const placeholders = insertCols.map(() => '?').join(', ');
      const sql = `INSERT INTO ${tableName} (${insertCols.join(', ')}) VALUES (${placeholders})`;
      const params = insertCols.map(c => values[c]);

      db.run(sql, params, function(insErr) {
        if (insErr) {
          console.error('Błąd dodawania wiersza:', insErr.message);
          return res.status(500).json({ message: 'Error adding row' });
        }
        return res.json({ message: 'Row added', id: this.lastID });
      });
    });
  });
});

// Admin-only: Utworzenie nowej tabeli z prostym schematem
app.post('/api/db/table', authenticateToken, requirePermission('MANAGE_DATABASE'), (req, res) => {
  // Tylko administrator może tworzyć tabele
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Insufficient permissions for database operations' });
  }

  const name = String(req.body?.name || '').trim();
  const columns = Array.isArray(req.body?.columns) ? req.body.columns : [];
  const primaryKey = String(req.body?.primaryKey || '').trim();

  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    return res.status(400).json({ message: 'Invalid table name' });
  }
  if (columns.length === 0) {
    return res.status(400).json({ message: 'No column definitions' });
  }

  const protectedTables = ['users', 'role_permissions', 'app_config'];
  if (protectedTables.includes(name)) {
    return res.status(400).json({ message: 'Table is protected and cannot be created' });
  }

  // Walidacja kolumn
  const colNamesSet = new Set();
  const colDefs = [];
  for (const col of columns) {
    const colName = String(col?.name || '').trim();
    const colType = String(col?.type || 'TEXT').trim().toUpperCase();
    const notNull = !!col?.notNull;
    if (!/^[A-Za-z0-9_]+$/.test(colName)) {
      return res.status(400).json({ message: `Invalid column name: ${colName}` });
    }
    if (colNamesSet.has(colName)) {
      return res.status(400).json({ message: `Duplicate column: ${colName}` });
    }
    colNamesSet.add(colName);
    const allowed = ['TEXT', 'INTEGER', 'REAL', 'BLOB'];
    if (!allowed.includes(colType)) {
      return res.status(400).json({ message: `Unsupported column type: ${colType}` });
    }
    colDefs.push(`${colName} ${colType}${notNull ? ' NOT NULL' : ''}`);
  }

  // Primary key
  let pkClause = '';
  if (primaryKey) {
    if (!colNamesSet.has(primaryKey)) {
      return res.status(400).json({ message: 'Primary key must reference an existing column' });
    }
    pkClause = `, PRIMARY KEY (${primaryKey})`;
  }

  const sql = `CREATE TABLE ${name} (${colDefs.join(', ')}${pkClause})`;
  db.run(sql, [], (err) => {
    if (err) {
      console.error('Błąd tworzenia tabeli:', err.message);
      return res.status(500).json({ message: 'Error creating table' });
    }

    // Zapis do audit_logs
    const auditData = {
      user_id: req.user.id || null,
      action: 'create',
      target_type: 'table',
      target_id: name,
      details: `CREATE TABLE ${name}`
    };
    db.run(
      "INSERT INTO audit_logs (user_id, username, action, target_type, target_id, details, timestamp) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))",
      [auditData.user_id, req.user.username, auditData.action, auditData.target_type, auditData.target_id, auditData.details],
      (logErr) => {
        if (logErr) {
          console.error('Błąd podczas zapisywania do audit log:', logErr.message);
        }
        return res.json({ message: `Table ${name} created` });
      }
    );
  });
});

// Middleware: wymagane uprawnienie z role_permissions (administrator ma pełny dostęp)
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (req.user.role === 'administrator') {
      return next();
    }
    db.get('SELECT 1 as ok FROM role_permissions WHERE role = ? AND permission = ?',
      [req.user.role, permission],
      (err, row) => {
        if (err) {
          console.error('Błąd podczas sprawdzania uprawnień:', err.message);
          return res.status(500).json({ message: 'Server error' });
        }
        if (row && row.ok) {
          return next();
        }
        return res.status(403).json({ message: 'Insufficient permissions' });
      }
    );
  };
}

// ===== API kategorii narzędzi =====
// Pobierz listę kategorii
app.get('/api/categories', authenticateToken, (req, res) => {
  db.all('SELECT id, name FROM tool_categories ORDER BY name', (err, rows) => {
    if (err) {
      console.error('Błąd podczas pobierania kategorii:', err.message);
      return res.status(500).json({ error: 'Server error' });
    }
    res.json(rows);
  });
});

// Pobierz listę kategorii wraz z liczbą narzędzi w każdej kategorii
app.get('/api/categories/stats', authenticateToken, (req, res) => {
  const sql = `
    SELECT 
      c.id,
      c.name,
      COALESCE(COUNT(t.id), 0) AS tool_count
    FROM tool_categories c
    LEFT JOIN tools t ON LOWER(t.category) = LOWER(c.name)
    GROUP BY c.id, c.name
    ORDER BY c.name
  `;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Błąd podczas pobierania statystyk kategorii:', err.message);
      return res.status(500).json({ error: 'Server error' });
    }
    res.json(rows);
  });
});

// Dodaj kategorię (administrator)
app.post('/api/categories', authenticateToken, (req, res) => {
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Insufficient permissions to manage categories' });
  }
  const { name } = req.body || {};
  if (!name || String(name).trim() === '') {
    return res.status(400).json({ error: 'Category name is required' });
  }
  const normalized = String(name).trim();
  db.run('INSERT INTO tool_categories (name) VALUES (?)', [normalized], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'A category with this name already exists' });
      }
      console.error('Błąd podczas dodawania kategorii:', err.message);
      return res.status(500).json({ error: 'Server error' });
    }
    db.get('SELECT id, name FROM tool_categories WHERE id = ?', [this.lastID], (getErr, row) => {
      if (getErr) {
        return res.status(500).json({ error: 'Error fetching category' });
      }
      res.status(201).json(row);
    });
  });
});

// Aktualizuj kategorię (administrator)
app.put('/api/categories/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Insufficient permissions to manage categories' });
  }
  const { id } = req.params;
  const { name } = req.body || {};
  if (!name || String(name).trim() === '') {
    return res.status(400).json({ error: 'Category name is required' });
  }
  const normalized = String(name).trim();
  db.run('UPDATE tool_categories SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [normalized, id], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'A category with this name already exists' });
      }
      console.error('Błąd podczas aktualizacji kategorii:', err.message);
      return res.status(500).json({ error: 'Server error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    db.get('SELECT id, name FROM tool_categories WHERE id = ?', [id], (getErr, row) => {
      if (getErr) {
        return res.status(500).json({ error: 'Error fetching category' });
      }
      res.json(row);
    });
  });
});

// Usuń kategorię (administrator)
app.delete('/api/categories/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Insufficient permissions to manage categories' });
  }
  const { id } = req.params;
  db.run('DELETE FROM tool_categories WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('Błąd podczas usuwania kategorii:', err.message);
      return res.status(500).json({ error: 'Server error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json({ message: 'Category deleted' });
  });
});

// Usuń kategorię po nazwie (administrator)
app.delete('/api/categories/by-name/:name', authenticateToken, (req, res) => {
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ message: 'Insufficient permissions to manage categories' });
  }
  const { name } = req.params;
  const normalized = String(name || '').trim();
  if (!normalized) {
    return res.status(400).json({ error: 'Category name is required' });
  }
  db.get('SELECT id FROM tool_categories WHERE LOWER(name) = LOWER(?)', [normalized], (findErr, cat) => {
    if (findErr) {
      console.error('Błąd wyszukiwania kategorii po nazwie:', findErr.message);
      return res.status(500).json({ error: 'Server error' });
    }
    if (!cat) {
      return res.json({ message: 'Category record does not exist', deleted: false });
    }
    db.run('DELETE FROM tool_categories WHERE id = ?', [cat.id], function(deleteErr) {
      if (deleteErr) {
        console.error('Błąd usuwania kategorii po nazwie:', deleteErr.message);
        return res.status(500).json({ error: 'Server error' });
      }
      res.json({ message: 'Category deleted (by-name)', deleted: true });
    });
  });
});

// Print API: wysyłanie zadań do drukarek sieciowych (IPP lub Zebra RAW 9100)
app.post('/api/print', authenticateToken, async (req, res) => {
  try {
    const { protocol = 'ipp', printerUrl, contentType = 'image/png', dataBase64, zpl, copies = 1, jobName = 'SZN Label' } = req.body || {};
    if (!printerUrl) {
      return res.status(400).json({ message: 'Missing field printerUrl' });
    }
    if (protocol === 'ipp') {
      if (!ipp) {
        return res.status(500).json({ message: 'IPP module is not installed. Run npm install ipp.' });
      }
      try {
        const printer = ipp.Printer(printerUrl);
        const dataBuf = Buffer.from(String(dataBase64 || ''), 'base64');
        const msg = {
          'operation': 'Print-Job',
          'requestId': 1,
          'attributes': {
            'requesting-user-name': 'szn',
            'job-name': jobName,
            'document-format': contentType
          },
          'data': dataBuf
        };
        printer.execute('Print-Job', msg, (err, ret) => {
          if (err) {
            return res.status(500).json({ message: err.message || 'IPP error' });
          }
          return res.json({ status: 'ok', jobId: ret && ret['job-id'] });
        });
      } catch (e) {
        return res.status(500).json({ message: e.message || 'IPP exception' });
      }
    } else if (protocol === 'zebra_raw') {
      try {
        const u = new URL(printerUrl);
        const host = u.hostname;
        const port = Number(u.port) || 9100;
        const client = new net.Socket();
        const payload = zpl ? Buffer.from(zpl, 'utf8') : Buffer.from(String(dataBase64 || ''), 'base64');
        let responded = false;
        client.on('error', (err) => {
          if (!responded) {
            responded = true;
            res.status(500).json({ message: err.message || 'RAW connection error' });
          }
        });
        client.connect(port, host, () => {
          client.write(payload);
          client.end();
        });
        client.on('close', () => {
          if (!responded) {
            responded = true;
            res.json({ status: 'ok' });
          }
        });
      } catch (e) {
        return res.status(500).json({ message: e.message || 'Zebra RAW exception' });
      }
    } else {
      return res.status(400).json({ message: `Unsupported protocol: ${protocol}` });
    }
  } catch (error) {
    console.error('Print API error:', error);
    return res.status(500).json({ message: 'Unexpected Print API error' });
  }
});
function sanitizeNamePart(str, take = 3) {
  if (!str) return '';
  const noDiacritics = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const lettersOnly = noDiacritics.replace(/[^a-zA-Z]/g, '');
  return lettersOnly.slice(0, take).toLowerCase();
}

function randomFromAlphabet(length, alphabet) {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function generateEmployeeLogin(firstName, lastName, cb) {
  const base = sanitizeNamePart(firstName, 3) + sanitizeNamePart(lastName, 3);
  const alphabet = '0123456789';
  const tryGenerate = () => {
    const candidate = base + randomFromAlphabet(4, alphabet);
    // Ensure uniqueness in users table
    db.get('SELECT id FROM users WHERE username = ?', [candidate], (err, row) => {
      if (err) return cb(err);
      if (row) return tryGenerate(); // collision, try again
      cb(null, candidate);
    });
  };
  tryGenerate();
}

function generateRandomPassword(length = 10) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return randomFromAlphabet(length, alphabet);
}

function sendCredentialsEmail(email, username, password, fullName, callback) {
  if (!email) return callback && callback(null);
  if (!nodemailerOptional) {
    console.warn('Email not sent: nodemailer is not installed.');
    return callback && callback(null);
  }
  // Pobierz konfigurację SMTP z bazy; fallback do zmiennych środowiskowych
  db.get('SELECT smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, smtp_from FROM app_config WHERE id = 1', [], (err, row) => {
    if (err) {
      console.warn('Email not sent: cannot read SMTP config from DB, using env.');
    }
    const host = (row && row.smtp_host) || process.env.SMTP_HOST;
    const port = parseInt((row && row.smtp_port) || process.env.SMTP_PORT || '587', 10);
    // Force secure=true for port 465 (implicit SSL) to avoid common misconfigurations
    const configuredSecure = !!((row && row.smtp_secure) || ((process.env.SMTP_SECURE || 'false').toLowerCase() === 'true'));
    const secure = port === 465 ? true : configuredSecure;
    const user = (row && row.smtp_user) || process.env.SMTP_USER;
    const pass = (row && row.smtp_pass) || process.env.SMTP_PASS;
    const from = (row && row.smtp_from) || process.env.SMTP_FROM || 'toolroom';
    if (!host || !user || !pass) {
      console.warn('Email not sent: SMTP configuration missing.');
      return callback && callback(null);
    }
    const transporter = nodemailerOptional.createTransport({ host, port, secure, auth: { user, pass } });

    // Prepare HTML template with logo and footer
    const legalNotice = 'The content of this message is confidential and must not be disclosed. If you are not the intended recipient, an employee, or an intermediary authorized to forward it to the recipient, please note that any dissemination, reproduction, or other use of this message is prohibited. If you received this message by mistake, please immediately notify the sender by replying to this message and delete all its copies.';
    const logoPath = path.join(__dirname, 'public', 'logo.png');
    const hasLogo = fs.existsSync(logoPath);
    const html = `
      <div style="font-family:Segoe UI,Roboto,Arial,sans-serif;background:#f7f7f8;padding:24px;color:#111;">
        <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:8px;overflow:hidden;">
          <div style="padding:20px 24px;border-bottom:1px solid #eee;display:flex;align-items:center;gap:12px;">
            ${hasLogo ? '<img src="cid:app_logo" alt="Logo" style="height:40px;">' : ''}
            <div style="font-size:18px;font-weight:600;">Login Credentials</div>
          </div>
          <div style="padding:24px;">
            <p style="margin:0 0 12px;">Hello <strong>${escapeHtml(fullName)}</strong>,</p>
            <p style="margin:0 0 16px;">Your account has been created. Below are your login details:</p>
            <div style="display:flex;gap:12px;flex-wrap:wrap;margin:8px 0 16px;">
              <div style="flex:1;min-width:220px;border:1px solid #e5e7eb;border-radius:6px;padding:12px;">
                <div style="font-size:12px;color:#6b7280;">Username</div>
                <div style="font-size:16px;font-weight:600;color:#111;">${escapeHtml(username)}</div>
              </div>
              <div style="flex:1;min-width:220px;border:1px solid #e5e7eb;border-radius:6px;padding:12px;">
                <div style="font-size:12px;color:#6b7280;">Password</div>
                <div style="font-size:16px;font-weight:600;color:#111;">${escapeHtml(password)}</div>
              </div>
            </div>
            <p style="margin:0 0 12px;color:#374151;">For security, please change the password after your first login.</p>
          </div>
          <div style="padding:16px 24px;border-top:1px solid #eee;">
            <small style="display:block;font-size:12px;color:#6b7280;font-style:italic;line-height:1.5;">${escapeHtml(legalNotice)}</small>
          </div>
        </div>
      </div>`;

    const mailOptions = {
      from,
      to: email,
      subject: 'Dane do logowania — System Zarządzania Narzędziownią',
      text: `Witaj ${fullName},\n\nTwoje konto zostało utworzone.\nLogin: ${username}\nHasło: ${password}\n\nZalecamy zmianę hasła po pierwszym logowaniu.\n\n${legalNotice}`,
      html,
      attachments: hasLogo ? [{ filename: 'logo.png', path: logoPath, cid: 'app_logo' }] : []
    };

    transporter.sendMail(mailOptions, (sendErr, info) => {
      if (sendErr) {
        console.error('Błąd wysyłki e-maila z danymi logowania:', sendErr.message);
        return callback && callback(sendErr);
      }
      console.log('Wysłano e-mail z danymi logowania:', info && info.response);
      callback && callback(null);
    });
  });
}

// Prosta funkcja ucieczki HTML do bezpiecznego renderowania
function escapeHtml(str) {
  if (typeof str !== 'string') return String(str || '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
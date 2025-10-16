const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Błąd połączenia z bazą danych:', err.message);
    process.exit(1);
  } else {
    console.log('✅ Połączono z bazą danych SQLite:', dbPath);
  }
});

const tables = [
  'app_config',
  'audit_logs',
  'bhp',
  'bhp_issues',
  'departments',
  'employees',
  'employees_new',
  'positions',
  'role_permissions',
  'tool_categories',
  'tool_issues',
  'tool_service_history',
  'tools',
  'users',
];

function countTable(table) {
  return new Promise((resolve) => {
    db.get(`SELECT COUNT(*) as cnt FROM ${table}`, (err, row) => {
      if (err) {
        resolve({ table, error: err.message });
      } else {
        resolve({ table, count: row.cnt });
      }
    });
  });
}

(async () => {
  const results = [];
  for (const t of tables) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await countTable(t));
  }

  console.log('\n📊 Liczba rekordów w każdej tabeli:');
  results.forEach((r) => {
    if (r.error) {
      console.log(`- ${r.table}: ERROR ${r.error}`);
    } else {
      console.log(`- ${r.table}: ${r.count}`);
    }
  });

  db.close();
})();
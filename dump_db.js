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

function listTables() {
  return new Promise((resolve, reject) => {
    db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name", (err, rows) => {
      if (err) return reject(err);
      resolve(rows.map(r => r.name));
    });
  });
}

function getTableInfo(table) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${table})`, (err, cols) => {
      if (err) return reject(err);
      resolve(cols);
    });
  });
}

function getCount(table) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT COUNT(*) as cnt FROM ${table}`, (err, row) => {
      if (err) return reject(err);
      resolve(row.cnt);
    });
  });
}

function getSampleRows(table, limit = 10) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM ${table} LIMIT ${limit}`, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

(async () => {
  try {
    const tables = await listTables();
    console.log('\n📋 Tabele w bazie danych:');
    tables.forEach(t => console.log(`- ${t}`));

    console.log('\n=== Szczegóły tabel (liczba rekordów i próbka danych) ===');
    for (const table of tables) {
      console.log(`\n┌──────────────────────────────────────────────`);
      console.log(`│ Tabela: ${table}`);
      const cols = await getTableInfo(table);
      const count = await getCount(table);
      console.log(`│ Kolumny: ${cols.map(c => `${c.name}(${c.type})`).join(', ')}`);
      console.log(`│ Liczba rekordów: ${count}`);
      if (count > 0) {
        const rows = await getSampleRows(table, 10);
        console.log(`│ Próbka rekordów (max 10):`);
        rows.forEach((row, idx) => {
          console.log(`│  ${idx + 1}. ${JSON.stringify(row)}`);
        });
      } else {
        console.log('│ Brak rekordów w tabeli');
      }
      console.log(`└──────────────────────────────────────────────`);
    }
  } catch (e) {
    console.error('❌ Błąd podczas odczytu bazy:', e.message);
  } finally {
    db.close();
  }
})();
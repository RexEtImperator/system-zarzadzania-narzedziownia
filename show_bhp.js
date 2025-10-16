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

function getColumns() {
  return new Promise((resolve, reject) => {
    db.all('PRAGMA table_info(bhp)', (err, cols) => {
      if (err) return reject(err);
      resolve(cols);
    });
  });
}

function getAllRows() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM bhp ORDER BY id', (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

(async () => {
  try {
    const cols = await getColumns();
    console.log('\n📋 Kolumny w bhp:', cols.map(c => `${c.name}(${c.type})`).join(', '));
    const rows = await getAllRows();
    console.log(`\n📦 Liczba rekordów w bhp: ${rows.length}`);
    if (rows.length === 0) {
      console.log('Brak rekordów.');
    } else {
      console.log('\n=== Rekordy bhp ===');
      rows.forEach((row, idx) => {
        console.log(`${idx + 1}. ${JSON.stringify(row)}`);
      });
    }
  } catch (e) {
    console.error('❌ Błąd podczas odczytu bhp:', e.message);
  } finally {
    db.close();
  }
})();
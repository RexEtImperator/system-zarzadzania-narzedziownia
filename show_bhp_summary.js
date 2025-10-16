const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Błąd połączenia z bazą danych:', err.message);
    process.exit(1);
  }
});

const sql = `
  SELECT id, inventory_number, manufacturer, model, serial_number,
         status, inspection_date, is_set
  FROM bhp
  ORDER BY id
`;

db.all(sql, (err, rows) => {
  if (err) {
    console.error('❌ Błąd zapytania:', err.message);
    process.exit(1);
  }
  console.log(`📦 Liczba rekordów: ${rows.length}`);
  rows.forEach((r) => {
    console.log(`${r.id}. ${r.inventory_number} | ${r.manufacturer} ${r.model} | SN: ${r.serial_number} | ${r.status} | Przegląd: ${r.inspection_date} | Zestaw: ${r.is_set ? 'tak' : 'nie'}`);
  });
  db.close();
});
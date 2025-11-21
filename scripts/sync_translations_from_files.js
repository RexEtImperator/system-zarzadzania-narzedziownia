const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

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

async function main() {
  const dbPath = path.join(__dirname, '..', 'database.db');
  const db = new sqlite3.Database(dbPath);
  const i18nDir = path.join(__dirname, '..', 'src', 'i18n');
  const files = {
    pl: path.join(i18nDir, 'pl.json'),
    en: path.join(i18nDir, 'en.json'),
    de: path.join(i18nDir, 'de.json'),
  };

  const dicts = {
    pl: flattenObject(readJsonSafe(files.pl)),
    en: flattenObject(readJsonSafe(files.en)),
    de: flattenObject(readJsonSafe(files.de)),
  };

  const stmtSql = `INSERT INTO translate(lang, key, value, updated_at) VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(lang, key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`;
  const stmt = db.prepare(stmtSql);
  let updates = 0;

  try {
    db.serialize(() => {
      for (const lang of Object.keys(dicts)) {
        for (const [k, v] of Object.entries(dicts[lang])) {
          stmt.run(lang, k, v, function(err) {
            if (!err) updates++;
          });
        }
      }
      stmt.finalize((err) => {
        if (err) {
          console.error('Error finalizing sync statement:', err.message);
          process.exitCode = 1;
        } else {
          console.log(`Synced translations from files into DB. Upserts executed: ${updates}`);
        }
        db.close();
      });
    });
  } catch (e) {
    console.error('Failed to sync translations:', e.message);
    process.exitCode = 1;
    db.close();
  }
}

main();
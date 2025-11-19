// Sync missing i18n keys from src/i18n/*.json into SQLite 'translate' table
// Inserts only missing pairs (lang,key); existing DB values are preserved

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

async function getExistingKeys(db, lang) {
  return new Promise((resolve, reject) => {
    db.all('SELECT key FROM translate WHERE lang = ?', [lang], (err, rows) => {
      if (err) return reject(err);
      resolve(new Set((rows || []).map(r => r.key)));
    });
  });
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

  try {
    const langs = ['pl', 'en', 'de'];
    const insertedCounts = { pl: 0, en: 0, de: 0 };

    for (const lang of langs) {
      const existing = await getExistingKeys(db, lang);
      const stmt = db.prepare('INSERT OR IGNORE INTO translate (lang, key, value, updated_at) VALUES (?, ?, ?, datetime("now"))');
      for (const [key, value] of Object.entries(dicts[lang])) {
        if (!existing.has(key)) {
          stmt.run(lang, key, value);
          insertedCounts[lang]++;
        }
      }
      await new Promise((resolve, reject) => {
        stmt.finalize(err => (err ? reject(err) : resolve()));
      });
    }

    console.log('Translation synchronization completed. Missing keys inserted:', insertedCounts);
  } catch (e) {
    console.error('Failed to synchronize translations:', e.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

main();
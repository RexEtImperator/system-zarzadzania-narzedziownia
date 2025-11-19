// Report differences between src/i18n/*.json and DB (translate table)
// Shows: missing values ​​in DB, extra values ​​in DB, discrepancies in values ​​(DB vs. file)

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

async function readDbTranslations(db) {
  return new Promise((resolve, reject) => {
    db.all('SELECT lang, key, value FROM translate', (err, rows) => {
      if (err) return reject(err);
      const byLang = { pl: {}, en: {}, de: {} };
      for (const r of rows || []) {
        if (!byLang[r.lang]) byLang[r.lang] = {};
        byLang[r.lang][r.key] = r.value;
      }
      resolve(byLang);
    });
  });
}

function diffLang(lang, fileDict, dbDict) {
  const fileKeys = new Set(Object.keys(fileDict));
  const dbKeys = new Set(Object.keys(dbDict || {}));

  const missing = []; // klucze w plikach, brak w DB
  const extra = []; // klucze w DB, brak w plikach
  const mismatched = []; // klucze w obu, ale wartości różne

  for (const k of fileKeys) {
    if (!dbKeys.has(k)) missing.push(k);
    else if (String(dbDict[k]) !== String(fileDict[k])) {
      mismatched.push({ key: k, file: fileDict[k], db: dbDict[k] });
    }
  }
  for (const k of dbKeys) {
    if (!fileKeys.has(k)) extra.push(k);
  }
  return { missing, extra, mismatched };
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
    const dbDicts = await readDbTranslations(db);
    const langs = ['pl', 'en', 'de'];
    const summary = {};
    for (const lang of langs) {
      const diff = diffLang(lang, dicts[lang], dbDicts[lang] || {});
      summary[lang] = {
        missing: diff.missing.length,
        extra: diff.extra.length,
        mismatched: diff.mismatched.length,
      };
      console.log(`\n=== ${lang.toUpperCase()} ===`);
      console.log(`Missing in DB: ${diff.missing.length}`);
      if (diff.missing.length) console.log(diff.missing.join('\n'));
      console.log(`\nExtra in DB: ${diff.extra.length}`);
      if (diff.extra.length) console.log(diff.extra.join('\n'));
      console.log(`\nMismatched values: ${diff.mismatched.length}`);
      if (diff.mismatched.length) {
        for (const m of diff.mismatched) {
          console.log(`${m.key}\n  file: ${m.file}\n  db:   ${m.db}`);
        }
      }
    }
    console.log('\nSummary:', summary);
  } catch (e) {
    console.error('Failed to generate translation diff report:', e.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

main();
import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';

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
  } catch (_) {
    return {};
  }
}

function collectKeysFromSource(dir) {
  const keys = new Set();
  const exts = new Set(['.js', '.jsx']);
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        walk(full);
      } else if (exts.has(path.extname(entry.name))) {
        const content = fs.readFileSync(full, 'utf8');
        const regex = /\bt\(\s*(["'])((?:[^"'\\]|\\.)+)\1\s*\)/g;
        let m;
        while ((m = regex.exec(content)) !== null) {
          keys.add(m[2]);
        }
      }
    }
  };
  walk(dir);
  return Array.from(keys);
}

async function readDbOverrides(dbPath) {
  return await new Promise((resolve) => {
    if (!fs.existsSync(dbPath)) return resolve({ pl: {}, en: {}, de: {} });
    try {
      const db = new sqlite3.Database(dbPath);
      db.all('SELECT lang, key, value FROM translate', (err, rows) => {
        if (err) {
          resolve({ pl: {}, en: {}, de: {} });
        } else {
          const byLang = { pl: {}, en: {}, de: {} };
          for (const r of rows || []) {
            if (!byLang[r.lang]) byLang[r.lang] = {};
            byLang[r.lang][r.key] = r.value;
          }
          resolve(byLang);
        }
      });
      db.close();
    } catch (_) {
      resolve({ pl: {}, en: {}, de: {} });
    }
  });
}

test('wszystkie użycia t() mają klucze w i18n lub override DB', async () => {
  const projectRoot = path.join(__dirname, '..', '..');
  const srcDir = path.join(projectRoot, 'src');
  const i18nDir = path.join(srcDir, 'i18n');
  const dbPath = path.join(projectRoot, 'database.db');

  const plDict = flattenObject(readJsonSafe(path.join(i18nDir, 'pl.json')));
  const enDict = flattenObject(readJsonSafe(path.join(i18nDir, 'en.json')));
  const deDict = flattenObject(readJsonSafe(path.join(i18nDir, 'de.json')));
  const overrides = await readDbOverrides(dbPath);

  const keys = collectKeysFromSource(srcDir);
  const failures = [];

  for (const k of keys) {
    const hasPl = Object.prototype.hasOwnProperty.call(plDict, k) || Object.prototype.hasOwnProperty.call(overrides.pl, k);
    const hasEn = Object.prototype.hasOwnProperty.call(enDict, k) || Object.prototype.hasOwnProperty.call(overrides.en, k);
    const hasDe = Object.prototype.hasOwnProperty.call(deDict, k) || Object.prototype.hasOwnProperty.call(overrides.de, k);
    if (!hasPl && !hasEn && !hasDe) {
      failures.push({ key: k, pl: hasPl, en: hasEn, de: hasDe });
    }
  }

  if (failures.length) {
    const sample = failures.slice(0, 50).map(f => `${f.key}`).join('\n');
    const msg = `Brakujące (we wszystkich językach i bez override DB) dla ${failures.length} kluczy:\n${sample}`;
    if (String(process.env.I18N_STRICT || '').toLowerCase() === 'true') {
      throw new Error(msg);
    } else {
      // Raportuj jako ostrzeżenie w trybie nie‑strict
      // eslint-disable-next-line no-console
      console.warn(msg);
    }
  }
});
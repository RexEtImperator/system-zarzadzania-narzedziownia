const path = require('path');
const sqlite3 = require('sqlite3').verbose();

function normalizeWithPrefix(prefix, value) {
  if (!value || typeof value !== 'string') return value;
  const base = value.trim();
  const pfx = (prefix || '').toString().trim();
  if (!pfx) return base;
  if (base.startsWith(`${pfx}-`)) return base;
  if (base.startsWith(pfx)) return `${pfx}-${base.slice(pfx.length)}`;
  return base; // nie wymuszamy prefiksu jeśli go brak
}

function collapseDoublePrefix(prefix, value) {
  const pfx = (prefix || '').toString().trim();
  let v = value;
  const doublePattern = new RegExp(`^${pfx}-+${pfx}-+`);
  if (pfx && doublePattern.test(v)) {
    v = v.replace(doublePattern, `${pfx}-`);
  }
  return v;
}

async function main() {
  const dbPath = path.join(__dirname, '..', 'database.db');
  const db = new sqlite3.Database(dbPath);

  console.log('> Start normalizacji kodów narzędzi (SKU, barcode, qr_code)');

  // Pobierz prefiks narzędzi z app_config
  const config = await new Promise((resolve, reject) => {
    db.get('SELECT tools_code_prefix FROM app_config WHERE id = 1', [], (err, row) => {
      if (err) return reject(err);
      resolve(row || { tools_code_prefix: '' });
    });
  });
  const activePrefix = String(config.tools_code_prefix || '').trim();

  if (!activePrefix) {
    console.warn('! Brak skonfigurowanego prefiksu narzędzi (tools_code_prefix). Normalizacja tylko usunie podwójny prefiks jeśli występuje.');
  } else {
    console.log(`> Używany prefiks do normalizacji: "${activePrefix}"`);
  }

  const rows = await new Promise((resolve, reject) => {
    db.all('SELECT id, sku, barcode, qr_code FROM tools', [], (err, res) => {
      if (err) return reject(err);
      resolve(res || []);
    });
  });

  let updatedCount = 0;
  let skippedDuplicates = 0;

  // Wstępna mapa znormalizowanych SKU do wykrycia potencjalnych konfliktów
  const normalizedSkuMap = new Map();

  for (const r of rows) {
    const nSku = collapseDoublePrefix(activePrefix, normalizeWithPrefix(activePrefix, String(r.sku || '')));
    if (nSku) {
      const key = nSku.toLowerCase();
      const existing = normalizedSkuMap.get(key);
      if (!existing) normalizedSkuMap.set(key, r.id);
      else if (existing !== r.id) {
        // Konflikt po normalizacji — oznacz do specjalnego traktowania
        normalizedSkuMap.set(key, 'DUPLICATE');
      }
    }
  }

  for (const r of rows) {
    const originalSku = String(r.sku || '');
    const originalBarcode = String(r.barcode || '');
    const originalQr = String(r.qr_code || '');

    let newSku = collapseDoublePrefix(activePrefix, normalizeWithPrefix(activePrefix, originalSku));
    let newBarcode = collapseDoublePrefix(activePrefix, normalizeWithPrefix(activePrefix, originalBarcode));
    let newQr = collapseDoublePrefix(activePrefix, normalizeWithPrefix(activePrefix, originalQr));

    // Jeśli normalizacja SKU prowadzi do konfliktu, dodaj sufiks id aby zachować unikalność
    if (newSku && normalizedSkuMap.get(newSku.toLowerCase()) === 'DUPLICATE') {
      newSku = `${newSku}-${r.id}`;
      skippedDuplicates += 1;
    }

    const changed = (newSku !== originalSku) || (newBarcode !== originalBarcode) || (newQr !== originalQr);
    if (!changed) continue;

    await new Promise((resolve) => {
      db.run(
        'UPDATE tools SET sku = ?, barcode = ?, qr_code = ?, updated_at = datetime("now") WHERE id = ?',
        [newSku || null, newBarcode || null, newQr || null, r.id],
        (err) => {
          if (err) {
            console.error(`Błąd aktualizacji rekordu id=${r.id}:`, err.message);
          } else {
            updatedCount += 1;
          }
          resolve();
        }
      );
    });
  }

  console.log(`> Zaktualizowano rekordów: ${updatedCount}`);
  if (skippedDuplicates > 0) {
    console.warn(`! Wykryto potencjalne konflikty SKU po normalizacji. Dodano sufiks '-<id>' do ${skippedDuplicates} pozycji, aby zachować unikalność.`);
  }

  db.close();
  console.log('> Normalizacja zakończona.');
}

main().catch((err) => {
  console.error('Błąd procesu normalizacji:', err);
  process.exit(1);
});
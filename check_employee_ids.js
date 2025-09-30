const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Połączenie z bazą danych
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('Sprawdzanie ID pracowników...');

db.serialize(() => {
  // Sprawdzenie pracowników bez brand_number
  db.all('SELECT id, first_name, last_name, brand_number FROM employees WHERE brand_number IS NULL OR brand_number = ""', (err, rows) => {
    if (err) {
      console.error('❌ Błąd pobierania pracowników bez brand_number:', err.message);
      db.close();
      return;
    }
    
    console.log(`\n📊 Pracownicy bez brand_number: ${rows.length}`);
    
    if (rows.length > 0) {
      console.log('\n👥 Pracownicy bez brand_number:');
      rows.forEach(emp => {
        console.log(`ID: ${emp.id} - ${emp.first_name} ${emp.last_name} (brand_number: ${emp.brand_number || 'BRAK'})`);
      });
      
      // Dodanie brand_number dla pracowników którzy go nie mają
      console.log('\n🔄 Dodawanie brand_number dla pracowników...');
      
      let completed = 0;
      rows.forEach((emp, index) => {
        // Generowanie brand_number na podstawie ID (np. ID 9 -> brand_number "009")
        const brandNumber = emp.id.toString().padStart(3, '0');
        
        db.run('UPDATE employees SET brand_number = ? WHERE id = ?', [brandNumber, emp.id], function(err) {
          if (err) {
            console.error(`❌ Błąd aktualizacji pracownika ID ${emp.id}:`, err.message);
          } else {
            console.log(`✅ Zaktualizowano: ${emp.first_name} ${emp.last_name} -> brand_number: ${brandNumber}`);
          }
          
          completed++;
          if (completed === rows.length) {
            checkFinalState();
          }
        });
      });
    } else {
      console.log('✅ Wszyscy pracownicy mają już brand_number');
      checkFinalState();
    }
  });
  
  function checkFinalState() {
    console.log('\n📋 Sprawdzanie końcowego stanu...');
    
    // Sprawdzenie wszystkich pracowników
    db.all('SELECT id, first_name, last_name, brand_number FROM employees ORDER BY CAST(brand_number AS INTEGER)', (err, rows) => {
      if (err) {
        console.error('❌ Błąd pobierania wszystkich pracowników:', err.message);
      } else {
        console.log(`\n📊 Łączna liczba pracowników: ${rows.length}`);
        console.log('\n👥 Wszyscy pracownicy z ID:');
        rows.forEach(emp => {
          console.log(`ID: ${emp.id} | Brand: ${emp.brand_number} - ${emp.first_name} ${emp.last_name}`);
        });
      }
      
      db.close((err) => {
        if (err) {
          console.error('❌ Błąd zamykania bazy:', err.message);
        } else {
          console.log('\n🔒 Połączenie z bazą danych zostało zamknięte');
        }
      });
    });
  }
});
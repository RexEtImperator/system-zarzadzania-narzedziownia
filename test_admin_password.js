const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const db = new sqlite3.Database('./database.db');

db.get('SELECT password FROM users WHERE username = ?', ['admin'], (err, row) => {
  if (err) {
    console.error(err);
    return;
  }
  
  if (!row) {
    console.log('User admin not found');
    return;
  }
  
  const passwords = ['admin', 'admin123', 'password', '123456', 'natalka9'];
  
  passwords.forEach(pwd => {
    const isValid = bcrypt.compareSync(pwd, row.password);
    console.log(`Password '${pwd}': ${isValid ? 'VALID' : 'invalid'}`);
  });
  
  db.close();
});
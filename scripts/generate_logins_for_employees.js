const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
let nodemailerOptional = null;
try { nodemailerOptional = require('nodemailer'); } catch (_) { nodemailerOptional = null; }

const dbPath = path.join(__dirname, '..', 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Błąd połączenia z bazą danych:', err.message);
    process.exit(1);
  }
});

function sanitizeNamePart(str, take = 3) {
  if (!str) return '';
  const noDiacritics = str.normalize('NFD').replace(/[^\u0000-\u007F]/g, '');
  const lettersOnly = noDiacritics.replace(/[^a-zA-Z]/g, '');
  return lettersOnly.slice(0, take).toLowerCase();
}

function randomFromAlphabet(length, alphabet) {
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function generateEmployeeLogin(firstName, lastName) {
  const base = sanitizeNamePart(firstName, 3) + sanitizeNamePart(lastName, 3);
  const alphabet = '0123456789';
  return new Promise((resolve, reject) => {
    const tryGenerate = () => {
      const candidate = base + randomFromAlphabet(4, alphabet);
      db.get('SELECT id FROM users WHERE username = ?', [candidate], (err, row) => {
        if (err) return reject(err);
        if (row) return tryGenerate();
        resolve(candidate);
      });
    };
    tryGenerate();
  });
}

function generateRandomPassword(length = 10) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return randomFromAlphabet(length, alphabet);
}

function sendCredentialsEmail(email, username, password, fullName) {
  return new Promise((resolve) => {
    if (!email) return resolve({ skipped: true });
    if (!nodemailerOptional) {
      console.warn('Email nie wysłany: brak zainstalowanego nodemailer.');
      return resolve({ skipped: true });
    }
    db.get('SELECT smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, smtp_from FROM app_config WHERE id = 1', [], (err, row) => {
      const host = (row && row.smtp_host) || process.env.SMTP_HOST;
      const port = parseInt((row && row.smtp_port) || process.env.SMTP_PORT || '587', 10);
      const configuredSecure = !!((row && row.smtp_secure) || ((process.env.SMTP_SECURE || 'false').toLowerCase() === 'true'));
      const secure = port === 465 ? true : configuredSecure;
      const user = (row && row.smtp_user) || process.env.SMTP_USER;
      const pass = (row && row.smtp_pass) || process.env.SMTP_PASS;
      const from = (row && row.smtp_from) || process.env.SMTP_FROM || 'narzędziownia';
      if (!host || !user || !pass) {
        console.warn('Email nie wysłany: brak pełnej konfiguracji SMTP.');
        return resolve({ skipped: true });
      }
      const transporter = nodemailerOptional.createTransport({ host, port, secure, auth: { user, pass } });
      const legalNotice = 'Treść niniejszej wiadomości jest poufna i objęta zakazem jej ujawniania. Jeśli odbiorca tej wiadomości nie jest jej zamierzonym adresatem, pracownikiem lub pośrednikiem upoważnionym do jej przekazania adresatowi, informujemy że wszelkie rozpowszechnianie, powielanie lub jakiekolwiek inne wykorzystywanie niniejszej wiadomości jest zabronione. Jeżeli zatem wiadomość ta została otrzymana omyłkowo, prosimy o bezzwłoczne zawiadomienie nadawcy w trybie odpowiedzi na niniejszą wiadomość oraz o usunięcie wszystkich jej kopii.';
      const logoPath = path.join(__dirname, '..', 'public', 'logo.png');
      let hasLogo = false;
      try { hasLogo = require('fs').existsSync(logoPath); } catch (_) { hasLogo = false; }
      const html = `
        <div style="font-family:Segoe UI,Roboto,Arial,sans-serif;background:#f7f7f8;padding:24px;color:#111;">
          <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:8px;overflow:hidden;">
            <div style="padding:20px 24px;border-bottom:1px solid #eee;display:flex;align-items:center;gap:12px;">
              ${hasLogo ? '<img src="cid:app_logo" alt="Logo" style="height:40px;">' : ''}
              <div style="font-size:18px;font-weight:600;">Dane do logowania</div>
            </div>
            <div style="padding:24px;">
              <p style="margin:0 0 12px;">Witaj <strong>${escapeHtml(fullName)}</strong>,</p>
              <p style="margin:0 0 16px;">Twoje konto zostało utworzone. Poniżej znajdują się dane do logowania:</p>
              <div style="display:flex;gap:12px;flex-wrap:wrap;margin:8px 0 16px;">
                <div style="flex:1;min-width:220px;border:1px solid #e5e7eb;border-radius:6px;padding:12px;">
                  <div style="font-size:12px;color:#6b7280;">Login</div>
                  <div style="font-size:16px;font-weight:600;color:#111;">${escapeHtml(username)}</div>
                </div>
                <div style="flex:1;min-width:220px;border:1px solid #e5e7eb;border-radius:6px;padding:12px;">
                  <div style="font-size:12px;color:#6b7280;">Hasło</div>
                  <div style="font-size:16px;font-weight:600;color:#111;">${escapeHtml(password)}</div>
                </div>
              </div>
              <p style="margin:0 0 12px;color:#374151;">Ze względów bezpieczeństwa zalecamy zmianę hasła po pierwszym logowaniu.</p>
            </div>
            <div style="padding:16px 24px;border-top:1px solid #eee;">
              <small style="display:block;font-size:12px;color:#6b7280;font-style:italic;line-height:1.5;">${escapeHtml(legalNotice)}</small>
            </div>
          </div>
        </div>`;
      const mailOptions = {
        from,
        to: email,
        subject: 'Dane do logowania — System Zarządzania Narzędziownią',
        text: `Witaj ${fullName},\n\nTwoje konto zostało utworzone.\nLogin: ${username}\nHasło: ${password}\n\nZalecamy zmianę hasła po pierwszym logowaniu.\n\n${legalNotice}`,
        html,
        attachments: hasLogo ? [{ filename: 'logo.png', path: logoPath, cid: 'app_logo' }] : []
      };
      transporter.sendMail(mailOptions, (sendErr, info) => {
        if (sendErr) {
          console.error('Błąd wysyłki e-maila z danymi logowania:', sendErr.message);
          return resolve({ sent: false, error: sendErr.message });
        }
        console.log('Wysłano e-mail z danymi logowania:', info && info.response);
        resolve({ sent: true });
      });
    });
  });
}

function escapeHtml(str) {
  if (typeof str !== 'string') return String(str || '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function run() {
  console.log('🔐 Generowanie loginów dla pracowników bez loginu...');
  db.all('SELECT * FROM employees WHERE login IS NULL OR login = ""', [], async (err, employees) => {
    if (err) {
      console.error('Błąd pobierania pracowników:', err.message);
      return exit();
    }
    if (!employees || employees.length === 0) {
      console.log('Brak pracowników bez loginu.');
      return exit();
    }
    let created = 0;
    for (const emp of employees) {
      const first_name = emp.first_name || '';
      const last_name = emp.last_name || '';
      const fullName = `${first_name} ${last_name}`.trim();
      try {
        const username = await generateEmployeeLogin(first_name, last_name);
        const rawPassword = generateRandomPassword(10);
        const hashedPassword = bcrypt.hashSync(rawPassword, 10);
        await new Promise((resolve, reject) => db.run(
          'INSERT INTO users (username, password, role, full_name, created_at, updated_at) VALUES (?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'))',
          [username, hashedPassword, 'employee', fullName],
          function(err2) { return err2 ? reject(err2) : resolve(); }
        ));
        await new Promise((resolve, reject) => db.run(
          'UPDATE employees SET login = ? WHERE id = ?', [username, emp.id],
          function(err3) { return err3 ? reject(err3) : resolve(); }
        ));
        const emailRes = await sendCredentialsEmail(emp.email, username, rawPassword, fullName);
        created++;
        console.log(`✔ Utworzono login dla #${emp.id}: ${username}${emailRes.sent ? ' (e-mail wysłany)' : ''}`);
      } catch (e) {
        console.error(`✖ Błąd generowania dla #${emp.id}:`, e.message);
      }
    }
    console.log(`✅ Zakończono. Utworzono loginy: ${created}/${employees.length}.`);
    exit();
  });
}

function exit() {
  db.close((err) => {
    if (err) console.error('Błąd zamknięcia bazy:', err.message);
    console.log('🔒 Połączenie z bazą danych zostało zamknięte');
    process.exit(0);
  });
}

run();
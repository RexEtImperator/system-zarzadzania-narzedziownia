/* eslint-disable */
const { spawn } = require('child_process');

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const PORT = 3005;
  const server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'inherit', cwd: process.cwd() });
  await delay(1500);

  const base = `http://localhost:${PORT}`;
  const headers = { 'Content-Type': 'application/json' };

  async function post(path, body, token) {
    const res = await fetch(base + path, { method: 'POST', headers: token ? { ...headers, Authorization: `Bearer ${token}` } : headers, body: JSON.stringify(body || {}) });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
  }
  async function put(path, body, token) {
    const res = await fetch(base + path, { method: 'PUT', headers: token ? { ...headers, Authorization: `Bearer ${token}` } : headers, body: JSON.stringify(body || {}) });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
  }
  async function get(path, token) {
    const res = await fetch(base + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
  }

  try {
    const loginAdmin = await post('/api/login', { username: 'admintest', password: 'admin' });
    if (loginAdmin.status !== 200 || !loginAdmin.json.token) throw new Error('Admin login failed');
    const token = loginAdmin.json.token;

    const secPut = await put('/api/config/security', {
      sessionTimeout: 10,
      passwordMinLength: 8,
      maxLoginAttempts: 3,
      lockoutDuration: 1,
      requireSpecialChars: true,
      requireNumbers: true,
      requireUppercase: true,
      requireLowercase: true,
      historyLength: 2,
      blacklist: ['admin','password','123456']
    }, token);
    if (secPut.status !== 200) throw new Error('Updating security policy failed');

    // Lockout scenario on wrong password
    for (let i = 0; i < 3; i++) {
      const r = await post('/api/login', { username: 'admintest', password: 'wrong' });
      if (r.status !== 401) throw new Error('Expected 401 on invalid login');
    }
    const locked = await post('/api/login', { username: 'admintest', password: 'admin' });
    if (locked.status !== 429) throw new Error('Expected 429 lockout');

    // Unlock admin
    const me = await get('/api/users', token);
    const admin = Array.isArray(me.json) ? me.json.find(u => u.username === 'admintest') : null;
    if (!admin) throw new Error('Admin user not found via list');
    const unlock = await post(`/api/users/${admin.id}/unlock`, {}, token);
    if (unlock.status !== 200) throw new Error('Unlock endpoint failed');
    const relog = await post('/api/login', { username: 'admintest', password: 'admin' });
    if (relog.status !== 200) throw new Error('Login should succeed after unlock');

    // Create user with weak password should fail
    const weakCreate = await post('/api/users', { username: 'u1', password: 'abc', role: 'employee', full_name: 'User One' }, token);
    if (weakCreate.status === 201) throw new Error('Weak password should be rejected');

    // Create strong user
    const uname = 'u' + Date.now();
    const strongCreate = await post('/api/users', { username: uname, password: 'Abcdef1!', role: 'employee', full_name: 'User Two' }, token);
    if (strongCreate.status !== 201) throw new Error('Strong user creation failed');

    // Change to a new strong password
    const list = await get('/api/users', token);
    const u2 = Array.isArray(list.json) ? list.json.find(u => u.username === uname) : null;
    if (!u2) throw new Error('User u2 not found');
    const change1 = await put(`/api/users/${u2.id}`, { username: 'u2', role: 'employee', full_name: 'User Two', password: 'Xyz1234!' }, token);
    if (change1.status !== 200) throw new Error('Password change 1 failed');

    // Try to reuse previous password within history length
    const reuse = await put(`/api/users/${u2.id}`, { username: 'u2', role: 'employee', full_name: 'User Two', password: 'Abcdef1!' }, token);
    if (reuse.status === 200) throw new Error('Password reuse should be blocked');

    console.log('Security integration tests finished successfully');
  } catch (e) {
    console.error('Test failed:', e.message);
    process.exitCode = 1;
  } finally {
    server.kill();
  }
}

run();
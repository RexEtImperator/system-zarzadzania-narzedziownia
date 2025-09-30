const http = require('http');

// Funkcja do wykonania HTTP request
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(data);
    }
    req.end();
  });
}

async function testAPI() {
  console.log('Testowanie API endpoints...\n');

  // Test GET /api/departments
  try {
    console.log('1. Testowanie GET /api/departments');
    const deptResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/departments',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('Status:', deptResponse.statusCode);
    console.log('Response:', deptResponse.body);
    console.log('---\n');
  } catch (error) {
    console.error('Błąd GET /api/departments:', error.message);
    console.log('---\n');
  }

  // Test GET /api/positions
  try {
    console.log('2. Testowanie GET /api/positions');
    const posResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/positions',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('Status:', posResponse.statusCode);
    console.log('Response:', posResponse.body);
    console.log('---\n');
  } catch (error) {
    console.error('Błąd GET /api/positions:', error.message);
    console.log('---\n');
  }
}

testAPI();
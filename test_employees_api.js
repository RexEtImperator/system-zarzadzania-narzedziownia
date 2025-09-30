const http = require('http');

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testEmployeesAPI() {
  try {
    console.log('🔐 Logowanie...');
    
    // Login to get token
    const loginOptions = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const loginResponse = await makeRequest(loginOptions, {
      username: 'admin',
      password: 'admin123'
    });
    
    if (loginResponse.status !== 200) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }
    
    const token = loginResponse.data.token;
    console.log('✅ Zalogowano pomyślnie');
    console.log('Token:', token.substring(0, 20) + '...');
    
    // Test GET /api/employees
    console.log('\n📋 Testowanie GET /api/employees...');
    
    const employeesOptions = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/employees',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };
    
    const employeesResponse = await makeRequest(employeesOptions);
    
    console.log('✅ Odpowiedź API:');
    console.log('Status:', employeesResponse.status);
    console.log('Liczba pracowników:', employeesResponse.data.length);
    
    if (employeesResponse.data.length > 0) {
      console.log('\n📄 Przykładowy pracownik:');
      console.log(JSON.stringify(employeesResponse.data[0], null, 2));
    }
    
    // Test structure compatibility
    console.log('\n🔍 Sprawdzanie struktury danych...');
    if (employeesResponse.data.length > 0) {
      const employee = employeesResponse.data[0];
      const expectedFields = ['id', 'first_name', 'last_name', 'phone', 'position', 'department'];
      const missingFields = expectedFields.filter(field => !(field in employee));
      
      if (missingFields.length > 0) {
        console.log('⚠️  Brakujące pola:', missingFields);
      } else {
        console.log('✅ Wszystkie wymagane pola są obecne');
      }
      
      // Check for new fields that component expects
      const componentFields = ['employee_id', 'email', 'department_id', 'position_id'];
      const newFields = componentFields.filter(field => !(field in employee));
      
      if (newFields.length > 0) {
        console.log('⚠️  Pola oczekiwane przez komponent ale nieobecne w API:', newFields);
      }
    }
    
  } catch (error) {
    console.error('❌ Błąd:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testEmployeesAPI();
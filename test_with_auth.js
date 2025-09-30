// Test API endpoints z uwierzytelnianiem
async function testWithAuth() {
  const baseUrl = 'http://localhost:3000/api';
  
  console.log('=== Logowanie ===');
  try {
    // Zaloguj się aby uzyskać token
    const loginResponse = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'dbrzezinsky',
        password: 'natalka9'
      })
    });
    
    const loginData = await loginResponse.json();
    console.log('Login response:', loginData);
    
    if (!loginData.token) {
      console.error('Nie udało się uzyskać tokenu');
      return;
    }
    
    const token = loginData.token;
    console.log('Token uzyskany:', token.substring(0, 20) + '...');
    
    // Test API departments
    console.log('\n=== Test GET /api/departments ===');
    const deptResponse = await fetch(`${baseUrl}/departments`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Departments response status:', deptResponse.status);
    if (deptResponse.ok) {
      const deptData = await deptResponse.json();
      console.log('Departments data:', deptData);
    } else {
      const errorText = await deptResponse.text();
      console.log('Departments error:', errorText);
    }
    
    // Test API positions
    console.log('\n=== Test GET /api/positions ===');
    const posResponse = await fetch(`${baseUrl}/positions`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Positions response status:', posResponse.status);
    if (posResponse.ok) {
      const posData = await posResponse.json();
      console.log('Positions data:', posData);
    } else {
      const errorText = await posResponse.text();
      console.log('Positions error:', errorText);
    }
    
  } catch (error) {
    console.error('Błąd:', error.message);
  }
}

testWithAuth();
// Test zwrotu młota pneumatycznego
async function testReturnTool() {
  const baseUrl = 'http://localhost:3000/api';
  
  // Najpierw zaloguj się aby uzyskać token
  console.log('=== Logowanie ===');
  try {
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
    
    // Test zwrotu młota pneumatycznego (tool_id: 2, issue_id: 3)
    console.log('\n=== Test zwrotu młota pneumatycznego ===');
    const returnResponse = await fetch(`${baseUrl}/tools/2/return`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        issue_id: 3,
        quantity: 1
      })
    });
    
    console.log('Return response status:', returnResponse.status);
    const returnData = await returnResponse.text();
    console.log('Return response body:', returnData);
    
    if (!returnResponse.ok) {
      console.error('Błąd zwrotu:', returnResponse.status, returnData);
    } else {
      console.log('Zwrot zakończony pomyślnie!');
    }
    
  } catch (error) {
    console.error('Błąd:', error.message);
  }
}

testReturnTool();
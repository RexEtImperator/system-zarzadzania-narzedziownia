// Wydaj narzędzia do testowania UI zwrotu
async function issueTestTools() {
  const baseUrl = 'http://localhost:3000/api';
  
  // Zaloguj się
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
    
    // Wydaj lutownicę (ID: 6)
    console.log('\n=== Wydawanie lutownicy ===');
    const issueResponse1 = await fetch(`${baseUrl}/tools/6/issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        employee_id: 1, // Dawid Brzeziński
        quantity: 1,
        notes: 'Test wydania dla UI'
      })
    });
    
    if (issueResponse1.ok) {
      const issueData1 = await issueResponse1.json();
      console.log('✅ Lutownica wydana:', issueData1);
    } else {
      const errorText1 = await issueResponse1.text();
      console.log('❌ Błąd wydania lutownicy:', errorText1);
    }
    
    // Wydaj wiertarkę Bosch (ID: 1) - 1 sztukę
    console.log('\n=== Wydawanie wiertarki Bosch ===');
    const issueResponse2 = await fetch(`${baseUrl}/tools/1/issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        employee_id: 1, // Dawid Brzeziński
        quantity: 1,
        notes: 'Test wydania dla UI'
      })
    });
    
    if (issueResponse2.ok) {
      const issueData2 = await issueResponse2.json();
      console.log('✅ Wiertarka Bosch wydana:', issueData2);
    } else {
      const errorText2 = await issueResponse2.text();
      console.log('❌ Błąd wydania wiertarki:', errorText2);
    }
    
    console.log('\n=== Wydawanie zakończone ===');
    
  } catch (error) {
    console.error('Błąd:', error.message);
  }
}

issueTestTools();
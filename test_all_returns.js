// Test zwrotu wszystkich aktywnych wydań
async function testAllReturns() {
  const baseUrl = 'http://localhost:3000/api';
  
  // Najpierw zaloguj się
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
    
    // Pobierz wszystkie aktywne wydania
    console.log('\n=== Pobieranie aktywnych wydań ===');
    const issuesResponse = await fetch(`${baseUrl}/tools`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const tools = await issuesResponse.json();
    console.log(`Znaleziono ${tools.length} narzędzi`);
    
    // Znajdź narzędzia z aktywnymi wydaniami
    const activeIssues = [];
    
    for (const tool of tools) {
      if (tool.status === 'wydane' || tool.status === 'częściowo wydane') {
        // Pobierz szczegóły narzędzia
        const detailsResponse = await fetch(`${baseUrl}/tools/${tool.id}/details`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const details = await detailsResponse.json();
        if (details.issues && details.issues.length > 0) {
          details.issues.forEach(issue => {
            activeIssues.push({
              toolId: tool.id,
              toolName: tool.name,
              issueId: issue.id,
              quantity: issue.quantity,
              employee: `${issue.employee_first_name} ${issue.employee_last_name}`
            });
          });
        }
      }
    }
    
    console.log(`\nZnaleziono ${activeIssues.length} aktywnych wydań:`);
    activeIssues.forEach(issue => {
      console.log(`- ${issue.toolName} (ID: ${issue.toolId}) - wydanie ${issue.issueId} - ${issue.quantity} szt. - ${issue.employee}`);
    });
    
    // Testuj zwrot każdego wydania
    console.log('\n=== Testowanie zwrotów ===');
    
    for (const issue of activeIssues) {
      console.log(`\nTest zwrotu: ${issue.toolName} (wydanie ${issue.issueId})`);
      
      try {
        const returnResponse = await fetch(`${baseUrl}/tools/${issue.toolId}/return`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            issue_id: issue.issueId,
            quantity: issue.quantity
          })
        });
        
        console.log(`Status odpowiedzi: ${returnResponse.status}`);
        
        if (returnResponse.ok) {
          const returnData = await returnResponse.json();
          console.log(`✅ Zwrot pomyślny:`, returnData);
        } else {
          const errorText = await returnResponse.text();
          console.log(`❌ Błąd zwrotu:`, errorText);
        }
        
      } catch (error) {
        console.log(`❌ Błąd podczas zwrotu:`, error.message);
      }
    }
    
    console.log('\n=== Test zakończony ===');
    
  } catch (error) {
    console.error('Błąd:', error.message);
  }
}

testAllReturns();
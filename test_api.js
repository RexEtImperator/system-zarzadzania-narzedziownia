const http = require('http');

// Test API endpoint dla szczegółów piły łańcuchowej
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/tools/5/details',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('=== TESTOWANIE API SZCZEGÓŁÓW NARZĘDZIA ===\n');

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const toolDetails = JSON.parse(data);
      console.log('Szczegóły piły łańcuchowej (ID: 5):');
      console.log(JSON.stringify(toolDetails, null, 2));
      
      console.log('\n=== ANALIZA ===');
      console.log(`Nazwa: ${toolDetails.name}`);
      console.log(`Status: ${toolDetails.status}`);
      console.log(`Całkowita ilość: ${toolDetails.quantity}`);
      console.log(`Dostępna ilość: ${toolDetails.available_quantity || 'brak danych'}`);
      
      if (toolDetails.issues && toolDetails.issues.length > 0) {
        console.log('\nAktywne wydania:');
        toolDetails.issues.forEach((issue, index) => {
          console.log(`${index + 1}. Pracownik: ${issue.employee_name}, Ilość: ${issue.quantity}, Data: ${issue.issued_at}`);
        });
      } else {
        console.log('\nBrak aktywnych wydań w nowym systemie');
      }
      
      if (toolDetails.issued_to_employee_id) {
        console.log(`\nStary system - wydane dla: ${toolDetails.employee_name} (ID: ${toolDetails.issued_to_employee_id})`);
      }
      
    } catch (error) {
      console.error('Błąd parsowania JSON:', error);
      console.log('Surowa odpowiedź:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('Błąd żądania:', error);
});

req.end();
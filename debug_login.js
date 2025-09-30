// Debug script to test login request exactly as frontend sends it
// Using built-in fetch (Node.js 18+)

async function testLogin() {
  const credentials = {
    username: 'admin',
    password: 'admin'
  };

  console.log('Sending login request with credentials:', credentials);
  
  try {
    const response = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials)
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('Error response body:', errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Success response:', data);
    
  } catch (error) {
    console.error('Login test failed:', error.message);
    console.error('Full error:', error);
  }
}

testLogin();
// Debug CORS and preflight requests
async function testCORS() {
  console.log('Testing CORS and preflight requests...');
  
  // Test OPTIONS request (preflight)
  try {
    console.log('\n1. Testing OPTIONS request (preflight)...');
    const optionsResponse = await fetch('http://localhost:3000/api/login', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3001',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    
    console.log('OPTIONS Response status:', optionsResponse.status);
    console.log('OPTIONS Response headers:', Object.fromEntries(optionsResponse.headers.entries()));
  } catch (error) {
    console.error('OPTIONS request failed:', error.message);
  }

  // Test actual POST request with Origin header
  try {
    console.log('\n2. Testing POST request with Origin header...');
    const postResponse = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3001'
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin'
      })
    });

    console.log('POST Response status:', postResponse.status);
    console.log('POST Response headers:', Object.fromEntries(postResponse.headers.entries()));
    
    if (postResponse.ok) {
      const data = await postResponse.json();
      console.log('POST Response data:', data);
    } else {
      const errorText = await postResponse.text();
      console.log('POST Error response:', errorText);
    }
  } catch (error) {
    console.error('POST request failed:', error.message);
  }
}

testCORS();
// Debug helper for frontend login
export const debugLogin = async (credentials) => {
  console.log('=== DEBUG LOGIN START ===');
  console.log('Credentials:', credentials);
  console.log('API Base URL:', 'http://localhost:3000');
  console.log('Login endpoint:', '/api/login');
  console.log('Full URL:', 'http://localhost:3000/api/login');
  
  try {
    console.log('Sending fetch request...');
    const response = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials)
    });

    console.log('Response received:');
    console.log('- Status:', response.status);
    console.log('- Status Text:', response.statusText);
    console.log('- Headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('- Error Body:', errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('- Success Data:', data);
    console.log('=== DEBUG LOGIN SUCCESS ===');
    return data;
    
  } catch (error) {
    console.error('=== DEBUG LOGIN ERROR ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('=== DEBUG LOGIN END ===');
    throw error;
  }
};
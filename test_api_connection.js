const http = require('http');

// Test login
const loginData = JSON.stringify({
  username: 'admin',
  password: 'admin'
});

const loginOptions = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(loginData)
  }
};

console.log('=== Testowanie połączenia z API ===');

const loginReq = http.request(loginOptions, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Login Status:', res.statusCode);
    console.log('Login Response:', data);
    
    if (res.statusCode === 200) {
      const loginResponse = JSON.parse(data);
      
      // Test tools endpoint
      const toolsOptions = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/tools',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${loginResponse.token}`
        }
      };
      
      const toolsReq = http.request(toolsOptions, (toolsRes) => {
        let toolsData = '';
        
        toolsRes.on('data', (chunk) => {
          toolsData += chunk;
        });
        
        toolsRes.on('end', () => {
          console.log('Tools Status:', toolsRes.statusCode);
          if (toolsRes.statusCode === 200) {
            const tools = JSON.parse(toolsData);
            console.log('Tools count:', tools.length);
            console.log('First tool:', tools[0]);
          } else {
            console.log('Tools Error:', toolsData);
          }
        });
      });
      
      toolsReq.on('error', (err) => {
        console.error('Tools request error:', err);
      });
      
      toolsReq.end();
    }
  });
});

loginReq.on('error', (err) => {
  console.error('Login request error:', err);
});

loginReq.write(loginData);
loginReq.end();
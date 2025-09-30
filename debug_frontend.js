// Skrypt do debugowania localStorage w konsoli przeglądarki
console.log('=== Debug localStorage ===');
console.log('Token:', localStorage.getItem('token'));
console.log('User:', localStorage.getItem('user'));
console.log('All localStorage keys:', Object.keys(localStorage));

// Sprawdź czy API client ma token
if (window.api) {
  console.log('API client token:', window.api.token);
} else {
  console.log('API client not found in window');
}

// Test API call
if (localStorage.getItem('token')) {
  fetch('http://localhost:3000/api/tools', {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json'
    }
  })
  .then(response => {
    console.log('API Response status:', response.status);
    return response.json();
  })
  .then(data => {
    console.log('API Response data:', data);
  })
  .catch(error => {
    console.error('API Error:', error);
  });
} else {
  console.log('No token found - cannot test API');
}
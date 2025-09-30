// Symulacja tego co robi UI
const testUIReturn = () => {
  const toolId = 6; // Lutownica
  const issueId = 5; // ID wydania z migracji
  
  console.log('=== Test UI Return ===');
  console.log('toolId:', toolId);
  console.log('issueId:', issueId);
  
  const requestBody = { issue_id: issueId };
  console.log('Request body:', JSON.stringify(requestBody));
  
  // Sprawdź czy issue_id jest prawidłowo ustawione
  if (!requestBody.issue_id) {
    console.error('PROBLEM: issue_id jest undefined lub null!');
  } else {
    console.log('OK: issue_id jest ustawione na:', requestBody.issue_id);
  }
};

testUIReturn();
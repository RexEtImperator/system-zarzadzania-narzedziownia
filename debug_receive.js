// Debug script to test service receive endpoint like frontend

async function testReceive() {
  const token = process.env.DEBUG_TOKEN || '';
  const toolId = process.env.DEBUG_TOOL_ID || '1';
  const quantity = parseInt(process.env.DEBUG_QUANTITY || '1', 10);

  if (!token) {
    console.error('Missing DEBUG_TOKEN env var. Run debug_login.js and set DEBUG_TOKEN.');
    return;
  }

  const url = `http://localhost:${process.env.PORT || 3000}/api/tools/${toolId}/service/receive`;
  console.log('POST', url, 'quantity=', quantity);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ quantity })
    });
    console.log('Status:', resp.status);
    const text = await resp.text();
    try {
      const json = JSON.parse(text);
      console.log('JSON:', json);
    } catch (_) {
      console.log('Text:', text);
    }
  } catch (e) {
    console.error('Request failed:', e);
  }
}

testReceive();
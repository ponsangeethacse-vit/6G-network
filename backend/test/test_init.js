async function testInit() {
  const baseURL = 'http://localhost:4000/api';
  const data = {
    nodeId: `TEST_INIT_${Date.now()}`,
    type: 'Edge Node',
    senderAddress: '0x1111111111111111111111111111111111111111',
    receiverAddress: '0x2222222222222222222222222222222222222222',
    trustScore: 80,
    rfFingerprint: 'TEST_RF_999',
    csiBehavior: 0.9,
    snr: 28.5
  };

  try {
    console.log('Sending POST /api/nodes ...');
    const response = await fetch(`${baseURL}/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    console.log('Response Status:', response.status);
    console.log('Response Body:', JSON.stringify(result, null, 2));

    if (response.ok) {
       console.log('SUCCESS: Node initialized.');
    } else {
       console.log('FAILURE: Node initialization failed.');
    }
  } catch (err) {
    console.error('Network Error:', err.message);
  }
}

testInit();

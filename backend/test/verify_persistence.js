async function verifyPersistence() {
  const baseURL = 'http://localhost:4000/api';
  const data = {
    nodeId: `VERIFY_${Date.now()}`,
    type: 'IoT Device',
    senderAddress: '0x3333333333333333333333333333333333333333',
    receiverAddress: '0x4444444444444444444444444444444444444444',
    trustScore: 90,
    rfFingerprint: 'RF_VERIFY_123',
    csiBehavior: 0.85,
    snr: 25.0
  };

  try {
    console.log('1. Initializing new node...');
    const initResp = await fetch(`${baseURL}/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    console.log('Post Status:', initResp.status);

    console.log('2. Fetching all nodes...');
    const listResp = await fetch(`${baseURL}/nodes`);
    const listData = await listResp.json();
    
    const nodes = listData.nodes || [];
    console.log(`Total Nodes found: ${nodes.length}`);
    
    const found = nodes.find(n => n.address === data.nodeId);
    if (found) {
      console.log('SUCCESS: New node is present in the list!');
      console.log('Node Details:', JSON.stringify(found, null, 2));
    } else {
      console.error('FAILURE: New node NOT found in the list.');
      console.log('Available node IDs:', nodes.map(n => n.address).join(', '));
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

verifyPersistence();

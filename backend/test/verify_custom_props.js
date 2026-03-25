// No requirement for node-fetch as Node 18+ has built-in fetch

const BASE_URL = 'http://localhost:4000';

async function testCustomNodeProperties() {
  console.log('--- Testing Custom Node Properties ---');

  const customNode = {
    nodeId: 'CUSTOM_TEST_NODE_' + Date.now(),
    type: 'Edge Node',
    senderAddress: '0x111',
    receiverAddress: '0x222',
    trustScore: 90,
    rfFingerprint: 'CUSTOM_FP_999',
    csiBehavior: 0.95,
    snr: 35.5
  };

  console.log(`Creating node: ${customNode.nodeId} with custom SNR: ${customNode.snr}`);
  
  const createRes = await fetch(`${BASE_URL}/api/nodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(customNode)
  });

  if (!createRes.ok) {
    console.error('❌ Failed to create custom node:', await createRes.text());
    return;
  }
  const createData = await createRes.json();
  console.log('✅ Custom node created successfully.');

  // Verify type in list
  console.log('\nVerifying node type in the global list...');
  const listRes = await fetch(`${BASE_URL}/api/nodes`);
  const listData = await listRes.json();
  const foundNode = listData.nodes.find(n => n.address === customNode.nodeId);
  
  if (foundNode && foundNode.type === customNode.type) {
    console.log(`✅ Node type correctly persisted: ${foundNode.type}`);
  } else {
    console.error(`❌ Node type MISMATCH! Expected ${customNode.type}, got ${foundNode ? foundNode.type : 'null'}`);
  }

  // Verify physical auth with correct custom metrics
  console.log('\nVerifying physical identity with CORRECT custom metrics...');
  const authRes = await fetch(`${BASE_URL}/api/verify-physical-identity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nodeAddress: customNode.nodeId,
      metrics: {
        rfFingerprint: customNode.rfFingerprint,
        csiBehavior: customNode.csiBehavior,
        snr: customNode.snr
      }
    })
  });

  const authData = await authRes.json();
  if (authData.authenticated) {
    console.log('✅ Authentication SUCCESSFUL with custom metrics.');
  } else {
    console.error('❌ Authentication FAILED:', authData.reason);
  }

  // Verify physical auth with WRONG metrics (to check rejection)
  console.log('\nVerifying physical identity with INCORRECT metrics (should fail)...');
  const failRes = await fetch(`${BASE_URL}/api/verify-physical-identity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nodeAddress: customNode.nodeId,
      metrics: {
        rfFingerprint: 'WRONG_FP',
        csiBehavior: 0.1,
        snr: 5.0
      }
    })
  });

  const failData = await failRes.json();
  if (!failData.authenticated) {
    console.log(`✅ Authentication FAILED as expected: ${failData.reason}`);
  } else {
    console.error('❌ Authentication UNEXPECTEDLY Succeeded!');
  }
}

testCustomNodeProperties().catch(err => console.error('Verification failed:', err));

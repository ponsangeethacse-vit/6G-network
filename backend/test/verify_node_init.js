// No requirement for node-fetch as Node 18+ has built-in fetch

const BASE_URL = 'http://localhost:4000';

async function testNodeCreation() {
  console.log('--- Testing Node Creation and Initialization ---');

  const nodesToTest = [
    { nodeId: 'TEST_BASE_STATION', type: 'Base Station', expectedRole: 2 },
    { nodeId: 'TEST_EDGE_NODE', type: 'Edge Node', expectedRole: 3 },
    { nodeId: 'TEST_IOT_DEVICE', type: 'IoT Device', expectedRole: 1 }
  ];

  for (const test of nodesToTest) {
    console.log(`\nCreating node: ${test.nodeId} (${test.type})`);
    
    const response = await fetch(`${BASE_URL}/api/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodeId: test.nodeId,
        type: test.type,
        senderAddress: '0x123',
        receiverAddress: '0x456',
        trustScore: 80
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Node ${test.nodeId} created successfully.`);
    } else {
      const error = await response.text();
      console.error(`❌ Failed to create node ${test.nodeId}: ${error}`);
      continue;
    }

    // Verify role in simulator state
    const nodesRes = await fetch(`${BASE_URL}/api/nodes`);
    const nodesData = await nodesRes.json();
    const nodeInSimulator = nodesData.nodes.find(n => n.address === test.nodeId);
    
    if (nodeInSimulator && nodeInSimulator.role === test.expectedRole) {
      console.log(`✅ Correct role assigned in simulator: ${nodeInSimulator.role}`);
    } else {
      console.error(`❌ Incorrect role in simulator. Expected ${test.expectedRole}, found ${nodeInSimulator?.role}`);
    }

    // Verify physical auth initialization by checking if it exists (via verify endpoint)
    const authRes = await fetch(`${BASE_URL}/api/verify-physical-identity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodeAddress: test.nodeId,
        metrics: {
          rfFingerprint: 'WRONG_FINGERPRINT', // We just want to see if it even finds the profile
          csiBehavior: 0.85,
          snr: 25
        }
      })
    });

    const authResult = await authRes.json();
    if (authResult.code === 'ERR_FINGERPRINT_SPOOF') {
      console.log(`✅ Physical auth profile initialized (Mismatch detected as expected).`);
    } else if (authResult.code === 'ERR_UNREGISTERED') {
      console.error(`❌ Physical auth profile NOT initialized.`);
    } else {
      console.log(`Status: ${JSON.stringify(authResult)}`);
    }
  }
}

testNodeCreation().catch(err => console.error('Verification failed:', err));

async function verifySync() {
  try {
    const baseURL = 'http://localhost:4000/api';
    
    console.log('--- 1. Fetching current nodes ---');
    const nodesResp = await fetch(`${baseURL}/nodes`).then(r => r.json());
    const nodes = nodesResp.nodes;
    console.log(`Found ${nodes.length} nodes in simulation.`);

    console.log('\n--- 2. Initializing new node via Admin API ---');
    const newNodeId = `TEST_NODE_${Date.now()}`;
    await fetch(`${baseURL}/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodeId: newNodeId,
        type: 'IoT Device',
        trustScore: 90,
        senderAddress: '0x123',
        receiverAddress: '0x456'
      })
    }).then(r => r.json());
    console.log(`Initialized ${newNodeId}`);

    console.log('\n--- 3. Verifying sync in simulation state ---');
    const nodesResp2 = await fetch(`${baseURL}/nodes`).then(r => r.json());
    const nodes2 = nodesResp2.nodes;
    const found = nodes2.find(n => n.address === newNodeId);
    
    if (found) {
      console.log(`SUCCESS: ${newNodeId} found in simulation!`);
    } else {
      console.log(`FAILURE: ${newNodeId} NOT found in simulation.`);
    }

    console.log('\n--- 4. Checking trust score persistence ---');
    const trustResp = await fetch(`${baseURL}/trust/${newNodeId}`).then(r => r.json());
    console.log(`Trust score for ${newNodeId}: ${trustResp.trustScore}`);

  } catch (err) {
    console.error('Error during verification:', err.message);
  }
}

verifySync();

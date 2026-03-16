const fs = require('fs');

const BASE_URL = 'http://127.0.0.1:4000';
let logBuffer = '';

function log(msg) {
  console.log(msg);
  logBuffer += msg + '\n';
}

async function runTests() {
  log('--- STARTING TRUST-THRESHOLD ROUTING TESTS ---');

  const node1 = '0x0000000000000000000000000000000000000001';
  const node4 = '0x0000000000000000000000000000000000000004';
  const node2 = '0x0000000000000000000000000000000000000002';

  try {
    // 1. Submit packet
    log(`\n[1] Sending Data Packet from Node 1 to Node 4...`);
    const sendRes = await fetch(`${BASE_URL}/api/send-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ src: node1, dst: node4, data: 'Threshold Test Packet' })
    }).then(r => r.json());
    log('Send Response Path: ' + sendRes.path.map(n => n.slice(-4)).join(' -> '));

    // 2. Set Node 2 trust to 40 right away to force re-routing on next forwards step
    log(`\n[2] Setting Node 2 (${node2.slice(-4)}) Trust to 40 (below threshold 50)...`);
    await fetch(`${BASE_URL}/api/test/set-trust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node: node2, score: 40 })
    });

    log(`\n[3] Awaiting 4.5 seconds for simulator loops to tick forwards...`);
    await new Promise(resolve => setTimeout(resolve, 4500));

    // 4. Fetch local blockchain of sender (node 1) to inspect block logs
    log(`\n[4] Inspecting Local Blockchain of Node 1...`);
    const chain1 = await fetch(`${BASE_URL}/api/nodes/${node1}/local-blockchain`).then(r => r.json());
    
    const blockedBlock = chain1.find(b => b.eventType === 'packet_blocked');
    const forwardedBlock = chain1.find(b => b.eventType === 'packet_forwarded');

    if (blockedBlock) {
       log(`✅ SUCCESS: Packet was BLOCKED on Node 1 correctly due to low trust ahead.`);
       log(`Block Index: ${blockedBlock.index} | Event: ${blockedBlock.eventType}`);
    } else {
       log(`⚠️ Check: No explicit block event found on Node 1.`);
    }

    log(`\n[5] Fetching Ledger of Node 2 (${node2.slice(-4)})...`);
    const ledger2 = await fetch(`${BASE_URL}/api/nodes/${node2}/local-blockchain`).then(r => r.json());
    const hasIncoming = ledger2.some(b => b.eventType === 'packet_received' || b.eventType === 'packet_forwarded');
    
    if (!hasIncoming) {
       log(`✅ SUCCESS: Node 2 was completely BYPASSED as expected.`);
    } else {
       log(`❌ FAIL: Node 2 received logs even though its trust score was low!`);
    }

    // Restore trust score
    log(`\n[6] Restoring Node 2 Trust to 80...`);
    await fetch(`${BASE_URL}/api/test/set-trust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node: node2, score: 80 })
    });

  } catch (error) {
    log('❌ Test Errored: ' + error.message);
  } finally {
    fs.writeFileSync('d:/Games/Project/ponsangeetha mam project 6gnetwork/6G-network/backend/test/test_threshold_result.txt', logBuffer);
  }
}

runTests();

const fs = require('fs'); // Added

const BASE_URL = 'http://localhost:4000';
let logBuffer = '';

function log(msg) {
  console.log(msg);
  logBuffer += msg + '\n';
}

async function runTests() {
  log('--- STARTING MULTI-HOP ROUTING TESTS ---');

  const node1 = '0x0000000000000000000000000000000000000001';
  const node4 = '0x0000000000000000000000000000000000000004';
  const node2 = '0x0000000000000000000000000000000000000002'; // Changed from node3
  const node3 = '0x0000000000000000000000000000000000000003';

  try {
    // 1. Calculate Route (Normal Conditions)
    log(`\n[1] Calculating Route from Node 1 to Node 4...`);
    let routeRes = await fetch(`${BASE_URL}/api/calculate-route?src=${node1}&dst=${node4}`).then(r => r.json());
    log('Path: ' + routeRes.path.map(n => n.slice(-4)).join(' -> ') + ' | Cost: ' + routeRes.cost);

    // 2. Trigger Attack on node2 to force rerouting
    log(`\n[2] Triggering DDoS attack on Node 2 (${node2.slice(-4)})...`);
    await fetch(`${BASE_URL}/api/simulator/attack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node: node2, attackType: 'DDoS' })
    });

    // 3. Re-calculate Route (Sensed conditions)
    log(`\n[3] Re-calculating Route after attack...`);
    routeRes = await fetch(`${BASE_URL}/api/calculate-route?src=${node1}&dst=${node4}`).then(r => r.json());
    log('Path: ' + routeRes.path.map(n => n.slice(-4)).join(' -> ') + ' | New Cost: ' + routeRes.cost);

    if (routeRes.path.includes(node2)) {
      log('❌ FAIL: Path still includes malicious node!');
    } else {
      log('✅ SUCCESS: Routing algorithm bypassed the malicious node.');
    }

    // 4. Send packet (Simulated hop test)
    log(`\n[4] Submitting Send-Data Request from {Node 1} -> {Node 4}...`);
    const sendRes = await fetch(`${BASE_URL}/api/send-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ src: node1, dst: node4, data: 'Verification Packet' })
    }).then(r => r.json());
    log('Send Response: ' + JSON.stringify(sendRes));

    // Stop attack so that future ticks don't skew verification logs
    log(`\n[5] Stopping Attack on Node 2...`);
    await fetch(`${BASE_URL}/api/simulator/stop-attack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node: node2 })
    });

  } catch (error) {
    log('❌ Test Errored: ' + error.message);
  } finally {
    fs.writeFileSync('d:/Games/Project/ponsangeetha mam project 6gnetwork/6G-network/backend/test/test_routing_result.txt', logBuffer);
  }
}

runTests();

const fs = require('fs');

const BASE_URL = 'http://localhost:4000';
let logBuffer = '';

function log(msg) {
  console.log(msg);
  logBuffer += msg + '\n';
}

async function runTests() {
  log('--- STARTING NODE LEDGER VERIFICATION TESTS ---');

  const node1 = '0x0000000000000000000000000000000000000001';
  const node4 = '0x0000000000000000000000000000000000000004';
  const node2 = '0x0000000000000000000000000000000000000002';

  try {
    // 1. Submit packet
    log(`\n[1] Sending Data Packet from Node 1 to Node 4...`);
    const sendRes = await fetch(`${BASE_URL}/api/send-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ src: node1, dst: node4, data: 'Ledger Test Packet' })
    }).then(r => r.json());
    log('Send Response: ' + JSON.stringify(sendRes));

    // 2. Wait for simulation ticks (2x 2000ms intervals)
    log(`\n[2] Awaiting 4.5 seconds for packet hop forwards...`);
    await new Promise(resolve => setTimeout(resolve, 4500));

    // 3. Inspect Ledger of node 2 (expected intermediate hop)
    log(`\n[3] Fetching Ledger for intermediate Node 2 (${node2.slice(-4)})...`);
    const ledgerRes = await fetch(`${BASE_URL}/api/nodes/${node2}/ledger`).then(r => r.json());
    
    log(`Ledger items found: ${ledgerRes.length}`);
    if (ledgerRes.length > 0) {
      log(`✅ SUCCESS: Packet recorded in intermediate node ledger.`);
      log(`Packet ID: ${ledgerRes[0].packet_id}`);
      log(`Path History Trace: ` + ledgerRes[0].path_history.map(n => n.slice(-4)).join(' -> '));
    } else {
      log(`❌ FAIL: No ledger records found on intermediate node.`);
    }

  } catch (error) {
    log('❌ Test Errored: ' + error.message);
  } finally {
    fs.writeFileSync('d:/Games/Project/ponsangeetha mam project 6gnetwork/6G-network/backend/test/test_ledger_result.txt', logBuffer);
  }
}

runTests();

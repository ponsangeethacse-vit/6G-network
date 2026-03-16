const fs = require('fs');

const BASE_URL = 'http://localhost:4000';
let logBuffer = '';

function log(msg) {
  console.log(msg);
  logBuffer += msg + '\n';
}

async function runTests() {
  log('--- STARTING LOCAL BLOCKCHAIN VERIFICATION TESTS ---');

  const node1 = '0x0000000000000000000000000000000000000001';
  const node4 = '0x0000000000000000000000000000000000000004';
  const node2 = '0x0000000000000000000000000000000000000002';

  try {
    // 1. Submit packet
    log(`\n[1] Sending Data Packet from Node 1 to Node 4...`);
    const sendRes = await fetch(`${BASE_URL}/api/send-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ src: node1, dst: node4, data: 'Blockchain Test Packet' })
    }).then(r => r.json());
    log('Send Response: ' + JSON.stringify(sendRes));

    // 2. Wait for simulation ticks
    log(`\n[2] Awaiting 4.5 seconds for packet hop forwards simulation...`);
    await new Promise(resolve => setTimeout(resolve, 4500));

    // 3. Inspect Local Blockchain of Node 1 (Sender)
    log(`\n[3] Fetching Local Blockchain for Node 1 (Sender - ${node1.slice(-4)})...`);
    const chain1 = await fetch(`${BASE_URL}/api/nodes/${node1}/local-blockchain`).then(r => r.json());
    log(`Node 1 Chain Length: ${chain1.length}`);
    const sentBlock = chain1.find(b => b.eventType === 'packet_sent');
    if (sentBlock) {
      log(`✅ SUCCESS: 'packet_sent' event mined on Node 1.`);
      log(`Block index: ${sentBlock.index} | Hash: ${sentBlock.hash.slice(0, 16)}…`);
    } else {
      log(`❌ FAIL: No 'packet_sent' block found on Node 1.`);
    }

    // 4. Inspect Local Blockchain of Node 2 (Intermediate)
    log(`\n[4] Fetching Local Blockchain for Node 2 (Intermediate - ${node2.slice(-4)})...`);
    const chain2 = await fetch(`${BASE_URL}/api/nodes/${node2}/local-blockchain`).then(r => r.json());
    log(`Node 2 Chain Length: ${chain2.length}`);
    const forwardBlock = chain2.find(b => b.eventType === 'packet_forwarded');
    if (forwardBlock) {
      log(`✅ SUCCESS: 'packet_forwarded' event mined on Node 2.`);
      log(`Block index: ${forwardBlock.index} | Hash: ${forwardBlock.hash.slice(0, 16)}…`);
    } else {
      log(`❌ FAIL: No 'packet_forwarded' block found on Node 2.`);
    }

  } catch (error) {
    log('❌ Test Errored: ' + error.message);
  } finally {
    fs.writeFileSync('d:/Games/Project/ponsangeetha mam project 6gnetwork/6G-network/backend/test/test_local_blockchain_result.txt', logBuffer);
  }
}

runTests();

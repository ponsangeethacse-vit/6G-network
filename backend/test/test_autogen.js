const fs = require('fs');
const BASE_URL = 'http://127.0.0.1:4000';
let logBuffer = '';
function log(msg) { console.log(msg); logBuffer += msg + '\n'; }

async function run() {
  log('--- AUTOGEN PACKET GENERATOR VERIFICATION ---');

  // Start simulation
  log('\n[1] Starting simulation...');
  const startRes = await fetch(`${BASE_URL}/api/simulator/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.json());
  log('Start: ' + JSON.stringify(startRes));

  // Wait 12 seconds — should see 2-3 packets with variable timing
  log('\n[2] Waiting 12 seconds for auto-packets to generate...');
  await new Promise(resolve => setTimeout(resolve, 12000));

  // Check status
  log('\n[3] Checking simulation status...');
  const status = await fetch(`${BASE_URL}/api/simulator/status`).then(r => r.json());
  log('Status: ' + JSON.stringify(status));

  if (status.totalGenerated >= 2) {
    log(`✅ SUCCESS: ${status.totalGenerated} packets auto-generated in ~12s (expected 2–4).`);
  } else {
    log(`⚠️  Only ${status.totalGenerated} packets generated. May need more time.`);
  }

  // Stop simulation
  log('\n[4] Stopping simulation...');
  const stopRes = await fetch(`${BASE_URL}/api/simulator/stop`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.json());
  log('Stop: ' + JSON.stringify(stopRes));

  fs.writeFileSync('d:/Games/Project/ponsangeetha mam project 6gnetwork/6G-network/backend/test/test_autogen_result.txt', logBuffer);
}
run().catch(e => { log('❌ Error: ' + e.message); fs.writeFileSync('.../test_autogen_result.txt', logBuffer); });

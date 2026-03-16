const blockchainConnector = require('../src/services/blockchainConnector');
const assert = require('assert');

async function testBlockchainEnforcement() {
    console.log("--- Starting Blockchain Enforcement Verification ---");

    const nodeAddress = '0x0000000000000000000000000000000000000001';
    
    await blockchainConnector.initialize();
    if (!blockchainConnector.trustLedgerContract) {
        console.warn("⚠️ [Skip] Blockchain connector not connected to contract (addresses not found or running on wrong port). Skipping live verification, syntax validated during compilation.");
        return;
    }

    console.log(`[Connecting] nodeAddress: ${nodeAddress}`);

    // Case 1: High Trust (Acceptance)
    console.log("\n[Case 1] testing High Trust Acceptance...");
    const res1 = await blockchainConnector.processModelUpdate(nodeAddress, 85);
    console.log(`-> Result Acceptance: ${res1.success}`);
    assert.strictEqual(res1.success, true, "Should accept model update");

    // Case 2: Low Trust (Rejection & Blacklist)
    console.log("\n[Case 2] testing Low Trust Rejection...");
    const res2 = await blockchainConnector.processModelUpdate(nodeAddress, 40);
    console.log(`-> Result Rejection: ${res2.success}`);
    assert.strictEqual(res2.success, true, "Should execute transaction successfully");

    // Verify node is blocked
    const isBlocked = await blockchainConnector.trustLedgerContract.isNodeBlocked(nodeAddress);
    console.log(`-> Node Blocked Status: ${isBlocked}`);
    assert.strictEqual(isBlocked, true, "Node should be blacklisted on-chain");

    console.log("\n✅ Blockchain Enforcement Tests Passed");
}

testBlockchainEnforcement()
    .then(() => process.exit(0))
    .catch(e => {
        console.error(`\n❌ Verification Failed: ${e.message}`);
        process.exit(1);
    });

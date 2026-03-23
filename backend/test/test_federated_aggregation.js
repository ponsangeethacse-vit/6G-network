const aggregationService = require('../src/services/federatedAggregationService');
const assert = require('assert');

function testAggregation() {
    console.log("--- Starting Secure Federated Aggregation Verification ---");

    const node1 = '0x1111111111111111111111111111111111111111';
    const node2 = '0x2222222222222222222222222222222222222222';
    const nodeMalicious = '0x9999999999999999999999999999999999999999';

    // 1. Submit update from trusted nodes
    console.log("\n[Case 1] Submitting trusted updates...");
    const res1 = aggregationService.submitUpdate(node1, [1.0, 1.0, 1.0, 1.0, 1.0], 80);
    const res2 = aggregationService.submitUpdate(node2, [2.0, 2.0, 2.0, 2.0, 2.0], 90);
    assert.strictEqual(res1.accepted, true);
    assert.strictEqual(res2.accepted, true);

    // 2. Submit update from untrusted node (should be filtered)
    console.log("\n[Case 2] Submitting update below threshold (Malicious)...");
    const res3 = aggregationService.submitUpdate(nodeMalicious, [10.0, 10.0, 10.0, 10.0, 10.0], 40);
    assert.strictEqual(res3.accepted, false); // Filtered out

    // 3. Trigger aggregation
    console.log("\n[Case 3] Triggering Aggregation...");
    const initialModel = aggregationService.getGlobalModel();
    console.log(`-> Initial Model: [${initialModel.join(', ')}]`);

    const aggregatedModel = aggregationService.aggregate();
    console.log(`-> Aggregated Model: [${aggregatedModel.join(', ')}]`);

    // Weighted average: (1.0*80 + 2.0*90) / (80+90) = (80 + 180)/170 = 260/170 = 1.5294
    const expected = 1.5294;
    console.log(`-> Expected: ~${expected}`);
    
    assert.ok(Math.abs(aggregatedModel[0] - expected) < 0.001);

    console.log("\n✅ Secure Federated Aggregation Tests Passed");
}

try {
    testAggregation();
    process.exit(0);
} catch (e) {
    console.error(`\n❌ Verification Failed: ${e.message}`);
    process.exit(1);
}

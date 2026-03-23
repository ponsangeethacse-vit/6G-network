const physicalAuth = require('../src/services/physicalAuthService');
const assert = require('assert');

function runTests() {
    console.log("--- Starting Backend Physical Auth Verification ---");

    const node1 = '0x0000000000000000000000000000000000000001';
    const profile = physicalAuth.getCorrectProfile(node1);

    if (!profile) {
        console.error("❌ Profile for Node 1 not found!");
        process.exit(1);
    }

    console.log(`[Profile loaded] RF: ${profile.rfFingerprint}`);

    // Case 1: Valid Credentials
    console.log("\n[Case 1] testing Valid Credentials...");
    const validMetrics = {
        rfFingerprint: profile.rfFingerprint,
        csiBehavior: profile.csiBehavior,
        snr: profile.snr
    };
    const res1 = physicalAuth.verifyIdentity(node1, validMetrics);
    console.log(`-> Result: authenticated=${res1.authenticated}`);
    assert.strictEqual(res1.authenticated, true, "Should be authenticated");

    // Case 2: Spoofed RF Fingerprint
    console.log("\n[Case 2] testing Spoofed RF Fingerprint...");
    const spoofedMetrics = {
        rfFingerprint: "RF_SPOOF_12345",
        csiBehavior: profile.csiBehavior,
        snr: profile.snr
    };
    const res2 = physicalAuth.verifyIdentity(node1, spoofedMetrics);
    console.log(`-> Result: authenticated=${res2.authenticated}, Code: ${res2.code}`);
    assert.strictEqual(res2.authenticated, false, "Should be rejected");
    assert.strictEqual(res2.code, "ERR_FINGERPRINT_SPOOF");

    // Case 3: CSI drift
    console.log("\n[Case 3] testing CSI Behavior Drift...");
    const driftedMetrics = {
        rfFingerprint: profile.rfFingerprint,
        csiBehavior: 0.60, // 0.85 nominal, diff 0.25 > 0.15 limit
        snr: profile.snr
    };
    const res3 = physicalAuth.verifyIdentity(node1, driftedMetrics);
    console.log(`-> Result: authenticated=${res3.authenticated}, Code: ${res3.code}`);
    assert.strictEqual(res3.authenticated, false, "Should be rejected");
    assert.strictEqual(res3.code, "ERR_CSI_DRIFT");

    console.log("\n✅ All Backend Physical Auth Tests Passed");
}

try {
    runTests();
    process.exit(0);
} catch (e) {
    console.error(`\n❌ Verification Failed: ${e.message}`);
    process.exit(1);
}

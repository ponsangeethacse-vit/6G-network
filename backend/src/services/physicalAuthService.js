const crypto = require('crypto');

class PhysicalAuthService {
    constructor() {
        this.profiles = {};
        this.initializeProfiles();
    }

    // Generate static valid thresholds for the 20 Mock nodes 
    initializeProfiles() {
        for (let i = 0; i < 20; i++) {
            const hex = (i + 1).toString(16).padStart(40, '0');
            const address = `0x${hex}`;
            
            // Create a deterministic signature based on address
            const rfFingerprint = crypto.createHash('sha1').update(address + "SECRET_6G_SALT").digest('hex').slice(0, 16).toUpperCase();
            
            this.profiles[address] = {
                rfFingerprint: `RF_${rfFingerprint}`,
                csiBehavior: 0.85, // base nominal
                snr: 25.0         // base dBm nominal
            };
        }
    }

    verifyIdentity(nodeAddress, providedMetrics) {
        const profile = this.profiles[nodeAddress];
        if (!profile) {
            return {
                authenticated: false,
                reason: "Node profile not found / Unregistered Address",
                code: "ERR_UNREGISTERED"
            };
        }

        const providedFingerprint = providedMetrics.rfFingerprint;
        const providedCsi         = parseFloat(providedMetrics.csiBehavior);
        const providedSnr         = parseFloat(providedMetrics.snr);

        // 1. Strict Fingerprint Match
        if (providedFingerprint !== profile.rfFingerprint) {
            return {
                authenticated: false,
                reason: `RF Fingerprint Mismatch. Expected ${profile.rfFingerprint}, got ${providedFingerprint}`,
                code: "ERR_FINGERPRINT_SPOOF"
            };
        }

        // 2. CSI Drift Verification (Range check)
        const csiDelta = Math.abs(providedCsi - profile.csiBehavior);
        if (csiDelta > 0.15) { // 15% tolerance max
            return {
                authenticated: false,
                reason: `CSI Behavior Anomaly detected. Deviation: ${csiDelta.toFixed(2)}`,
                code: "ERR_CSI_DRIFT"
            };
        }

        // 3. SNR Level drop/high Verification
        const snrDelta = Math.abs(providedSnr - profile.snr);
        if (snrDelta > 8.0) { // 8 dB tolerance
            return {
                authenticated: false,
                reason: `SNR Signal Instability. Profile: ${profile.snr}dB, Received: ${providedSnr}dB`,
                code: "ERR_SNR_JAMMING"
            };
        }

        return {
            authenticated: true,
            details: "Physical Layer Authentication Successful"
        };
    }

    // Helper for Simulator to generate CORRECT profiles values
    getCorrectProfile(nodeAddress) {
        return this.profiles[nodeAddress] || null;
    }
}

module.exports = new PhysicalAuthService();

import sys

path = r"d:\Games\Project\ponsangeetha mam project 6gnetwork\6G-network\backend\src\server.js"

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Verify overlapping lines 205 (0-indexed 204) to line 256 (0-indexed 255)
# previous read step 985 was:
# 205:     // 🛡️ Added: Signal metrics for physica    // Apply attack profile modifiers
start_idx = 204
end_idx = 255

print(f"SPLICING lines from {start_idx} to {end_idx}")
print(f"Start content: {lines[start_idx].strip()}")
print(f"End content: {lines[end_idx].strip()}")

replacement = """        // Apply attack profile modifiers
        if (activeAttack === 'DDoS') {
          packetRate = 500 + Math.floor(Math.random() * 50);
          responseTimeMs = 1500 + Math.floor(Math.random() * 100);
          packetSize = 5000;
        } else if (activeAttack === 'Sybil') {
          packetRate = 80 + Math.floor(Math.random() * 10);
          authFailures = 5;
        } else if (activeAttack === 'Suspicious') {
          packetRate = 45 + Math.floor(Math.random() * 15);
          channelQuality = 0.75; 
        } else if (activeAttack === 'DataManipulation') {
          packetRate = 4 + Math.floor(Math.random() * 3);
        } else if (activeAttack === 'PacketFlooding') {
          packetRate = 800 + Math.floor(Math.random() * 100);
        }

        // 🛡️ Added: Signal metrics for physical layer auth
        const correctProfile = physicalAuth.getCorrectProfile(node.address);
        let providedRf = correctProfile ? correctProfile.rfFingerprint : 'RF_UNKNOWN';
        let providedCsi = 0.85;
        let providedSnr = 25.0;

        if (activeAttack === 'Sybil') {
          providedRf = `RF_SPOOF_${Math.floor(Math.random() * 1000)}`;
        } else if (activeAttack === 'Suspicious') {
          providedCsi = 0.60;
        }

        // 🧠 Added: Model Update Gradient Metrics
        let gradient_magnitude = Number((Math.random() * 0.25 + 0.1).toFixed(3));
        let loss_change = Number((Math.random() * 0.1 - 0.05).toFixed(3));
        let update_variance = Number((Math.random() * 0.04).toFixed(3));
        let parameter_drift = Number((Math.random() * 0.02).toFixed(3));

        if (activeAttack === 'PoisonedGradients') {
          gradient_magnitude = 0.85 + Math.random() * 0.1;
        } else if (activeAttack === 'CoordinatedAttack') {
          gradient_magnitude = 0.90 + Math.random() * 0.08;
        }
"""

# Replace
lines[start_idx:end_idx+1] = [replacement + '\n']

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Splicing done.")

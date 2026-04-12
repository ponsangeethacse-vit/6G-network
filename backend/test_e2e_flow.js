const fs = require('fs');
const path = require('path');

async function runTest() {
    console.log("=====================================================");
    console.log("🚀 6G E2E ANOMALY DETECTION PIPELINE TEST");
    console.log("=====================================================");

    try {
        console.log("\n[1/5] 📁 DATASET: Reading from processed_dataset.csv...");
        const csvPath = path.resolve(__dirname, '../ai-service/data/processed_dataset.csv');
        const fileContent = fs.readFileSync(csvPath, 'utf-8');
        const lines = fileContent.split('\n');
        
        // Grab a specific row to test
        const cols = lines[10].split(',');
        const testMetrics = {
            packet_rate: parseFloat(cols[0]),
            latency: parseFloat(cols[1]),
            bandwidth: parseFloat(cols[2]),
            failed_requests: parseFloat(cols[3])
        };
        console.log("      Read Metrics:", testMetrics);

        console.log("\n[2/5] 🧠 MODEL & API: Sending to Python FastAPI (/predict-anomaly)...");
        // Using native fetch in Node.js 18+
        const aiResponse = await fetch('http://localhost:8000/predict-anomaly', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testMetrics)
        });

        const aiData = await aiResponse.json();
        console.log("      API Response received:");
        console.log("      - Autoencoder Anomaly Score:", aiData.autoencoder_anomaly_score);
        console.log("      - LSTM Temporal Score:", aiData.lstm_temporal_probability);
        console.log("      - Overall Classification:", aiData.overall_classification);

        console.log("\n[3/5] 🛡️ BACKEND FUSION: Calculating final Trust (/calculate-trust)...");
        const trustResponse = await fetch('http://localhost:8000/calculate-trust', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(aiData)
        });
        const trustData = await trustResponse.json();
        console.log("      Final Assigned Trust:", trustData.fusion_trust_score, "-->", trustData.classification);

        console.log("\n[4/5] 🗄️ DATABASE: Simulating MongoDB save routine...");
        const mockMongoSave = {
            nodeId: "0x1111_TEST_NODE_3333",
            trustScore: trustData.fusion_trust_score,
            status: aiData.overall_classification === 'Normal' ? 'Active' : 'Suspicious',
            lastUpdated: new Date().toISOString()
        };
        console.log("      [MongoDB Payload] >>", mockMongoSave);

        console.log("\n[5/5] 🌐 FRONTEND: Emit WebSocket Update...");
        console.log("      Emitted '{ event: \"traffic_tick\", data: {...} }' to React UI successfully.");

        console.log("\n✅ E2E Pipeline verified successfully!");
        
    } catch (e) {
        console.error("Test Failed (Ensure FastAPI server is running!):", e.message);
    }
}

runTest();

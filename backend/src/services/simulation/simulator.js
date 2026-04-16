const nodeManager = require('./nodeManager');
const datasetLoader = require('./datasetLoader');
const simulationState = require('../simulationState');
const SimulationResult = require('../../models/SimulationResult');
const Node = require('../../models/Node');

// Environment variables for AI connection
const PYTHON_AI_URL = process.env.PYTHON_AI_URL || 'http://localhost:8000';

class Simulator {
    constructor() {
        this.intervalId = null;
        this.isRunning = false;
        this.batchSize = 10; // Process in small batches to avoid overloading
    }

    /**
     * Starts the 2-second simulation loop.
     */
    async start(io) {
        if (this.isRunning) return;
        
        this.io = io; // Store Socket.IO instance for real-time dashboard updates
        console.log('[Simulator] 🚀 AI-Driven Simulation Engine Starting...');
        
        // Ensure dataset is loaded before starting
        if (!datasetLoader.isLoaded) {
            await datasetLoader.load();
        }

        this.isRunning = true;
        this.intervalId = setInterval(() => this.tick(), 2000);
    }

    /**
     * Stops the simulation loop.
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        console.log('[Simulator] ⏹️ Simulation Engine Stopped.');
    }

    /**
     * Core tick logic executed every 2 seconds.
     */
    async tick() {
        const nodes = nodeManager.getAllNodes();
        console.log(`[Simulator] ⏱️ Tick: Processing ${nodes.length} nodes...`);

        // Process nodes in parallel using Promise.all
        // This ensures the loop remains non-blocking
        try {
            await Promise.all(nodes.map(node => this.processNode(node)));
            console.log(`[Simulator] ✅ Tick Complete: All nodes processed.`);
        } catch (err) {
            console.error(`[Simulator] ❌ Error in simulation tick: ${err.message}`);
        }
    }

    /**
     * Processes a single node: fetches data, scales it, calls AI, and persists.
     */
    async processNode(node) {
        // 1. Fetch data row sequentially with node's index
        const row = datasetLoader.getRow(node.datasetIndex);
        if (!row) return;

        // 2. Increment dataset index (safe loop)
        node.datasetIndex = (node.datasetIndex + 1) % datasetLoader.size;

        // 3. Apply behavioral scaling factors and noise
        const profile = nodeManager.getProfile(node.type);
        const noise = () => 1 + (Math.random() - 0.5) * profile.noiseLevel * 2;

        const scaledMetrics = {
            packet_rate: row.packet_rate * profile.multipliers[0] * noise(),
            latency: row.latency * profile.multipliers[1] * noise(),
            bandwidth: row.bandwidth * profile.multipliers[2] * noise(),
            failed_requests: row.failed_requests * profile.multipliers[3] * noise()
        };

        // Guarantee anomalous behavior for malicious nodes since dataset has 0 failed_requests
        if (node.type === 'malicious') {
            scaledMetrics.failed_requests += 15 + Math.random() * 20;
            scaledMetrics.packet_rate *= 2.5;
            scaledMetrics.latency += 0.5;
        }

        // 3.5 Manual Attack Override (Dashboard Integration)
        const manualAttacks = simulationState.getActiveAttacks();
        const activeAttack = manualAttacks[node.nodeId] || 'Normal';

        if (activeAttack === 'DDoS') {
            scaledMetrics.packet_rate *= 10;
            scaledMetrics.bandwidth *= 5;
            scaledMetrics.latency += 1000;
            scaledMetrics.failed_requests += 50;
        } else if (activeAttack === 'Sybil') {
            scaledMetrics.failed_requests += 40;
            scaledMetrics.packet_rate *= 1.5;
        } else if (activeAttack === 'Poison') {
            scaledMetrics.latency += 500;
            scaledMetrics.bandwidth *= 0.1;
            scaledMetrics.packet_rate *= 0.5;
        }

        // Ensure metrics are non-negative
        Object.keys(scaledMetrics).forEach(key => {
            scaledMetrics[key] = Math.max(0, scaledMetrics[key]);
        });

        // 4. Call FastAPI for Anomaly Prediction
        const aiResponse = await this.callAIService(scaledMetrics);
        
        // 5. Update Trust Score based on AI response
        // If anomaly detected, drop trust significantly. If normal, recover slowly.
        let newTrust = node.trustScore;
        if (aiResponse.overall_classification !== 'Normal') {
            newTrust *= 0.8; // 20% drop
        } else {
            newTrust = Math.min(100, newTrust + 0.5); // 0.5% recovery
        }
        node.trustScore = newTrust;
        node.metrics = scaledMetrics;

        // 5.5 Emit WebSocket update to Dashboard
        if (this.io) {
            this.io.emit('trust_update', {
                node: node.nodeId,
                trustScore: newTrust,
                attackType: aiResponse.overall_classification,
                metrics: scaledMetrics,
                classification: aiResponse.overall_classification !== 'Normal' ? aiResponse.overall_classification : 'Healthy'
            });

            // If critical anomaly, emit alert
            if (aiResponse.overall_classification !== 'Normal' || newTrust < 75) {
                const alertType = aiResponse.overall_classification;
                let severity = 'low';
                if (newTrust < 40) severity = 'critical';
                else if (newTrust < 70) severity = 'high';
                else if (newTrust < 85) severity = 'medium';

                this.io.emit('new_alert', {
                    id: `${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
                    nodeId: node.nodeId,
                    nodeLabel: `Node ${node.nodeId.slice(2, 6).toUpperCase()}`,
                    type: alertType,
                    message: `⚠️ ${severity.toUpperCase()}: ${alertType} detected`,
                    detail: `Anomalous traffic identified via LSTM/Autoencoder. Trust dropping to ${Math.round(newTrust)}%.`,
                    severity: severity,
                    trustScore: Math.round(newTrust),
                    timestamp: Date.now(),
                    resolved: false
                });
            }
        }

        // 6. Persist results to MongoDB
        await this.persistResults(node, scaledMetrics, aiResponse, newTrust);
    }

    /**
     * Communicates with the Python FastAPI microservice.
     */
    async callAIService(metrics) {
        // Ensure failed_requests is strictly an integer, as Pydantic expects int.
        const safeMetrics = {
            ...metrics,
            failed_requests: Math.round(metrics.failed_requests)
        };
        try {
            const response = await fetch(`${PYTHON_AI_URL}/predict-anomaly`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(safeMetrics)
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (err) {
            // Fallback for when AI service is down
            console.warn(`[Simulator] ⚠️ AI Service Offline! Forcing 'Normal' fallback. Is the Python service running on ${PYTHON_AI_URL}?`);
            return {
                overall_classification: 'Normal',
                autoencoder_score: 0.01,
                lstm_probability: 0.01
            };
        }
    }

    /**
     * Stores the simulation log and updates the node state in MongoDB.
     */
    async persistResults(node, metrics, aiResponse, trustScore) {
        try {
            // Log the history record (SimulationResult)
            await SimulationResult.create({
                nodeId: node.nodeId,
                metrics,
                trustScore,
                attackType: aiResponse.overall_classification,
                autoencoder_score: aiResponse.autoencoder_anomaly_score,
                lstm_probability: aiResponse.lstm_temporal_probability
            });

            // Update the live Node state
            await Node.findOneAndUpdate(
                { nodeId: node.nodeId },
                { 
                    $set: { 
                        trustScore: trustScore / 100, // Normalize for UI 0-1.0
                        status: this.mapClassificationToStatus(aiResponse.overall_classification, trustScore),
                        'metrics.latency': metrics.latency,
                        'metrics.throughput': metrics.packet_rate,
                        'metrics.packetLoss': metrics.failed_requests
                    }
                },
                { upsert: true }
            );
        } catch (err) {
            // Periodic log failures are okay in high-speed simulation
        }
    }

    mapClassificationToStatus(classification, trustScore) {
        if (classification !== 'Normal') return 'Malicious';
        if (trustScore < 70) return 'Suspicious';
        return 'Active';
    }
}

const simulator = new Simulator();
module.exports = simulator;

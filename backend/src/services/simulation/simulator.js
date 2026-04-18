const nodeManager = require('./nodeManager');
const datasetLoader = require('./datasetLoader');
const simulationState = require('../simulationState');
const SimulationResult = require('../../models/SimulationResult');
const Node = require('../../models/Node');
const ledgerService = require('../ledgerService');

// Environment variables for AI connection
const PYTHON_AI_URL = process.env.PYTHON_AI_URL || 'http://localhost:8000';

class Simulator {
    constructor() {
        this.intervalId = null;
        this.isRunning = false;
        this.io = null;
        
        // --- STEP 7: REMOVE STATIC BEHAVIOR (Configuration Constants) ---
        this.ISOLATION_THRESHOLD = 60;
        this.RECOVERY_RATE = 0.8;          // Slow recovery
        this.MALICIOUS_CHANCE = 0.15;      // ~15% chance per node per cycle to start an attack
        this.ATTACK_STAY_CHANCE = 0.70;    // 70% chance to continue attack next cycle
    }

    /**
     * Starts the simulation engine.
     */
    async start(io) {
        if (this.isRunning) return;
        this.io = io; 
        console.log('[Simulator] 🚀 Dynamic Anomaly Detection Engine Starting...');
        
        if (!datasetLoader.isLoaded) await datasetLoader.load();

        this.isRunning = true;
        this.intervalId = setInterval(() => this.tick(), 2500); // 2.5s cycle
    }

    /**
     * Stops the simulation engine.
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
     * --- STEP 1: FIX STATIC ATTACK SELECTION ---
     * Probabilistic attack assignment per simulation cycle.
     */
    async tick() {
        const nodes = nodeManager.getAllNodes();
        const activeAttacks = simulationState.getActiveAttacks();

        nodes.forEach(node => {
            // Already isolated nodes cannot attack or be attacked
            if (node.status === 'Isolated') return;

            const isCurrentlyAttacking = activeAttacks[node.nodeId] && activeAttacks[node.nodeId] !== 'Healthy';

            if (isCurrentlyAttacking) {
                // Chance to stop attacking and return to normal
                if (Math.random() > this.ATTACK_STAY_CHANCE) {
                    activeAttacks[node.nodeId] = 'Healthy';
                }
            } else {
                // --- STEP 1: Implement ~20% (configured as 15% for stability) chance to become malicious ---
                if (Math.random() < this.MALICIOUS_CHANCE) {
                    const types = ['DDoS Attack', 'Port Scan', 'Infiltration', 'Botnet'];
                    activeAttacks[node.nodeId] = types[Math.floor(Math.random() * types.length)];
                } else {
                    activeAttacks[node.nodeId] = 'Healthy';
                }
            }
        });

        console.log(`[Simulator] ⏱️ Tick: Processing ${nodes.length} nodes with dynamic attack patterns.`);
        try {
            await Promise.all(nodes.map(node => this.processNode(node)));
        } catch (err) {
            console.error(`[Simulator] Error: ${err.message}`);
        }
    }

    /**
     * Core processing for each node.
     */
    async processNode(node) {
        // --- STEP 5: IMPLEMENT NODE ISOLATION (Prevention) ---
        if (node.status === 'Isolated') {
            const blockedMetrics = { packet_rate: 0, latency: 999, bandwidth: 0, failed_requests: 0 };
            return await this.persistResults(node, blockedMetrics, { overall_classification: 'Blocked' }, node.trustScore);
        }

        // 1. Fetch from Dataset
        const row = datasetLoader.getRow(node.datasetIndex);
        node.datasetIndex = (node.datasetIndex + 1) % datasetLoader.size;

        // 2. Behavioral Profile Multipliers
        const profile = nodeManager.getProfile(node.type);
        let metrics = {
            packet_rate: row.packet_rate * profile.multipliers[0],
            latency: row.latency * profile.multipliers[1],
            bandwidth: row.bandwidth * profile.multipliers[2],
            failed_requests: row.failed_requests * profile.multipliers[3]
        };

        // --- STEP 4: ADD ANOMALY INJECTION (CRITICAL) ---
        const activeAttacks = simulationState.getActiveAttacks();
        const currentAttack = activeAttacks[node.nodeId];

        if (currentAttack && currentAttack !== 'Healthy') {
            // Spike metrics x3 to x6 as requested
            metrics.packet_rate *= (3 + Math.random() * 3);
            metrics.failed_requests += (30 + Math.floor(Math.random() * 50));
            metrics.latency += (200 + Math.random() * 300);
        }

        // --- STEP 3: FIX AI INTEGRATION ---
        const aiResponse = await this.callAIService(metrics);
        const anomalyScore = Math.max(
            aiResponse.autoencoder_anomaly_score || 0,
            aiResponse.lstm_temporal_probability || 0
        );

        // --- STEP 2: FIX TRUST SCORE UPDATE ---
        let oldTrust = node.trustScore;
        let newTrust = oldTrust;

        if (anomalyScore > 0.45 || aiResponse.overall_classification !== 'Normal') {
            // If anomaly detected → decrease trust significantly
            const penalty = 20 + (anomalyScore * 30); 
            newTrust = Math.max(0, oldTrust - penalty);
        } else {
            // If normal → increase trust slightly (Slow recovery)
            newTrust = Math.min(100, oldTrust + this.RECOVERY_RATE);
        }

        // Apply change
        node.trustScore = newTrust;
        node.metrics = metrics;

        // Sync with global simulationState for API visibility
        const globalScores = simulationState.getTrustScores();
        globalScores[node.nodeId] = newTrust;

        // --- STEP 5: IMPLEMENT NODE ISOLATION (Detection) ---
        if (newTrust < this.ISOLATION_THRESHOLD) {
            node.status = 'Isolated';
            simulationState.getActiveAttacks()[node.nodeId] = 'Isolated';
        }

        // Periodically persist state to JSON fallback
        if (Math.random() < 0.1) simulationState.saveState();

        // --- STEP 8: ADD DEBUG LOGGING ---
        if (currentAttack !== 'Healthy' || node.status === 'Isolated') {
            console.log(`[DEBUG] Node: ${node.nodeId.slice(0,6)} | Attack: ${currentAttack} | Anomaly: ${anomalyScore.toFixed(2)} | Trust: ${newTrust.toFixed(1)} | Isolated: ${node.status === 'Isolated'}`);
        }

        // --- STEP 6: FIX FRONTEND UPDATE (WebSocket Emission) ---
        if (this.io) {
            const updatePayload = {
                node: node.nodeId,
                trustScore: newTrust,
                attackType: currentAttack,
                metrics: metrics,
                status: node.status,
                classification: node.status === 'Isolated' ? 'Isolated' : aiResponse.overall_classification
            };
            this.io.emit('trust_update', updatePayload);

            if (aiResponse.overall_classification !== 'Normal' || node.status === 'Isolated') {
                this.io.emit('new_alert', {
                    nodeId: node.nodeId,
                    type: currentAttack === 'Healthy' ? 'Auto-Isolation' : currentAttack,
                    message: node.status === 'Isolated' ? 'NODE ISOLATED' : 'Attack Detected',
                    severity: newTrust < 40 ? 'critical' : 'high',
                    trustScore: Math.round(newTrust),
                    timestamp: Date.now()
                });
            }
        }

        // Blockchain recording for transparency
        if (Math.abs(newTrust - oldTrust) > 5 || node.status === 'Isolated') {
            await ledgerService.recordEvent(node.nodeId, newTrust, node.status === 'Isolated' ? 'Node Isolated' : 'Dynamic Trust Update', currentAttack);
        }

        await this.persistResults(node, metrics, aiResponse, newTrust);
    }

    async callAIService(metrics) {
        try {
            const response = await fetch(`${PYTHON_AI_URL}/predict-anomaly`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(metrics)
            });
            return await response.json();
        } catch (err) {
            return { overall_classification: 'Normal', autoencoder_anomaly_score: 0.02 };
        }
    }

    async persistResults(node, metrics, aiResponse, trustScore) {
        try {
            await SimulationResult.create({
                nodeId: node.nodeId,
                metrics,
                trustScore,
                status: node.status,
                attackType: aiResponse.overall_classification
            });

            await Node.findOneAndUpdate(
                { nodeId: node.nodeId },
                { 
                    $set: { 
                        trustScore: trustScore / 100, 
                        status: node.status,
                        'metrics.latency': metrics.latency,
                        'metrics.throughput': metrics.packet_rate 
                    } 
                }
            );
        } catch (err) {}
    }
}

const simulator = new Simulator();
module.exports = simulator;

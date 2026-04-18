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
        
        // Calibrated for realistic 6G simulation:
        // ~8% of nodes may come under attack per cycle; most recover within 30-60s
        this.ISOLATION_THRESHOLD = 20;     // Only truly compromised nodes get isolated
        this.RECOVERY_RATE      = 3.0;     // Recover 3 points/tick when healthy (was 0.8)
        this.MALICIOUS_CHANCE   = 0.08;    // 8% chance per node per cycle to start an attack (was 25%)
        this.ATTACK_STAY_CHANCE = 0.50;    // 50% chance to continue attack (was 70%)  
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
                // --- STEP 1: Implement ~25% chance to become malicious ---
                if (Math.random() < this.MALICIOUS_CHANCE) {
                    const types = ['DDoS Attack', 'Sybil Attack', 'Poison Attack'];
                    activeAttacks[node.nodeId] = types[Math.floor(Math.random() * types.length)];
                } else {
                    activeAttacks[node.nodeId] = 'Healthy';
                }
            }
        });

        console.log(`[Simulator] ⏱️ Tick: Processing ${nodes.length} nodes with dynamic attack patterns.`);
        try {
            await Promise.all(nodes.map(node => this.processNode(node)));
            // Store snapshot for history analytics
            simulationState.captureSnapshot();
        } catch (err) {
            console.error(`[Simulator] Error: ${err.message}`);
        }
    }

    /**
     * Core processing for each node.
     */
    async processNode(node) {
        // Isolated nodes slowly self-recover at 1/4 normal rate
        if (node.status === 'Isolated') {
            const globalScores = simulationState.getTrustScores();
            const current = globalScores[node.nodeId] ?? 0;
            const recovered = Math.min(100, current + (this.RECOVERY_RATE * 0.25));
            globalScores[node.nodeId] = recovered;
            node.trustScore = recovered;
            if (recovered >= this.ISOLATION_THRESHOLD) {
                node.status = 'Malicious'; // Graduate back to malicious before healthy
                simulationState.getActiveAttacks()[node.nodeId] = 'Healthy';
            }
            return; // Still skip full processing
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
        // Penalty: gradual degradation (5–12 pts) rather than cliff-drop (20–47 pts)
        // Recovery: 3 pts/tick when healthy so nodes bounce back within ~30s
        let oldTrust = node.trustScore;
        let newTrust = oldTrust;

        if (anomalyScore > 0.45 || aiResponse.overall_classification !== 'Normal') {
            // Penalty scales with anomaly severity but stays moderate
            const penalty = 5 + (anomalyScore * 7); // max ~12 pts per tick
            newTrust = Math.max(0, oldTrust - penalty);
        } else {
            // Healthy → recover toward 100
            newTrust = Math.min(100, oldTrust + this.RECOVERY_RATE);
        }

        // Apply change
        node.trustScore = newTrust;
        node.metrics = metrics;

        // Sync with global simulationState for API visibility
        const globalScores = simulationState.getTrustScores();
        globalScores[node.nodeId] = newTrust;

        // Status mapping: Healthy > 80, Suspicious 60-80, Malicious 20-60, Isolated < 20
        if (newTrust < this.ISOLATION_THRESHOLD) {
            node.status = 'Isolated';
            simulationState.getActiveAttacks()[node.nodeId] = 'Isolated';
        } else if (newTrust < 60) {
            node.status = 'Malicious';
        } else if (newTrust < 80) {
            node.status = 'Suspicious';
        } else {
            node.status = 'Healthy';
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
        // LOG EVERY ATTACK or isolation event
        const isAttack = currentAttack && currentAttack !== 'Healthy';
        const significantChange = Math.abs(newTrust - oldTrust) > 8;
        
        if (isAttack || node.status === 'Isolated' || significantChange) {
            const action = node.status === 'Isolated' ? 'Node Isolated' : 
                          (isAttack ? `Network Threat Logged: ${currentAttack}` : 'Trust Dynamic Update');
            
            await ledgerService.recordEvent(node.nodeId, newTrust, action, currentAttack || 'Normal');
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

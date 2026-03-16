require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

// ─── App & Server ──────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

// ─── 6G Node Management & Transfer Routes ───────────────────────────────────
const nodesRouter = require('./routes/nodes');
const transfersRouter = require('./routes/transfers');
const physicalAuth = require('./services/physicalAuthService');
const federatedAggregation = require('./services/federatedAggregationService');

app.use('/api/admin/nodes', nodesRouter);
app.use('/api/admin/transfers', transfersRouter);

// ─── Mock 6G Node Registry ────────────────────────────────────────────────────
const MOCK_NODES = Array.from({ length: 20 }, (_, i) => {
  const hex = (i + 1).toString(16).padStart(40, '0');
  let role = 1; // Default IoT
  if (i >= 14 && i < 17) role = 2; // High Traffic (Base Station proxy)
  else if (i >= 17 && i < 19) role = 3; // Unstable (Relay proxy)
  return { address: `0x${hex}`, role };
});

// ─── In-Memory Trust & Blockchain State ───────────────────────────────────────
const trustScores = {};      // address -> current score (0-100)
const alerts = [];           // attack alerts list
const blockchainBlocks = []; // simulated blockchain blocks
let maliciousMode = false;
let blockIndex = 1;

MOCK_NODES.forEach(n => { trustScores[n.address] = 85; });

// Transaction log — separate from blocks, for the TX viewer table
const txLog = [];   // rich transaction records
let txSeq = 1;

const ACTIONS = ['Trust Score Updated', 'Attack Detected', 'Node Isolated', 'Node Recovered'];

function generateHash(len = 64) {
  return '0x' + [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

function mineBlock(nodeAddr, score, action) {
  const prev = blockchainBlocks.length > 0
    ? blockchainBlocks[blockchainBlocks.length - 1].hash
    : '0x0000000000000000000000000000000000000000000000000000000000000000';

  const blockHash = generateHash(64);
  const txHash    = generateHash(64);
  const nodeLabel = `Node ${nodeAddr.slice(2,6).toUpperCase()}`;
  const timestamp = Date.now();

  // Rich transaction record for the log table
  const tx = {
    id:        txSeq++,
    blockId:   blockIndex,
    nodeId:    nodeAddr,
    nodeLabel,
    action:    action || 'Trust Score Updated',
    txHash,
    blockHash,
    timestamp,
    trustScore: score,
  };
  txLog.unshift(tx);
  if (txLog.length > 100) txLog.pop();

  blockchainBlocks.push({
    index: blockIndex++,
    hash: blockHash,
    previousHash: prev,
    transactions: [tx],
  });
  if (blockchainBlocks.length > 20) blockchainBlocks.shift();

  // Broadcast new transaction in real time
  io.emit('new_transaction', tx);
}

const activeAttacks = {}; // { [nodeAddress]: 'DDoS' | 'Sybil' | 'DataManipulation' }
const nodeMetricsHistory = {}; // { [nodeAddress]: list of metrics }

// ─── Simulator ────────────────────────────────────────────────────────────────
async function runSimulatorTick() {
  for (const node of MOCK_NODES) {
    const attack = activeAttacks[node.address] || 'Normal';
    const attacking = attack !== 'Normal';

    // 1. Generate metrics shape matching pipeline expect inputs
    let packetRate = Math.floor(Math.random() * 20 + 1);
    let packetSize = Math.floor(Math.random() * 500 + 100);
    let responseTimeMs = Math.floor(Math.random() * 80 + 20);
    let authFailures = 0;
    let channelQuality = 0.95; // nominal

    // 🛡️ Added: Signal metrics for physical layer auth
    const correctProfile = physicalAuth.getCorrectProfile(node.address);
    let providedRf = correctProfile ? correctProfile.rfFingerprint : 'RF_UNKNOWN';
    let providedCsi = 0.85;
    let providedSnr = 25.0;

    // 🧠 Added: Model Update Gradient Metrics
    let gradient_magnitude = Number((Math.random() * 0.25 + 0.1).toFixed(3));
    let loss_change = Number((Math.random() * 0.1 - 0.05).toFixed(3));
    let update_variance = Number((Math.random() * 0.04).toFixed(3));
    let parameter_drift = Number((Math.random() * 0.02).toFixed(3));

    // Apply attack profiles
    if (attack === 'DDoS') {
      packetRate = 500;
      packetSize = 5000;
      responseTimeMs = 1500;
    } else if (attack === 'Sybil') {
      packetRate = 80;
      packetSize = 250;
      authFailures = 5;
      providedRf = `RF_SPOOF_${Math.floor(Math.random() * 1000)}`;
    } else if (attack === 'DataManipulation') {
      packetRate = 4;
      packetSize = 100;
    } else if (attack === 'PacketFlooding') {
      packetRate = 800;
    } else if (attack === 'Suspicious') {
      packetRate = 45;
      channelQuality = 0.75; 
      providedCsi = 0.60;
    } else if (attack === 'PoisonedGradients') {
      gradient_magnitude = 0.85;
      loss_change = 0.60;
      update_variance = 0.45;
    } else if (attack === 'DelayedUpdate') {
      responseTimeMs = 2500;
      packetRate = 1; 
    } else if (attack === 'CoordinatedAttack') {
      gradient_magnitude = 0.90; // High Poison
    }

    const currentMetrics = {
      packet_rate: packetRate,
      latency: responseTimeMs,
      bandwidth_usage: packetSize * packetRate,
      failed_requests: attacking ? 12 : 1,
      connection_attempts: (attack === 'Sybil') ? 22 : 4,
      authentication_failures: authFailures,
      channel_quality: channelQuality,
      rfFingerprint: providedRf,
      csiBehavior: providedCsi,
      snr: providedSnr,
      gradient_magnitude,
      loss_change,
      update_variance,
      parameter_drift
    };

    // Maintain history for LSTM sequential tests
    if (!nodeMetricsHistory[node.address]) nodeMetricsHistory[node.address] = [];
    const history = [...nodeMetricsHistory[node.address]];
    nodeMetricsHistory[node.address].push(currentMetrics);
    if (nodeMetricsHistory[node.address].length > 4) nodeMetricsHistory[node.address].shift();

    const previousScore = trustScores[node.address] ?? 85;
    let finalScore = previousScore;
    let pipelineStages = [];
    let isAnomalous = false;
    let classification = 'Normal';

    // 🔬 Step 1: Pre-Filter Physical Layer Authentication in Backend
    const authStatus = physicalAuth.verifyIdentity(node.address, currentMetrics);

    if (!authStatus.authenticated) {
        // Reject and Isolate Immediately
        isAnomalous = true;
        classification = 'Spoofed Identity';
        finalScore = Math.max(0, previousScore - 30); // Penalty
        pipelineStages = [
           { stage: "Physical Auth Pre-Filter (Backend)", success: false, details: authStatus.reason }
        ];
    } else {
        // Proceed to AI Pipeline
        try {
          const response = await fetch('http://localhost:8000/pipeline/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              node_address: node.address,
              current_trust: previousScore,
              metrics: currentMetrics,
              history: history
            })
          });

          if (response.ok) {
            const aiData = await response.json();
            finalScore     = aiData.final_trust_score;
            pipelineStages = [
                { stage: "Physical Auth Pre-Filter (Backend)", success: true, details: "Passed credentials match" },
                ...aiData.pipeline_stages
            ];
            isAnomalous    = aiData.is_anomalous;
            classification = aiData.classification;
          } else {
            throw new Error('Fallback trigger');
          }
        } catch (e) {
          // AI Service offline fallback heuristics
          let delta = (attacking ? -20 : +2);
          finalScore = Math.max(0, Math.min(100, Math.round(previousScore + delta)));
          isAnomalous = attacking;
          classification = attacking ? 'Fallback Attack' : 'Normal';
          pipelineStages = [
             { stage: "Physical Auth Pre-Filter (Backend)", success: true, details: "Passed credentials match" },
             { stage: "Fallback Aggregator", score: finalScore, details: "AI Online verification skipping..." }
          ];
        }
    }

    trustScores[node.address] = finalScore;

    // Emit trust_update with PIPELINE trace metadata
    io.emit('trust_update', {
      node: node.address,
      packetSize,
      packetRate,
      isMaliciousMode: attacking,
      trustScore: finalScore,
      attackType: attack,
      classification: classification,
      pipelineStages: pipelineStages // Added for frontend panel
    });

    // 6. Blockchain Smart Contract Enforcement (Enabler condition)
    let action = 'Trust Score Updated';
    let shouldMine = Math.random() < 0.20;

    if (isAnomalous) {
      action = 'Node Access Revoked';
      shouldMine = true; // Log instantly
    } else if (finalScore < 60 && previousScore >= 60) {
      action = 'Suspicious Behavior Logged';
      shouldMine = true;
    }

    if (shouldMine) {
      mineBlock(node.address, finalScore, action);
    }

    // 🤝 Submit for Federated Aggregation if trust >= threshold
    if (finalScore >= 60) {
      const gradients = [
        Number((Math.random() * 0.4 + 0.1).toFixed(3)),
        Number((Math.random() * 0.3 + 0.1).toFixed(3)),
        Number((Math.random() * 0.2).toFixed(3)),
        Number((Math.random() * 0.5 + 0.5).toFixed(3)),
        Number((Math.random() * 0.1).toFixed(3))
      ];
      federatedAggregation.submitUpdate(node.address, gradients, finalScore);
    }

    // Generate attack alert structure for monitoring page buffer feed
    if (isAnomalous || finalScore < 60) {
      const severity = finalScore < 30 ? 'critical' : finalScore < 50 ? 'high' : 'medium';
      const nodeLabel = `Node ${node.address.slice(2, 6).toUpperCase()}`;

      const alert = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
        nodeId: node.address,
        nodeLabel,
        type: classification.includes('Attack') ? classification : `${classification} Attack`,
        message: `⚠️ ${classification} detected on ${nodeLabel}`,
        detail: pipelineStages.map(p => `${p.stage}: ${p.details || 'Processed'}`).join(' | '),
        severity,
        trustScore: finalScore,
        timestamp: Date.now(),
        resolved: false,
      };
      alerts.unshift(alert);
      if (alerts.length > 50) alerts.pop();
      // Push real-time to connected clients
      io.emit('new_alert', alert);
    }
    
  }

  // 🧠 Execute Secure Federated Aggregation round cycle
  const globalModel = federatedAggregation.aggregate();
  io.emit('federated_model_updated', { globalModel });
}

// ─── REST API ─────────────────────────────────────────────────────────────────
app.post('/api/verify-physical-identity', (req, res) => {
  const { nodeAddress, metrics } = req.body;
  if (!nodeAddress || !metrics) return res.status(400).json({ error: 'nodeAddress and metrics required' });
  
  const result = physicalAuth.verifyIdentity(nodeAddress, metrics);
  if (!result.authenticated) {
    return res.status(403).json(result);
  }
  res.json(result);
});

app.get('/api/nodes', (req, res) => {
  res.json({ nodes: MOCK_NODES });
});

app.get('/api/trust/:nodeAddr', (req, res) => {
  const { nodeAddr } = req.params;
  const score = trustScores[nodeAddr] ?? 85;
  res.json({ trustScore: score, predictedNextScore: Math.min(100, score + (Math.random() * 6 - 1)) });
});

app.get('/api/attacks', (req, res) => {
  const { severity, type, limit = 50 } = req.query;
  let result = [...alerts];
  if (severity) result = result.filter(a => a.severity === severity);
  if (type)     result = result.filter(a => a.type === type);
  res.json(result.slice(0, Number(limit)));
});

app.get('/api/blockchain', (req, res) => {
  res.json(blockchainBlocks);
});

app.get('/api/transactions', (req, res) => {
  const { action, nodeId, limit = 100 } = req.query;
  let result = [...txLog];
  if (action) result = result.filter(t => t.action === action);
  if (nodeId) result = result.filter(t => t.nodeId === nodeId);
  res.json(result.slice(0, Number(limit)));
});

app.get('/api/trust-scores', (req, res) => {
  const result = MOCK_NODES.map((node, i) => {
    const rawScore = trustScores[node.address] ?? 85;  // stored as 0-100
    const normalized = rawScore / 100;
    const status = normalized > 0.7 ? 'trusted' : normalized >= 0.4 ? 'suspicious' : 'malicious';
    return {
      nodeId: `${node.address.slice(0, 6)}…${node.address.slice(-4)}`,
      address: node.address,
      trustScore: parseFloat(normalized.toFixed(3)),
      role: node.role,
      status,
    };
  });
  res.json(result);
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', simulator: 'running', maliciousMode });
});

// ─── Admin Node Actions ────────────────────────────────────────────────────────
// GET single node detail
app.get('/api/nodes/:addr', (req, res) => {
  const { addr } = req.params;
  const node = MOCK_NODES.find(n => n.address === addr);
  if (!node) return res.status(404).json({ error: 'Node not found' });
  const score = trustScores[addr] ?? 85;
  const status = score >= 70 ? 'trusted' : score >= 40 ? 'suspicious' : 'malicious';
  res.json({ ...node, trustScore: score, status });
});

// POST: Isolate a node (set trust score to 0, mine block)
app.post('/api/nodes/:addr/isolate', (req, res) => {
  const { addr } = req.params;
  if (!MOCK_NODES.find(n => n.address === addr)) return res.status(404).json({ error: 'Node not found' });
  trustScores[addr] = 0;
  mineBlock(addr, 0, 'Node Isolated');
  io.emit('trust_update', { node: addr, trustScore: 0, isMaliciousMode: maliciousMode });
  io.emit('node_action', { addr, action: 'isolated', trustScore: 0, timestamp: Date.now() });
  res.json({ success: true, addr, action: 'isolated', trustScore: 0 });
});

// POST: Restore a node (reset trust to 80, mine block)
app.post('/api/nodes/:addr/restore', (req, res) => {
  const { addr } = req.params;
  if (!MOCK_NODES.find(n => n.address === addr)) return res.status(404).json({ error: 'Node not found' });
  trustScores[addr] = 80;
  mineBlock(addr, 80, 'Node Recovered');
  io.emit('trust_update', { node: addr, trustScore: 80, isMaliciousMode: maliciousMode });
  io.emit('node_action', { addr, action: 'restored', trustScore: 80, timestamp: Date.now() });
  res.json({ success: true, addr, action: 'restored', trustScore: 80 });
});

// POST: Update trust score manually
app.post('/api/nodes/:addr/trust', (req, res) => {
  const { addr } = req.params;
  const { score } = req.body;
  if (!MOCK_NODES.find(n => n.address === addr)) return res.status(404).json({ error: 'Node not found' });
  const clamped = Math.max(0, Math.min(100, Number(score)));
  if (isNaN(clamped)) return res.status(400).json({ error: 'Invalid score' });
  trustScores[addr] = clamped;
  mineBlock(addr, clamped, 'Trust Score Updated');
  io.emit('trust_update', { node: addr, trustScore: clamped, isMaliciousMode: maliciousMode });
  io.emit('node_action', { addr, action: 'trust_updated', trustScore: clamped, timestamp: Date.now() });
  res.json({ success: true, addr, action: 'trust_updated', trustScore: clamped });
});

app.post('/api/simulator/attack', (req, res) => {
  const { node, attackType } = req.body;
  if (node) {
    // 🔬 Containment Rule 6: Max 15% Malicious Simulator Limit
    const maliciousCount = Object.values(activeAttacks).filter(a => a !== 'Normal' && a !== 'Normal Traffic').length;
    const maxAllowed = Math.ceil(MOCK_NODES.length * 0.15);

    if (attackType !== 'Normal' && maliciousCount >= maxAllowed && !activeAttacks[node]) {
       console.log(`[Simulator] 🛡️ Manual Attack Blocked for ${node.slice(0,6)} (Limit of ${maxAllowed} reached)`);
       return res.status(400).json({ error: `Attack limit reached (${maxAllowed}). Stop previous attacks first.` });
    }

    activeAttacks[node] = attackType;
    console.log(`[Simulator] ⚔️ Attack [${attackType}] triggered on ${node}`);
    io.emit('simulator_mode', { node, attackType, isMaliciousMode: true });
    return res.json({ success: true, message: `Started ${attackType} on ${node}` });
  }
  res.status(400).json({ error: 'Node address required' });
});

app.post('/api/simulator/stop-attack', (req, res) => {
  const { node } = req.body;
  if (node) {
    delete activeAttacks[node];
    console.log(`[Simulator] 🛡️ Attack stopped on ${node}`);
    io.emit('simulator_mode', { node, attackType: 'Normal', isMaliciousMode: false });
    return res.json({ success: true, message: `Stopped attack on ${node}` });
  }
  res.status(400).json({ error: 'Node address required' });
});

// ─── Socket.IO ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('[Socket] Client connected:', socket.id);
  // Immediately send current mode + all nodes on connect
  socket.emit('simulator_mode', { maliciousMode });
  res_json_nodes_on_connect: res => null; // handled by GET /api/nodes

  socket.on('disconnect', () => {
    console.log('[Socket] Client disconnected:', socket.id);
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`\n✅ Backend running on http://localhost:${PORT}`);
  console.log('✅ 6G Simulator starting...\n');
  
  // Start simulator immediately
  setInterval(runSimulatorTick, 2000);

  // 🎲 Stochastic Attack Generator (Every 5-10 seconds)
  setInterval(() => {
    const maliciousCount = Object.values(activeAttacks).filter(a => a !== 'Normal' && a !== 'Normal Traffic').length;
    const maxAllowed = Math.ceil(MOCK_NODES.length * 0.15); // Max 15% (e.g., 1 node)

    const node = MOCK_NODES[Math.floor(Math.random() * MOCK_NODES.length)].address;
    const rand = Math.random();

    if (maliciousCount >= maxAllowed) {
       // Stop generating NEW attacks. If picked node is malicious, allow healing to Normal
       if (activeAttacks[node] && activeAttacks[node] !== 'Normal' && rand < 0.50) {
          delete activeAttacks[node];
          console.log(`[Stochastic] 🛡️ Node ${node.slice(0,6)} forced back to Normal for recovery balancer.`);
          io.emit('simulator_mode', { node, attackType: 'Normal', isMaliciousMode: false });
       }
       return;
    }

    if (rand < 0.10) { // 10% Malicious
      const attacks = ['DDoS', 'Sybil', 'DataManipulation', 'PacketFlooding'];
      const chosen = attacks[Math.floor(Math.random() * attacks.length)];
      activeAttacks[node] = chosen;
      console.log(`[Stochastic] 🎲 Spontaneous Attack [${chosen}] initiated on ${node.slice(0,6)}`);
      io.emit('simulator_mode', { node, attackType: chosen, isMaliciousMode: true });
    } else if (rand < 0.30) { // 20% Suspicious
      activeAttacks[node] = 'Suspicious';
      console.log(`[Stochastic] 🎲 Spontaneous [Suspicious] state set on ${node.slice(0,6)}`);
      io.emit('simulator_mode', { node, attackType: 'Suspicious', isMaliciousMode: true });
    } else { // 70% Normal
      if (activeAttacks[node]) {
        delete activeAttacks[node];
        console.log(`[Stochastic] 🛡️ Node ${node.slice(0,6)} returned to Normal`);
        io.emit('simulator_mode', { node, attackType: 'Normal', isMaliciousMode: false });
      }
    }
  }, Math.floor(Math.random() * 5000) + 5000);
});

// ─── Optional: Try MongoDB (non-blocking) ─────────────────────────────────────
try {
  const mongoose = require('mongoose');
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/6g_trustguard';
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('[MongoDB] Connected'))
    .catch(err => console.warn('[MongoDB] Not available, running in mock mode:', err.message));
} catch (e) {
  console.warn('[MongoDB] Module not available, running without DB.');
}

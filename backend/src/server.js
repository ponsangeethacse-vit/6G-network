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

// ─── Mock 6G Node Registry ────────────────────────────────────────────────────
const MOCK_NODES = [
  { address: '0x1111111111111111111111111111111111111111', role: 1 }, // IoT Device
  { address: '0x2222222222222222222222222222222222222222', role: 2 }, // Base Station
  { address: '0x3333333333333333333333333333333333333333', role: 3 }, // Cellular Relay
  { address: '0x9999999999999999999999999999999999999999', role: 1 }, // Malicious Node
];

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

// ─── Simulator ────────────────────────────────────────────────────────────────
async function runSimulatorTick() {
  for (const node of MOCK_NODES) {
    const attack = activeAttacks[node.address] || 'Normal';
    const attacking = attack !== 'Normal';

    // Compute trust score change
    let delta = (Math.random() * 6) - 2; // -2 to +4 normally
    if (attacking) delta = -(Math.random() * 18 + 12); // sharp drop during attack

    const prev = trustScores[node.address] ?? 85;
    const newScore = Math.max(0, Math.min(100, Math.round(prev + delta)));
    trustScores[node.address] = newScore;

    // Default metrics
    let packetRate = Math.floor(Math.random() * 20 + 1);
    let packetSize = Math.floor(Math.random() * 500 + 100);
    let responseTimeMs = Math.floor(Math.random() * 80 + 20);

    // Apply attack profiles
    if (attack === 'DDoS') {
      packetRate = 500;
      packetSize = 5000;
      responseTimeMs = 1500;
    } else if (attack === 'Sybil') {
      packetRate = 80;
      packetSize = 250;
      responseTimeMs = 120;
    } else if (attack === 'DataManipulation') {
      packetRate = 4;
      packetSize = 100;
      responseTimeMs = 10; // Manipulated low latency
    }

    // Emit trust_update matching the shape TrustDashboard expects
    io.emit('trust_update', {
      node: node.address,
      packetSize: packetSize,
      packetRate: packetRate,
      isMaliciousMode: attacking,
      trustScore: newScore,
      attackType: attack
    });

    // Mine a block with the appropriate action type
    if (Math.random() < 0.35) {
      let action = 'Trust Score Updated';
      if (newScore < 30)       action = 'Node Isolated';
      else if (newScore < 60)  action = 'Attack Detected';
      else if (prev < 60 && newScore >= 60) action = 'Node Recovered';
      mineBlock(node.address, newScore, action);
    }

    // Generate attack alert when trust falls below threshold
    if (newScore < 60) {
      let classification = 'Insider Threat';
      let message = 'Anomalous internal access pattern';

      try {
        const response = await fetch('http://localhost:8000/predict-attack', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            packet_rate: packetRate,
            latency: attacking ? 600 : 40,
            failed_requests: attacking ? 50 : 3,
            connection_attempts: attacking ? 10 : 2
          })
        });

        if (response.ok) {
          const aiData = await response.json();
          classification = aiData.classification;
          message = aiData.message;
          console.log(`[AI-Service] Predicted [${classification}] for Node ${node.address.slice(0,6)}`);
        }
      } catch (e) {
        // Fallback placeholder logic if AI microservice goes down
        classification = attacking ? 'DDoS Attack' : 'Data Manipulation';
      }

      const severity = newScore < 30 ? 'critical' : newScore < 50 ? 'high' : 'medium';
      const nodeLabel = `Node ${node.address.slice(2, 6).toUpperCase()}`;

      const alert = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
        nodeId: node.address,
        nodeLabel,
        type: classification.includes('Attack') ? classification : `${classification} Attack`,
        message: `⚠️ ${classification} detected on ${nodeLabel}`,
        detail:  message,
        severity,
        trustScore: newScore,
        timestamp: Date.now(),
        resolved: false,
      };
      alerts.unshift(alert);
      if (alerts.length > 50) alerts.pop();
      // Push real-time to connected clients
      io.emit('new_alert', alert);
    }
  }
}

// ─── REST API ─────────────────────────────────────────────────────────────────
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

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

// ─── Simulator ────────────────────────────────────────────────────────────────
function runSimulatorTick() {
  MOCK_NODES.forEach(node => {
    const isMalicious = node.address === '0x9999999999999999999999999999999999999999';
    const attacking = isMalicious && maliciousMode;

    // Compute trust score change
    let delta = (Math.random() * 6) - 2; // -2 to +4 normally
    if (attacking) delta = -(Math.random() * 15 + 10); // sharp drop during attack

    const prev = trustScores[node.address] ?? 85;
    const newScore = Math.max(0, Math.min(100, Math.round(prev + delta)));
    trustScores[node.address] = newScore;

    // Emit trust_update matching the shape TrustDashboard expects
    io.emit('trust_update', {
      node: node.address,
      packetSize: attacking ? 5000 : Math.floor(Math.random() * 500 + 100),
      packetRate: attacking ? 500  : Math.floor(Math.random() * 20 + 1),
      isMaliciousMode: maliciousMode,
      trustScore: newScore
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
      const ATTACK_TYPES = [
        { type: 'DDoS Attack',         msg: 'High-volume packet flooding detected' },
        { type: 'Sybil Attack',        msg: 'Duplicate identity spoofing suspected' },
        { type: 'Data Manipulation',   msg: 'Packet payload integrity violation' },
        { type: 'Insider Threat',      msg: 'Anomalous internal access pattern' },
      ];
      const pick = attacking
        ? ATTACK_TYPES[0]  // always DDoS when malicious mode
        : ATTACK_TYPES[Math.floor(Math.random() * ATTACK_TYPES.length)];

      const severity = newScore < 30 ? 'critical' : newScore < 50 ? 'high' : 'medium';
      const nodeLabel = `Node ${node.address.slice(2, 6).toUpperCase()}`;

      const alert = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
        nodeId: node.address,
        nodeLabel,
        type: pick.type,
        message: `⚠️ ${pick.type} detected on ${nodeLabel}`,
        detail:  pick.msg,
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
  });
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

app.post('/api/simulator/toggle', (req, res) => {
  maliciousMode = !maliciousMode;
  console.log(`[Simulator] Malicious mode: ${maliciousMode}`);
  io.emit('simulator_mode', { maliciousMode });
  res.json({ maliciousMode });
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

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

function generateHash() {
  return '0x' + [...Array(40)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

function mineBlock(nodeAddr, score) {
  const prev = blockchainBlocks.length > 0 ? blockchainBlocks[blockchainBlocks.length - 1].hash : '0x0000...genesis';
  blockchainBlocks.push({
    index: blockIndex++,
    hash: generateHash(),
    previousHash: prev,
    transactions: [{ node: nodeAddr, trustScore: score, ts: Date.now() }]
  });
  if (blockchainBlocks.length > 10) blockchainBlocks.shift(); // keep rolling window
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

    // Mine a block every few ticks
    if (Math.random() < 0.3) mineBlock(node.address, newScore);

    // Generate attack alert if below threshold
    if (newScore < 60) {
      const alert = {
        nodeId: node.address,
        type: attacking ? 'DDoS' : 'Anomaly',
        severity: newScore < 40 ? 'high' : 'medium',
        timestamp: Date.now()
      };
      alerts.unshift(alert);
      if (alerts.length > 20) alerts.pop();
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
  res.json(alerts);
});

app.get('/api/blockchain', (req, res) => {
  res.json(blockchainBlocks);
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

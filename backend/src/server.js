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
const routingService = require('./services/routingService'); // Added
const localBlockchainService = require('./services/localBlockchainService'); // Added for local node chain

app.use('/api/admin/nodes', nodesRouter);
app.use('/api/admin/transfers', transfersRouter);

// ─── Mock 6G Node Registry ────────────────────────────────────────────────────
const MOCK_NODES = Array.from({ length: 20 }, (_, i) => {
  const hex = (i + 1).toString(16).padStart(40, '0');
  let role = 1; // Default IoT
  if (i >= 14 && i < 17) role = 2; // Base Station proxy
  else if (i >= 17 && i < 19) role = 3; // Relay proxy

  let profile = 'Normal';
  if (i < 2) profile = 'Malicious';       // First 2 nodes (10%)
  else if (i < 6) profile = 'Suspicious';  // Next 4 nodes (20%)

  return { address: `0x${hex}`, role, profile };
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
const activePackets = []; // Added
const nodeLedgers = {}; // Added for local logging
let packetSeq = 1; // Added
let simulationRunning = false;
let autoPacketTimeout = null;

function scheduleNextPacket() {
  // Random delay between 2000ms and 3000ms
  const delay = 2000 + Math.floor(Math.random() * 1001);
  autoPacketTimeout = setTimeout(() => {
    if (!simulationRunning) return;
    generateAutoPacket();
    scheduleNextPacket();  // schedule the next one after this finishes
  }, delay);
}

function generateAutoPacket() {
  // Pick distinct random src/dst
  const idx1 = Math.floor(Math.random() * MOCK_NODES.length);
  let idx2 = Math.floor(Math.random() * MOCK_NODES.length);
  while (idx2 === idx1) idx2 = Math.floor(Math.random() * MOCK_NODES.length);
  const src = MOCK_NODES[idx1].address;
  const dst = MOCK_NODES[idx2].address;

  // Calculate safest path based on current trust scores
  const path = routingService.calculateRoute(MOCK_NODES, trustScores, activeAttacks, src, dst);
  if (path.length < 2) {
    console.log(`[AutoGen] ⚠️  No safe path from ${src.slice(-4)} → ${dst.slice(-4)}, skipping.`);
    return;
  }

  const pathTrusts = path.map(addr => {
    const t = trustScores[addr] !== undefined ? trustScores[addr] : 80;
    return `${addr.slice(-4)}(${t})`;
  });

  const packet = {
    id: packetSeq++,
    src, dst,
    current_node: src,
    path_history: [src],
    data: `AutoPkt-${Date.now()}`,
    path,
    currentIdx: 0,
    timestamp: Date.now()
  };

  // Log at source ledger
  if (!nodeLedgers[src]) nodeLedgers[src] = [];
  nodeLedgers[src].push({
    packet_id: packet.id,
    source_node: src,
    destination_node: dst,
    current_node: src,
    path_history: [src],
    data: packet.data,
    timestamp: packet.timestamp
  });
  localBlockchainService.getNodeBlockchain(src).mineBlock(packet.id, 'packet_sent', src, dst);

  activePackets.push(packet);

  console.log(`[AutoGen] 📦 Packet #${packet.id} | ${src.slice(-4)} → ${dst.slice(-4)} | Path: ${pathTrusts.join(' → ')}`);

  io.emit('packet_sent', { packetId: packet.id, src, dst, path, data: packet.data });
  io.emit('simulation_stats', { activePackets: activePackets.length, totalGenerated: packet.id });
}

function startAutoPackets() {
  if (simulationRunning) return;
  simulationRunning = true;
  scheduleNextPacket();
}

function stopAutoPackets() {
  simulationRunning = false;
  if (autoPacketTimeout) {
    clearTimeout(autoPacketTimeout);
    autoPacketTimeout = null;
  }
}


// ─── Simulator ────────────────────────────────────────────────────────────────
async function runSimulatorTick() {
  for (const node of MOCK_NODES) {
    let activeAttack = activeAttacks[node.address] || 'Normal';
    
    // 🔮 Apply behavior profile activation chances
    if (node.profile === 'Suspicious' && Math.random() < 0.35) {
      activeAttack = 'Suspicious';
    } else if (node.profile === 'Malicious' && Math.random() < 0.25) {
      const heavy = ['DDoS', 'Sybil', 'DataManipulation', 'PacketFlooding'];
      activeAttack = heavy[Math.floor(Math.random() * heavy.length)];
    }

    const attacking = activeAttack !== 'Normal';

    // 📈 Base rates with stochastic noise
    let packetRate = 12 + Math.floor(Math.random() * 21) - 10;     // rand(-10, 10)
    let responseTimeMs = 50 + Math.floor(Math.random() * 11) - 5;  // rand(-5, 5)
    let packetSize = 300 + Math.floor(Math.random() * 17) - 8;     // rand(-8, 8)
    let authFailures = 0;
    let channelQuality = 0.95; // nominal

        // Apply attack profile modifiers
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

    const currentMetrics = {
      packet_rate: packetRate,
      latency: responseTimeMs,
      bandwidth_usage: packetSize * packetRate,
      failed_requests: attacking ? 12 : 1,
      connection_attempts: (activeAttack === 'Sybil') ? 22 : 4,
      authentication_attempts: (activeAttack === 'Sybil') ? 22 : 4,
      authentication_failures: authFailures,
      channel_quality: channelQuality,
      rfFingerprint: providedRf,
      csiBehavior: providedCsi,
      snr: providedSnr,
      gradient_magnitude,
      model_update_magnitude: gradient_magnitude,
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
        const evidence = 0; // Absolute fail
        finalScore = Math.round((0.8 * previousScore) + (0.2 * evidence));
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
            const evidence = aiData.final_trust_score; 
            finalScore = Math.round((0.8 * previousScore) + (0.2 * evidence));
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
          let evidence = (attacking ? 0 : 100);
          if (activeAttack === 'Suspicious') evidence = 50;
    // Apply attack profile modifiers
          finalScore = Math.round((0.8 * previousScore) + (0.2 * evidence));
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
      attackType: activeAttack,
      classification: classification,
      pipelineStages: pipelineStages,
      metrics: currentMetrics
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

  // 🛰️ Simulation Packet Forwarding (Multi-Hop)
  processPacketsSim();
}

function processPacketsSim() {
  for (let i = activePackets.length - 1; i >= 0; i--) {
    const pkt = activePackets[i];
    
    if (pkt.currentIdx >= pkt.path.length - 1) {
      console.log(`[Routing] Packet ${pkt.id} reached destination ${pkt.dst.slice(2, 6).toUpperCase()}`);
      io.emit('packet_delivered', { packetId: pkt.id, dst: pkt.dst, src: pkt.src });

      // ⛓️ Log Received on Destination Node local blockchain
      localBlockchainService.getNodeBlockchain(pkt.dst).mineBlock(pkt.id, 'packet_received', pkt.src, pkt.dst);

      activePackets.splice(i, 1);
      continue;
    }

    const current_node = pkt.path[pkt.currentIdx];
    const next_hop_node = pkt.path[pkt.currentIdx + 1];

    // Check if next hop is malicious OR below trust threshold
    const attack = activeAttacks[next_hop_node] || 'Normal';
    const trust = trustScores[next_hop_node] !== undefined ? trustScores[next_hop_node] : 80;

    if (attack !== 'Normal' || trust < 50) {
      console.log(`[Routing] 🚨 Next hop ${next_hop_node.slice(2, 6).toUpperCase()} triggers safety cutoff (Attack: ${attack}, Trust: ${trust}). Recomputing from ${current_node.slice(2, 6).toUpperCase()}...`);
      
      // ⛓️ Log Blocked on Current Node local blockchain
      localBlockchainService.getNodeBlockchain(current_node).mineBlock(pkt.id, 'packet_blocked', pkt.src, pkt.dst);

      const newPath = routingService.calculateRoute(MOCK_NODES, trustScores, activeAttacks, current_node, pkt.dst);
      if (newPath.length < 2) {
        console.log(`[Routing] ❌ Destination ${pkt.dst.slice(2, 6).toUpperCase()} UNREACHABLE from ${current_node.slice(2, 6).toUpperCase()}.`);
        io.emit('packet_dropped', { packetId: pkt.id, node: current_node, reason: 'unreachable_or_low_trust' });
        
        // ⛓️ Log Dropped on Current Node local blockchain
        localBlockchainService.getNodeBlockchain(current_node).mineBlock(pkt.id, 'packet_dropped', pkt.src, pkt.dst);

        activePackets.splice(i, 1);
        continue;
      }

      pkt.path = newPath;
      pkt.currentIdx = 0; // Reset index to accommodate start over from current node inside new node set
      console.log(`[Routing] Re-Routed successfully: ${pkt.path.map(n => n.slice(2, 6).toUpperCase()).join(' -> ')}`);
      io.emit('packet_rerouted', { packetId: pkt.id, path: pkt.path });
    }

    // ⛓️ Log Forwarded on Current Node local blockchain before incrementing index
    localBlockchainService.getNodeBlockchain(current_node).mineBlock(pkt.id, 'packet_forwarded', pkt.src, pkt.dst);
    
    io.emit('packet_forwarded', { packetId: pkt.id, node: current_node, nextNode: next_hop_node, src: pkt.src, dst: pkt.dst });

    pkt.currentIdx++;
    const node_now = pkt.path[pkt.currentIdx];

    // 📝 Local Ledger Logging & Track History
    pkt.current_node = node_now;
    if (!pkt.path_history) pkt.path_history = [];
    pkt.path_history.push(node_now);
    pkt.timestamp = Date.now();

    if (!nodeLedgers[node_now]) nodeLedgers[node_now] = [];
    nodeLedgers[node_now].push({
      packet_id: pkt.id,
      source_node: pkt.src,
      destination_node: pkt.dst,
      current_node: node_now,
      path_history: [...pkt.path_history],
      data: pkt.data,
      timestamp: pkt.timestamp
    });

    console.log(`[Routing] Packet ${pkt.id} hopped to ${node_now.slice(2, 6).toUpperCase()} (Logged in Ledger)`);
    io.emit('packet_hop', {
      packetId: pkt.id,
      current: node_now,
      path: pkt.path,
      path_history: pkt.path_history,
      index: pkt.currentIdx,
      data: pkt.data
    });
  }
}

// ─── REST API ─────────────────────────────────────────────────────────────────
// ─── Multi-Hop Routing APIs ──────────────────────────────────────────────────
app.get('/api/calculate-route', (req, res) => {
  const { src, dst } = req.query;
  if (!src || !dst) return res.status(400).json({ error: 'src and dst addresses required' });

  const path = routingService.calculateRoute(MOCK_NODES, trustScores, activeAttacks, src, dst);
  const cost = path.reduce((sum, node, i) => {
    if (i === 0) return 0;
    return sum + routingService.getEdgeWeight(node, trustScores, activeAttacks);
  }, 0);

  res.json({ path, cost });
});

app.post('/api/send-data', (req, res) => {
  const { src, dst, data } = req.body;
  if (!src || !dst) return res.status(400).json({ error: 'src and dst required' });

  const path = routingService.calculateRoute(MOCK_NODES, trustScores, activeAttacks, src, dst);
  
  if (path.length < 2) {
    return res.status(400).json({ error: 'Destination unreachable or path finding failed' });
  }

  const packet = {
    id: packetSeq++,
    src,
    dst,
    current_node: src,
    path_history: [src],
    data: data || 'Generic Data Stream',
    path,
    currentIdx: 0,
    timestamp: Date.now()
  };

  // Log at source ledger as well
  if (!nodeLedgers[src]) nodeLedgers[src] = [];
  nodeLedgers[src].push({
    packet_id: packet.id,
    source_node: src,
    destination_node: dst,
    current_node: src,
    path_history: [src],
    data: packet.data,
    timestamp: packet.timestamp
  });

  // ⛓️ Log Sent on Source Node local blockchain
  localBlockchainService.getNodeBlockchain(src).mineBlock(packet.id, 'packet_sent', src, dst);

  activePackets.push(packet);
  
  io.emit('packet_sent', {
    packetId: packet.id,
    src,
    dst,
    path,
    data: packet.data
  });

  res.json({ success: true, packetId: packet.id, path });
});

app.get('/api/nodes/:addr/ledger', (req, res) => {
  const { addr } = req.params;
  const ledger = nodeLedgers[addr] || [];
  res.json(ledger);
});

app.get('/api/nodes/:addr/local-blockchain', (req, res) => {
  const { addr } = req.params;
  const chain = localBlockchainService.getNodeBlockchain(addr).getChain();
  res.json(chain);
});

app.post('/api/test/set-trust', (req, res) => {
  const { node, score } = req.body;
  if (!node || score === undefined) return res.status(400).json({ error: 'node and score required' });
  trustScores[node] = score;
  res.json({ success: true, node, score });
});

// ─── Simulation Control ───────────────────────────────────────────────────────
app.post('/api/simulator/start', (req, res) => {
  if (simulationRunning) return res.json({ success: true, running: true, note: 'already running' });
  startAutoPackets();
  io.emit('simulation_status', { running: true });
  console.log('[Simulator] ▶️  Simulation STARTED — random packets every 3–5s');
  res.json({ success: true, running: true });
});

app.post('/api/simulator/stop', (req, res) => {
  stopAutoPackets();
  io.emit('simulation_status', { running: false });
  console.log('[Simulator] ⏹️  Simulation STOPPED');
  res.json({ success: true, running: false });
});

app.get('/api/simulator/status', (req, res) => {
  res.json({ running: simulationRunning, activePackets: activePackets.length, totalGenerated: packetSeq - 1 });
});

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

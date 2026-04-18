require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const Node = require('./models/Node');
const nodeService = require('./services/nodeService');
const ledgerService = require('./services/ledgerService');

// ─── App & Server ──────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});
ledgerService.setIo(io);

app.use(cors());
app.use(express.json());

// ─── Advanced 5G Node Management & Transfer Routes ───────────────────────────────────
const nodesRouter = require('./routes/nodes');
const transfersRouter = require('./routes/transfers');
const physicalAuth = require('./services/physicalAuthService');
const federatedAggregation = require('./services/federatedAggregationService');
const routingService = require('./services/routingService'); // Added
const localBlockchainService = require('./services/localBlockchainService'); // Added for local node chain

app.use('/api/admin/nodes', nodesRouter);
app.use('/api/admin/transfers', transfersRouter);
const simulationState = require('./services/simulationState');
const datasetLoader = require('./services/simulation/datasetLoader');
const nodeManager = require('./services/simulation/nodeManager');
const simulator = require('./services/simulation/simulator');

// ─── Simulation State ────────────────────────────────────────────────────────
const MOCK_NODES = simulationState.getNodes();
const trustScores = simulationState.getTrustScores();
const activeAttacks = simulationState.getActiveAttacks();

// Sync initial trust scores
MOCK_NODES.forEach(n => {
  trustScores[n.address] = 100;
  activeAttacks[n.address] = 'Normal';
});

// Initial trust scores populated by simulationState.syncNodesFromDB()
const alerts = [];           // attack alerts list
let maliciousMode = false;

// ─── Dynamic Node Management ────────────────────────────────────────────────
app.post('/api/nodes', async (req, res) => {
  try {
    const { 
      nodeId, type, senderAddress, receiverAddress, trustScore,
      rfFingerprint, csiBehavior, snr
    } = req.body;
    
    // 1. Initialize Physical Layer Profile (Correcting sequence: Initialize -> Complete -> Create)
    physicalAuth.initializeNodeProfile(nodeId, { rfFingerprint, csiBehavior, snr });

    // 2. Create in NodeService (DB/Memory + Blockchain registration)
    const node = await require('./services/nodeService').createNode({
      nodeId, type, senderAddress, receiverAddress, 
      trustScore: trustScore / 100,
      rfFingerprint, csiBehavior, snr,
      status: 'Healthy'
    });

    // 2. Refresh local state
    await simulationState.syncNodesFromDB();

    // 3. Record on Chain
    ledgerService.recordEvent(nodeId, trustScore, 'Node Initialized');

    res.status(201).json({ success: true, node });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/nodes/:addr', async (req, res) => {
  try {
    const { addr } = req.params;
    
    // 1. Update in NodeService
    await require('./services/nodeService').removeNode(addr);

    // 2. Update Simulator Local State
    activeAttacks[addr] = 'Removed';
    trustScores[addr] = 0;

    // 3. Record on Chain
    ledgerService.recordEvent(addr, 0, 'Node Removed from Network');

    res.json({ success: true, message: `Node ${addr} removed.` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

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
  let idx1 = Math.floor(Math.random() * MOCK_NODES.length);
  while (activeAttacks[MOCK_NODES[idx1].address] === 'Removed' || (trustScores[MOCK_NODES[idx1].address] || 0) < 60) {
    idx1 = Math.floor(Math.random() * MOCK_NODES.length);
  }
  
  let idx2 = Math.floor(Math.random() * MOCK_NODES.length);
  while (idx2 === idx1 || activeAttacks[MOCK_NODES[idx2].address] === 'Removed' || (trustScores[MOCK_NODES[idx2].address] || 0) < 60) {
    idx2 = Math.floor(Math.random() * MOCK_NODES.length);
  }
  
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
    if (activeAttacks[node.address] === 'Removed') continue; // Skip removed nodes
    
    let activeAttack = activeAttacks[node.address] || 'Healthy';
    
    // 🔮 Apply behavior profile activation chances
    if (node.profile === 'Suspicious' && Math.random() < 0.35) {
      activeAttack = 'Suspicious';
    } else if (node.profile === 'Malicious' && Math.random() < 0.25) {
      const heavy = ['DDoS attack', 'sybil attack', 'poison attack', 'data manipulation'];
      activeAttack = heavy[Math.floor(Math.random() * heavy.length)];
    }

    const attacking = activeAttack !== 'Healthy';

    // 📈 Base rates with stochastic noise
    let packetRate = 12 + Math.floor(Math.random() * 21) - 10;     // rand(-10, 10)
    let responseTimeMs = 50 + Math.floor(Math.random() * 11) - 5;  // rand(-5, 5)
    let packetSize = 300 + Math.floor(Math.random() * 17) - 8;     // rand(-8, 8)
    let authFailures = 0;
    let channelQuality = 0.95; // nominal

        // Apply attack profile modifiers
        if (activeAttack === 'DDoS attack') {
          packetRate = 500 + Math.floor(Math.random() * 50);
          responseTimeMs = 1500 + Math.floor(Math.random() * 100);
          packetSize = 5000;
        } else if (activeAttack === 'sybil attack') {
          packetRate = 80 + Math.floor(Math.random() * 10);
          authFailures = 5;
        } else if (activeAttack === 'Suspicious') {
          packetRate = 45 + Math.floor(Math.random() * 15);
          channelQuality = 0.75; 
        } else if (activeAttack === 'data manipulation') {
          packetRate = 4 + Math.floor(Math.random() * 3);
        } else if (activeAttack === 'Packet Flooding' || activeAttack === 'DDoS attack') {
          packetRate = 800 + Math.floor(Math.random() * 100);
        } else if (activeAttack === 'poison attack') {
          packetRate = 150 + Math.floor(Math.random() * 50); // Falsified high rate
          responseTimeMs = 300 + Math.floor(Math.random() * 200); // Falsified latency
          channelQuality = 0.45; // Degraded quality
        }

        // 🛡️ Added: Signal metrics for physical layer auth
        const correctProfile = physicalAuth.getCorrectProfile(node.address);
        let providedRf = correctProfile ? correctProfile.rfFingerprint : 'RF_UNKNOWN';
        let providedCsi = 0.85;
        let providedSnr = 25.0;

        if (activeAttack === 'sybil attack') {
          providedRf = `RF_SPOOF_${Math.floor(Math.random() * 1000)}`;
        } else if (activeAttack === 'Suspicious') {
          providedCsi = 0.60;
        }

        // 🧠 Added: Model Update Gradient Metrics
        let gradient_magnitude = Number((Math.random() * 0.25 + 0.1).toFixed(3));
        let loss_change = Number((Math.random() * 0.1 - 0.05).toFixed(3));
        let update_variance = Number((Math.random() * 0.04).toFixed(3));
        let parameter_drift = Number((Math.random() * 0.02).toFixed(3));

        if (activeAttack === 'PoisonedGradients' || activeAttack === 'poison attack') {
          gradient_magnitude = 0.85 + Math.random() * 0.1;
          update_variance = 0.5 + Math.random() * 0.5; // High variance
          parameter_drift = 0.4 + Math.random() * 0.6; // High drift
        } else if (activeAttack === 'CoordinatedAttack') {
          gradient_magnitude = 0.90 + Math.random() * 0.08;
        }

    const currentMetrics = {
      packet_rate: packetRate,
      latency: responseTimeMs,
      bandwidth_usage: packetSize * packetRate,
      failed_requests: attacking ? 12 : 1,
      connection_attempts: (activeAttack === 'sybil attack') ? 22 : 4,
      authentication_attempts: (activeAttack === 'sybil attack') ? 22 : 4,
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

    if (activeAttack === 'poison attack' && Math.random() < 0.4) {
      // Misleading reputation: Bad-mouth a random legitimate node
      const victim = MOCK_NODES[Math.floor(Math.random() * MOCK_NODES.length)].address;
      if (victim !== node.address && trustScores[victim] > 40) {
        trustScores[victim] -= 5;
        console.log(`[Poisoning] Node ${node.address.slice(0,6)} is bad-mouthing ${victim.slice(0,6)}. New victim trust: ${trustScores[victim]}`);
        io.emit('trust_update', { node: victim, trustScore: trustScores[victim], classification: 'Targeted by Poisoning' });
      }
    }

    // Maintain history for LSTM sequential tests
    if (!nodeMetricsHistory[node.address]) nodeMetricsHistory[node.address] = [];
    const history = [...nodeMetricsHistory[node.address]];
    nodeMetricsHistory[node.address].push(currentMetrics);
    if (nodeMetricsHistory[node.address].length > 4) nodeMetricsHistory[node.address].shift();

    const previousScore = trustScores[node.address] ?? 85;
    let finalScore = previousScore;
    let pipelineStages = [];
    let isAnomalous = false;
    let classification = 'Healthy Traffic';

    // 🔬 Step 1: Pre-Filter Physical Layer Authentication in Backend
    const authStatus = physicalAuth.verifyIdentity(node.address, currentMetrics);

    if (!authStatus.authenticated) {
        // Reject and Isolate Immediately
        isAnomalous = true;
        classification = 'sybil attack';
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
          // If attacking is true but activeAttack is undefined/Normal, default to 'data manipulation'
          classification = attacking ? ((activeAttack === 'Healthy') ? 'data manipulation' : activeAttack) : 'Healthy Traffic';
          pipelineStages = [
             { stage: "Physical Auth Pre-Filter (Backend)", success: true, details: "Passed credentials match" },
             { stage: "Fallback Aggregator", score: finalScore, details: "AI Online verification skipping..." }
          ];
        }
    }

    // 🔬 Step 2: Poisoning Detection (Statistical Outlier / Gradient Analysis)
    const poisonedUpdate = federatedAggregation.isPoisonedUpdate([currentMetrics.model_update_magnitude], [0.15]); // Simplified check
    // Actually, more comprehensive check:
    const isGradientsExtreme = currentMetrics.gradient_magnitude > 0.8 || currentMetrics.update_variance > 0.4;
    
    if (isGradientsExtreme && activeAttack === 'poison attack') {
        isAnomalous = true;
        classification = 'poison attack';
        finalScore = Math.max(0, finalScore - 50); // Severe penalty
        console.log(`[Detector] 🚨 Poisoning detected for ${node.address.slice(0,6)} (Gradient magnitude outlier)`);
        
        pipelineStages.push({
           stage: "Model Poisoning Detection",
           success: false,
           details: `Anomalous gradients detected: ${currentMetrics.gradient_magnitude}`
        });
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
      await ledgerService.recordEvent(node.address, finalScore, action, activeAttack);
    }

    // 🤝 Submit for Federated Aggregation if trust >= threshold
    if (finalScore >= 60) {
      let gradients = [
        Number((Math.random() * 0.4 + 0.1).toFixed(3)),
        Number((Math.random() * 0.3 + 0.1).toFixed(3)),
        Number((Math.random() * 0.2).toFixed(3)),
        Number((Math.random() * 0.5 + 0.5).toFixed(3)),
        Number((Math.random() * 0.1).toFixed(3))
      ];

      if (activeAttack === 'poison attack') {
        // Inject extreme poisoned gradients to skew the global model
        gradients = [10.0, -10.0, 5.0, 8.0, -5.0];
        console.log(`[Poisoning] Malicious node ${node.address.slice(0,6)} injected poisoned gradients.`);
      }

      federatedAggregation.submitUpdate(node.address, gradients, finalScore);
    }

    // Generate attack alert structure for monitoring page buffer feed
    if (isAnomalous || finalScore < 60) {
      const severity = finalScore < 30 ? 'critical' : finalScore < 50 ? 'high' : 'medium';
      
      // Ensure the alert type is one of the 4 requested (if not already set to one by AI or fallback)
      let alertType = classification;
      const validTypes = ['ddos attack', 'sybil attack', 'poison attack', 'data manipulation'];
      if (!validTypes.includes(alertType)) {
        // Map common synonyms or defaults
        if (alertType.toLowerCase().includes('ddos')) alertType = 'ddos attack';
        else if (alertType.toLowerCase().includes('sybil')) alertType = 'sybil attack';
        else if (alertType.toLowerCase().includes('poison')) alertType = 'poison attack';
        else if (alertType.toLowerCase().includes('manipulation') || alertType.toLowerCase().includes('traffic')) alertType = 'data manipulation';
        else alertType = 'data manipulation'; // Ultimate fallback
      }

      const alert = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
        nodeId: node.address,
        nodeLabel: `Node ${node.address.slice(2, 6).toUpperCase()}`,
        type: alertType,
        message: `⚠️ ${alertType} detected`,
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
    const attack = activeAttacks[next_hop_node] || 'Healthy';
    const trust = trustScores[next_hop_node] !== undefined ? trustScores[next_hop_node] : 80;

    if (attack !== 'Healthy' || trust < 50) {
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
  console.log('[Simulator] 🟢 Advanced 5G Traffic Simulation Started');
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
  const nodesWithScores = MOCK_NODES.map(node => {
     const score = trustScores[node.address] ?? 85;
     return {
       ...node,
       trustScore: score,
       status: score >= 70 ? 'healthy' : score >= 40 ? 'suspicious' : 'malicious'
     };
  });
  res.json({ nodes: nodesWithScores });
});

app.get('/api/trust-scores/history', (req, res) => {
  res.json(simulationState.getTrustHistory());
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
  res.json(ledgerService.getBlockchain());
});

app.get('/api/transactions', (req, res) => {
  const { action, nodeId, limit = 100 } = req.query;
  let result = ledgerService.getTxLog();
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
  ledgerService.recordEvent(addr, 0, 'Node Isolated');
  io.emit('trust_update', { node: addr, trustScore: 0, isMaliciousMode: maliciousMode });
  io.emit('node_action', { addr, action: 'isolated', trustScore: 0, timestamp: Date.now() });
  res.json({ success: true, addr, action: 'isolated', trustScore: 0 });
});

// POST: Restore a node (reset trust to 80, mine block)
app.post('/api/nodes/:addr/restore', (req, res) => {
  const { addr } = req.params;
  if (!MOCK_NODES.find(n => n.address === addr)) return res.status(404).json({ error: 'Node not found' });
  trustScores[addr] = 80;
  ledgerService.recordEvent(addr, 80, 'Node Recovered', 'Healthy');
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
  ledgerService.recordEvent(addr, clamped, 'Trust Score Updated');
  io.emit('trust_update', { node: addr, trustScore: clamped, isMaliciousMode: maliciousMode });
  io.emit('node_action', { addr, action: 'trust_updated', trustScore: clamped, timestamp: Date.now() });
  res.json({ success: true, addr, action: 'trust_updated', trustScore: clamped });
});

app.post('/api/simulator/attack', (req, res) => {
  const { node, attackType } = req.body;
  if (node) {
    const sharedAttacks = simulationState.getActiveAttacks();
    const nodes = simulationState.getNodes();
    
    // 🔬 Containment Rule 6: Max 15% Malicious Simulator Limit
    const maliciousCount = Object.values(sharedAttacks).filter(a => a !== 'Healthy' && a !== 'Normal' && a !== 'Healthy Traffic' && a !== 'Normal Traffic').length;
    const maxAllowed = Math.ceil(nodes.length * 0.15);

    if (attackType !== 'Normal' && maliciousCount >= maxAllowed && !sharedAttacks[node]) {
       console.log(`[Simulator] 🛡️ Manual Attack Blocked for ${node.slice(0,6)} (Limit of ${maxAllowed} reached)`);
       return res.status(400).json({ error: `Attack limit reached (${maxAllowed}). Stop previous attacks first.` });
    }

    sharedAttacks[node] = attackType;
    console.log(`[Simulator] ⚔️ Attack [${attackType}] triggered on ${node}`);
    io.emit('simulator_mode', { node, attackType, isMaliciousMode: true });
    return res.json({ success: true, message: `Started ${attackType} on ${node}` });
  }
  res.status(400).json({ error: 'Node address required' });
});

app.post('/api/simulator/stop-attack', (req, res) => {
  const { node } = req.body;
  if (node) {
    const sharedAttacks = simulationState.getActiveAttacks();
    delete sharedAttacks[node];
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
  console.log('✅ Advanced 5G Simulator starting...\n');
  
  // Start the new scalable dataset-driven simulator
  (async () => {
    try {
      await simulationState.syncNodesFromDB();
      await datasetLoader.load();
      await simulator.start(io); // Passing io instance
    } catch (err) {
      console.error('[Main] Failed to start simulation:', err.message);
    }
  })();

  // Legacy stochastic attack generator removed.
  // The new simulator.js handles behavior profiles and autonomous malicious spikes.
});

// ─── Optional: Try MongoDB (non-blocking) ─────────────────────────────────────
try {
  const mongoose = require('mongoose');
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/advanced_5g_trustguard';
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('[MongoDB] Connected'))
    .catch(err => console.warn('[MongoDB] Not available, running in mock mode:', err.message));
} catch (e) {
  console.warn('[MongoDB] Module not available, running without DB.');
}

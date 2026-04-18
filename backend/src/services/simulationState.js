const fs = require('fs');
const path = require('path');

const MOCK_NODES = [];
const trustScores = {};
const activeAttacks = {};
const STATE_FILE = path.join(__dirname, '../../simulation_state.json');

function saveState() {
  try {
    const data = JSON.stringify({ trustScores, activeAttacks }, null, 2);
    fs.writeFileSync(STATE_FILE, data);
  } catch (err) {
    console.warn('[SimulationState] Could not save state:', err.message);
  }
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      Object.assign(trustScores, data.trustScores || {});
      Object.assign(activeAttacks, data.activeAttacks || {});
      console.log(`[SimulationState] 💾 Loaded persisted state from ${STATE_FILE}`);
    }
  } catch (err) {
    console.warn('[SimulationState] Could not load state:', err.message);
  }
}

async function syncNodesFromDB() {
  loadState();
  try {
    const nodeService = require('./nodeService');
    const dbNodes = await nodeService.getNodes();
    
    let nodesFetched = [];
    if (dbNodes.length === 0) {
      console.log('[SimulationState] No database nodes found, importing from scalable NodeManager...');
      const nodeManager = require('./simulation/nodeManager');
      const simNodes = nodeManager.getAllNodes();
      nodesFetched = simNodes.map(n => ({
          address: n.nodeId,
          type: n.type,
          role: n.type === 'iot' ? 1 : (n.type === 'base_station' ? 2 : 3),
          profile: 'Healthy'
      }));
    } else {
      nodesFetched = dbNodes.map(dn => ({
        address: dn.nodeId || dn.address,
        type: dn.type,
        role: dn.role || (dn.type === 'Base Station' ? 2 : (dn.type === 'Edge Node' ? 3 : 1)),
        profile: dn.status === 'Malicious' ? 'Malicious' : (dn.status === 'Suspicious' ? 'Suspicious' : 'Healthy')
      }));
    }

    MOCK_NODES.splice(0, MOCK_NODES.length, ...nodesFetched);

    MOCK_NODES.forEach(n => {
      if (trustScores[n.address] === undefined) trustScores[n.address] = 85;
      if (activeAttacks[n.address] === undefined) activeAttacks[n.address] = 'Healthy';
    });

    return MOCK_NODES;
  } catch (err) {
    console.error('[SimulationState] ❌ Error syncing nodes:', err.message);
    return MOCK_NODES;
  }
}

module.exports = {
  getNodes: () => MOCK_NODES,
  getTrustScores: () => trustScores,
  getActiveAttacks: () => activeAttacks,
  syncNodesFromDB,
  saveState,
  loadState
};

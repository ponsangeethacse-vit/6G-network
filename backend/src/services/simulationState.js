const Node = require('../models/Node');

const MOCK_NODES = [];
const trustScores = {};
const activeAttacks = {};

function generateDefaultNodes() {
  return Array.from({ length: 20 }, (_, i) => {
    const hex = (i + 1).toString(16).padStart(40, '0');
    let role = 1; 
    if (i >= 14 && i < 17) role = 2;
    else if (i >= 17 && i < 19) role = 3;

    let type = 'IoT Device';
    if (role === 2) type = 'Base Station';
    else if (role === 3) type = 'Edge Node';

    let profile = 'Healthy';
    if (i < 2) profile = 'Malicious';
    else if (i < 6) profile = 'Suspicious';

    return { address: `0x${hex}`, type, role, profile };
  });
}

async function syncNodesFromDB() {
  try {
    const nodeService = require('./nodeService');
    const dbNodes = await nodeService.getNodes();
    
    let nodesFetched = [];
    if (dbNodes.length === 0) {
      console.log('[SimulationState] No nodes found, generating defaults...');
      nodesFetched = generateDefaultNodes();
      // Optional: Seed the defaults back into nodeService so they persist in memory/DB
      for (const n of nodesFetched) {
        // We don't await here to avoid potential recursion or slow start
        nodeService.createNode({
          nodeId: n.address,
          type: n.type,
          status: n.profile === 'Malicious' ? 'Malicious' : (n.profile === 'Suspicious' ? 'Suspicious' : 'Active'),
          trustScore: 0.85
        }).catch(() => {});
      }
    } else {
      nodesFetched = dbNodes.map(dn => ({
        address: dn.nodeId || dn.address,
        type: dn.type,
        role: dn.role || (dn.type === 'Base Station' ? 2 : (dn.type === 'Edge Node' ? 3 : 1)),
        profile: dn.status === 'Malicious' ? 'Malicious' : (dn.status === 'Suspicious' ? 'Suspicious' : 'Healthy')
      }));
      console.log(`[SimulationState] 🔄 Loaded ${nodesFetched.length} nodes for simulation.`);
    }

    // Update state in place
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
  generateDefaultNodes
};

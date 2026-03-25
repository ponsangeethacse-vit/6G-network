const express = require('express');
const router = express.Router();
const Node = require('../models/Node');
const nodeService = require('../services/nodeService');
const simulationState = require('../services/simulationState');

// Get all nodes from DB
router.get('/', async (req, res) => {
  try {
    const nodes = await nodeService.getNodes();
    res.json(nodes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create a new node
router.post('/', async (req, res) => {
  try {
    const node = await nodeService.createNode(req.body);
    await simulationState.syncNodesFromDB();
    res.status(201).json(node);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update node info (trust score, status)
router.put('/:nodeId', async (req, res) => {
  try {
     const node = await nodeService.updateNode(req.params.nodeId, req.body);
     res.json(node);
  } catch (err) {
     res.status(400).json({ message: err.message });
  }
});

// Remove node from network
router.delete('/:nodeId', async (req, res) => {
  try {
    const node = await nodeService.removeNode(req.params.nodeId);
    await simulationState.syncNodesFromDB();
    res.json({ message: "Node removed successfully", node });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// View node activity / history
router.get('/:nodeId/activity', async (req, res) => {
  try {
     const activity = await nodeService.getNodeActivity(req.params.nodeId);
     res.json(activity);
  } catch (err) {
     res.status(404).json({ message: err.message });
  }
});

router.post('/simulate', async (req, res) => {
  try {
    const nodeCount = await Node.countDocuments();
    if (nodeCount > 0) return res.json({ message: "Nodes already exist" });

    const nodes = [];
    for (let i = 0; i < 100; i++) {
        const type = i < 10 ? 'Core' : (i < 30 ? 'Edge' : 'IoT');
        nodes.push({
            nodeId: `NODE_${i}`,
            type,
            trustScore: 0.7 + Math.random() * 0.3,
            status: 'Normal',
            metrics: {
                latency: Math.random() * 2,
                throughput: 50 + Math.random() * 40,
                packetLoss: Math.random() * 0.5,
                commTrust: 0.8 + Math.random() * 0.2,
                transTrust: 0.8 + Math.random() * 0.2,
                behaviorTrust: 0.8 + Math.random() * 0.2
            }
        });
    }
    await Node.insertMany(nodes);
    await simulationState.syncNodesFromDB();
    res.status(201).json({ message: "100 nodes simulated" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

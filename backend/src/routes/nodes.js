const express = require('express');
const router = express.Router();
const Node = require('../models/Node');

router.get('/', async (req, res) => {
  try {
    const nodes = await Node.find({});
    res.json(nodes);
  } catch (err) {
    res.status(500).json({ message: err.message });
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
    res.status(201).json({ message: "100 nodes simulated" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

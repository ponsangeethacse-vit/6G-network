const express = require('express');
const router = express.Router();
const Node = require('../models/Node');
const trustEngine = require('../services/trustEngine');

router.get('/:nodeId', async (req, res) => {
  try {
    const node = await Node.findOne({ nodeId: req.params.nodeId });
    if (!node) return res.status(404).json({ message: "Node not found" });
    res.json(node);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/recalculate', async (req, res) => {
    try {
        await trustEngine.updateAllNodes();
        res.json({ message: "Trust scores recalculated" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;

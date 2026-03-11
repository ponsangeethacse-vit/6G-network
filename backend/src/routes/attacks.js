const express = require('express');
const router = express.Router();
const attackDetector = require('../services/attackDetector');

router.post('/simulate', async (req, res) => {
  try {
    const { type } = req.body;
    const result = await attackDetector.simulateAttack(type || 'DDoS');
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const transferService = require('../services/transferService');

// Create a new transfer / execute transfer
router.post('/', async (req, res) => {
    const { senderNodeId, receiverNodeId, data, behavior } = req.body;
    
    if (!senderNodeId || !receiverNodeId || !data) {
         return res.status(400).json({ message: 'Missing required fields: senderNodeId, receiverNodeId, data' });
    }

    try {
         const transfer = await transferService.executeTransfer(senderNodeId, receiverNodeId, data, behavior || 'Normal');
         res.status(201).json(transfer);
    } catch (err) {
         res.status(400).json({ message: err.message });
    }
});

// Get all transfers
router.get('/', async (req, res) => {
    try {
         const transfers = await transferService.getTransfers();
         res.json(transfers);
    } catch (err) {
         res.status(500).json({ message: err.message });
    }
});

module.exports = router;

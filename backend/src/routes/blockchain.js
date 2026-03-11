const express = require('express');
const router = express.Router();
const Block = require('../models/Block');

router.get('/', async (req, res) => {
  try {
    const blocks = await Block.find().sort({ index: -1 });
    res.json(blocks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

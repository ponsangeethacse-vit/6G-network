const mongoose = require('mongoose');
const path = require('path');
const Node = require('../src/models/Node');

async function checkDB() {
  try {
    const MONGODB_URI = 'mongodb://localhost:27017/advanced_5g_trustguard';
    await mongoose.connect(MONGODB_URI);
    const count = await Node.countDocuments();
    console.log(`Node Count: ${count}`);
    const nodes = await Node.find().limit(5);
    console.log('Sample Nodes:', JSON.stringify(nodes, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkDB();

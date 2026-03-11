const mongoose = require('mongoose');

const nodeSchema = new mongoose.Schema({
  nodeId: { type: String, required: true, unique: true },
  type: { type: String, enum: ['IoT', 'Edge', 'Core'], default: 'IoT' },
  trustScore: { type: Number, default: 0.5 },
  metrics: {
    latency: { type: Number, default: 0 },
    throughput: { type: Number, default: 0 },
    packetLoss: { type: Number, default: 0 },
    commTrust: { type: Number, default: 0.5 },
    transTrust: { type: Number, default: 0.5 },
    behaviorTrust: { type: Number, default: 0.5 }
  },
  status: { type: String, enum: ['active', 'isolated', 'malicious'], default: 'active' },
  lastSeen: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Node', nodeSchema);

const mongoose = require('mongoose');

const nodeSchema = new mongoose.Schema({
  nodeId: { type: String, required: true, unique: true },
  type: { type: String, enum: ['IoT Device', 'User Device', 'Edge Node', 'Base Station'], default: 'IoT Device' },
  senderAddress: { type: String, default: "" },
  receiverAddress: { type: String, default: "" },
  trustScore: { type: Number, default: 0.5 },
  metrics: {
    latency: { type: Number, default: 0 },
    throughput: { type: Number, default: 0 },
    packetLoss: { type: Number, default: 0 },
    commTrust: { type: Number, default: 0.5 },
    transTrust: { type: Number, default: 0.5 },
    behaviorTrust: { type: Number, default: 0.5 }
  },
  status: { type: String, enum: ['Normal', 'Suspicious', 'Malicious', 'Active', 'Removed'], default: 'Normal' },
  transactionHistory: [{
    txHash: String,
    action: String,
    timestamp: { type: Date, default: Date.now }
  }],
  lastSeen: { type: Date, expires: '1h', default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Node', nodeSchema);

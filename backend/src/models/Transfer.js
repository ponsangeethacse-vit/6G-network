const mongoose = require('mongoose');

const transferSchema = new mongoose.Schema({
  senderNodeId: { type: String, required: true },
  receiverNodeId: { type: String, required: true },
  data: { type: String, required: true }, // Transfer data or transaction ID
  status: { type: String, enum: ['Success', 'Failed', 'Pending'], default: 'Pending' },
  updatedTrustScore: { type: Number },
}, { timestamps: true });

module.exports = mongoose.model('Transfer', transferSchema);

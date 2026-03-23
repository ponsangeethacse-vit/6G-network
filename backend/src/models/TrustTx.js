const mongoose = require('mongoose');

const trustTxSchema = new mongoose.Schema({
  from: { type: String, required: true },
  to: { type: String, required: true },
  trustValue: { type: Number, required: true },
  factor: { type: String, required: true },
  timestamp: { type: Date, expires: '1h', default: Date.now }
});

module.exports = mongoose.model('TrustTx', trustTxSchema);

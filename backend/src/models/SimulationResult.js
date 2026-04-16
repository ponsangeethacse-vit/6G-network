const mongoose = require('mongoose');

const simulationResultSchema = new mongoose.Schema({
    nodeId: { type: String, required: true },
    metrics: {
        packet_rate: Number,
        latency: Number,
        bandwidth: Number,
        failed_requests: Number
    },
    trustScore: { type: Number, required: true },
    attackType: { type: String, default: 'Normal' },
    autoencoder_score: Number,
    lstm_probability: Number,
    timestamp: { type: Date, default: Date.now, index: { expires: '1h' } }
}, { timestamps: true });

// Index for efficient querying of recent results per node
simulationResultSchema.index({ nodeId: 1, timestamp: -1 });

module.exports = mongoose.model('SimulationResult', simulationResultSchema);

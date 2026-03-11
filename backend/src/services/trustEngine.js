const Node = require('../models/Node');
const blockchain = require('./blockchain');

class TrustEngine {
  async calculateTrust(node) {
    const { metrics } = node;
    
    // trustScore = 0.4*commTrust + 0.3*transTrust + 0.3*behaviorTrust
    const newTrustScore = (
      0.4 * metrics.commTrust + 
      0.3 * metrics.transTrust + 
      0.3 * metrics.behaviorTrust
    );

    node.trustScore = Math.max(0, Math.min(1, newTrustScore));
    
    if (node.trustScore < 0.3) {
      node.status = 'isolated';
    } else if (node.status === 'isolated' && node.trustScore > 0.5) {
      node.status = 'active';
    }

    await node.save();

    // Record trust update on blockchain
    await blockchain.addTransaction({
      nodeId: node.nodeId,
      trustScore: node.trustScore,
      timestamp: Date.now()
    });

    return node.trustScore;
  }

  async updateAllNodes() {
    const nodes = await Node.find({});
    for (const node of nodes) {
      // Simulate slight variations in metrics
      node.metrics.commTrust += (Math.random() - 0.5) * 0.05;
      node.metrics.transTrust += (Math.random() - 0.5) * 0.05;
      node.metrics.behaviorTrust += (Math.random() - 0.5) * 0.05;
      
      // Ensure metrics stay within [0, 1]
      node.metrics.commTrust = Math.max(0, Math.min(1, node.metrics.commTrust));
      node.metrics.transTrust = Math.max(0, Math.min(1, node.metrics.transTrust));
      node.metrics.behaviorTrust = Math.max(0, Math.min(1, node.metrics.behaviorTrust));

      await this.calculateTrust(node);
    }
  }
}

module.exports = new TrustEngine();

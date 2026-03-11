const Node = require('../models/Node');

class AttackDetector {
  async detectAttacks() {
    const nodes = await Node.find({});
    const alerts = [];

    for (const node of nodes) {
      // Simple heuristic-based detection (Simulating ML)
      if (node.metrics.throughput > 90 && node.metrics.latency > 10) {
        alerts.push({
          nodeId: node.nodeId,
          type: 'DDoS',
          severity: 'high',
          timestamp: Date.now()
        });
        node.status = 'isolated';
        node.metrics.behaviorTrust *= 0.5;
        await node.save();
      }

      if (node.metrics.packetLoss > 20) {
        alerts.push({
          nodeId: node.nodeId,
          type: 'Packet Injection',
          severity: 'medium',
          timestamp: Date.now()
        });
        node.metrics.commTrust *= 0.7;
        await node.save();
      }
    }

    return alerts;
  }

  async simulateAttack(type) {
    const nodes = await Node.find({ status: 'active' }).limit(5);
    for (const node of nodes) {
      if (type === 'DDoS') {
        node.metrics.throughput = 95;
        node.metrics.latency = 50;
      } else if (type === 'Sybil') {
        node.metrics.behaviorTrust = 0.1;
      }
      await node.save();
    }
    return { message: `${type} attack simulated on ${nodes.length} nodes` };
  }
}

module.exports = new AttackDetector();

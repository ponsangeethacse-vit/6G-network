import { roleIdentificationService } from './role-identification.service';
import { trustFusionService } from './trust-fusion.service';
import { mlEngineService } from './ml-engine.service';
import EventEmitter from 'events';
const nodeService = require('./nodeService');

import { datasetLoader } from './simulation/datasetLoader';
import { nodeManager, SimulationNode } from './simulation/nodeManager';

export const simulatorEvents = new EventEmitter();

export class TrafficSimulatorService {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  public activeAttacks: Map<string, string> = new Map(); // nodeAddress -> attackType

  startSimulation() {
    this.isRunning = true;
    console.log('[Simulator] 🟢 Scalable Dataset-Driven Simulation Started');
    
    // generate every 2 seconds asynchronously
    this.intervalId = setInterval(() => this.generateTrafficTickAsync(), 2000); 
  }

  stopSimulation() {
    this.isRunning = false;
    if (this.intervalId) clearInterval(this.intervalId);
    console.log('[Simulator] 🔴 Simulation Stopped');
  }

  triggerAttack(node: string, attackType: string) {
    this.activeAttacks.set(node.toLowerCase(), attackType);
    console.log(`[Simulator] ⚔️ Attack triggered on ${node}: ${attackType}`);
  }

  stopAttack(node: string) {
    this.activeAttacks.delete(node.toLowerCase());
    console.log(`[Simulator] 🛡️ Attack stopped on ${node}`);
  }

  private async generateTrafficTickAsync() {
    const nodes = nodeManager.getNodes();

    if (datasetLoader.getDatasetSize() === 0) {
      console.warn('[Simulator] Waiting for dataset to load...');
      return;
    }

    // Process multiple nodes efficiently with Promise.all avoiding blocking
    await Promise.allSettled(nodes.map(async (node) => {
      await this.processNodeTraffic(node);
    }));
  }

  private async processNodeTraffic(node: SimulationNode) {
    const activeAttack = this.activeAttacks.get(node.nodeId.toLowerCase()) || 'Normal';
    
    // Grab the dataset row sequentially using node's pointer variation
    const row = datasetLoader.getRow(node.datasetIndex);
    if (!row) return;

    // Iterate pointer securely
    node.datasetIndex = (node.datasetIndex + 1) % datasetLoader.getDatasetSize();

    let packetRate = row.packet_rate;
    let responseTimeMs = row.latency;
    let bandwidth = row.bandwidth;
    let failed_requests = row.failed_requests;
    let packetSize = 1000;

    // Apply Node Type Behavior scaling
    const noise = () => 0.9 + Math.random() * 0.2; // 0.9 to 1.1 slightly random

    switch (node.type) {
        case 'iot':
            packetRate *= 0.5 * noise();
            bandwidth *= 0.5 * noise();
            responseTimeMs *= 1.2 * noise();
            break;
        case 'edge':
            packetRate *= 1.0 * noise();
            bandwidth *= 1.0 * noise();
            break;
        case 'base_station':
            packetRate *= 2.0 * noise();
            bandwidth *= 2.0 * noise();
            responseTimeMs *= 0.8 * noise();
            break;
        case 'malicious':
            // Over time inject random anomalies, avoiding constant spikes
            if (activeAttack === 'Normal' && Math.random() > 0.7) {
                packetRate *= 5.0 * noise();
                bandwidth *= 5.0 * noise();
                failed_requests += (10 + Math.random() * 20);
                responseTimeMs *= 2.5 * noise();
            } else if (activeAttack === 'Normal') {
                packetRate *= 1.0 * noise();
                bandwidth *= 1.0 * noise();
            }
            break;
    }

    // Apply explicit Dashboard Atttacks
    if (activeAttack === 'DDoS') {
        packetRate *= 10;
        bandwidth *= 10;
        responseTimeMs *= 5;
        failed_requests += 50;
    } else if (activeAttack === 'Spoofing') {
        failed_requests += 20;
    }

    const success = Math.random() > (failed_requests > 0.5 ? 0.8 : 0.05);

    // 1. Role ID processing
    await roleIdentificationService.processTrafficPattern(node.nodeId, {
      packetSize: packetSize,
      packetRate: packetRate,
      connectionDuration: Math.floor(Math.random() * 5000),
      protocolType: 'UDP'
    });

    // 2. Trust Metrics integration
    trustFusionService.recordInteraction(node.nodeId, {
      success,
      responseTimeMs
    });
    trustFusionService.recordPeerFeedback(node.nodeId, 0.8);

    // 3. Trigger Real AI Prediction asynchronously
    const aiResult = await mlEngineService.predictAnomaly({
      packet_rate: packetRate,
      latency: responseTimeMs,
      bandwidth: bandwidth,
      failed_requests: failed_requests
    });

    // 4. Compute composite trust
    const score = await trustFusionService.computeTrust(node.nodeId, aiResult);
    nodeManager.updateNodeTrust(node.nodeId, score);

    // 5. Native MongoDB Integration
    try {
      await nodeService.updateNode(node.nodeId, {
        trustScore: score, 
        status: aiResult.overall_classification === 'Normal' ? 'Active' : 'Suspicious'
      });
    } catch (e: any) {
      // Ignored if Node entity physically doesn't exist in DB yet during rapid simulation init
    }

    // Emit WebSockets to Dashboard
    simulatorEvents.emit('traffic_tick', {
      node: node.nodeId,
      packetSize,
      packetRate,
      isMaliciousMode: (activeAttack !== 'Normal' || (node.type === 'malicious' && failed_requests > row.failed_requests + 5)),
      trustScore: score,
      attackType: aiResult.overall_classification || "Normal"
    });
  }
}

export const trafficSimulatorService = new TrafficSimulatorService();

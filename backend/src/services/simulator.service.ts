import { roleIdentificationService } from './role-identification.service';
import { trustFusionService } from './trust-fusion.service';
import { mlEngineService } from './ml-engine.service';
import EventEmitter from 'events';

export const simulatorEvents = new EventEmitter();

// Mock 6G Nodes
const NODES = [
  '0x1111111111111111111111111111111111111111', // IoT Device (Normal)
  '0x2222222222222222222222222222222222222222', // Edge Server (Normal)
  '0x3333333333333333333333333333333333333333', // User Eq (Normal)
  '0x9999999999999999999999999999999999999999', // Malicious Node (DDoS/Spoofing)
];

export class TrafficSimulatorService {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  public activeAttacks: Map<string, string> = new Map(); // nodeAddress -> attackType

  startSimulation() {
    this.isRunning = true;
    console.log('[Simulator] 🟢 6G Traffic Simulation Started');
    
    this.intervalId = setInterval(() => this.generateTrafficTick(), 2000); // generate every 2 seconds
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

  private async generateTrafficTick() {
    for (const node of NODES) {
      const attack = this.activeAttacks.get(node.toLowerCase()) || 'Normal';
      
      let packetSize = Math.floor(Math.random() * 500) + 100;
      let packetRate = Math.floor(Math.random() * 20) + 1;
      let responseTimeMs = Math.floor(Math.random() * 100) + 10;
      let success = Math.random() > 0.1; // 90% success normally
      let peerFeedback = 0.8 + (Math.random() * 0.2); // Normal feedback (0.8 - 1.0)

      if (attack === 'DDoS') {
        packetSize = 5000;
        packetRate = 500;
        responseTimeMs = 1500; // congestion
        success = Math.random() > 0.8; // mostly fails
        peerFeedback = Math.random() * 0.2; 
      } else if (attack === 'Sybil') {
        packetSize = 150;
        packetRate = 80;
        responseTimeMs = 200;
        success = false; 
        peerFeedback = Math.random() * 0.1;
      } else if (attack === 'DataManipulation') {
        packetSize = 50;
        packetRate = 5;
        responseTimeMs = 10;
        success = true; // look fine
        peerFeedback = 0.0; // severe reputation penalty triggers anomaly
      } else if (attack === 'PacketFlooding') {
        packetSize = 800;
        packetRate = 800; // extremely high rate
        responseTimeMs = 2000;
        success = false;
        peerFeedback = 0.1;
      } else if (attack === 'Suspicious') {
        packetSize = Math.floor(Math.random() * 1000 + 400);
        packetRate = Math.floor(Math.random() * 60 + 30); // elevated
        responseTimeMs = Math.floor(Math.random() * 100 + 100);
        success = Math.random() > 0.4; // degrades
        peerFeedback = 0.5;
      }

      // 1. Module 1: Role ID
      await roleIdentificationService.processTrafficPattern(node, {
        packetSize,
        packetRate,
        connectionDuration: Math.floor(Math.random() * 5000),
        protocolType: 'UDP'
      });

      // 2. Module 2: Trust metrics recording
      trustFusionService.recordInteraction(node, {
        success,
        responseTimeMs
      });
      trustFusionService.recordPeerFeedback(node, peerFeedback);

      // 3. Trigger AI Attack Prediction
      const attackType = await mlEngineService.predictAttack({
        packet_rate: packetRate,
        latency: responseTimeMs,
        failed_requests: success ? 0 : 35, // Simulate triggers
        connection_attempts: 1
      });

      // 4. Trigger Trust Calculation & Fusion
      const score = await trustFusionService.computeTrust(node, attackType);

      // Emit for WebSockets (Dashboard)
      simulatorEvents.emit('traffic_tick', {
        node,
        packetSize,
        packetRate,
        isMaliciousMode: attack !== 'Normal',
        trustScore: score,
        attackType: attack
      });
    }
  }
}

export const trafficSimulatorService = new TrafficSimulatorService();

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
  public maliciousMode = false;

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

  toggleMalicious() {
    this.maliciousMode = !this.maliciousMode;
    console.log(`[Simulator] Malicious mode is now: ${this.maliciousMode}`);
  }

  private async generateTrafficTick() {
    for (const node of NODES) {
      const isMaliciousNode = node === '0x9999999999999999999999999999999999999999';
      
      let packetSize = Math.floor(Math.random() * 500) + 100;
      let packetRate = Math.floor(Math.random() * 20) + 1;
      let responseTimeMs = Math.floor(Math.random() * 100) + 10;
      let success = Math.random() > 0.1; // 90% success normally
      let peerFeedback = 0.8 + (Math.random() * 0.2); // Normal feedback (0.8 - 1.0)

      if (isMaliciousNode && this.maliciousMode) {
        // Simulating DDoS / Packet Flooding / Sybil
        packetSize = 5000;
        packetRate = 500;
        responseTimeMs = 1500; // congestion
        success = Math.random() > 0.8; // mostly fails
        peerFeedback = Math.random() * 0.3; // Low peer feedback
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
        isMaliciousMode: this.maliciousMode,
        trustScore: score,
        attackType // optional forward
      });
    }
  }
}

export const trafficSimulatorService = new TrafficSimulatorService();

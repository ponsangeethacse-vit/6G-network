import { mlEngineService } from './ml-engine.service';
import { blockchainService } from './blockchain.service';

interface NodeInteraction {
  success: boolean;
  responseTimeMs: number;
}

// 🌐 Node Network Mesh Mappings (Neighbors)
const NEIGHBOR_MAP: Record<string, string[]> = {
  '0x1111111111111111111111111111111111111111': ['0x2222222222222222222222222222222222222222', '0x3333333333333333333333333333333333333333'],
  '0x2222222222222222222222222222222222222222': ['0x1111111111111111111111111111111111111111', '0x9999999999999999999999999999999999999999'],
  '0x3333333333333333333333333333333333333333': ['0x1111111111111111111111111111111111111111'],
  '0x9999999999999999999999999999999999999999': ['0x2222222222222222222222222222222222222222']
};

export class TrustFusionService {
  // nodeAddress -> interactions
  private interactionsHistory: Map<string, NodeInteraction[]> = new Map();
  
  // nodeAddress -> [Historical Trust Scores]
  private trustHistory: Map<string, number[]> = new Map();

  // Peer feedbacks (approximated for demo as periodic inputs)
  private peerFeedback: Map<string, number[]> = new Map(); // 0 to 1 scores

  // nodeAddress -> timestamp of last attack/anomaly
  private lastAttackTime: Map<string, number> = new Map();

  public readonly ANOMALY_THRESHOLD = 60; // < 60 is flagged

  recordInteraction(nodeAddress: string, interaction: NodeInteraction) {
    if (!this.interactionsHistory.has(nodeAddress)) {
      this.interactionsHistory.set(nodeAddress, []);
    }
    this.interactionsHistory.get(nodeAddress)!.push(interaction);

    // Keep only recent 50 interactions
    if (this.interactionsHistory.get(nodeAddress)!.length > 50) {
      this.interactionsHistory.get(nodeAddress)!.shift();
    }
  }

  recordPeerFeedback(nodeAddress: string, score: number) {
    if (!this.peerFeedback.has(nodeAddress)) {
      this.peerFeedback.set(nodeAddress, []);
    }
    this.peerFeedback.get(nodeAddress)!.push(Math.max(0, Math.min(1, score)));
    
    if (this.peerFeedback.get(nodeAddress)!.length > 10) {
      this.peerFeedback.get(nodeAddress)!.shift();
    }
  }

  private applyNeighborPenalty(nodeAddress: string, penalty: number) {
    if (!this.trustHistory.has(nodeAddress)) return;
    const history = this.trustHistory.get(nodeAddress)!;
    if (history.length === 0) return;

    const lastScore = history[history.length - 1];
    // Rule 2: Clamp reduction so neighbors don't get classified as malicious (<40) easily
    const newScore = Math.max(45, lastScore - penalty); 
    history[history.length - 1] = newScore;
    console.log(`[TrustFusion] ⚠️ Anti-Cascade penalty onto neighbor ${nodeAddress}: New Score ${newScore}`);
  }

  private calculateDirectTrust(nodeAddress: string): number {
    const interactions = this.interactionsHistory.get(nodeAddress);
    if (!interactions || interactions.length === 0) return 1.0; // Default new node trust

    const successCount = interactions.filter(i => i.success).length;
    const successRate = successCount / interactions.length;

    // Penalty for slow response (e.g. > 500ms)
    const avgResponseTime = interactions.reduce((sum, i) => sum + i.responseTimeMs, 0) / interactions.length;
    let timePenalty = 0;
    if (avgResponseTime > 500) {
      timePenalty = Math.min(0.3, (avgResponseTime - 500) / 1000);
    }

    return Math.max(0, successRate - timePenalty);
  }

  private calculateIndirectTrust(nodeAddress: string): number {
    const feedbacks = this.peerFeedback.get(nodeAddress);
    if (!feedbacks || feedbacks.length === 0) return 0.5; // Neutral

    const sum = feedbacks.reduce((acc, val) => acc + val, 0);
    return sum / feedbacks.length;
  }

  async computeTrust(nodeAddress: string, attackType: string = "Normal"): Promise<number | null> {
    const behavioral = this.calculateDirectTrust(nodeAddress);
    const reputation = this.calculateIndirectTrust(nodeAddress);
    
    // 📊 Derive Historical Trust from last 5 scores
    const history = this.getHistoricalTrust(nodeAddress);
    const recent = history.slice(-5);
    const historical = recent.length > 0 
      ? (recent.reduce((a, b) => a + b, 0) / recent.length) / 100 
      : 0.8; // Default seed

    // 🌍 Context Trust (e.g., node role or ambient metrics)
    const context = 0.8; // Stand-in dynamic parameter supporting factor architecture

    // Use Python Microservice for Fusion
    const fusionScore = await mlEngineService.computeFusionTrust(behavioral, historical, reputation, context);
    
    let finalScore = fusionScore;

    // 🔬 Containment Rule 5: Trust Recovery Mechanism (Normal behavior for >= 20 seconds)
    const nowMs = Date.now();
    if (attackType !== 'Normal' && attackType !== 'Normal Traffic') {
      this.lastAttackTime.set(nodeAddress, nowMs);
    } else {
      const lastAttack = this.lastAttackTime.get(nodeAddress) || 0;
      const idleTime = nowMs - lastAttack;
      
      if (idleTime >= 20000) { // 20s of normal behavior
         const history = this.getHistoricalTrust(nodeAddress);
         if (history.length > 0) {
            const lastScore = history[history.length - 1];
            if (lastScore < 100) {
               finalScore = Math.min(100, lastScore + 5); // gradual increment
               console.log(`[TrustFusion] 💊 Trust Recovery on ${nodeAddress} (+5): New Score ${finalScore}`);
            }
         }
      }
    }

    // 🔬 Containment Rule 3/4: Max 10-15% Malicious Nodes Clamp
    const totalNodes = Math.max(4, this.interactionsHistory.size);
    const allScores = Array.from(this.trustHistory.entries());
    const maliciousCount = allScores.filter(([addr, scores]) => scores.length > 0 && scores[scores.length - 1] < this.ANOMALY_THRESHOLD).length;

    if (finalScore < this.ANOMALY_THRESHOLD) {
      if (maliciousCount / totalNodes >= 0.15) {
        console.log(`[TrustFusion] 🛡️ Anti-Cascade threshold exceeded (>15%). Capping ${nodeAddress} score to prevent collapse.`);
        finalScore = this.ANOMALY_THRESHOLD + 5; // restore to 65
      }
    }

    // Save history
    if (!this.trustHistory.has(nodeAddress)) {
      this.trustHistory.set(nodeAddress, []);
    }
    this.trustHistory.get(nodeAddress)!.push(finalScore);
    if (this.trustHistory.get(nodeAddress)!.length > 100) {
      this.trustHistory.get(nodeAddress)!.shift();
    }

    // 🔬 Containment Rule 1/2: Attenuate Neighbors Mildly
    if (finalScore < this.ANOMALY_THRESHOLD) {
      const neighbors = NEIGHBOR_MAP[nodeAddress.toLowerCase()] || [];
      for (const n of neighbors) {
         this.applyNeighborPenalty(n, 8); // deduction mildly
      }
    }

    // Write to Blockchain and check anomaly
    await this.updateBlockchainLedger(nodeAddress, finalScore, attackType);

    return finalScore;
  }

  private async updateBlockchainLedger(nodeAddress: string, fusionScore: number, attackType: string) {
    try {
      if (!blockchainService.trustLedgerContract) return;

      // ⚖️ ONLY update blockchain ledger for anomalies / security events
      if (fusionScore < this.ANOMALY_THRESHOLD) {
        const tx = await blockchainService.trustLedgerContract.updateTrustScore(nodeAddress, fusionScore, attackType);
        await tx.wait();

        console.log(`[TrustFusion] 🚨 ANOMALY DETECTED for ${nodeAddress} (Score: ${fusionScore})`);
        const reportTx = await blockchainService.trustLedgerContract.reportAnomaly(nodeAddress, `Consistently low trust score (Model: ${attackType})`);
        await reportTx.wait();
      } else {
        console.log(`[TrustFusion] ✅ Normal trust score for ${nodeAddress} (${fusionScore}) - Cached locally`);
      }
    } catch (e: any) {
      console.error(`[TrustFusion] Error updating ledger for ${nodeAddress}:`, e.message);
    }
  }

  getHistoricalTrust(nodeAddress: string): number[] {
    return this.trustHistory.get(nodeAddress) || [];
  }

  getPredictedFutureTrust(nodeAddress: string): number {
    const history = this.getHistoricalTrust(nodeAddress);
    return mlEngineService.predictFutureTrends(history);
  }
}

export const trustFusionService = new TrustFusionService();

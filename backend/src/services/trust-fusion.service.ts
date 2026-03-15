import { mlEngineService } from './ml-engine.service';
import { blockchainService } from './blockchain.service';

interface NodeInteraction {
  success: boolean;
  responseTimeMs: number;
}

export class TrustFusionService {
  // nodeAddress -> interactions
  private interactionsHistory: Map<string, NodeInteraction[]> = new Map();
  
  // nodeAddress -> [Historical Trust Scores]
  private trustHistory: Map<string, number[]> = new Map();

  // Peer feedbacks (approximated for demo as periodic inputs)
  private peerFeedback: Map<string, number[]> = new Map(); // 0 to 1 scores

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

  async computeTrust(nodeAddress: string): Promise<number | null> {
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

    // Save history
    if (!this.trustHistory.has(nodeAddress)) {
      this.trustHistory.set(nodeAddress, []);
    }
    this.trustHistory.get(nodeAddress)!.push(fusionScore);
    if (this.trustHistory.get(nodeAddress)!.length > 100) {
      this.trustHistory.get(nodeAddress)!.shift();
    }

    // Write to Blockchain and check anomaly
    await this.updateBlockchainLedger(nodeAddress, fusionScore);

    return fusionScore;
  }

  private async updateBlockchainLedger(nodeAddress: string, fusionScore: number) {
    try {
      if (!blockchainService.trustLedgerContract) return;

      const tx = await blockchainService.trustLedgerContract.updateTrustScore(nodeAddress, fusionScore);
      await tx.wait();

      if (fusionScore < this.ANOMALY_THRESHOLD) {
        console.log(`[TrustFusion] 🚨 ANOMALY DETECTED for ${nodeAddress} (Score: ${fusionScore})`);
        
        // Also trigger report explicitly if needed
        const reportTx = await blockchainService.trustLedgerContract.reportAnomaly(nodeAddress, "Consistently low trust score detected by ML Fusion");
        await reportTx.wait();
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

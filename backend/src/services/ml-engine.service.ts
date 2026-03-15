const PYTHON_AI_URL = process.env.PYTHON_AI_URL || 'http://localhost:8000';

export class MLEngineService {
  constructor() {
    console.log('[MLEngine] Initialized using Python Microservice endpoint:', PYTHON_AI_URL);
  }


  // Uses Python Microservice to predict fusion score based on Direct and Indirect trust
  async computeFusionTrust(directTrust: number, indirectTrust: number): Promise<number> {
    try {
      const response = await fetch(`${PYTHON_AI_URL}/calculate-trust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          behavioral_trust: directTrust,
          historical_trust: 0.8, // Default fallback or seed
          reputation_trust: indirectTrust,
          context_trust: 0.75     // Default fallback or seed
        })
      });

      if (!response.ok) {
        throw new Error(`Python AI Microservice responded with status: ${response.status}`);
      }

      const data = await response.json();
      return Math.round(data.fusion_trust_score); // FastAPI returns already scaled 0-100 score
      
    } catch (error: any) {
      console.error('[MLEngine] Error calling Python AI Service:', error.message);
      // Fallback weighted average if microservice is offline
      return Math.round(((directTrust * 0.7) + (indirectTrust * 0.3)) * 100);
    }
  }

  // Predict future trust (proxy using simple moving average for prototype, ARIMA/LSTM proxy)
  predictFutureTrends(historicalScores: number[]): number {
    if (historicalScores.length < 3) return historicalScores[historicalScores.length - 1] || 100;
    
    // Simple heuristic prediction mapping dropping trends
    const recent = historicalScores.slice(-3);
    const trend = (recent[recent.length - 1] - recent[0]) / recent.length;
    
    let predictedNext = recent[recent.length - 1] + trend;
    return Math.max(0, Math.min(100, predictedNext));
  }
}

export const mlEngineService = new MLEngineService();

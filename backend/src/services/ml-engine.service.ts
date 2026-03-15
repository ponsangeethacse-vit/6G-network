const PYTHON_AI_URL = process.env.PYTHON_AI_URL || 'http://localhost:8000';

export class MLEngineService {
  constructor() {
    console.log('[MLEngine] Initialized using Python Microservice endpoint:', PYTHON_AI_URL);
  }


  // Uses Python Microservice to predict fusion score based on 4 trust factors
  async computeFusionTrust(behavioral: number, historical: number, reputation: number, context: number): Promise<number> {
    try {
      const response = await fetch(`${PYTHON_AI_URL}/calculate-trust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          behavioral_trust: behavioral,
          historical_trust: historical,
          reputation_trust: reputation,
          context_trust: context
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
      return Math.round(((behavioral * 0.35) + (historical * 0.25) + (reputation * 0.20) + (context * 0.20)) * 100);
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

  // Predict attack classification based on network traffic metrics
  async predictAttack(metrics: { packet_rate: number, latency: number, failed_requests: number, connection_attempts: number }): Promise<string> {
    try {
      const response = await fetch(`${PYTHON_AI_URL}/predict-attack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metrics)
      });

      if (!response.ok) throw new Error(`Python AI Microservice responded with status: ${response.status}`);
      const data = await response.json();
      return data.classification;
      
    } catch (e: any) {
      console.error('[MLEngine] Error predicting attack type:', e.message);
      return 'Normal'; // Fallback
    }
  }
}

export const mlEngineService = new MLEngineService();

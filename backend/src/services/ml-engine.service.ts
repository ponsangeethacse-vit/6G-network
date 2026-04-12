const PYTHON_AI_URL = process.env.PYTHON_AI_URL || 'http://localhost:8000';

export class MLEngineService {
  constructor() {
    console.log('[MLEngine] Initialized using Python Microservice endpoint:', PYTHON_AI_URL);
  }


  // Uses Python Microservice to predict fusion score based on 4 trust factors
  // Uses Python Microservice to predict fusion score based on Anomaly metrics
  async computeFusionTrust(metrics: { autoencoder_anomaly_score: number, lstm_temporal_probability: number }): Promise<{ score: number, classification: string }> {
    try {
      const response = await fetch(`${PYTHON_AI_URL}/calculate-trust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoencoder_anomaly_score: metrics.autoencoder_anomaly_score,
          lstm_temporal_probability: metrics.lstm_temporal_probability
        })
      });

      if (!response.ok) {
        throw new Error(`Python AI Microservice responded with status: ${response.status}`);
      }

      const data = await response.json();
      return { score: data.fusion_trust_score, classification: data.classification };
      
    } catch (error: any) {
      console.error('[MLEngine] Error calling Python AI Service Trust:', error.message);
      return { score: 80.0, classification: 'Trusted' };
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
  // Predict attack classification based on network traffic metrics via Autoencoder + LSTM
  async predictAnomaly(metrics: { packet_rate: number, latency: number, bandwidth: number, failed_requests: number }): Promise<any> {
    try {
      const response = await fetch(`${PYTHON_AI_URL}/predict-anomaly`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metrics)
      });

      if (!response.ok) throw new Error(`Python AI Microservice responded with status: ${response.status}`);
      const data = await response.json();
      return data;
      
    } catch (e: any) {
      console.error('[MLEngine] Error predicting attack type:', e.message);
      // Fallback object to avoid crashes
      return {
          autoencoder_anomaly_score: 0.1,
          lstm_temporal_probability: 0.1,
          overall_classification: 'Normal'
      };
    }
  }
}

export const mlEngineService = new MLEngineService();

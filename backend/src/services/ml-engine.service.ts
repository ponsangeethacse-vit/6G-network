import * as tf from '@tensorflow/tfjs';

export class MLEngineService {
  private fusionModel!: tf.Sequential;
  private isModelReady = false;

  constructor() {
    this.initFusionModel();
  }

  // Initialize a simple Feed-Forward Neural Network for Trust Fusion
  private async initFusionModel() {
    this.fusionModel = tf.sequential();
    
    // Input: [directTrust, indirectTrust]
    this.fusionModel.add(tf.layers.dense({ units: 8, activation: 'relu', inputShape: [2] }));
    this.fusionModel.add(tf.layers.dense({ units: 4, activation: 'relu' }));
    
    // Output: fusionTrustScore (0 to 1)
    this.fusionModel.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));

    this.fusionModel.compile({
      optimizer: tf.train.adam(0.01),
      loss: 'meanSquaredError'
    });

    // Mock Training Data (Direct, Indirect) -> Fusion Score
    // High direct and high indirect -> High Fusion (0.9)
    // High direct but low indirect -> Medium Fusion (0.6)
    // Low direct and low indirect -> Low Fusion (0.1)
    const xs = tf.tensor2d([
       [0.9, 0.9], [0.8, 0.9], [0.9, 0.8],
       [0.9, 0.2], [0.2, 0.9], [0.5, 0.5],
       [0.2, 0.2], [0.1, 0.3], [0.3, 0.1]
    ]);
    const ys = tf.tensor2d([
       [0.95], [0.85], [0.85],
       [0.55], [0.55], [0.50],
       [0.10], [0.15], [0.15]
    ]);

    await this.fusionModel.fit(xs, ys, { epochs: 100, verbose: 0 });
    this.isModelReady = true;
    console.log('[MLEngine] Trust Fusion Model Trained and Ready.');
  }

  // Uses TF.js model to predict fusion score based on Direct and Indirect trust (both 0-1)
  async computeFusionTrust(directTrust: number, indirectTrust: number): Promise<number> {
    if (!this.isModelReady) return (directTrust * 0.7) + (indirectTrust * 0.3); // Fallback weighted average

    return tf.tidy(() => {
      const input = tf.tensor2d([[directTrust, indirectTrust]]);
      const prediction = this.fusionModel.predict(input) as tf.Tensor;
      const score = prediction.dataSync()[0];
      return Math.round(score * 100); // Scale 0-1 to 0-100
    });
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

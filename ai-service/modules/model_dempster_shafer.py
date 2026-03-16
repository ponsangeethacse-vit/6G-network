class ModelDempsterShaferFusion:
    def __init__(self, conf_ae=0.90, conf_lstm=0.85):
        # Confidence levels (discounts)
        self.c1 = conf_ae
        self.c2 = conf_lstm

    def process(self, anomaly_score: float, temporal_prob: float) -> dict:
        """
        Inputs: Spatial Anomaly Score and Temporal Attack Probability
        Returns: Fused Belief frame (Malicious, Benign, Uncertainty)
        """
        anomaly_score = float(anomaly_score)
        temporal_prob = float(temporal_prob)

        # 1. Mass 1: Autoencoder (Spatial)
        m1_malicious = anomaly_score * self.c1
        m1_benign    = (1.0 - anomaly_score) * self.c1
        m1_uncertain = 1.0 - self.c1 # Mass allotted to theta

        # 2. Mass 2: LSTM (Temporal)
        m2_malicious = temporal_prob * self.c2
        m2_benign    = (1.0 - temporal_prob) * self.c2
        m2_uncertain = 1.0 - self.c2

        # 3. Dempster's Combination Rule Conflict (K)
        # Sum of intersecting absolute conflicts
        conflict_k = (m1_malicious * m2_benign) + (m1_benign * m2_malicious)

        denominator = 1.0 - conflict_k if (1.0 - conflict_k) > 0.001 else 0.001

        # 4. Fused Beliefs Formula
        fused_malicious = (
            (m1_malicious * m2_malicious) + 
            (m1_malicious * m2_uncertain) + 
            (m1_uncertain * m2_malicious)
        ) / denominator

        fused_benign = (
            (m1_benign * m2_benign) + 
            (m1_benign * m2_uncertain) + 
            (m1_uncertain * m2_benign)
        ) / denominator

        fused_uncertain = (m1_uncertain * m2_uncertain) / denominator

        # Normalise safely
        fused_m = min(1.0, max(0.0, fused_malicious))
        fused_b = min(1.0, max(0.0, fused_benign))
        fused_u = min(1.0, max(0.0, fused_uncertain))

        return {
            "stage": "Model Dempster-Shafer Fusion",
            "belief_malicious": round(fused_m, 4),
            "belief_benign": round(fused_b, 4),
            "uncertainty": round(fused_u, 4),
            "conflict_k": round(conflict_k, 4),
            "fused_decision": "Malicious" if fused_m > 0.60 else "Benign" if fused_b > 0.60 else "Uncertain"
        }

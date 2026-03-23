class ModelTrustLearning:
    def __init__(self):
        # Weight coefficients for dynamic scaling
        self.recovery_weight = 0.05
        self.penalty_weight = 0.30

    def process(self, previous_trust: float, beliefs: dict) -> dict:
        """
        Inputs: Previous Trust Score [0-100 scale or 0-1 scale]
        Standardizing inputs to 0.0 -> 1.0 internally.
        """
        prev = float(previous_trust)
        # Normalize if passed with 0-100 scale
        if prev > 1.0:
             prev = prev / 100.0

        b_malicious = float(beliefs.get("belief_malicious", 0.0))
        b_benign    = float(beliefs.get("belief_benign", 0.0))
        uncertainty = float(beliefs.get("uncertainty", 0.0))

        delta = 0.0
        details = "Stable trust holding"

        # 1. Strong Trust Decrease for Malicious Evidence
        if b_malicious > 0.40:
             # Long term penalty scaling: drops faster if already low trust
             multiplier = 1.5 if prev < 0.60 else 1.0 
             delta = -(b_malicious * self.penalty_weight * multiplier)
             details = "High Malicious Belief trigger"

        # 2. Gradual Recovery for Benign Evidence
        elif b_benign > 0.60 and b_malicious < 0.20:
             # Uncertainty damping: recover slower if unknown triggers exist
             damping = 1.0 - uncertainty 
             delta = b_benign * self.recovery_weight * damping
             details = "Normal Behaviour - Gradual recovery"

        # 3. Uncertain States hold position
        else:
             details = "High uncertainty holding position"

        new_trust = prev + delta
        new_trust = min(1.0, max(0.0, new_trust))

        # Output with consistent 0-100 bounded scale for visualization dashboards
        return {
            "stage": "Model Trust Update",
            "previous_trust": round(prev * 100, 2),
            "new_trust": round(new_trust * 100, 2),
            "delta": round(delta * 100, 2),
            "classification": "Trust Decrease" if delta < 0 else "Trust Increase" if delta > 0 else "Unchanged",
            "details": details
        }

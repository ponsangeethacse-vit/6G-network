class ModelLSTMAttackDetector:
    def __init__(self):
        self.threshold = 0.60

    def process(self, current: dict, history: list) -> dict:
        """
        Input: Current Metrics, History list of past intervals
        Returns: Temporal Attack Probability [0.0 - 1.0]
        """
        if not history or len(history) < 2:
             return {
                 "stage": "Model Update LSTM",
                 "temporal_attack_probability": 0.0,
                 "detected": False,
                 "details": "Insufficient history history for sequential analysis"
             }

        # Extract sequential scores (Assume latest is at index -1)
        trust_history = [float(h.get("trust_score", 85.0)) for h in history]
        anomaly_history = [float(h.get("anomaly_score", 0.0)) for h in history]

        current_trust = float(current.get("trust_score", 85.0))
        current_anomaly = float(current.get("anomaly_score", 0.0))

        all_trust = trust_history + [current_trust]
        all_anomaly = anomaly_history + [current_anomaly]

        prob = 0.0
        pattern_notes = []

        # 1. Slow Poisoning Detection (Monotonic continuous trust decay)
        drops = 0
        for i in range(1, len(all_trust)):
             if all_trust[i] < all_trust[i-1]:
                  drops += 1
        
        if drops >= 3 and (all_trust[0] - all_trust[-1]) > 10:
             prob += 0.45
             pattern_notes.append("Monotonic trust decay (Slow Poisoning)")

        # 2. On-Off Attacker Detection (Cyclic anomaly spikes)
        # Flipping high-low thresholds triggers alerts
        spikes = 0
        for i in range(1, len(all_anomaly)):
             diff = abs(all_anomaly[i] - all_anomaly[i-1])
             if diff > 0.4:
                  spikes += 1
        
        if spikes >= 2:
             prob += 0.40
             pattern_notes.append("Alternating anomaly spikes (On-Off Strategy)")

        # 3. Coordinated Bursts
        if len(all_anomaly) >= 2 and (all_anomaly[-1] - all_anomaly[-2]) > 0.6:
             prob += 0.35
             pattern_notes.append("Sudden attack burst magnitude")

        final_prob = min(1.0, max(0.0, prob))
        is_detected = final_prob > self.threshold

        return {
            "stage": "Model Update LSTM",
            "temporal_attack_probability": round(final_prob, 4),
            "detected": is_detected,
            "details": " | ".join(pattern_notes) if pattern_notes else "Stable temporal profile"
        }

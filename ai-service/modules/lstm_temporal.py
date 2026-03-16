class LSTMTemporalDetector:
    def __init__(self, sequence_threshold=0.7):
        self.sequence_threshold = sequence_threshold

    def process(self, metrics: dict, history: list) -> dict:
        """
        Stage 3: LSTM Temporal Attack Detection
        Analyzes time-series buffers to find progressively advancing attacks.
        """
        # Simulate sequential memory trace
        # If last 3 entries show sequential growth in packet_rate, flag temporal anomaly
        if len(history) < 3:
            return {
                "stage": "LSTM Temporal",
                "detected": False,
                "score": 0.0,
                "details": "Buffering history..."
            }

        rates = [h.get("packet_rate", 0) for h in history[-3:]] + [metrics.get("packet_rate", 0)]
        
        # Check for sequential increasing trend (Attack proxy)
        trend_score = 0.0
        growth_count = 0
        for i in range(1, len(rates)):
            if rates[i] > rates[i-1] * 1.5: # 50% growth tick
                growth_count += 1

        trend_score = growth_count / (len(rates) - 1)
        detected = trend_score >= self.sequence_threshold

        return {
            "stage": "LSTM Temporal",
            "detected": detected,
            "score": round(trend_score, 2),
            "details": f"Temporal growth anomaly {round(trend_score * 100, 1)}%" if detected else "Sequential flow stable"
        }

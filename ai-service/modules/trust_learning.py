class TrustLearning:
    def __init__(self, learning_rate=0.15):
        self.learning_rate = learning_rate

    def process(self, current_trust: float, fusion_result: dict, auth_result: dict) -> dict:
        """
        Stage 5: Trust-by-Learning Update
        Updates scalar trust dynamically following a learning rate weight delta.
        """
        # Auth failed is an immediate heavy lock penalty
        if not auth_result.get("success", True):
             current_trust = min(current_trust, auth_result.get("score", 0.0) * 100.0)
             return {
                 "stage": "Trust Update",
                 "new_trust": round(current_trust, 2),
                 "delta": round(current_trust - current_trust, 2),
                 "update_notes": "Immediate penalty — auth failure"
             }

        fused_attack = fusion_result.get("fused_attack_belief", 0.0)
        
        # Calculate delta based on attack belief
        # If belief > 0.5, trust decreases. If belief < 0.5, trust recovers.
        if fused_attack > 0.5:
             delta = - (fused_attack * 20.0 * self.learning_rate) # scale delta penalty
        else:
             delta = + ((1.0 - fused_attack) * 5.0 * self.learning_rate) # slow recovery

        # Apply update clamped 0-100
        new_trust = max(0.0, min(100.0, current_trust + delta))

        return {
            "stage": "Trust Update",
            "new_trust": round(new_trust, 2),
            "delta": round(delta, 2),
            "update_notes": "Decreasing trajectory" if delta < 0 else "Stabilizing trajectory"
        }

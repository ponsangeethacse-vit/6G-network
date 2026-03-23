class DempsterShaferFusion:
    def __init__(self):
        pass

    def process(self, ae_result: dict, lstm_result: dict) -> dict:
        """
        Stage 4: Dempster–Shafer Evidence Fusion
        Combines spatial (Autoencoder) and temporal (LSTM) evidence.
        """
        # Mass 1: Autoencoder (Attack probability)
        # Higher loss = higher attack belief
        m1_attack = ae_result.get("loss", 0.0)
        m1_normal = max(0.0, 1.0 - m1_attack)

        # Mass 2: LSTM (Attack probability)
        # Higher score = higher attack belief
        m2_attack = lstm_result.get("score", 0.0)
        m2_normal = max(0.0, 1.0 - m2_attack)

        # Dempster's Combination Rule
        # 1. Conflict Metric K
        conflict_k = (m1_attack * m2_normal) + (m1_normal * m2_attack)

        # 2. Fused Belief (Attack & Normal)
        denominator = 1.0 - conflict_k if (1.0 - conflict_k) > 0.001 else 0.001

        fused_attack = (m1_attack * m2_attack) / denominator
        fused_normal = (m1_normal * m2_normal) / denominator

        # Normalise safely
        fused_attack = min(1.0, max(0.0, fused_attack))
        fused_normal = min(1.0, max(0.0, fused_normal))

        is_anomalous = fused_attack > 0.65 # threshold fusion trigger

        return {
            "stage": "Dempster-Shafer Fusion",
            "is_anomalous": is_anomalous,
            "fused_attack_belief": round(fused_attack, 4),
            "fused_normal_belief": round(fused_normal, 4),
            "conflict_k": round(conflict_k, 4),
            "details": "High conflict merging sources" if conflict_k > 0.5 else "Evidence aligned"
        }

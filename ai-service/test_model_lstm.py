import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from modules.model_lstm import ModelLSTMAttackDetector

def test_model_lstm():
    print("--- Starting Model LSTM Verification ---")
    
    detector = ModelLSTMAttackDetector()

    # Case 1: Nominal State
    print("\n[Case 1] testing Nominal Updates history...")
    history_nominal = [
        {"trust_score": 85, "anomaly_score": 0.1},
        {"trust_score": 86, "anomaly_score": 0.05},
        {"trust_score": 85, "anomaly_score": 0.12}
    ]
    current_nominal = {"trust_score": 85, "anomaly_score": 0.08}
    
    res1 = detector.process(current_nominal, history_nominal)
    print(f"-> Prob: {res1['temporal_attack_probability']} (Detected: {res1['detected']})")
    assert res1['temporal_attack_probability'] < 0.3, "Stable updates should have low probability"

    # Case 2: Slow Poisoning (Monotonic trust decay)
    print("\n[Case 2] testing Slow Poisoning (Decay)...")
    history_decay = [
        {"trust_score": 85, "anomaly_score": 0.1},
        {"trust_score": 82, "anomaly_score": 0.15},
        {"trust_score": 78, "anomaly_score": 0.18}
    ]
    current_decay = {"trust_score": 73, "anomaly_score": 0.22} # drop continues
    
    res2 = detector.process(current_decay, history_decay)
    print(f"-> Prob: {res2['temporal_attack_probability']} ({res2['details']})")
    assert res2['temporal_attack_probability'] >= 0.45, "Monotonic decay should trigger penalty"

    # Case 3: On-Off Attacker (Alternating Spikes)
    print("\n[Case 3] testing On-Off Attacker (Spikes)...")
    history_spikes = [
        {"trust_score": 85, "anomaly_score": 0.6}, # Spike 1
        {"trust_score": 85, "anomaly_score": 0.05}, # Drop
        {"trust_score": 85, "anomaly_score": 0.65}  # Spike 2
    ]
    current_spike = {"trust_score": 85, "anomaly_score": 0.1} # Drop
    
    res3 = detector.process(current_spike, history_spikes)
    print(f"-> Prob: {res3['temporal_attack_probability']} ({res3['details']})")
    assert res3['temporal_attack_probability'] >= 0.40, "On-Off flipping should trigger penalty"

    print("\n✅ Model LSTM verification Passed")

if __name__ == "__main__":
    try:
        test_model_lstm()
        sys.exit(0)
    except AssertionError as e:
        print(f"\n❌ Verification Failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected Error: {e}")
        sys.exit(1)

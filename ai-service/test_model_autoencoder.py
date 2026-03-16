import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from modules.model_autoencoder import ModelAutoencoderAnomaly

def test_model_autoencoder():
    print("--- Starting Model Autoencoder Verification ---")
    
    detector = ModelAutoencoderAnomaly()

    # Case 1: Nominal Updates
    print("\n[Case 1] testing Nominal Model Update...")
    metrics_nominal = {
        "gradient_magnitude": 0.32,
        "loss_change": 0.08,
        "update_variance": 0.04,
        "parameter_drift": 0.12
    }
    res1 = detector.process(metrics_nominal)
    print(f"-> Score: {res1['anomaly_score']} (Detected: {res1['detected']})")
    assert res1['anomaly_score'] < 0.4, "Nominal update should have low score"

    # Case 2: Abnormal Update Magnitude (Large gradient)
    print("\n[Case 2] testing Abnormal Gradient Magnitude...")
    metrics_malicious = {
        "gradient_magnitude": 0.95, # high 
        "loss_change": 0.40,
        "update_variance": 0.35,
        "parameter_drift": 0.60
    }
    res2 = detector.process(metrics_malicious)
    print(f"-> Score: {res2['anomaly_score']} (Detected: {res2['detected']})")
    assert res2['anomaly_score'] >= 0.65, "Malicious drift should trigger anomaly"
    assert res2['detected'] == True, "Should flag detected"

    print("\n✅ Model Autoencoder verification Passed")

if __name__ == "__main__":
    try:
        test_model_autoencoder()
        sys.exit(0)
    except AssertionError as e:
        print(f"\n❌ Verification Failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected Error: {e}")
        sys.exit(1)

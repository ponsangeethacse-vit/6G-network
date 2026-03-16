import sys
import os

# Add parent dir to path to import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from modules.physical_auth import PhysicalAuth
from modules.autoencoder_anomaly import AutoencoderAnomaly
from modules.lstm_temporal import LSTMTemporalDetector
from modules.dempster_shafer import DempsterShaferFusion
from modules.trust_learning import TrustLearning

def test_pipeline():
    print("--- Starting AI Pipeline Verification ---")
    
    # Init
    auth = PhysicalAuth()
    ae = AutoencoderAnomaly()
    lstm = LSTMTemporalDetector()
    ds = DempsterShaferFusion()
    trust = TrustLearning()

    # Case 1: Normal Traffic
    print("\n[Case 1] testing Normal Traffic...")
    metrics_normal = {
        "packet_rate": 20,
        "latency": 50,
        "bandwidth_usage": 1000,
        "authentication_failures": 0,
        "channel_quality": 0.9
    }
    
    auth_res = auth.process(metrics_normal)
    ae_res = ae.process(metrics_normal)
    lstm_res = lstm.process(metrics_normal, [])
    fused_res = ds.process(ae_res, lstm_res)
    trust_res = trust.process(85.0, fused_res, auth_res)

    print(f"-> Auth: {auth_res['details']}")
    print(f"-> AE Loss: {ae_res['loss']} (Detected: {ae_res['detected']})")
    print(f"-> DS Fusion Attack Belief: {fused_res['fused_attack_belief']}")
    print(f"-> New Trust: {trust_res['new_trust']}")
    assert trust_res['new_trust'] >= 85.0, "Trust should stay same or increase"

    # Case 2: DDoS Pattern (Progressive Attack)
    print("\n[Case 2] testing Progressive DDoS Attack (LSTM required)...")
    
    # Simulate historical escalation for LSTM
    history = [
        {"packet_rate": 100, "latency": 60, "bandwidth_usage": 5000, "authentication_failures": 0},
        {"packet_rate": 250, "latency": 100, "bandwidth_usage": 15000, "authentication_failures": 0},
        {"packet_rate": 500, "latency": 150, "bandwidth_usage": 40000, "authentication_failures": 0}
    ]

    metrics_ddos = {
        "packet_rate": 900,
        "latency": 250,
        "bandwidth_usage": 90000,
        "authentication_failures": 0,
        "channel_quality": 0.9
    }
    
    auth_res = auth.process(metrics_ddos)
    ae_res = ae.process(metrics_ddos)
    lstm_res = lstm.process(metrics_ddos, history) # pass history
    fused_res = ds.process(ae_res, lstm_res)
    trust_res = trust.process(85.0, fused_res, auth_res)

    print(f"-> AE Loss: {ae_res['loss']} (Detected: {ae_res['detected']})")
    print(f"-> LSTM Score: {lstm_res['score']} (Detected: {lstm_res['detected']})")
    print(f"-> DS Fusion Attack Belief: {fused_res['fused_attack_belief']}")
    print(f"-> New Trust: {trust_res['new_trust']}")
    assert trust_res['new_trust'] < 85.0, f"Trust didn't drop, current: {trust_res['new_trust']}"

    print("\n✅ All Pipeline Verification Passed Local Assertions")

if __name__ == "__main__":
    try:
        test_pipeline()
        sys.exit(0)
    except AssertionError as e:
        print(f"\n❌ Verification Failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected Error: {e}")
        sys.exit(1)

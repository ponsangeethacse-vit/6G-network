import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from modules.model_trust_learning import ModelTrustLearning

def test_model_trust():
    print("--- Starting Model Trust Learning Verification ---")
    
    trust_module = ModelTrustLearning()

    # Case 1: Gradual Recovery (Benign)
    print("\n[Case 1] testing Gradual Recovery (Benign)...")
    beliefs_benign = {
        "belief_malicious": 0.1,
        "belief_benign": 0.8,
        "uncertainty": 0.1
    }
    # start trust at 85
    res1 = trust_module.process(85, beliefs_benign)
    print(f"-> Prev: {res1['previous_trust']}, New: {res1['new_trust']}, Delta: {res1['delta']}")
    assert res1['new_trust'] > 85, "Trust should climb up"
    assert res1['delta'] > 0, "positive delta expected"

    # Case 2: Strong Decrease (Malicious)
    print("\n[Case 2] testing Strong Decrease (Malicious)...")
    beliefs_malicious = {
        "belief_malicious": 0.75,
        "belief_benign": 0.15,
        "uncertainty": 0.1
    }
    res2 = trust_module.process(85, beliefs_malicious)
    print(f"-> Prev: {res2['previous_trust']}, New: {res2['new_trust']}, Delta: {res2['delta']}")
    assert res2['new_trust'] < 70, "Trust should drop significantly"
    assert res2['delta'] < -15, "strong drop expected"

    # Case 3: Long Term Penalty (Low starting trust)
    print("\n[Case 3] testing Long Term Penalty Acceleration...")
    # repeating attack on ALREADY low trust node
    res3 = trust_module.process(40, beliefs_malicious) # starts at 40
    print(f"-> Prev: {res3['previous_trust']}, New: {res3['new_trust']}, Delta: {res3['delta']}")
    # Acceleration should make drop absolute steeper or proportional
    assert res3['delta'] < -25, "Accelerated drop expected for low trust node (multiplier triggered)"

    print("\n✅ Model Trust Learning verification Passed")

if __name__ == "__main__":
    try:
        test_model_trust()
        sys.exit(0)
    except AssertionError as e:
        print(f"\n❌ Verification Failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected Error: {e}")
        sys.exit(1)

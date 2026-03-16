import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from modules.model_dempster_shafer import ModelDempsterShaferFusion

def test_model_ds():
    print("--- Starting Model Dempster-Shafer Verification ---")
    
    fusion = ModelDempsterShaferFusion()

    # Case 1: Both Agree (Malicious)
    print("\n[Case 1] testing Agreement (Malicious)...")
    res1 = fusion.process(0.8, 0.7) # both high
    print(f"-> Malicious: {res1['belief_malicious']}, Benign: {res1['belief_benign']}, Decision: {res1['fused_decision']}")
    assert res1['belief_malicious'] > 0.7, "Should be high malicious belief"
    assert res1['fused_decision'] == "Malicious"

    # Case 2: Both Agree (Benign)
    print("\n[Case 2] testing Agreement (Benign)...")
    res2 = fusion.process(0.1, 0.15) # both low
    print(f"-> Malicious: {res2['belief_malicious']}, Benign: {res2['belief_benign']}, Decision: {res2['fused_decision']}")
    assert res2['belief_benign'] > 0.7, "Should be high benign belief"
    assert res2['fused_decision'] == "Benign"

    # Case 3: High Conflict (AE = 0.9, LSTM = 0.1)
    print("\n[Case 3] testing Conflict (AE=High, LSTM=Low)...")
    res3 = fusion.process(0.9, 0.1) 
    print(f"-> Malicious: {res3['belief_malicious']}, Benign: {res3['belief_benign']}, Uncertainty: {res3['uncertainty']}, K: {res3['conflict_k']}")
    assert res3['conflict_k'] > 0.4, "Should be high conflict"
    # In conflict, uncertainty might increase or decision becomes Uncertain
    print(f"-> Decision: {res3['fused_decision']}")

    print("\n✅ Model Dempster-Shafer verification Passed")

if __name__ == "__main__":
    try:
        test_model_ds()
        sys.exit(0)
    except AssertionError as e:
        print(f"\n❌ Verification Failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected Error: {e}")
        sys.exit(1)

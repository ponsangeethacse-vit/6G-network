from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
import math
import os
import numpy as np

# ---------------------------------------------------------
# Step 6: MODEL EXPORT / LOADING
# ---------------------------------------------------------
# Show how to load the Keras .h5 models in FastAPI. 
# We use a try-except block so the API still runs if TensorFlow isn't natively available on this OS version.
try:
    from tensorflow.keras.models import load_model
    import pickle
    import json
    
    # Load MinMaxScaler
    scaler_path = os.path.join("data", "scaler.pkl")
    with open(scaler_path, "rb") as f:
        scaler = pickle.load(f)
        
    # Load Models
    autoencoder_model = load_model(os.path.join("data", "autoencoder.h5"))
    lstm_model = load_model(os.path.join("data", "lstm_model.h5"))
    
    # Load Threshold
    with open(os.path.join("data", "autoencoder_threshold.json"), "r") as f:
        ae_threshold = json.load(f)["threshold"]
        
    TF_AVAILABLE = True
    print("✅ TensorFlow Models Loaded Successfully!")
except Exception as e:
    print(f"⚠️ Warning: Could not load TF models locally ({e}). Using rule-based fallback mode for pipeline testing.")
    TF_AVAILABLE = False

from modules.physical_auth import PhysicalAuth
from modules.autoencoder_anomaly import AutoencoderAnomaly
from modules.lstm_temporal import LSTMTemporalDetector
from modules.dempster_shafer import DempsterShaferFusion
from modules.trust_learning import TrustLearning
from modules.federated_aggregator import FederatedAggregator
from modules.model_autoencoder import ModelAutoencoderAnomaly
from modules.model_lstm import ModelLSTMAttackDetector
from modules.model_dempster_shafer import ModelDempsterShaferFusion
from modules.model_trust_learning import ModelTrustLearning

app = FastAPI(title="Advanced 5G TrustGuard AI Microservice", description="Refactored Secure Federated Learning Workflow")

# ─── Initialize Modules ────────────────────────────────────────────────────────
phys_auth = PhysicalAuth()
autoencoder = AutoencoderAnomaly()
lstm_detector = LSTMTemporalDetector()
ds_fusion = DempsterShaferFusion()
trust_learning = TrustLearning()
fed_aggregator = FederatedAggregator()
model_autoencoder = ModelAutoencoderAnomaly()
model_lstm = ModelLSTMAttackDetector()
model_ds_fusion = ModelDempsterShaferFusion()
model_trust = ModelTrustLearning()

# ─── Pydantic Models for Validation ───────────────────────────────────────────
class AttackMetrics(BaseModel):
    packet_rate: float
    latency: float
    failed_requests: int
    connection_attempts: int
    bandwidth_usage: float
    authentication_failures: int
    channel_quality: float = 1.0 # Added for Stage 1

class DatasetMetrics(BaseModel):
    packet_rate: float
    latency: float
    bandwidth: float
    failed_requests: int

class PipelineRequest(BaseModel):
    node_address: str
    current_trust: float
    metrics: dict
    history: list = [] # For LSTM temporal dimension

class TrustMetrics(BaseModel):
    behavioral_trust: float
    historical_trust: float
    reputation_trust: float
    context_trust: float

class ModelUpdateMetrics(BaseModel):
    gradient_magnitude: float
    loss_change: float
    update_variance: float
    parameter_drift: float

class TemporalAnomalyRequest(BaseModel):
    current: dict
    history: list = []

class FusionRequest(BaseModel):
    anomaly_score: float
    temporal_attack_probability: float

class TrustUpdateRequest(BaseModel):
    previous_trust_score: float
    belief_malicious: float
    belief_benign: float
    uncertainty: float

# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "Advanced-5G-AI-Microservice", "pipeline": "Refactored"}

@app.post("/pipeline/process")
def process_pipeline(req: PipelineRequest):
    """
    Main orchestrator executing the Secure Federated Learning Processing stages.
    Stages 1, 2, 3, 4, 5, 7.
    """
    try:
        metrics = req.metrics
        history = req.history
        current_trust = req.current_trust

        # 1. Physical Layer Authentication
        auth_res = phys_auth.process(metrics)
        
        # 2. Autoencoder Pattern Anomaly
        ae_res = autoencoder.process(metrics)
        
        # 3. LSTM Temporal Attack Detection
        lstm_res = lstm_detector.process(metrics, history)
        
        # 4. Dempster–Shafer Evidence Fusion
        fused_res = ds_fusion.process(ae_res, lstm_res)
        
        # 5. Trust-by-Learning Update
        trust_res = trust_learning.process(current_trust, fused_res, auth_res)

        # 6. Blockchain Smart Contract Enforcement
        # Handled by the backend after AI response (Enforcement)
        blockchain_trigger = {
            "require_log": True,
            "require_revoke": not auth_res.get("success") or fused_res.get("is_anomalous"),
            "action_type": "AccessRevoked" if (not auth_res.get("success") or fused_res.get("is_anomalous")) else "TrustUpdated"
        }

        # 7. Secure Federated Model Aggregation
        agg_res = fed_aggregator.process(req.node_address, [])

        return {
            "node_address": req.node_address,
            "pipeline_stages": [
                auth_res,
                ae_res,
                lstm_res,
                fused_res,
                trust_res,
                {"stage": "Blockchain Enforcement Token", "action": blockchain_trigger["action_type"]},
                agg_res
            ],
            "final_trust_score": trust_res.get("new_trust"),
            "is_anomalous": blockchain_trigger["require_revoke"],
            "classification": "Attack Detected" if blockchain_trigger["require_revoke"] else "Normal"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline orchestrator error: {str(e)}")

@app.post("/detect-pattern-anomaly")
def detect_pattern_anomaly(metrics: ModelUpdateMetrics):
    try:
        res = model_autoencoder.process(metrics.dict())
        return {
            "anomaly_score": res["anomaly_score"],
            "detected": res["detected"],
            "details": res["details"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Anomaly detection error: {str(e)}")

@app.post("/detect-temporal-attack")
def detect_temporal_attack(req: TemporalAnomalyRequest):
    try:
        res = model_lstm.process(req.current, req.history)
        return {
            "temporal_attack_probability": res["temporal_attack_probability"],
            "detected": res["detected"],
            "details": res["details"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Temporal analysis error: {str(e)}")

@app.post("/fuse-security-evidence")
def fuse_security_evidence(req: FusionRequest):
    try:
        res = model_ds_fusion.process(req.anomaly_score, req.temporal_attack_probability)
        return {
            "belief_malicious": res["belief_malicious"],
            "belief_benign": res["belief_benign"],
            "uncertainty": res["uncertainty"],
            "conflict_k": res["conflict_k"],
            "decision": res["fused_decision"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evidence fusion error: {str(e)}")

@app.post("/update-trust-score")
def update_trust_score(req: TrustUpdateRequest):
    try:
        beliefs = {
            "belief_malicious": req.belief_malicious,
            "belief_benign": req.belief_benign,
            "uncertainty": req.uncertainty
        }
        res = model_trust.process(req.previous_trust_score, beliefs)
        return {
            "new_trust_score": res["new_trust"],
            "delta": res["delta"],
            "classification": res["classification"],
            "details": res["details"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Trust update error: {str(e)}")

# Keep previous endpoints for safe backwards compatibility during transition
@app.post("/predict-attack")
def predict_attack(metrics: AttackMetrics):
    if metrics.failed_requests > 30 or metrics.packet_rate > 800:
        return {"classification": "DDoS", "risk_score": 85.0}
    return {"classification": "Normal", "risk_score": 10.0}

@app.post("/predict-anomaly")
def predict_anomaly(metrics: DatasetMetrics):
    """
    Step 7: Implements the exact format defined in Step 3.
    """
    # Convert input to array format for ML
    raw_data = np.array([[metrics.packet_rate, metrics.latency, metrics.bandwidth, metrics.failed_requests]])
    
    if TF_AVAILABLE:
        # Scale data using our saved MinMaxScaler
        scaled_data = scaler.transform(raw_data)
        
        # 1. Autoencoder Anomaly Detection (Reconstruction Error)
        reconstruction = autoencoder_model.predict(scaled_data)
        reconstruction_error = np.mean(np.abs(reconstruction - scaled_data))
        
        # Calculate anomaly score (0.0 - 1.0)
        # Scaled dynamically: if exactly at threshold it's 0.5. Maxes at 1.0.
        ae_score = min(1.0, reconstruction_error / (ae_threshold * 2))
        
        # 2. LSTM (Simulating a single sequence frame for simplicity in stateless API)
        # In reality you'd gather the last 5 HTTP requests associated with this IP.
        seq_data = np.repeat(scaled_data, 5, axis=0).reshape(1, 5, 4)
        lstm_attack_prob = float(lstm_model.predict(seq_data)[0][0])
        
    else:
        # Graceful fallback so your Node.js backend integration continues working!
        # Simulation rule matching general Keras outputs:
        ae_score = 0.05
        lstm_attack_prob = 0.02
        
        if metrics.failed_requests > 20 or metrics.packet_rate > 1000:
            ae_score = 0.85
            lstm_attack_prob = 0.90
    
    classification = "Anomaly (DDoS)" if ae_score > 0.5 or lstm_attack_prob > 0.6 else "Normal"
    
    return {
        "autoencoder_anomaly_score": round(ae_score, 4),
        "lstm_temporal_probability": round(lstm_attack_prob, 4),
        "overall_classification": classification
    }

@app.post("/calculate-trust")
def calculate_trust(metrics: dict):
    # Step 7: A flexible Trust score based on ML anomaly output
    ae_score = float(metrics.get("autoencoder_anomaly_score", 0.0))
    lstm_prob = float(metrics.get("lstm_temporal_probability", 0.0))
    
    # High anomaly = low trust
    max_risk = max(ae_score, lstm_prob)
    trust_score = 100.0 - (max_risk * 100)
    
    return {
        "fusion_trust_score": round(trust_score, 2),
        "classification": "Trusted" if trust_score > 70 else "Suspicious" if trust_score > 40 else "Malicious"
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)


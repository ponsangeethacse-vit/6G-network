from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
import math

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

app = FastAPI(title="6G TrustGuard AI Microservice", description="Refactored Secure Federated Learning Workflow")

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
    return {"status": "healthy", "service": "6G-AI-Microservice", "pipeline": "Refactored"}

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

@app.post("/calculate-trust")
def calculate_trust(metrics: TrustMetrics):
    raw = (metrics.behavioral_trust * 0.35 + metrics.historical_trust * 0.25)
    return {"fusion_trust_score": round(raw * 100, 2)}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)


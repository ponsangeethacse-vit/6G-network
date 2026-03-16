import math

class AutoencoderAnomaly:
    def __init__(self, reconstruction_threshold=0.65):
        self.reconstruction_threshold = reconstruction_threshold
        # Simulated weights for output dimension scaling
        self.input_weights = {
            "packet_rate": 0.4,
            "latency": 0.3,
            "bandwidth_usage": 0.3
        }

    def process(self, metrics: dict) -> dict:
        """
        Stage 2: Autoencoder Pattern Anomaly Detection
        Computes reconstruction error (loss). Higher loss = anomalous traffic vector.
        """
        packet_rate = metrics.get("packet_rate", 0)
        latency = metrics.get("latency", 0)
        bandwidth = metrics.get("bandwidth", 0)

        # Normalize or fit into proxy dense activations
        # DDoS footprint raises packet_rate and latency
        norm_packet = min(1.0, packet_rate / 1000.0)
        norm_latency = min(1.0, latency / 500.0)
        norm_band = min(1.0, bandwidth / 100000.0)

        # Simulated reconstruction error
        # Normal profile vector expected around [0.1, 0.1, 0.1]
        reconstruction_loss = (norm_packet * self.input_weights["packet_rate"] + 
                              norm_latency * self.input_weights["latency"] + 
                              norm_band * self.input_weights["bandwidth_usage"])

        detected = reconstruction_loss > self.reconstruction_threshold
        confidence = max(0.0, min(1.0, reconstruction_loss))

        return {
            "stage": "Autoencoder Anomaly",
            "detected": detected,
            "loss": round(reconstruction_loss, 4),
            "confidence": round(confidence, 2),
            "details": "Pattern Anomaly Detected" if detected else "Nominal Traffic Profile"
        }

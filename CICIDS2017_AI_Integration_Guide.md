# 6G TrustGuard - CICIDS2017 AI Integration Guide

## Overview
This document explains how we transformed the `6G-TrustGuard` network simulation from relying on random mathematical generation into a **data-driven Artificial Intelligence pipeline** powered by the industry-standard **CICIDS2017 DDoS Dataset**.

Our goal was production-level anomaly detection: taking raw network traffic, passing it through specialized deep learning models (Autoencoder and LSTM), and using the output to dynamically enforce Node trust dynamically in MongoDB and the Blockchain.

---

## 1. Data Understanding & Preprocessing
The CICIDS2017 dataset generates over 78 features describing network flow. To map this into a 6G node structure without overwhelming the system, we extracted the 4 most critical features representing node density and network health:
1. **Packet Rate (`Flow Packets/s`)**: Identifies high-velocity flooding (DDoS).
2. **Latency (`Flow IAT Mean`)**: Represents the time between packets, detecting congestion.
3. **Bandwidth (`Flow Bytes/s`)**: Identifies massive payload anomalies.
4. **Failed Requests (`RST Flag Count`)**: Identifies broken connection attempts or port scanning.

We automatically cleaned this data (`preprocess_dataset.py`) by dropping missing/infinite values, capping the top 1% outliers (so normal traffic didn't flatline during scaling), and fitted an intelligent `MinMaxScaler` that converts all values proportionally between `0.0` and `1.0`.

---

## 2. Advanced AI Modeling
We utilize an ensemble of two Deep Learning patterns to secure the network. Both are coded in raw TensorFlow/Keras (`train_autoencoder.py` & `train_lstm.py`).

### 🧠 Pattern A: Autoencoder (Reconstruction Error)
An Autoencoder's goal is to effectively compress an input down to a dense bottleneck, and then rebuild it.
- **Why?** We explicitly trained this model *only* on **BENIGN (Normal)** traffic.
- **How it Detects Attacks:** When anomalous DDoS traffic arrives, the model scrambles it because it’s never seen those patterns before. The mathematical difference between the incoming packet and the scrambled output is called the **Reconstruction Error**. If the error exceeds the established normal threshold (99th percentile), an attack is flagged.

### ⏳ Pattern B: LSTM (Temporal Detection)
While the Autoencoder is great at catching single huge spikes, clever "Slow-Drop" or "Sybil" attacks slowly ruin a network over time without triggering instantaneous spikes. 
- **The Concept:** An LSTM looks at sequences across *time*.
- **Implementation:** We transformed the CSV tabular traffic into a 3D sequence array (`Sequence Length = 5`). The LSTM doesn't just read `[Time T]`. It reads `[T-4, T-3, T-2, T-1, T]`.
- **Result:** It can perceive the escalating momentum of an attack before it reaches maximum bandwidth, outputting a precise 0.0 to 1.0 probability score.

---

## 3. High-Performance API Integration (FastAPI)
Rather than executing raw Python scripts from Node.js (which is very slow), we established a lightweight Microservice pattern via `main.py` using **FastAPI** to bridge native Python AI to the Node backend.

It provides two core endpoints replacing the older manual calculation rules:
* **`/predict-anomaly`**: Consumes exact traffic metrics, passes them into the pre-loaded `.h5` Keras models, and determines the network anomaly state.
* **`/calculate-trust`**: Synthesizes the exact threat levels from the Autoencoder and LSTM models to scale a final dynamic Trust Score naturally from 0 to 100.

---

## 4. End-to-End Simulation Pipeline
The backend is now completely data-driven. Within `simulator.service.ts`, instead of invoking `Math.random()` to generate node metrics, the system actively streams rows directly from our newly prepared `processed_dataset.csv`.

*The E2E lifecycle looks like this:*
1. **Node Simulation Loop:** 6G simulator reads actual packets/sec from CSV.
2. **Fetch Request:** NodeJS natively POSTs the payload to python via `fetch`.
3. **Inference Execution:** Autoencoder identifies instantaneous mismatch -> LSTM identifies sequence pattern momentum -> Fusion returns a `72 Trust Score`.
4. **Database Sink:** `nodeService.updateNode()` immediately logs this Trust Score securely into the remote MongoDB for persistence mapping instead of keeping it completely ephemeral!
5. **Dashboard Emitting:** Sends the visual change via WebSocket.

---
### 🎉 Summary
You have completely refactored a functional prototype into a modern, data-driven security system mimicking real production Enterprise architectures utilizing separated AI Microservices!

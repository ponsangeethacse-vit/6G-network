# 6G TrustGuard: Project Documentation

## 1. Executive Summary
**6G TrustGuard** is a comprehensive, full-stack trust management and anomaly detection system tailored for next-generation **6G Networks**. 
As 6G introduces extreme decentralization, ultra-dense node deployments, and heterogeneous environments, maintaining a **Zero-Trust architecture** becomes critical.

This system monitors network nodes in real-time, computes a **Fusion Trust Score** using a **Python AI Microservice**, and logs all critical trust metrics onto an **Immutable Blockchain Ledger** (Ethereum/Solidity). It simulates network attacks (e.g., DDoS, Sybil) and demonstrates how trust-based isolation can quarantine malicious nodes autonomously.

---

## 2. System Architecture

The project is structured into three distinct layers:

### 🔬 **A. Backend (Control Layer)**
- **Runtime**: Node.js & Express.
- **WebSocket Gateway**: `Socket.io` enables true real-time synchronization, piping node states to the 3D frontend canvas every 2-3 seconds.
- **Service Integration**: Calls the Python AI service via REST API for anomaly detection and scoring.
- **Database**: MongoDB for historical logging and visual caching of nodes.

### 🧠 **B. AI Microservice (Python)**
- **Framework**: FastAPI (Uvicorn).
- **Endpoints**:
  - **`POST /predict-attack`**: Classifies node traffic into Normal, DDoS, or Sybil.
  - **`POST /calculate-trust`**: Computes weighted **Fusion Trust Score** from Direct, Historical, Reputation, and Context vectors.

### 🌐 **B. Frontend (Visualization & Monitoring)**
- **Framework**: React 18 (built with Vite for speed).
- **3D Visualizer**: **Three.js / React Three Fiber**
  - Displays nodes as a 3D mesh network topology.
  - Nodes change colors dynamically (Green = Trusted, Red = Anomalous/Blocked).
- **Analytics**: **Recharts** charts map trust decay over time, historical trends, and bandwidth/latency metrics.
- **Web3 Interface**: Connection hooks ready for wallet integrations (e.g., MetaMask) to sign anomaly reports.

### ⛓️ **C. Blockchain (Security & Ledger)**
- **Framework**: Hardhat (Solidity `^0.8.28`).
- **Smart Contracts**:
  1. **`NodeRegistry.sol`**: Records legal node profile addresses and roles (`DataRequester`, `ServiceProvider`, `Communicator`).
  2. **`TrustLedger.sol`**: The active scoring grid.
     - Logs `fusionTrustScore` immutably.
     - **Auto-Revocation Logic**: If the backend pushes a trust score below the **Anomaly Threshold** (default: 60), the contract automatically emits an `AccessRevoked` event and flags the node as blocked.

---

## 3. Core Algorithms & Logic

### 📐 **Multi-Factor Trust Fusion**
1. **Direct Trust**: Speed/Latency calculations weighted against Success/Failure interaction logs.
2. **Indirect Trust**: Aggregates average periodic feedbacks scored by neighboring peers.
3. **Fusion (Python AI)**: Instead of basic averages, the system forwards vectors to the FastAPI service applying weighted grading to outputs.

---

## 4. Key Features & Simulation

| Feature | Description |
| :--- | :--- |
| **3D Live Mesh Topology** | Real-time viz of 100+ simulated wireless nodes communicating together. |
| **Live Attack Injection** | Allows dashboard triggers for **DDoS** or **Sybil** storms to test defense latency. |
| **Trust Ledger Explorer** | Custom UI node showing live blocks indexing on-chain node state locks. |
| **Dynamic Role assignment** | Handles shifting authorization states (Unknown vs Authorized routers). |

---

## 5. Application in Fields

The principles designed into **6G TrustGuard** extend to several high-value sectors:

1. **6G/5G Telecommunications**: Protecting Open-RAN (Radio Access Network) infrastructures and edge computing slicing from hijacking.
2. **IoT & Smart Cities**: Managing safe routing protocols across millions of self-moving sensors (e.g., Connected Autonomous Vehicles).
3. **Decentralized Energy Grids**: Filtering fake signals in decentralized microgrid trading systems.
4. **Defense & Swarm Robotics**: Hardening communication links against spoofing in heavy interference zones.

---

## 6. Technical Stack Checklist

- **Frontend**: `React 18`, `Typescript`, `Vite`, `Three.js`, `Charts.js / Recharts`, `Axios`.
- **Backend**: `Node.js`, `Express`, `Socket.io`, `Ethers.js (v6)`.
- **AI Microservice**: `Python 3.10+`, `FastAPI`, `Uvicorn`, `Pydantic`.
- **Blockchain**: `Solidity`, `Hardhat`, `EtherJS` interaction nodes.

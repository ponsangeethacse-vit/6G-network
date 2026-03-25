# Advanced 5G TrustGuard - Full Stack Trust Management System

A real-time, blockchain-powered trust management and attack detection system for Advanced 5G networks.

## Architecture
- **Frontend**: React 18, Vite, Three.js (3D Visualization), Web3.js, Recharts, Tailwind CSS.
- **Backend**: Node.js, Express, Socket.io, MongoDB, Ethers.js.
- **Blockchain**: Simulated Ethereum Proof-of-Trust (PoT) consensus.

## Prerequisites
- Node.js (v20+)
- MongoDB (Running locally on default port 27017 or update `.env`)
- MetaMask (Optional, for Web3 features)

## Installation

### 1. Backend Setup
```bash
cd backend
npm install
npm run dev
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## Features
- **3D Network Mesh**: Live visualization of 100+ nodes using Three.js.
- **Zero-Trust Engine**: Multi-factor trust calculation updated every 3s via WebSockets.
- **Attack Simulation**: Trigger DDoS/Sybil attacks and watch the system isolate nodes in real-time.
- **Trust Ledger**: A simulated blockchain explorer recording every trust update.
- **Web3 Integration**: Connect wallet to sign reports (simulated).

## Advanced 5G Trust Formula
`trustScore = 0.4 * commTrust + 0.3 * transTrust + 0.3 * behaviorTrust`

## License
MIT

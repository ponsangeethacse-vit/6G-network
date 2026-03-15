// ─── Smart Contract ABIs ────────────────────────────────────────────────────
// These ABIs must match the deployed Solidity contracts exactly.
// Regenerate from: npx hardhat compile → artifacts/contracts/...

// ── NodeRegistry.sol ─────────────────────────────────────────────────────────
export const NODE_REGISTRY_ABI = [
  // Write functions
  {
    "type": "function", "name": "registerNode",
    "inputs": [{ "name": "_node", "type": "address" }, { "name": "_role", "type": "uint8" }],
    "outputs": [], "stateMutability": "nonpayable"
  },
  {
    "type": "function", "name": "updateRole",
    "inputs": [{ "name": "_node", "type": "address" }, { "name": "_newRole", "type": "uint8" }],
    "outputs": [], "stateMutability": "nonpayable"
  },
  {
    "type": "function", "name": "recordInteraction",
    "inputs": [{ "name": "_node", "type": "address" }],
    "outputs": [], "stateMutability": "nonpayable"
  },
  // Read functions
  {
    "type": "function", "name": "getNodeRole",
    "inputs": [{ "name": "_node", "type": "address" }],
    "outputs": [{ "name": "", "type": "uint8" }],
    "stateMutability": "view"
  },
  {
    "type": "function", "name": "isNodeRegistered",
    "inputs": [{ "name": "_node", "type": "address" }],
    "outputs": [{ "name": "", "type": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function", "name": "getRegisteredNodesCount",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view"
  },
  // Events
  {
    "type": "event", "name": "NodeRegistered",
    "inputs": [
      { "name": "node",  "type": "address", "indexed": true },
      { "name": "role",  "type": "uint8",   "indexed": false }
    ]
  },
  {
    "type": "event", "name": "RoleUpdated",
    "inputs": [
      { "name": "node",    "type": "address", "indexed": true },
      { "name": "newRole", "type": "uint8",   "indexed": false }
    ]
  },
] as const;

// ── TrustLedger.sol ──────────────────────────────────────────────────────────
export const TRUST_LEDGER_ABI = [
  // Write functions
  {
    "type": "function", "name": "updateTrustScore",
    "inputs": [
      { "name": "_node",     "type": "address" },
      { "name": "_newScore", "type": "uint256" }
    ],
    "outputs": [], "stateMutability": "nonpayable"
  },
  {
    "type": "function", "name": "reportAnomaly",
    "inputs": [
      { "name": "_node",   "type": "address" },
      { "name": "_reason", "type": "string"  }
    ],
    "outputs": [], "stateMutability": "nonpayable"
  },
  {
    "type": "function", "name": "setAnomalyThreshold",
    "inputs": [{ "name": "_newThreshold", "type": "uint256" }],
    "outputs": [], "stateMutability": "nonpayable"
  },
  // Read functions
  {
    "type": "function", "name": "getTrustScore",
    "inputs": [{ "name": "_node", "type": "address" }],
    "outputs": [
      { "name": "score",       "type": "uint256" },
      { "name": "lastUpdated", "type": "uint256" },
      { "name": "isBlocked",   "type": "bool"    }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function", "name": "isNodeBlocked",
    "inputs": [{ "name": "_node", "type": "address" }],
    "outputs": [{ "name": "", "type": "bool" }],
    "stateMutability": "view"
  },
  // Events — these drive the attack detection and the TX log
  {
    "type": "event", "name": "TrustUpdated",
    "inputs": [
      { "name": "node",     "type": "address", "indexed": true  },
      { "name": "newScore", "type": "uint256", "indexed": false }
    ]
  },
  {
    "type": "event", "name": "AnomalyReported",
    "inputs": [
      { "name": "node",   "type": "address", "indexed": true  },
      { "name": "reason", "type": "string",  "indexed": false },
      { "name": "score",  "type": "uint256", "indexed": false }
    ]
  },
  {
    "type": "event", "name": "AccessRevoked",
    "inputs": [{ "name": "node", "type": "address", "indexed": true }]
  },
  {
    "type": "event", "name": "AccessRestored",
    "inputs": [{ "name": "node", "type": "address", "indexed": true }]
  },
] as const;

// ─── Web3 / Blockchain Configuration ─────────────────────────────────────────
// Edit these values to match your deployment environment.

export const WEB3_CONFIG = {
  // ── Connection Providers ────────────────────────────────────────────────────
  providers: {
    // Local Ganache node (default port 7545)
    ganache: 'http://127.0.0.1:7545',
    // Local Hardhat node (default port 8545)
    hardhat: 'http://127.0.0.1:8545',
    // Infura / Alchemy mainnet or testnet (replace with your project ID)
    infura:  'https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID',
  },

  // ── Active provider: 'metamask' | 'ganache' | 'hardhat' | 'infura' ──────────
  activeProvider: 'metamask' as 'metamask' | 'ganache' | 'hardhat' | 'infura',

  // ── Network chain IDs ────────────────────────────────────────────────────────
  chainIds: {
    ganache:    1337,
    hardhat:    31337,
    sepolia:    11155111,
    mainnet:    1,
  },

  // ── Smart Contract Addresses ─────────────────────────────────────────────────
  // Replace with your deployed contract addresses after running:
  //   npx hardhat run scripts/deploy.js --network localhost
  contracts: {
    NodeRegistry: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    TrustLedger:  '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  },

  // ── Default gas settings ─────────────────────────────────────────────────────
  gas: {
    limit: 300000,
    price: '20000000000', // 20 Gwei in wei
  },

  // ── Event polling interval (milliseconds) ────────────────────────────────────
  eventPollInterval: 5000,

  // ── How many past blocks to scan for past events ─────────────────────────────
  pastEventBlockRange: 1000,
} as const;

export type Web3Config = typeof WEB3_CONFIG;

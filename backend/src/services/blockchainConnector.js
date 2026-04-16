const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

class BlockchainConnector {
    constructor() {
        this.provider = null;
        this.wallet = null;
        this.nodeRegistryContract = null;
        this.trustLedgerContract = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            // Check if the blockchain node is actually online to prevent Ethers.js spam
            try {
                await fetch('http://127.0.0.1:8545', { method: 'POST' });
            } catch (e) {
                console.warn('[BlockchainConnector] ⚠️ Local Hardhat node offline on :8545. Running in mock mode.');
                this.initialized = true;
                return;
            }

            // Hardhat default node URL
            this.provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545', undefined, { staticNetwork: true });

            // Default account 0 from Hardhat node
            this.wallet = new ethers.Wallet(
                '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
                this.provider
            );

            const configPath = path.join(__dirname, '../config/contractAddresses.json');
            if (!fs.existsSync(configPath)) {
                console.warn(`[BlockchainConnector] Contract addresses not found at ${configPath}.`);
                return; // Graceful degradation or mock mode
            }

            const { NodeRegistry, TrustLedger } = JSON.parse(fs.readFileSync(configPath, 'utf8'));

            const nodeRegistryAbi = [
                "function registerNode(address _node, uint8 _role) external",
                "function updateRole(address _node, uint8 _newRole) external",
                "function recordInteraction(address _node) external",
                "function getNodeRole(address _node) external view returns (uint8)",
                "function isNodeRegistered(address _node) external view returns (bool)",
                "function getRegisteredNodesCount() external view returns (uint256)"
            ];

            const trustLedgerAbi = [
                "function updateTrustScore(address _node, uint256 _newScore, string calldata _attackType) external",
                "function processModelUpdate(address _node, uint256 _trustScore) external",
                "function reportAnomaly(address _node, string calldata _reason) external",
                "function setAnomalyThreshold(uint256 _newThreshold) external",
                "function getTrustScore(address _node) external view returns (uint256, uint256, bool)",
                "function isNodeBlocked(address _node) external view returns (bool)",
                "function logTransfer(address _sender, address _receiver, string calldata _details, uint256 _trustUpdate) external",
                "event TrustUpdated(address indexed node, uint256 newScore)",
                "event AnomalyReported(address indexed node, string reason, uint256 score)",
                "event AccessRevoked(address indexed node)",
                "event AccessRestored(address indexed node)"
            ];

            this.nodeRegistryContract = new ethers.Contract(NodeRegistry, nodeRegistryAbi, this.wallet);
            this.trustLedgerContract = new ethers.Contract(TrustLedger, trustLedgerAbi, this.wallet);

            this.initialized = true;
            console.log('[BlockchainConnector] Connected to local Hardhat node.');
        } catch (err) {
            console.warn('[BlockchainConnector] Initialisation failed:', err.message);
        }
    }

    async registerNode(address, role = 1) { // 1 = DataRequester or default
        await this.initialize();
        if (!this.nodeRegistryContract) return { success: false, message: "Contract not connected" };

        try {
            const tx = await this.nodeRegistryContract.registerNode(address, role);
            await tx.wait();
            return { success: true, txHash: tx.hash };
        } catch (err) {
            console.error('[BlockchainConnector] registerNode error:', err.message);
            return { success: false, error: err.message };
        }
    }

    async updateTrustScore(address, score, attackType = "Normal Update") {
        await this.initialize();
        if (!this.trustLedgerContract) return { success: false, message: "Contract not connected" };

        try {
            const scaledScore = Math.round(score * 100); // 0.85 -> 85
            const tx = await this.trustLedgerContract.updateTrustScore(address, Math.min(100, scaledScore), attackType);
            await tx.wait();
            return { success: true, txHash: tx.hash };
        } catch (err) {
            console.error('[BlockchainConnector] updateTrustScore error:', err.message);
            return { success: false, error: err.message };
        }
    }

    async processModelUpdate(address, score) {
        await this.initialize();
        if (!this.trustLedgerContract) return { success: false, message: "Contract not connected" };

        try {
            const scaledScore = Math.round(score * 100); 
            const tx = await this.trustLedgerContract.processModelUpdate(address, Math.min(100, scaledScore));
            await tx.wait();
            return { success: true, txHash: tx.hash };
        } catch (err) {
            console.error('[BlockchainConnector] processModelUpdate error:', err.message);
            return { success: false, error: err.message };
        }
    }

    async logTransfer(sender, receiver, details, trustUpdate) {
        await this.initialize();
        if (!this.trustLedgerContract) return { success: false, message: "Contract not connected" };

        try {
            // trustUpdate can be scaled as well if needed, or just 0/1 depending on logic
            const tx = await this.trustLedgerContract.logTransfer(sender, receiver, details, trustUpdate);
            await tx.wait();
            return { success: true, txHash: tx.hash };
        } catch (err) {
            console.error('[BlockchainConnector] logTransfer error:', err.message);
            return { success: false, error: err.message };
        }
    }
}

module.exports = new BlockchainConnector();

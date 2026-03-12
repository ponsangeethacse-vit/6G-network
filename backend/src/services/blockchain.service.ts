import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

export class BlockchainService {
  private provider!: ethers.JsonRpcProvider;
  private wallet!: ethers.Wallet;
  
  public nodeRegistryContract!: ethers.Contract;
  public trustLedgerContract!: ethers.Contract;

  async initialize() {
    this.provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    
    // Default account 0 from Hardhat node
    this.wallet = new ethers.Wallet(
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      this.provider
    );

    const configPath = path.join(__dirname, '../config/contractAddresses.json');
    if (!fs.existsSync(configPath)) {
      throw new Error(`Contract addresses not found at ${configPath}. Ensure contracts are deployed.`);
    }

    const { NodeRegistry, TrustLedger } = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // Temporary basic generic ABI while we rely on TypeScript typing and actual ABI generation
    const nodeRegistryAbi = [
      "function registerNode(address _node, uint8 _role) external",
      "function updateRole(address _node, uint8 _newRole) external",
      "function recordInteraction(address _node) external",
      "function getNodeRole(address _node) external view returns (uint8)",
      "function isNodeRegistered(address _node) external view returns (bool)",
      "function getRegisteredNodesCount() external view returns (uint256)"
    ];

    const trustLedgerAbi = [
      "function updateTrustScore(address _node, uint256 _newScore) external",
      "function reportAnomaly(address _node, string calldata _reason) external",
      "function setAnomalyThreshold(uint256 _newThreshold) external",
      "function getTrustScore(address _node) external view returns (uint256, uint256, bool)",
      "function isNodeBlocked(address _node) external view returns (bool)",
      "event TrustUpdated(address indexed node, uint256 newScore)",
      "event AnomalyReported(address indexed node, string reason, uint256 score)",
      "event AccessRevoked(address indexed node)",
      "event AccessRestored(address indexed node)"
    ];

    this.nodeRegistryContract = new ethers.Contract(NodeRegistry, nodeRegistryAbi, this.wallet);
    this.trustLedgerContract = new ethers.Contract(TrustLedger, trustLedgerAbi, this.wallet);

    console.log('Blockchain service connected to local Hardhat node.');
    console.log('NodeRegistry:', NodeRegistry);
    console.log('TrustLedger:', TrustLedger);
  }
}

export const blockchainService = new BlockchainService();

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./NodeRegistry.sol";

contract TrustLedger {
    NodeRegistry public registry;
    address public owner;

    struct TrustData {
        uint256 fusionTrustScore; // Scaled by 100, so 60 = 0.60
        uint256 lastUpdated;
        bool isBlocked;
    }

    struct TrustRecord {
        address nodeId;
        uint256 fusionTrustScore;
        string attackType;
        uint256 timestamp;
        bool isBlocked;
    }

    struct TransferRecord {
        address sender;
        address receiver;
        string details;
        uint256 trustUpdate;
        uint256 timestamp;
    }

    struct ModelUpdateRecord {
        address nodeId;
        uint256 trustScore;
        string decision;
        uint256 timestamp;
    }

    mapping(address => TrustData) public trustScores;
    mapping(address => TrustRecord[]) public trustHistory;
    mapping(address => ModelUpdateRecord[]) public modelUpdateHistory;
    TransferRecord[] public globalTransfers;
    
    event TransferLogged(address indexed sender, address indexed receiver, string details, uint256 trustUpdate);
    
    uint256 public anomalyThreshold = 60; // < 0.6 is suspicious

    event ModelUpdateAccepted(address indexed node, uint256 score);
    event ModelUpdateRejected(address indexed node, uint256 score, string reason);

    event TrustUpdated(address indexed node, uint256 newScore);
    event AnomalyReported(address indexed node, string reason, uint256 score);
    event AttackDetected(address indexed node, string attackType, uint256 score);
    event AccessRevoked(address indexed node);
    event AccessRestored(address indexed node);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    constructor(address _registryAddress) {
        owner = msg.sender;
        registry = NodeRegistry(_registryAddress);
    }

    function processModelUpdate(address _node, uint256 _trustScore) external onlyOwner {
        require(registry.isNodeRegistered(_node), "Node is not registered in Registry");
        require(!trustScores[_node].isBlocked, "Node is blacklisted");
        require(_trustScore <= 100, "Score must be <= 100");

        string memory decision;
        if (_trustScore >= anomalyThreshold) {
            decision = "Accepted";
            emit ModelUpdateAccepted(_node, _trustScore);
        } else {
            decision = "Rejected";
            emit ModelUpdateRejected(_node, _trustScore, "Trust score below threshold");
            
            // Blacklist node
            trustScores[_node].isBlocked = true;
            emit AccessRevoked(_node);
            emit AttackDetected(_node, "Malicious Model Update", _trustScore);
        }

        // Store only security metadata
        modelUpdateHistory[_node].push(ModelUpdateRecord({
            nodeId: _node,
            trustScore: _trustScore,
            decision: decision,
            timestamp: block.timestamp
        }));
        
        // Update general trust scale too for compatibility
        trustScores[_node].fusionTrustScore = _trustScore;
        trustScores[_node].lastUpdated = block.timestamp;
    }

    function updateTrustScore(address _node, uint256 _newScore, string calldata _attackType) external onlyOwner {
        require(registry.isNodeRegistered(_node), "Node is not registered in Registry");
        require(_newScore <= 100, "Score must be <= 100");

        trustScores[_node].fusionTrustScore = _newScore;
        trustScores[_node].lastUpdated = block.timestamp;

        // Record history
        trustHistory[_node].push(TrustRecord({
            nodeId: _node,
            fusionTrustScore: _newScore,
            attackType: _attackType,
            timestamp: block.timestamp,
            isBlocked: trustScores[_node].isBlocked
        }));

        emit TrustUpdated(_node, _newScore);

        if (_newScore < anomalyThreshold) {
            emit AttackDetected(_node, _attackType, _newScore);
            if (!trustScores[_node].isBlocked) {
                _revokeAccess(_node, "Trust score fell below threshold");
            }
        } else if (_newScore >= anomalyThreshold && trustScores[_node].isBlocked) {
            _restoreAccess(_node);
        }
    }

    function reportAnomaly(address _node, string calldata _reason) external onlyOwner {
        require(registry.isNodeRegistered(_node), "Node not registered");
        emit AnomalyReported(_node, _reason, trustScores[_node].fusionTrustScore);
        
        if (!trustScores[_node].isBlocked) {
            _revokeAccess(_node, _reason);
        }
    }

    function _revokeAccess(address _node, string memory _reason) internal {
        trustScores[_node].isBlocked = true;
        emit AccessRevoked(_node);
        emit AnomalyReported(_node, _reason, trustScores[_node].fusionTrustScore);
    }

    function _restoreAccess(address _node) internal {
        trustScores[_node].isBlocked = false;
        emit AccessRestored(_node);
    }

    function setAnomalyThreshold(uint256 _newThreshold) external onlyOwner {
        require(_newThreshold <= 100, "Threshold must be <= 100");
        anomalyThreshold = _newThreshold;
    }

    function getTrustScore(address _node) external view returns (uint256, uint256, bool) {
        TrustData memory data = trustScores[_node];
        return (data.fusionTrustScore, data.lastUpdated, data.isBlocked);
    }

    function isNodeBlocked(address _node) external view returns (bool) {
        return trustScores[_node].isBlocked;
    }

    function logTransfer(address _sender, address _receiver, string calldata _details, uint256 _trustUpdate) external onlyOwner {
        require(registry.isNodeRegistered(_sender), "Sender not registered");
        require(registry.isNodeRegistered(_receiver), "Receiver not registered");

        globalTransfers.push(TransferRecord({
            sender: _sender,
            receiver: _receiver,
            details: _details,
            trustUpdate: _trustUpdate,
            timestamp: block.timestamp
        }));

        // Automatically update node trust records on-chain
        trustScores[_sender].fusionTrustScore = _trustUpdate;
        trustScores[_sender].lastUpdated = block.timestamp;

        trustHistory[_sender].push(TrustRecord({
            nodeId: _sender,
            fusionTrustScore: _trustUpdate,
            attackType: _details,
            timestamp: block.timestamp,
            isBlocked: trustScores[_sender].isBlocked
        }));

        emit TransferLogged(_sender, _receiver, _details, _trustUpdate);
        emit TrustUpdated(_sender, _trustUpdate); // emit existing event
    }
}

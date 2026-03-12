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

    mapping(address => TrustData) public trustScores;
    
    uint256 public anomalyThreshold = 60; // < 0.6 is suspicious

    event TrustUpdated(address indexed node, uint256 newScore);
    event AnomalyReported(address indexed node, string reason, uint256 score);
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

    function updateTrustScore(address _node, uint256 _newScore) external onlyOwner {
        require(registry.isNodeRegistered(_node), "Node is not registered in Registry");
        require(_newScore <= 100, "Score must be <= 100");

        trustScores[_node].fusionTrustScore = _newScore;
        trustScores[_node].lastUpdated = block.timestamp;

        emit TrustUpdated(_node, _newScore);

        if (_newScore < anomalyThreshold && !trustScores[_node].isBlocked) {
            _revokeAccess(_node, "Trust score fell below threshold");
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
}

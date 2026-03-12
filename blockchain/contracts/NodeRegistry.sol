// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract NodeRegistry {
    enum NodeRole { Unknown, DataRequester, ServiceProvider, Communicator }

    struct NodeProfile {
        bool isRegistered;
        NodeRole role;
        uint256 registeredAt;
        uint256 interactionCount;
    }

    mapping(address => NodeProfile) public nodes;
    address[] public registeredNodesList;
    
    address public owner;

    event NodeRegistered(address indexed nodeAddress, NodeRole role);
    event RoleUpdated(address indexed nodeAddress, NodeRole newRole);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    modifier onlyRegistered(address _node) {
        require(nodes[_node].isRegistered, "Node is not registered");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function registerNode(address _node, NodeRole _role) external onlyOwner {
        require(!nodes[_node].isRegistered, "Node already registered");
        require(_role != NodeRole.Unknown, "Invalid role");

        nodes[_node] = NodeProfile({
            isRegistered: true,
            role: _role,
            registeredAt: block.timestamp,
            interactionCount: 0
        });

        registeredNodesList.push(_node);
        emit NodeRegistered(_node, _role);
    }

    function updateRole(address _node, NodeRole _newRole) external onlyOwner onlyRegistered(_node) {
        require(_newRole != NodeRole.Unknown, "Invalid role");
        nodes[_node].role = _newRole;
        emit RoleUpdated(_node, _newRole);
    }
    
    function recordInteraction(address _node) external onlyOwner onlyRegistered(_node) {
        nodes[_node].interactionCount++;
    }

    function getNodeRole(address _node) external view returns (NodeRole) {
        return nodes[_node].role;
    }

    function isNodeRegistered(address _node) external view returns (bool) {
        return nodes[_node].isRegistered;
    }

    function getRegisteredNodesCount() external view returns (uint256) {
        return registeredNodesList.length;
    }
}

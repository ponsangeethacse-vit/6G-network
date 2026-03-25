const Node = require('../models/Node');
const blockchainConnector = require('./blockchainConnector');
const mongoose = require('mongoose');

const inMemoryNodes = [];

class NodeService {
    async createNode(nodeData) {
        let node;
        const isConnected = mongoose.connection.readyState === 1;

        const newNodeData = {
            ...nodeData,
            status: nodeData.status || 'Active',
            trustScore: nodeData.trustScore !== undefined ? nodeData.trustScore : 0.8,
            transactionHistory: []
        };

        if (isConnected) {
            node = new Node(newNodeData);
            await node.save();
        } else {
            console.warn('[NodeService] MongoDB disconnected, using in-memory fallback');
            node = {
                ...newNodeData,
                createdAt: new Date(),
                save: async function() { return this; }
            };
            inMemoryNodes.push(node);
        }

        // 2. Sync with Blockchain
        try {
            // Mapping: 'Base Station' -> 2 (ServiceProvider), 'Edge Node' -> 3 (Communicator), default -> 1 (DataRequester)
            const role = nodeData.type === 'Base Station' ? 2 : (nodeData.type === 'Edge Node' ? 3 : 1);
            
            // Using NodeID as the address for registration in this simulation
            const result = await blockchainConnector.registerNode(nodeData.nodeId, role);
            if (result.success) {
                node.transactionHistory.push({
                    txHash: result.txHash,
                    action: 'Node Initialized and Registered on Blockchain',
                    timestamp: new Date()
                });
                if (isConnected) await node.save();
            }
        } catch (err) {
            console.warn(`[NodeService] blockchain sync failed for ${nodeData.nodeId}:`, err.message);
        }

        return node;
    }

    async removeNode(nodeId) {
        const isConnected = mongoose.connection.readyState === 1;
        let node;

        if (isConnected) {
            node = await Node.findOneAndUpdate({ nodeId }, { status: 'Removed' }, { new: true });
        } else {
            node = inMemoryNodes.find(n => n.nodeId === nodeId);
            if (node) node.status = 'Removed';
        }

        if (!node) throw new Error('Node not found');

        // Log to Blockchain
        try {
            const result = await blockchainConnector.updateTrustScore(nodeId, 0, 'Node Deactivated/Removed');
            if (result.success) {
                node.transactionHistory.push({
                    txHash: result.txHash,
                    action: 'Node Removed from Network (Status updated on Chain)',
                    timestamp: new Date()
                });
                if (isConnected) await node.save();
            }
        } catch (err) {
            console.warn(`[NodeService] blockchain removal log failed for ${nodeId}:`, err.message);
        }

        return node;
    }

    async updateNode(nodeId, updateData) {
        const isConnected = mongoose.connection.readyState === 1;
        let node;

        if (isConnected) {
            node = await Node.findOneAndUpdate({ nodeId }, updateData, { new: true });
        } else {
            node = inMemoryNodes.find(n => n.nodeId === nodeId);
            if (node) {
                Object.assign(node, updateData);
            }
        }

        if (!node) throw new Error('Node not found');

        if (updateData.trustScore !== undefined) {
             try {
                 const result = updateData.isModelUpdate 
                     ? await blockchainConnector.processModelUpdate(nodeId, updateData.trustScore)
                     : await blockchainConnector.updateTrustScore(nodeId, updateData.trustScore, updateData.status || "Update");
                 if (result.success) {
                      node.transactionHistory.push({
                           txHash: result.txHash,
                           action: `Trust Score Updated to ${updateData.trustScore}`,
                           timestamp: new Date()
                      });
                      if (isConnected) await node.save();
                 }
             } catch (err) {
                 console.warn(`[NodeService] blockchain trust update failed for ${nodeId}:`, err.message);
             }
        }

        return node;
    }

    async getNodes(query = {}) {
        const isConnected = mongoose.connection.readyState === 1;
        if (isConnected) {
            return await Node.find(query);
        } else {
            return inMemoryNodes;
        }
    }

    async getNodeById(nodeId) {
        const isConnected = mongoose.connection.readyState === 1;
        let node;
        
        if (isConnected) {
            node = await Node.findOne({ nodeId });
        } else {
            node = inMemoryNodes.find(n => n.nodeId === nodeId);
        }

        if (!node) throw new Error('Node not found');
        return node;
    }

    async getNodeActivity(nodeId) {
        const node = await this.getNodeById(nodeId);
        return node.transactionHistory;
    }
}

module.exports = new NodeService();

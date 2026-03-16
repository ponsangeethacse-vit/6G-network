const Node = require('../models/Node');
const blockchainConnector = require('./blockchainConnector');
const mongoose = require('mongoose');

const inMemoryNodes = [];

class NodeService {
    async createNode(nodeData) {
        let node;
        const isConnected = mongoose.connection.readyState === 1;

        if (isConnected) {
            node = new Node(nodeData);
            await node.save();
        } else {
            console.warn('[NodeService] MongoDB disconnected, using in-memory fallback');
            node = {
                ...nodeData,
                transactionHistory: [],
                status: nodeData.status || 'Normal',
                trustScore: nodeData.trustScore !== undefined ? nodeData.trustScore : 0.5,
                createdAt: new Date(),
                save: async function() { return this; } // mock save
            };
            inMemoryNodes.push(node);
        }

        // 2. Sync with Blockchain
        try {
            const result = await blockchainConnector.registerNode(nodeData.nodeId, 1);
            if (result.success) {
                node.transactionHistory.push({
                    txHash: result.txHash,
                    action: 'Node Registered on Blockchain'
                });
                if (isConnected) await node.save();
            }
        } catch (err) {
            console.warn(`[NodeService] blockchain sync failed for ${nodeData.nodeId}:`, err.message);
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
                 const result = await blockchainConnector.updateTrustScore(nodeId, updateData.trustScore, updateData.status || "Update");
                 if (result.success) {
                      node.transactionHistory.push({
                           txHash: result.txHash,
                           action: `Trust Score Updated to ${updateData.trustScore}`
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

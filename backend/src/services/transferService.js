const Transfer = require('../models/Transfer');
const Node = require('../models/Node');
const blockchainConnector = require('./blockchainConnector');
const mongoose = require('mongoose');

const inMemoryTransfers = [];

class TransferService {
    async executeTransfer(senderId, receiverId, data, behavior = 'Normal') {
        const isConnected = mongoose.connection.readyState === 1;
        const nodeService = require('./nodeService'); // lazy load to avoid circular if any

        // 1. Validate nodes
        let sender, receiver;
        
        if (isConnected) {
            sender = await Node.findOne({ nodeId: senderId });
            receiver = await Node.findOne({ nodeId: receiverId });
        } else {
            const nodes = await nodeService.getNodes();
            sender = nodes.find(n => n.nodeId === senderId);
            receiver = nodes.find(n => n.nodeId === receiverId);
        }

        if (!sender || !receiver) {
             throw new Error('Sender or Receiver node not found');
        }

        if (sender.status === 'Malicious') {
             throw new Error('Sender node is blocked due to malicious status');
        }

        // 2. Update Trust Score based on behavior
        let trustDelta = 0.01; 
        let status = 'Success';

        if (behavior === 'Malicious') {
             trustDelta = -0.20; 
             status = 'Failed';
             sender.status = 'Suspicious'; 
        }

        // DB uses 0.5 default. Keep score in 0-1 range.
        sender.trustScore = Math.max(0, Math.min(1, sender.trustScore + trustDelta));

        // 3. Record log in sender history
        const txRecord = {
             txHash: 'pending',
             action: `Sent data to ${receiverId} (${status})`,
             timestamp: new Date()
        };
        sender.transactionHistory.push(txRecord);

        receiver.transactionHistory.push({
             txHash: 'pending',
             action: `Received data from ${senderId}`,
             timestamp: new Date()
        });

        if (isConnected) {
             await sender.save();
             await receiver.save();
        }

        // 4. Record Transfer Event
        let transfer;
        if (isConnected) {
             transfer = new Transfer({
                  senderNodeId: senderId,
                  receiverNodeId: receiverId,
                  data: data,
                  status: status,
                  updatedTrustScore: sender.trustScore
             });
             await transfer.save();
             txRecord.txHash = transfer._id.toString(); // local ID
        } else {
             transfer = {
                  _id: Math.random().toString(36).substr(2, 9),
                  senderNodeId: senderId,
                  receiverNodeId: receiverId,
                  data: data,
                  status: status,
                  updatedTrustScore: sender.trustScore,
                  createdAt: new Date()
             };
             inMemoryTransfers.push(transfer);
             txRecord.txHash = transfer._id;
        }

        if (isConnected) await sender.save();

        // 5. Sync with Blockchain
        try {
             // Pass scaled trust score to blockchain (0-100)
             const result = await blockchainConnector.logTransfer(
                  senderId, 
                  receiverId, 
                  data, 
                  Math.round(sender.trustScore * 100)
             );
             if (result.success) {
                  txRecord.txHash = result.txHash;
                  if (isConnected) await sender.save();
             }
        } catch (err) {
             console.warn(`[TransferService] blockchain sync failed for ${senderId}:`, err.message);
        }

        return transfer;
    }

    async getTransfers(query = {}) {
        const isConnected = mongoose.connection.readyState === 1;
        if (isConnected) {
             return await Transfer.find(query);
        } else {
             return inMemoryTransfers;
        }
    }
}

module.exports = new TransferService();

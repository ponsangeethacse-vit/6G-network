const blockchainConnector = require('./blockchainConnector');

class LedgerService {
    constructor() {
        this.txLog = [];
        this.blockchainBlocks = [];
        this.txSeq = 1;
        this.blockIndex = 1;
        this.io = null;
    }

    setIo(io) {
        this.io = io;
    }

    generateHash(len = 64) {
        return '0x' + [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
    }

    async recordEvent(nodeAddr, score, action = 'Trust Score Updated', attackType = 'Normal') {
        const timestamp = Date.now();
        const blockHash = this.generateHash(64);
        const txHash = this.generateHash(64);
        const nodeLabel = `Node ${nodeAddr.slice(2, 6).toUpperCase()}`;

        const tx = {
            id: this.txSeq++,
            blockId: this.blockIndex,
            nodeId: nodeAddr,
            nodeLabel,
            action,
            attackType, // Store the attack type in the transaction
            txHash,
            blockHash,
            timestamp,
            trustScore: Math.round(score),
        };

        // 1. Update In-Memory Log for UI
        this.txLog.unshift(tx);
        if (this.txLog.length > 100) this.txLog.pop();

        // 2. Add to Mock Blockchain Blocks
        const prev = this.blockchainBlocks.length > 0
            ? this.blockchainBlocks[this.blockchainBlocks.length - 1].hash
            : '0x0000000000000000000000000000000000000000000000000000000000000000';

        this.blockchainBlocks.push({
            index: this.blockIndex++,
            hash: blockHash,
            previousHash: prev,
            transactions: [tx],
        });
        if (this.blockchainBlocks.length > 50) this.blockchainBlocks.shift();

        // 3. Sync with REAL Blockchain (Hardhat/Ethers) if available
        try {
            // We only log to real blockchain for significant events or periodic updates to avoid spam
            // Any attack is considered significant
            const isSignificant = action !== 'Trust Score Updated' || attackType !== 'Normal' || Math.random() < 0.1;
            if (isSignificant) {
                await blockchainConnector.updateTrustScore(nodeAddr, score / 100, attackType !== 'Normal' ? attackType : action);
            }
        } catch (err) {
            console.warn(`[LedgerService] REAL Blockchain sync failed for ${nodeAddr}:`, err.message);
        }

        // 4. Broadcast to frontend
        if (this.io) {
            this.io.emit('new_transaction', tx);
        }

        return tx;
    }

    getTxLog() {
        return this.txLog;
    }

    getBlockchain() {
        return this.blockchainBlocks;
    }
}

module.exports = new LedgerService();

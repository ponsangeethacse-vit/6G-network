const crypto = require('crypto');

class LocalBlock {
  constructor(index, timestamp, nodeId, packetId, eventType, sourceNode, destinationNode, previousHash = '') {
    this.index = index;
    this.timestamp = timestamp;
    this.nodeId = nodeId;
    this.packetId = packetId;
    this.eventType = eventType; // packet_sent, packet_received, packet_forwarded, packet_blocked
    this.sourceNode = sourceNode;
    this.destinationNode = destinationNode;
    this.previousHash = previousHash;
    this.hash = this.calculateHash();
  }

  calculateHash() {
    const data = this.index + this.timestamp + this.nodeId + this.packetId + this.eventType + this.sourceNode + this.destinationNode + this.previousHash;
    return crypto
      .createHash('sha256')
      .update(data)
      .digest('hex');
  }
}

class LocalBlockchain {
  constructor(nodeId) {
    this.nodeId = nodeId;
    this.chain = [this.createGenesisBlock()];
  }

  createGenesisBlock() {
    return new LocalBlock(
      0, 
      Date.now(), 
      this.nodeId, 
      "GENESIS_PACKET", 
      "genesis", 
      "0x0", 
      "0x0", 
      "0000000000000000000000000000000000000000000000000000000000000000"
    );
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  mineBlock(packetId, eventType, sourceNode, destinationNode) {
    const prevBlock = this.getLatestBlock();
    const newIndex = prevBlock.index + 1;
    const timestamp = Date.now();
    
    const newBlock = new LocalBlock(
      newIndex,
      timestamp,
      this.nodeId,
      packetId,
      eventType,
      sourceNode,
      destinationNode,
      prevBlock.hash
    );

    this.chain.push(newBlock);
    return newBlock;
  }

  getChain() {
    return this.chain;
  }
}

// In-Memory map for absolute singleton node blockchains
const nodeBlockchains = {};

function getNodeBlockchain(nodeId) {
  if (!nodeBlockchains[nodeId]) {
    nodeBlockchains[nodeId] = new LocalBlockchain(nodeId);
  }
  return nodeBlockchains[nodeId];
}

module.exports = {
  LocalBlock,
  LocalBlockchain,
  getNodeBlockchain
};

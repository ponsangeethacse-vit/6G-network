const crypto = require('crypto');
const Block = require('../models/Block');

class Blockchain {
  constructor() {
    this.chain = [];
    this.pendingTransactions = [];
    this.difficulty = 2;
  }

  async init() {
    const existingChain = await Block.find().sort({ index: 1 });
    if (existingChain.length === 0) {
      await this.createGenesisBlock();
    } else {
      this.chain = existingChain;
    }
  }

  async createGenesisBlock() {
    const genesisBlock = new Block({
      index: 0,
      timestamp: Date.now(),
      transactions: [{ message: "6G TrustGuard Genesis Block" }],
      previousHash: "0",
      hash: this.calculateHash(0, "0", Date.now(), [{ message: "6G TrustGuard Genesis Block" }], 0),
      nonce: 0
    });
    await genesisBlock.save();
    this.chain.push(genesisBlock);
  }

  calculateHash(index, previousHash, timestamp, transactions, nonce) {
    return crypto
      .createHash('sha256')
      .update(index + previousHash + timestamp + JSON.stringify(transactions) + nonce)
      .digest('hex');
  }

  async addTransaction(tx) {
    this.pendingTransactions.push(tx);
    if (this.pendingTransactions.length >= 5) {
      await this.minePendingTransactions();
    }
  }

  async minePendingTransactions() {
    const previousBlock = this.chain[this.chain.length - 1];
    let nonce = 0;
    let timestamp = Date.now();
    let hash = this.calculateHash(
      previousBlock.index + 1,
      previousBlock.hash,
      timestamp,
      this.pendingTransactions,
      nonce
    );

    while (hash.substring(0, this.difficulty) !== Array(this.difficulty + 1).join("0")) {
      nonce++;
      hash = this.calculateHash(
        previousBlock.index + 1,
        previousBlock.hash,
        timestamp,
        this.pendingTransactions,
        nonce
      );
    }

    const newBlock = new Block({
      index: previousBlock.index + 1,
      timestamp,
      transactions: this.pendingTransactions,
      previousHash: previousBlock.hash,
      hash,
      nonce
    });

    await newBlock.save();
    this.chain.push(newBlock);
    this.pendingTransactions = [];
    return newBlock;
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }
}

module.exports = new Blockchain();

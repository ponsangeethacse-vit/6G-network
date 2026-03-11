export interface NetworkNode {
  nodeId: string;
  type: 'IoT' | 'Edge' | 'Core';
  trustScore: number;
  metrics: {
    latency: number;
    throughput: number;
    packetLoss: number;
    commTrust: number;
    transTrust: number;
    behaviorTrust: number;
  };
  status: 'active' | 'isolated' | 'malicious';
  lastSeen: string;
}

export interface SecurityAlert {
  nodeId: string;
  type: string;
  severity: 'high' | 'medium' | 'low';
  timestamp: number;
}

export interface BlockchainBlock {
  index: number;
  timestamp: number;
  transactions: any[];
  previousHash: string;
  hash: string;
  nonce: number;
}

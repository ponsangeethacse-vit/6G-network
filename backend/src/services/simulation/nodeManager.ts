export type NodeType = 'iot' | 'edge' | 'base_station' | 'malicious';

export interface SimulationNode {
    nodeId: string;
    type: NodeType;
    trustScore: number;
    datasetIndex: number;
}

export class NodeManager {
    public nodes: SimulationNode[] = [];
    private readonly TOTAL_NODES = 75; // configurable between 50-100

    constructor() {
        this.initializeNodes();
    }

    private initializeNodes() {
        for (let i = 0; i < this.TOTAL_NODES; i++) {
            const hex = (i + 1).toString(16).padStart(40, '0');
            const nodeId = `0x${hex}`;
            
            // Assign type based on ratios: 60% iot, 20% edge, 10% base_station, 10% malicious
            let type: NodeType;
            if (i < this.TOTAL_NODES * 0.6) {
                type = 'iot';
            } else if (i < this.TOTAL_NODES * 0.8) {
                type = 'edge';
            } else if (i < this.TOTAL_NODES * 0.9) {
                type = 'base_station';
            } else {
                type = 'malicious';
            }

            this.nodes.push({
                nodeId,
                type,
                trustScore: 100, // Starts at 100
                datasetIndex: Math.floor(Math.random() * 10000) // Random start pointer for dataset
            });
        }
        console.log(`[NodeManager] 🌐 Initialized ${this.nodes.length} heterogeneous nodes.`);
    }

    public getNodes(): SimulationNode[] {
        return this.nodes;
    }

    public updateNodeTrust(nodeId: string, trustScore: number) {
        const node = this.nodes.find(n => n.nodeId === nodeId);
        if (node) {
            node.trustScore = trustScore;
        }
    }
}

export const nodeManager = new NodeManager();

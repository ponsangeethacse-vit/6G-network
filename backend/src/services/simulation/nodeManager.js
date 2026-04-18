class NodeManager {
    constructor() {
        this.nodes = [];
        this.TOTAL_NODES = 30; // Configurable between 50-100
        
        // Distribution ratios: 60% IoT, 20% Edge, 10% Base Station, 10% Malicious
        this.ratios = {
            iot: 0.6,
            edge: 0.2,
            base_station: 0.1,
            malicious: 0.1
        };

        // Scaling factors for dataset features based on node type
        // format: [packet_rate, latency, bandwidth, failed_requests]
        this.behaviorProfiles = {
            iot: {
                label: 'IoT Device',
                multipliers: [0.5, 1.5, 0.4, 0.8], // Low traffic, high latency
                noiseLevel: 0.05
            },
            edge: {
                label: 'Edge Node',
                multipliers: [1.0, 1.0, 1.0, 1.0], // Standard behavior
                noiseLevel: 0.02
            },
            base_station: {
                label: 'Base Station',
                multipliers: [3.0, 0.7, 4.0, 0.5], // High traffic, low latency, high bandwidth
                noiseLevel: 0.01
            },
            malicious: {
                label: 'Malicious Node',
                multipliers: [4.0, 2.0, 2.0, 10.0], // Spiky, high failure, abnormal
                noiseLevel: 0.2
            }
        };

        this.initializeNodes();
    }

    /**
     * Initializes the pool of nodes with heterogeneous types and random offsets.
     */
    initializeNodes() {
        console.log(`[NodeManager] 🌐 Initializing ${this.TOTAL_NODES} heterogeneous nodes...`);
        this.nodes = [];

        for (let i = 0; i < this.TOTAL_NODES; i++) {
            const nodeId = this.generateNodeId(i);
            const type = this.determineType(i);
            
            this.nodes.push({
                nodeId,
                type,
                label: this.behaviorProfiles[type].label,
                status: 'Active',
                trustScore: 100,
                datasetIndex: Math.floor(Math.random() * 1000), // Variation in reading start point
                metrics: {
                    packet_rate: 0,
                    latency: 0,
                    bandwidth: 0,
                    failed_requests: 0
                },
                lastUpdate: Date.now()
            });
        }
        console.log(`[NodeManager] ✅ Node initialization complete.`);
    }

    /**
     * Generates a 40-character hex address (simulating an Ethereum-style address).
     */
    generateNodeId(index) {
        const hex = (index + 1).toString(16).padStart(40, '0');
        return `0x${hex}`;
    }

    /**
     * Determines node type based on the distribution ratios.
     */
    determineType(index) {
        const p = index / this.TOTAL_NODES;
        if (p < this.ratios.iot) return 'iot';
        if (p < this.ratios.iot + this.ratios.edge) return 'edge';
        if (p < (1 - this.ratios.malicious)) return 'base_station';
        return 'malicious';
    }

    /**
     * Gets all nodes.
     */
    getAllNodes() {
        return this.nodes;
    }

    /**
     * Gets behavior profile for a specific type.
     */
    getProfile(type) {
        return this.behaviorProfiles[type];
    }
}

const nodeManager = new NodeManager();
module.exports = nodeManager;

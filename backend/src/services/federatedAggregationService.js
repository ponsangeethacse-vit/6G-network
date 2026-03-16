class FederatedAggregationService {
    constructor() {
        // Simulated global model weights/states layer parameters
        this.globalModel = [0.85, 0.40, 0.22, 0.70, 0.15]; 
        this.currentUpdates = [];
        this.acceptanceThreshold = 60; // minimum trust needed to participate
    }

    /**
     * @param {string} nodeId Address vector
     * @param {Array<number>} modelParams Weights weights arrays
     * @param {number} trustScore [0-100]
     */
    submitUpdate(nodeId, modelParams, trustScore) {
        if (trustScore < this.acceptanceThreshold) {
            console.warn(`[Aggregation] Update rejected from ${nodeId.slice(0,6)} (Trust: ${trustScore})`);
            return { accepted: false, reason: "Trust below threshold" };
        }

        this.currentUpdates.push({
            nodeId,
            modelParams: modelParams.map(Number),
            trustScore: Number(trustScore)
        });
        return { accepted: true };
    }

    /**
     * Executes securing weight averaging aggregates.
     * @returns {Array<number>} updated globalModel
     */
    aggregate() {
        if (this.currentUpdates.length === 0) {
            console.log('[Aggregation] No updates collected this cycle.');
            return this.globalModel;
        }

        const totalTrust = this.currentUpdates.reduce((sum, u) => sum + u.trustScore, 0);
        if (totalTrust === 0) return this.globalModel;

        const numWeights = this.globalModel.length;
        const newWeights = new Array(numWeights).fill(0);

        for (let i = 0; i < numWeights; i++) {
            let weightedSum = 0;
            for (const update of this.currentUpdates) {
                // If update runs short, fallback nominal
                const val = update.modelParams[i] !== undefined ? update.modelParams[i] : this.globalModel[i];
                weightedSum += val * update.trustScore;
            }
            newWeights[i] = Number((weightedSum / totalTrust).toFixed(4));
        }

        console.log(`[Aggregation] Fused ${this.currentUpdates.length} updates. Total trust mass: ${totalTrust}`);
        
        this.globalModel = newWeights;
        this.currentUpdates = []; // clear buffer for next round

        return this.globalModel;
    }

    getGlobalModel() {
        return this.globalModel;
    }

    setThreshold(val) {
        this.acceptanceThreshold = val;
    }
}

module.exports = new FederatedAggregationService();

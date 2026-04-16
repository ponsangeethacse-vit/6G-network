const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

class DatasetLoader {
    constructor() {
        this.dataset = [];
        this.isLoaded = false;
        this.csvPath = path.resolve(__dirname, '../../../../ai-service/data/processed_dataset.csv');
    }

    /**
     * Loads the CSV dataset into memory asynchronously.
     */
    async load() {
        return new Promise((resolve, reject) => {
            console.log(`[DatasetLoader] 📂 Loading dataset from: ${this.csvPath}`);
            const results = [];
            
            if (!fs.existsSync(this.csvPath)) {
                console.error(`[DatasetLoader] ❌ Dataset NOT found at ${this.csvPath}`);
                return reject(new Error('Dataset file not found'));
            }

            fs.createReadStream(this.csvPath)
                .pipe(csv())
                .on('data', (data) => {
                    results.push({
                        packet_rate: parseFloat(data.packet_rate),
                        latency: parseFloat(data.latency),
                        bandwidth: parseFloat(data.bandwidth),
                        failed_requests: parseFloat(data.failed_requests),
                        label: parseInt(data.label || '0')
                    });
                })
                .on('end', () => {
                    this.dataset = results;
                    this.isLoaded = true;
                    console.log(`[DatasetLoader] ✅ Successfully loaded ${this.dataset.length} rows into memory.`);
                    resolve(this.dataset);
                })
                .on('error', (err) => {
                    console.error(`[DatasetLoader] ❌ Error reading CSV: ${err.message}`);
                    reject(err);
                });
        });
    }

    /**
     * Get a row safely using modulo to loop around.
     * @param {number} index 
     * @returns {Object|null}
     */
    getRow(index) {
        if (!this.isLoaded || this.dataset.length === 0) return null;
        return this.dataset[index % this.dataset.length];
    }

    get size() {
        return this.dataset.length;
    }
}

const datasetLoader = new DatasetLoader();
module.exports = datasetLoader;

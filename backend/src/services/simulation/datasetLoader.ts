import * as fs from 'fs';
import * as path from 'path';

export interface DatasetRow {
    packet_rate: number;
    latency: number;
    bandwidth: number;
    failed_requests: number;
    label: number;
}

export class DatasetLoader {
    private dataset: DatasetRow[] = [];

    constructor() {
        this.loadDataset();
    }

    private loadDataset() {
        try {
            const csvPath = path.resolve(__dirname, '../../../../../ai-service/data/processed_dataset.csv');
            const fileContent = fs.readFileSync(csvPath, 'utf-8');
            const lines = fileContent.split('\\n');

            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                const cols = lines[i].split(',');
                this.dataset.push({
                    packet_rate: parseFloat(cols[0]),
                    latency: parseFloat(cols[1]),
                    bandwidth: parseFloat(cols[2]),
                    failed_requests: parseFloat(cols[3]),
                    label: parseInt(cols[4] || '0')
                });
            }
            console.log(`[DatasetLoader] 📊 Successfully loaded ${this.dataset.length} real dataset rows`);
        } catch (e: any) {
            console.error('[DatasetLoader] ⚠️ ML dataset not found! ' + e.message);
        }
    }

    /**
     * Get a dataset row safely using modulo operation to prevent out of bounds.
     */
    public getRow(index: number): DatasetRow | null {
        if (this.dataset.length === 0) return null;
        return this.dataset[index % this.dataset.length];
    }
    
    public getDatasetSize(): number {
        return this.dataset.length;
    }
}

export const datasetLoader = new DatasetLoader();

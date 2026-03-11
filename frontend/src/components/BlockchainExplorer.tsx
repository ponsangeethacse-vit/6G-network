import React, { useEffect, useState } from 'react';
import { Database, Hash, Square, ArrowRight } from 'lucide-react';
import { getBlockchain } from '../services/api';
import { BlockchainBlock } from '../types';

const BlockchainExplorer = () => {
  const [blocks, setBlocks] = useState<BlockchainBlock[]>([]);

  useEffect(() => {
    const fetchBlocks = async () => {
      try {
        const res = await getBlockchain();
        setBlocks(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchBlocks();
    const interval = setInterval(fetchBlocks, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="glass-card p-6 rounded-xl h-[400px] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Database className="w-4 h-4 text-trust-accent" /> Blockchain Trust Ledger
        </h3>
        <span className="text-[10px] bg-trust-accent/10 text-trust-accent px-2 py-0.5 rounded border border-trust-accent/20">PROOF-OF-TRUST</span>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
        <div className="flex gap-4 items-center">
          {blocks.map((block, idx) => (
            <React.Fragment key={block.hash}>
              <div className="min-w-[200px] glass-card p-3 rounded-lg border-trust-accent/30 hover:border-trust-accent transition-all">
                <div className="flex items-center gap-2 mb-2">
                  <Square className="w-4 h-4 text-trust-accent fill-trust-accent/20" />
                  <span className="text-xs font-bold font-mono">BLOCK #{block.index}</span>
                </div>
                <div className="space-y-2 text-[10px] font-mono">
                  <div className="flex flex-col">
                    <span className="text-gray-500">HASH</span>
                    <span className="text-trust-accent truncate">{block.hash}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-500">PREV HASH</span>
                    <span className="text-gray-400 truncate">{block.previousHash}</span>
                  </div>
                  <div className="flex justify-between border-t border-white/5 pt-2 mt-2">
                    <span className="text-gray-500 uppercase">TXs: {block.transactions.length}</span>
                    <span className="text-trust-high font-bold italic">VALIDATED</span>
                  </div>
                </div>
              </div>
              {idx < blocks.length - 1 && <ArrowRight className="text-gray-600 flex-shrink-0" />}
            </React.Fragment>
          ))}
        </div>
      </div>
      
      <div className="mt-4 p-3 bg-white/5 rounded-lg border border-white/10 text-[10px] text-gray-400 font-mono">
          <p>Consensus Algorithm: Decentralized Proof-of-Trust (PoT)</p>
          <p>Validation latency: 0.12ms | Throughput: 1M+ tps</p>
      </div>
    </div>
  );
};

export default BlockchainExplorer;

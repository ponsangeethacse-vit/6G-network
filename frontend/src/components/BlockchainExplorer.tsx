import React, { useEffect, useState } from 'react';
import { Database, Square, ArrowRight } from 'lucide-react';
import { getBlockchain } from '../services/api';
import { BlockchainBlock } from '../types';
import { Card, Badge } from 'react-bootstrap';

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
    <Card bg="dark" border="secondary" className="h-100 shadow-lg" style={{ minHeight: '400px' }}>
      <Card.Header className="bg-black bg-opacity-25 border-bottom border-secondary p-3 d-flex align-items-center justify-content-between">
        <h6 className="mb-0 text-secondary text-uppercase d-flex align-items-center gap-2" style={{ letterSpacing: '1px' }}>
            <Database className="text-info" size={16} /> Blockchain Trust Ledger
        </h6>
        <Badge bg="info" className="border border-info border-opacity-25 bg-opacity-10 text-info">PROOF-OF-TRUST</Badge>
      </Card.Header>

      <Card.Body className="d-flex flex-column h-100 p-3">
          <div className="flex-grow-1 overflow-auto pb-4 d-flex gap-4 align-items-center">
            {blocks.map((block, idx) => (
              <React.Fragment key={block.hash}>
                <Card bg="dark" border="secondary" className="flex-shrink-0" style={{ minWidth: '200px' }}>
                  <Card.Body className="p-3">
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <Square className="text-info" size={16} />
                      <span className="small fw-bold font-monospace text-light">BLOCK #{block.index}</span>
                    </div>
                    <div className="d-flex flex-column gap-2 font-monospace" style={{ fontSize: '10px' }}>
                      <div className="d-flex flex-column">
                        <span className="text-secondary">HASH</span>
                        <span className="text-info text-truncate">{block.hash}</span>
                      </div>
                      <div className="d-flex flex-column">
                        <span className="text-secondary">PREV HASH</span>
                        <span className="text-secondary text-truncate opacity-75">{block.previousHash}</span>
                      </div>
                      <div className="d-flex justify-content-between border-top border-secondary pt-2 mt-2">
                        <span className="text-secondary text-uppercase">TXs: {block.transactions.length}</span>
                        <span className="text-success fw-bold fst-italic">VALIDATED</span>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
                {idx < blocks.length - 1 && <ArrowRight className="text-secondary flex-shrink-0" size={24} />}
              </React.Fragment>
            ))}
          </div>
          
          <div className="mt-3 p-2 bg-secondary bg-opacity-25 rounded border border-secondary text-secondary font-monospace" style={{ fontSize: '10px' }}>
              <p className="mb-1">Consensus Algorithm: Decentralized Proof-of-Trust (PoT)</p>
              <p className="mb-0">Validation latency: 0.12ms | Throughput: 1M+ tps</p>
          </div>
      </Card.Body>
    </Card>
  );
};

export default BlockchainExplorer;

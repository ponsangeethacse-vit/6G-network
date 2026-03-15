import React from 'react';
import BlockchainExplorer from '../components/BlockchainExplorer';

const BlockchainTransactionViewerPage = () => {
  return (
    <div className="h-100 d-flex flex-column">
      <h4 className="text-light mb-4">Blockchain Trust Ledger</h4>
      <BlockchainExplorer />
    </div>
  );
};

export default BlockchainTransactionViewerPage;

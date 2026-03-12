import { Request, Response, NextFunction } from 'express';
import { blockchainService } from '../services/blockchain.service';

export const requireActiveTrust = async (req: Request, res: Response, next: NextFunction) => {
  const nodeAddress = req.headers['x-node-address'] as string;
  
  if (!nodeAddress) {
    return res.status(401).json({ error: 'Missing x-node-address header' });
  }

  try {
    if (!blockchainService.trustLedgerContract) {
      return next(); // Skips if contract not initialized yet (development fallback)
    }

    const isBlocked = await blockchainService.trustLedgerContract.isNodeBlocked(nodeAddress);
    if (isBlocked) {
      return res.status(403).json({ 
        error: 'Node Access Denied. Trust score fell below threshold or anomaly detected.' 
      });
    }

    // Node is trusted, proceed.
    next();
  } catch (error: any) {
    console.error(`[AccessControl] Error verifying node ${nodeAddress}:`, error.message);
    res.status(500).json({ error: 'Internal server error verifying trust status' });
  }
};

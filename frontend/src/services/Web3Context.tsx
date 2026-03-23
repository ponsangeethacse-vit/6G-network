import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { web3Service, ConnectionStatus, WalletInfo, ChainEvent, TrustRecord } from '../services/web3.service';

// ─── Context types ────────────────────────────────────────────────────────────
interface Web3ContextValue {
  status:       ConnectionStatus;
  wallet:       WalletInfo | null;
  chainEvents:  ChainEvent[];
  error:        string | null;
  connectMetaMask:  () => Promise<void>;
  connectLocalNode: (url?: string) => Promise<void>;
  disconnect:       () => void;
  getTrustScore:    (addr: string) => Promise<TrustRecord>;
  getTrustScores:   (addrs: string[]) => Promise<TrustRecord[]>;
  clearEvents:      () => void;
}

const Web3Context = createContext<Web3ContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────
export const Web3Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus]           = useState<ConnectionStatus>('disconnected');
  const [wallet, setWallet]           = useState<WalletInfo | null>(null);
  const [chainEvents, setChainEvents] = useState<ChainEvent[]>([]);
  const [error, setError]             = useState<string | null>(null);
  const unsubRef                      = useRef<(() => void) | null>(null);

  // Subscribe to contract events once connected
  const subscribeEvents = useCallback(() => {
    if (unsubRef.current) unsubRef.current();
    unsubRef.current = web3Service.subscribeToEvents(evt => {
      setChainEvents(prev => [evt, ...prev].slice(0, 200));
    });
  }, []);

  const connectMetaMask = useCallback(async () => {
    setError(null);
    setStatus('connecting');
    try {
      const w = await web3Service.connectMetaMask();
      setWallet(w);
      setStatus('connected');
      subscribeEvents();
    } catch (err: any) {
      setError(err.message ?? 'MetaMask connection failed');
      setStatus('error');
    }
  }, [subscribeEvents]);

  const connectLocalNode = useCallback(async (url?: string) => {
    setError(null);
    setStatus('connecting');
    try {
      const w = await web3Service.connectLocalNode(url);
      setWallet(w);
      setStatus('connected');
      subscribeEvents();
    } catch (err: any) {
      setError(err.message ?? 'Local node connection failed');
      setStatus('error');
    }
  }, [subscribeEvents]);

  const disconnect = useCallback(() => {
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    web3Service.disconnect();
    setStatus('disconnected');
    setWallet(null);
    setChainEvents([]);
    setError(null);
  }, []);

  const getTrustScore  = useCallback((addr: string)     => web3Service.getTrustScore(addr),       []);
  const getTrustScores = useCallback((addrs: string[])   => web3Service.getTrustScores(addrs),     []);
  const clearEvents    = useCallback(() => setChainEvents([]), []);

  // Cleanup on unmount
  useEffect(() => () => { if (unsubRef.current) unsubRef.current(); }, []);

  return (
    <Web3Context.Provider value={{
      status, wallet, chainEvents, error,
      connectMetaMask, connectLocalNode, disconnect,
      getTrustScore, getTrustScores, clearEvents,
    }}>
      {children}
    </Web3Context.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useWeb3 = (): Web3ContextValue => {
  const ctx = useContext(Web3Context);
  if (!ctx) throw new Error('useWeb3 must be used inside <Web3Provider>');
  return ctx;
};

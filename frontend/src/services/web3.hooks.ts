import { useState, useEffect, useCallback } from 'react';
import { useWeb3 } from './Web3Context';
import { TrustRecord, ChainEvent } from './web3.service';
import { web3Service } from './web3.service';

// ─── useNodeTrustScores ───────────────────────────────────────────────────────
// Reads trust scores for a list of node addresses once connected.
export function useNodeTrustScores(addresses: string[]) {
  const { status } = useWeb3();
  const [scores, setScores]   = useState<TrustRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (status !== 'connected' || addresses.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const results = await web3Service.getTrustScores(addresses);
      setScores(results);
    } catch (err: any) {
      setError(err.message ?? 'Failed to read trust scores');
    } finally {
      setLoading(false);
    }
  }, [status, addresses]);

  useEffect(() => { refresh(); }, [refresh]);

  return { scores, loading, error, refresh };
}

// ─── useChainEventFeed ────────────────────────────────────────────────────────
// Streams TrustLedger contract events, filtered by optional event name.
export function useChainEventFeed(filter?: string) {
  const { chainEvents } = useWeb3();
  const filtered = filter
    ? chainEvents.filter(e => e.event === filter)
    : chainEvents;
  return filtered;
}

// ─── usePastEvents ────────────────────────────────────────────────────────────
// Fetches past blockchain events for the TX log initial load.
export function usePastEvents(eventName: string) {
  const { status } = useWeb3();
  const [events, setEvents]   = useState<ChainEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status !== 'connected') return;
    setLoading(true);
    web3Service.getPastEvents(eventName)
      .then(setEvents)
      .finally(() => setLoading(false));
  }, [status, eventName]);

  return { events, loading };
}

// ─── useWalletStatus ─────────────────────────────────────────────────────────
// Returns a human-readable connection summary for the status bar.
export function useWalletStatus() {
  const { status, wallet } = useWeb3();
  return {
    connected: status === 'connected',
    connecting: status === 'connecting',
    address: wallet?.address ?? null,
    shortAddress: wallet ? `${wallet.address.slice(0,6)}…${wallet.address.slice(-4)}` : null,
    balance: wallet?.balance ?? null,
    network: wallet?.network ?? null,
    chainId: wallet?.chainId ?? null,
  };
}

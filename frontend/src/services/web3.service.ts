import Web3 from 'web3';
import { WEB3_CONFIG } from './web3.config';
import { NODE_REGISTRY_ABI, TRUST_LEDGER_ABI } from './contracts.abi';

// ─── Types ────────────────────────────────────────────────────────────────────
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface WalletInfo {
  address: string;
  balance: string;
  chainId: number;
  network: string;
}

export interface TrustRecord {
  node: string;
  score: number;       // 0–100
  lastUpdated: number; // unix ms
  isBlocked: boolean;
}

export interface ChainEvent {
  event: string;
  nodeAddress: string;
  txHash: string;
  blockNumber: number;
  data: Record<string, any>;
  timestamp: number;
}

// ─── Web3 Service ─────────────────────────────────────────────────────────────
class Web3Service {
  private web3: Web3 | null = null;
  public status: ConnectionStatus = 'disconnected';
  public wallet: WalletInfo | null = null;
  public nodeRegistryContract: any = null;
  public trustLedgerContract: any   = null;
  private eventListeners: ((evt: ChainEvent) => void)[] = [];

  // ── Connect MetaMask ─────────────────────────────────────────────────────────
  async connectMetaMask(): Promise<WalletInfo> {
    if (typeof (window as any).ethereum === 'undefined') {
      throw new Error('MetaMask is not installed. Please install the MetaMask browser extension.');
    }

    this.status = 'connecting';

    // Request accounts
    const accounts: string[] = await (window as any).ethereum.request({
      method: 'eth_requestAccounts',
    });

    this.web3 = new Web3((window as any).ethereum);

    return this._finalizeConnection(accounts[0]);
  }

  // ── Connect Local Node (Ganache / Hardhat) ────────────────────────────────────
  async connectLocalNode(url?: string): Promise<WalletInfo> {
    this.status = 'connecting';
    const rpcUrl = url ?? (WEB3_CONFIG.activeProvider === 'ganache'
      ? WEB3_CONFIG.providers.ganache
      : WEB3_CONFIG.providers.hardhat);

    this.web3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));
    const accounts = await this.web3.eth.getAccounts();
    if (accounts.length === 0) throw new Error('No accounts found on local node');

    return this._finalizeConnection(accounts[0]);
  }

  // ── Internal: finalize connection & bind contracts ────────────────────────────
  private async _finalizeConnection(account: string): Promise<WalletInfo> {
    if (!this.web3) throw new Error('Web3 not initialized');

    const [balanceWei, chainId] = await Promise.all([
      this.web3.eth.getBalance(account),
      this.web3.eth.getChainId(),
    ]);

    const balance = parseFloat(this.web3.utils.fromWei(balanceWei, 'ether')).toFixed(4);
    const networkName = this._chainIdToName(Number(chainId));

    this.wallet = { address: account, balance, chainId: Number(chainId), network: networkName };
    this.status = 'connected';

    // Bind contracts
    this.nodeRegistryContract = new this.web3.eth.Contract(
      NODE_REGISTRY_ABI as any,
      WEB3_CONFIG.contracts.NodeRegistry
    );
    this.trustLedgerContract = new this.web3.eth.Contract(
      TRUST_LEDGER_ABI as any,
      WEB3_CONFIG.contracts.TrustLedger
    );

    // Wire MetaMask events
    this._bindMetaMaskListeners();

    return this.wallet;
  }

  // ── Read: get trust score for a node ─────────────────────────────────────────
  async getTrustScore(nodeAddress: string): Promise<TrustRecord> {
    if (!this.trustLedgerContract) throw new Error('Contract not connected');
    try {
      const result = await this.trustLedgerContract.methods.getTrustScore(nodeAddress).call();
      return {
        node:        nodeAddress,
        score:       Number(result.score ?? result[0] ?? 0),
        lastUpdated: Number(result.lastUpdated ?? result[1] ?? 0) * 1000,
        isBlocked:   Boolean(result.isBlocked ?? result[2] ?? false),
      };
    } catch (err) {
      console.warn('[Web3] getTrustScore failed:', err);
      return { node: nodeAddress, score: 0, lastUpdated: 0, isBlocked: false };
    }
  }

  // ── Read: get trust scores for multiple nodes ─────────────────────────────────
  async getTrustScores(addresses: string[]): Promise<TrustRecord[]> {
    return Promise.all(addresses.map(addr => this.getTrustScore(addr)));
  }

  // ── Listen: subscribe to TrustLedger events ───────────────────────────────────
  subscribeToEvents(callback: (evt: ChainEvent) => void): () => void {
    this.eventListeners.push(callback);

    if (!this.trustLedgerContract || !this.web3) {
      console.warn('[Web3] Contract not connected — event subscription deferred');
      return () => { this.eventListeners = this.eventListeners.filter(l => l !== callback); };
    }

    // Subscribe to all TrustLedger events
    const events = ['TrustUpdated', 'AnomalyReported', 'AccessRevoked', 'AccessRestored'];
    const subscriptions: any[] = [];

    events.forEach(eventName => {
      try {
        const sub = this.trustLedgerContract.events[eventName]({ fromBlock: 'latest' });
        sub.on('data', (event: any) => {
          const chainEvent: ChainEvent = {
            event:       eventName,
            nodeAddress: event.returnValues?.node ?? '',
            txHash:      event.transactionHash ?? '',
            blockNumber: Number(event.blockNumber ?? 0),
            data:        event.returnValues ?? {},
            timestamp:   Date.now(),
          };
          this.eventListeners.forEach(l => l(chainEvent));
        });
        sub.on('error', (err: any) => console.warn(`[Web3] ${eventName} event error:`, err));
        subscriptions.push(sub);
      } catch (err) {
        console.warn(`[Web3] Could not subscribe to ${eventName}:`, err);
      }
    });

    // Unsubscribe cleanup function
    return () => {
      this.eventListeners = this.eventListeners.filter(l => l !== callback);
      subscriptions.forEach(s => { try { s.unsubscribe?.(); } catch {} });
    };
  }

  // ── Fetch past events (for TX table initial load) ─────────────────────────────
  async getPastEvents(eventName: string, fromBlock?: number): Promise<ChainEvent[]> {
    if (!this.trustLedgerContract || !this.web3) return [];
    try {
      const latestBlock = Number(await this.web3.eth.getBlockNumber());
      const from = fromBlock ?? Math.max(0, latestBlock - WEB3_CONFIG.pastEventBlockRange);
      const events = await this.trustLedgerContract.getPastEvents(eventName, {
        fromBlock: from,
        toBlock: 'latest',
      });
      return events.map((e: any) => ({
        event:       e.event,
        nodeAddress: e.returnValues?.node ?? '',
        txHash:      e.transactionHash,
        blockNumber: Number(e.blockNumber),
        data:        e.returnValues,
        timestamp:   Date.now(),
      }));
    } catch (err) {
      console.warn('[Web3] getPastEvents failed:', err);
      return [];
    }
  }

  // ── Disconnect ────────────────────────────────────────────────────────────────
  disconnect() {
    this.web3                  = null;
    this.wallet                = null;
    this.status                = 'disconnected';
    this.nodeRegistryContract  = null;
    this.trustLedgerContract   = null;
    this.eventListeners        = [];
  }

  // ── Utilities ────────────────────────────────────────────────────────────────
  get isConnected() { return this.status === 'connected'; }
  get web3Instance() { return this.web3; }

  private _chainIdToName(id: number): string {
    const map: Record<number, string> = {
      1: 'Mainnet', 11155111: 'Sepolia', 1337: 'Ganache', 31337: 'Hardhat', 5: 'Goerli'
    };
    return map[id] ?? `Chain #${id}`;
  }

  private _bindMetaMaskListeners() {
    if (typeof (window as any).ethereum === 'undefined') return;
    (window as any).ethereum.on?.('accountsChanged', (accounts: string[]) => {
      if (this.wallet) this.wallet.address = accounts[0] ?? '';
    });
    (window as any).ethereum.on?.('chainChanged', () => window.location.reload());
  }
}

// ── Singleton export ───────────────────────────────────────────────────────────
export const web3Service = new Web3Service();

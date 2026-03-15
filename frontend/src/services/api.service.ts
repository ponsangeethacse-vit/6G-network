import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE_URL = 'http://localhost:4000/api';

// ─── Axios Instance ───────────────────────────────────────────────────────────
export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10s
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Shared Response Types ───────────────────────────────────────────────────
export interface NodeInfo {
  address: string;
  role: number;
  trustScore?: number;
  status?: string;
}

export interface TrustScore {
  address: string;
  trustScore: number;
}

export interface AttackAlert {
  id: string;
  nodeId: string;
  nodeLabel: string;
  type: string;
  message: string;
  detail: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  trustScore: number;
  timestamp: number;
  resolved: boolean;
}

export interface BlockchainTransaction {
  blockId: string | number;
  nodeId: string;
  action: string;
  txHash: string;
  timestamp: string | number;
  trustScore?: number;
}

// ─── API Endpoints ──────────────────────────────────────────────────────────────
export const NodeService = {
  getNodes: async (): Promise<{ nodes: NodeInfo[] }> => {
    try {
      const resp = await api.get('/nodes');
      return resp.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },
  getNode: async (addr: string): Promise<NodeInfo> => {
    try {
      const resp = await api.get(`/nodes/${addr}`);
      return resp.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },
  isolateNode: async (addr: string): Promise<any> => {
    try {
      const resp = await api.post(`/nodes/${addr}/isolate`);
      return resp.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },
  restoreNode: async (addr: string): Promise<any> => {
    try {
      const resp = await api.post(`/nodes/${addr}/restore`);
      return resp.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },
  updateTrustScore: async (addr: string, score: number): Promise<any> => {
    try {
      const resp = await api.post(`/nodes/${addr}/trust`, { score });
      return resp.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },
};

export const TrustService = {
  getTrustScores: async (): Promise<TrustScore[]> => {
    try {
      const resp = await api.get('/trust-scores');
      return resp.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },
};

export const AttackService = {
  getAttacks: async (params?: { limit?: number; severity?: string; type?: string }): Promise<AttackAlert[]> => {
    try {
      const resp = await api.get('/attacks', { params });
      return resp.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },
};

export const TransactionService = {
  getTransactions: async (params?: { limit?: number; nodeId?: string; action?: string }): Promise<BlockchainTransaction[]> => {
    try {
      const resp = await api.get('/transactions', { params });
      return resp.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },
};

// ─── Error Handler Utility ────────────────────────────────────────────────────
function handleApiError(error: any): Error {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<any>;
    const message = axiosError.response?.data?.error || axiosError.response?.data?.message || axiosError.message;
    return new Error(message || 'Unknown API Exception');
  }
  return error instanceof Error ? error : new Error('Fatal Error');
}

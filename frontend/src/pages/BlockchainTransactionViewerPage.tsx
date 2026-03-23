import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Row, Col, Card, Table, Badge, Button, ButtonGroup, Spinner, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { io } from 'socket.io-client';
import {
  Database, RefreshCw, Copy, CheckCheck,
  ShieldCheck, ShieldOff, ShieldAlert, Activity, ArrowUpRight
} from 'lucide-react';

// ─── Web3.js integration stub ─────────────────────────────────────────────────
// When a live Ethereum node + deployed contract is available, replace the
// CONTRACT_ADDRESS and ABI below and uncomment the Web3 connection block.
//
//  import Web3 from 'web3';
//  const ETHEREUM_RPC = 'http://127.0.0.1:8545'; // Hardhat / Ganache
//  const CONTRACT_ADDRESS = '0xYourTrustLedgerAddress';
//  const TRUST_LEDGER_ABI = [
//    { "type":"event","name":"TrustUpdated", "inputs":[{"name":"node","type":"address"},{"name":"newScore","type":"uint256"}] },
//    { "type":"event","name":"AnomalyReported","inputs":[{"name":"node","type":"address"},{"name":"reason","type":"string"},{"name":"score","type":"uint256"}] },
//    { "type":"event","name":"AccessRevoked",  "inputs":[{"name":"node","type":"address"}] },
//    { "type":"event","name":"AccessRestored", "inputs":[{"name":"node","type":"address"}] },
//  ];
//
//  async function fetchChainEvents(): Promise<Transaction[]> {
//    const web3 = new Web3(ETHEREUM_RPC);
//    const contract = new web3.eth.Contract(TRUST_LEDGER_ABI, CONTRACT_ADDRESS);
//    const fromBlock = (await web3.eth.getBlockNumber()) - BigInt(1000);
//    const events = await contract.getPastEvents('allEvents', { fromBlock, toBlock: 'latest' });
//    return events.map(e => ({
//      id: Number(e.blockNumber),
//      blockId: Number(e.blockNumber),
//      nodeId: e.returnValues.node as string,
//      nodeLabel: `Node ${(e.returnValues.node as string).slice(2,6).toUpperCase()}`,
//      action: mapEventToAction(e.event),
//      txHash: e.transactionHash,
//      blockHash: e.blockHash,
//      timestamp: Date.now(),
//      trustScore: Number(e.returnValues.newScore ?? 0),
//    }));
//  }
//
// ─────────────────────────────────────────────────────────────────────────────

import { TransactionService } from '../services/api.service';

const SOCKET_URL = 'http://localhost:4000';

type ActionType = 'All' | 'Trust Score Updated' | 'Attack Detected' | 'Node Isolated' | 'Node Recovered';

interface Transaction {
  id: number;
  blockId: number;
  nodeId: string;
  nodeLabel: string;
  action: string;
  txHash: string;
  blockHash: string;
  timestamp: number;
  trustScore: number;
}

// ─── Action styling map ────────────────────────────────────────────────────────
const ACTION_STYLE: Record<string, { color: string; bg: string; icon: React.ReactNode; border: string }> = {
  'Trust Score Updated': { color: 'text-primary',  bg: 'rgba(13,110,253,0.10)',  border: 'rgba(13,110,253,0.25)', icon: <Activity size={13} /> },
  'Attack Detected':     { color: 'text-warning',  bg: 'rgba(255,193,7,0.10)',   border: 'rgba(255,193,7,0.25)',  icon: <ShieldAlert size={13} /> },
  'Node Isolated':       { color: 'text-danger',   bg: 'rgba(220,53,69,0.10)',   border: 'rgba(220,53,69,0.25)',  icon: <ShieldOff size={13} /> },
  'Node Recovered':      { color: 'text-success',  bg: 'rgba(25,135,84,0.10)',   border: 'rgba(25,135,84,0.25)',  icon: <ShieldCheck size={13} /> },
};

const ACTIONS: ActionType[] = ['All', 'Trust Score Updated', 'Attack Detected', 'Node Isolated', 'Node Recovered'];

// ─── Copy-to-clipboard button ────────────────────────────────────────────────
const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      className="btn btn-link p-0 ms-1 text-secondary"
      title="Copy"
      style={{ lineHeight: 1, verticalAlign: 'middle' }}
    >
      {copied ? <CheckCheck size={12} className="text-success" /> : <Copy size={12} />}
    </button>
  );
};

// ─── Truncated hash with tooltip ─────────────────────────────────────────────
const HashCell = ({ hash }: { hash: string }) => (
  <OverlayTrigger placement="top" overlay={<Tooltip style={{ fontFamily: 'monospace', fontSize: '11px' }}>{hash}</Tooltip>}>
    <span className="font-monospace text-info" style={{ fontSize: '11px', cursor: 'default' }}>
      {hash.slice(0, 10)}…{hash.slice(-6)}
      <CopyButton text={hash} />
    </span>
  </OverlayTrigger>
);

// ─── Action Badge ────────────────────────────────────────────────────────────
const ActionBadge = ({ action }: { action: string }) => {
  const s = ACTION_STYLE[action] ?? ACTION_STYLE['Trust Score Updated'];
  return (
    <Badge
      className={`${s.color} d-inline-flex align-items-center gap-1 fw-normal`}
      style={{ background: s.bg, border: `1px solid ${s.border}`, fontSize: '11px' }}
    >
      {s.icon}{action}
    </Badge>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const BlockchainTransactionViewerPage = () => {
  const [txs, setTxs]             = useState<Transaction[]>([]);
  const [loading, setLoading]     = useState(true);
  const [actionFilter, setAction] = useState<ActionType>('All');
  const [lastUpdated, setLast]    = useState<Date | null>(null);
  const [newTxIds, setNewTxIds]   = useState<Set<number>>(new Set());
  const highlightTimeout          = useRef<ReturnType<typeof setTimeout>>();

  // ── REST fetch ────────────────────────────────────────────────────────────
  const fetchTxs = useCallback(async () => {
    try {
      const data = await TransactionService.getTransactions({ limit: 100 });
      setTxs(data as any); // Cast if type definitions slightly mismatch in properties like nodeLabel
      setLast(new Date());
    } catch {
      /* backend may still be warming up */
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Socket real-time ──────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(SOCKET_URL);
    socket.on('new_transaction', (tx: Transaction) => {
      setTxs(prev => {
        if (prev.find(t => t.id === tx.id)) return prev;
        return [tx, ...prev].slice(0, 100);
      });
      setNewTxIds(prev => new Set([...prev, tx.id]));
      clearTimeout(highlightTimeout.current);
      highlightTimeout.current = setTimeout(() => setNewTxIds(new Set()), 2500);
      setLast(new Date());
    });
    return () => { socket.disconnect(); };
  }, []);

  // ── Initial load + poll ───────────────────────────────────────────────────
  useEffect(() => {
    fetchTxs();
    const iv = setInterval(fetchTxs, 6000);
    return () => clearInterval(iv);
  }, [fetchTxs]);

  // ── Filter ────────────────────────────────────────────────────────────────
  const visible = txs.filter(t => actionFilter === 'All' || t.action === actionFilter);

  // ── Summary counts ────────────────────────────────────────────────────────
  const counts: Record<ActionType, number> = {
    'All':                  txs.length,
    'Trust Score Updated':  txs.filter(t => t.action === 'Trust Score Updated').length,
    'Attack Detected':      txs.filter(t => t.action === 'Attack Detected').length,
    'Node Isolated':        txs.filter(t => t.action === 'Node Isolated').length,
    'Node Recovered':       txs.filter(t => t.action === 'Node Recovered').length,
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Header ── */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 className="text-light fw-bold mb-1">Blockchain Transaction Log</h4>
          <p className="text-secondary small mb-0">
            Immutable ledger of trust events &nbsp;·&nbsp; Web3.js ready &nbsp;·&nbsp; Live feed
          </p>
        </div>
        <div className="d-flex align-items-center gap-3">
          {lastUpdated && (
            <span className="text-secondary small d-flex align-items-center gap-1">
              <RefreshCw size={12} /> {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          {loading && <Spinner animation="border" variant="info" size="sm" />}
        </div>
      </div>

      {/* ── Summary pill cards ── */}
      <Row className="g-3 mb-4">
        {ACTIONS.filter(a => a !== 'All').map(action => {
          const s = ACTION_STYLE[action];
          return (
            <Col key={action} xs={6} md={3}>
              <Card
                bg="dark" border="secondary" className="shadow-sm"
                style={{ cursor: 'pointer', transition: 'transform 0.15s' }}
                onClick={() => setAction(action)}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'}
              >
                <Card.Body className="py-3 px-3 d-flex align-items-center gap-3">
                  <span className={s.color}>{s.icon}</span>
                  <div>
                    <div className={`fs-4 fw-bold ${s.color}`}>{counts[action]}</div>
                    <div className="text-secondary" style={{ fontSize: '11px' }}>{action}</div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* ── Action filter tabs ── */}
      <div className="d-flex gap-2 flex-wrap mb-3">
        <ButtonGroup size="sm">
          {ACTIONS.map(a => (
            <Button
              key={a}
              variant={actionFilter === a ? 'primary' : 'outline-secondary'}
              onClick={() => setAction(a)}
              style={{ fontSize: '11px' }}
            >
              {a}{a !== 'All' && <Badge bg="secondary" className="ms-1" style={{ fontSize: '9px' }}>{counts[a]}</Badge>}
            </Button>
          ))}
        </ButtonGroup>
        <Button size="sm" variant="outline-secondary" onClick={fetchTxs} style={{ fontSize: '11px' }}>
          <RefreshCw size={12} className="me-1" />Refresh
        </Button>
      </div>

      {/* ── Transaction Table ── */}
      <Card bg="dark" border="secondary" className="shadow-lg">
        <Card.Header className="bg-black bg-opacity-25 border-bottom border-secondary p-3 d-flex align-items-center justify-content-between">
          <h6 className="mb-0 text-secondary text-uppercase d-flex align-items-center gap-2" style={{ letterSpacing: '1px', fontSize: '12px' }}>
            <Database size={14} /> On-Chain Records
          </h6>
          <div className="d-flex align-items-center gap-2">
            <Badge bg="info" className="bg-opacity-25 text-info border border-info border-opacity-25" style={{ fontSize: '10px' }}>
              PROOF-OF-TRUST
            </Badge>
            <Badge bg="secondary" className="font-monospace" style={{ fontSize: '10px' }}>
              {visible.length} TXs
            </Badge>
          </div>
        </Card.Header>

        <Card.Body className="p-0">
          <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
            <Table hover variant="dark" className="mb-0" size="sm">
              <thead style={{ position: 'sticky', top: 0, backgroundColor: '#111116', zIndex: 1 }}>
                <tr>
                  <th className="text-secondary fw-normal px-3 py-2 small">Block ID</th>
                  <th className="text-secondary fw-normal py-2 small">Node</th>
                  <th className="text-secondary fw-normal py-2 small">Action</th>
                  <th className="text-secondary fw-normal py-2 small">Transaction Hash</th>
                  <th className="text-secondary fw-normal py-2 small">Block Hash</th>
                  <th className="text-secondary fw-normal py-2 small">Trust</th>
                  <th className="text-secondary fw-normal py-2 small">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-secondary py-5 small">
                      {loading ? 'Loading transactions…' : 'No transactions recorded yet. Waiting for simulator…'}
                    </td>
                  </tr>
                ) : visible.map(tx => {
                  const isNew = newTxIds.has(tx.id);
                  const style = ACTION_STYLE[tx.action] ?? ACTION_STYLE['Trust Score Updated'];
                  const scoreColor = tx.trustScore >= 70 ? 'text-success' : tx.trustScore >= 40 ? 'text-warning' : 'text-danger';
                  return (
                    <tr
                      key={tx.id}
                      style={{
                        transition: 'background 0.6s',
                        background: isNew ? 'rgba(13,110,253,0.07)' : 'transparent'
                      }}
                    >
                      {/* Block ID */}
                      <td className="px-3 py-2 font-monospace text-info small">#{tx.blockId}</td>

                      {/* Node */}
                      <td className="py-2">
                        <span className="text-light small fw-medium">{tx.nodeLabel}</span>
                        <p className="mb-0 text-secondary font-monospace" style={{ fontSize: '10px' }}>
                          {tx.nodeId.slice(0, 8)}…{tx.nodeId.slice(-4)}
                        </p>
                      </td>

                      {/* Action */}
                      <td className="py-2"><ActionBadge action={tx.action} /></td>

                      {/* TX Hash */}
                      <td className="py-2"><HashCell hash={tx.txHash} /></td>

                      {/* Block Hash */}
                      <td className="py-2"><HashCell hash={tx.blockHash} /></td>

                      {/* Trust Score */}
                      <td className={`py-2 fw-bold small ${scoreColor}`}>{tx.trustScore}%</td>

                      {/* Timestamp */}
                      <td className="py-2 text-secondary small" style={{ whiteSpace: 'nowrap' }}>
                        {new Date(tx.timestamp).toLocaleTimeString()}<br />
                        <span style={{ fontSize: '10px' }}>{new Date(tx.timestamp).toLocaleDateString()}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </Card.Body>

        <Card.Footer className="bg-transparent border-top border-secondary p-2 d-flex justify-content-between align-items-center">
          <span className="text-secondary" style={{ fontSize: '11px' }}>
            Showing {visible.length} of {txs.length} total records &nbsp;·&nbsp; Hover hashes for full value &nbsp;·&nbsp; Click <Copy size={10} className="mx-1" /> to copy
          </span>
          <span className="text-secondary d-flex align-items-center gap-1" style={{ fontSize: '11px' }}>
            <ArrowUpRight size={12} className="text-info" />
            Web3.js contract hooks ready — see code comments to connect Hardhat
          </span>
        </Card.Footer>
      </Card>
    </div>
  );
};

export default BlockchainTransactionViewerPage;

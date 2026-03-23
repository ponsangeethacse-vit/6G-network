import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Badge, Button, ButtonGroup, Spinner,
  Modal, Form, Row, Col, Alert
} from 'react-bootstrap';
import { io } from 'socket.io-client';
import {
  Server, Smartphone, Cpu, Activity,
  ShieldCheck, ShieldAlert, ShieldOff, ShieldX,
  RefreshCw, Database, Lock, Unlock, Sliders, Search
} from 'lucide-react';

import { NodeService, TrustService, TransactionService } from '../services/api.service';

const SOCKET_URL = 'http://localhost:4000';

// ─── Types ────────────────────────────────────────────────────────────────────
type NodeStatus = 'trusted' | 'suspicious' | 'malicious' | 'isolated';
type ActionState = 'idle' | 'loading' | 'success' | 'error';

interface ManagedNode {
  address: string;
  role: number;
  trustScore: number;
  status: NodeStatus;
  lastActivity: number;
  actionState: ActionState;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const classify = (score: number): NodeStatus =>
  score === 0 ? 'isolated' : score >= 70 ? 'trusted' : score >= 40 ? 'suspicious' : 'malicious';

const getRoleLabel = (role?: number) => {
  switch (role) {
    case 1: return 'IoT Edge Device';
    case 2: return 'Base Station';
    case 3: return 'Cellular Relay';
    default: return 'Unknown';
  }
};

const getRoleIcon = (role?: number, size = 15) => {
  switch (role) {
    case 1: return <Smartphone size={size} className="text-info me-2" />;
    case 2: return <Server size={size} className="text-primary me-2" />;
    case 3: return <Cpu size={size} className="text-warning me-2" />;
    default: return <Activity size={size} className="text-secondary me-2" />;
  }
};

const STATUS_STYLE: Record<NodeStatus, { bg: string; color: string; icon: React.ReactNode; label: string }> = {
  trusted:    { bg: 'success', color: 'text-success', icon: <ShieldCheck size={12} className="me-1" />,  label: 'Trusted'    },
  suspicious: { bg: 'warning', color: 'text-warning', icon: <ShieldAlert size={12} className="me-1" />,  label: 'Suspicious' },
  malicious:  { bg: 'danger',  color: 'text-danger',  icon: <ShieldX size={12} className="me-1" />,     label: 'Malicious'  },
  isolated:   { bg: 'dark',    color: 'text-secondary',icon: <ShieldOff size={12} className="me-1" />,   label: 'Isolated'   },
};

const StatusBadge = ({ status }: { status: NodeStatus }) => {
  const s = STATUS_STYLE[status];
  return (
    <Badge bg={s.bg} className="text-uppercase d-inline-flex align-items-center" style={{ fontSize: '10px' }}>
      {s.icon}{s.label}
    </Badge>
  );
};

const ScoreBar = ({ score }: { score: number }) => {
  const color = score >= 70 ? 'success' : score >= 40 ? 'warning' : 'danger';
  return (
    <div className="d-flex align-items-center gap-2">
      <span className={`fw-bold small text-${color}`} style={{ width: 34 }}>{score}%</span>
      <div className="bg-secondary bg-opacity-25 rounded-pill flex-grow-1" style={{ height: 6 }}>
        <div
          className={`bg-${color} h-100 rounded-pill`}
          style={{ width: `${score}%`, transition: 'width 0.5s ease' }}
        />
      </div>
    </div>
  );
};

// ─── Update Trust Score Modal ─────────────────────────────────────────────────
interface UpdateModalProps {
  node: ManagedNode | null;
  show: boolean;
  onHide: () => void;
  onSave: (addr: string, score: number) => void;
}
const UpdateTrustModal = ({ node, show, onHide, onSave }: UpdateModalProps) => {
  const [score, setScore] = useState(node?.trustScore ?? 75);
  useEffect(() => { setScore(node?.trustScore ?? 75); }, [node]);

  return (
    <Modal show={show} onHide={onHide} centered contentClassName="bg-dark border border-secondary text-light">
      <Modal.Header className="border-secondary">
        <Modal.Title className="fs-6 d-flex align-items-center gap-2">
          <Sliders size={16} className="text-primary" /> Update Trust Score
        </Modal.Title>
        <button className="btn-close btn-close-white" onClick={onHide} />
      </Modal.Header>
      <Modal.Body>
        <p className="text-secondary small mb-3">
          Manually set the trust score for:{' '}
          <span className="font-monospace text-info">{node?.address.slice(0, 16)}…</span>
        </p>
        <Form.Group>
          <Form.Label className="small text-secondary">New Trust Score: <strong className="text-light">{score}%</strong></Form.Label>
          <Form.Range
            min={0} max={100} value={score}
            onChange={e => setScore(Number(e.target.value))}
            className="mb-1"
          />
          <div className="d-flex justify-content-between text-secondary" style={{ fontSize: '10px' }}>
            <span>0 — Malicious</span><span>40 — Suspicious</span><span>70 — Trusted</span><span>100</span>
          </div>
        </Form.Group>
        <div className="mt-3">
          <ScoreBar score={score} />
        </div>
      </Modal.Body>
      <Modal.Footer className="border-secondary">
        <Button variant="outline-secondary" size="sm" onClick={onHide}>Cancel</Button>
        <Button variant="primary" size="sm" onClick={() => { node && onSave(node.address, score); onHide(); }}>
          Apply & Record on Chain
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

// ─── Blockchain Record Modal ──────────────────────────────────────────────────
interface BlockchainModalProps {
  node: ManagedNode | null;
  records: any[];
  show: boolean;
  onHide: () => void;
}
const BlockchainRecordModal = ({ node, records, show, onHide }: BlockchainModalProps) => (
  <Modal show={show} onHide={onHide} centered size="lg" contentClassName="bg-dark border border-secondary text-light">
    <Modal.Header className="border-secondary">
      <Modal.Title className="fs-6 d-flex align-items-center gap-2">
        <Database size={16} className="text-info" /> Blockchain Records — {node?.address.slice(0, 14)}…
      </Modal.Title>
      <button className="btn-close btn-close-white" onClick={onHide} />
    </Modal.Header>
    <Modal.Body>
      {records.length === 0 ? (
        <p className="text-secondary text-center py-3 small">No blockchain records found for this node.</p>
      ) : (
        <Table variant="dark" hover size="sm" className="mb-0">
          <thead>
            <tr>
              <th className="text-secondary fw-normal small">Block</th>
              <th className="text-secondary fw-normal small">Action</th>
              <th className="text-secondary fw-normal small">TX Hash</th>
              <th className="text-secondary fw-normal small">Trust</th>
              <th className="text-secondary fw-normal small">Time</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => (
              <tr key={i}>
                <td className="font-monospace text-info small">#{r.blockId}</td>
                <td className="small text-light">{r.action}</td>
                <td className="font-monospace text-secondary" style={{ fontSize: '10px' }}>
                  {r.txHash?.slice(0, 12)}…
                </td>
                <td className={`small fw-bold ${r.trustScore >= 70 ? 'text-success' : r.trustScore >= 40 ? 'text-warning' : 'text-danger'}`}>
                  {r.trustScore}%
                </td>
                <td className="small text-secondary">{new Date(r.timestamp).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Modal.Body>
    <Modal.Footer className="border-secondary">
      <Button variant="outline-secondary" size="sm" onClick={onHide}>Close</Button>
    </Modal.Footer>
  </Modal>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const NodeManagementPanelPage = () => {
  const [nodes, setNodes]             = useState<ManagedNode[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [statusFilter, setFilter]     = useState<NodeStatus | 'all'>('all');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [toast, setToast]             = useState<{ msg: string; variant: string } | null>(null);

  // Modals
  const [updateModal, setUpdateModal]   = useState(false);
  const [chainModal, setChainModal]     = useState(false);
  const [selectedNode, setSelectedNode] = useState<ManagedNode | null>(null);
  const [chainRecords, setChainRecords] = useState<any[]>([]);

  // ── Fetch ─────────────────────────────────────────────────────────────
  const fetchNodes = useCallback(async () => {
    try {
      const data = await NodeService.getNodes();
      const raw = data.nodes ?? [];

      const [tsData, txData] = await Promise.all([
        TrustService.getTrustScores().catch(() => []),
        TransactionService.getTransactions({ limit: 100 }).catch(() => []),
      ]);

      // Map trust scores by address
      const tsMap: Record<string, number> = {};
      tsData.forEach((t: any) => { tsMap[t.address] = Math.round(t.trustScore * 100); });

      // Map last activity by address
      const actMap: Record<string, number> = {};
      txData.forEach((t: any) => {
        if (!actMap[t.nodeId] || t.timestamp > actMap[t.nodeId]) actMap[t.nodeId] = Number(t.timestamp);
      });

      const enriched: ManagedNode[] = raw.map((n: any) => {
        const score = tsMap[n.address] ?? 85;
        return {
          address: n.address,
          role: n.role,
          trustScore: score,
          status: classify(score),
          lastActivity: actMap[n.address] ?? Date.now(),
          actionState: 'idle',
        };
      });

      setNodes(enriched);
      setLastUpdated(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Socket live updates ───────────────────────────────────────────────
  useEffect(() => {
    const socket = io(SOCKET_URL);
    socket.on('trust_update', (tick: { node: string; trustScore: number }) => {
      setNodes(prev => prev.map(n =>
        n.address === tick.node
          ? { ...n, trustScore: tick.trustScore, status: classify(tick.trustScore), lastActivity: Date.now() }
          : n
      ));
    });
    socket.on('node_action', (evt: { addr: string; trustScore: number; action: string }) => {
      setNodes(prev => prev.map(n =>
        n.address === evt.addr
          ? { ...n, trustScore: evt.trustScore, status: classify(evt.trustScore), actionState: 'success', lastActivity: Date.now() }
          : n
      ));
    });
    return () => { socket.disconnect(); };
  }, []);

  useEffect(() => {
    fetchNodes();
    const iv = setInterval(fetchNodes, 8000);
    return () => clearInterval(iv);
  }, [fetchNodes]);

  // ── Admin actions ─────────────────────────────────────────────────────
  const setNodeState = (addr: string, state: ActionState) =>
    setNodes(prev => prev.map(n => n.address === addr ? { ...n, actionState: state } : n));

  const showToast = (msg: string, variant = 'success') => {
    setToast({ msg, variant });
    setTimeout(() => setToast(null), 3000);
  };

  const handleIsolate = async (node: ManagedNode) => {
    setNodeState(node.address, 'loading');
    try {
      await NodeService.isolateNode(node.address);
      showToast(`Node ${node.address.slice(2, 6).toUpperCase()} isolated successfully`);
    } catch {
      setNodeState(node.address, 'error');
      showToast('Failed to isolate node', 'danger');
    }
  };

  const handleRestore = async (node: ManagedNode) => {
    setNodeState(node.address, 'loading');
    try {
      await NodeService.restoreNode(node.address);
      showToast(`Node ${node.address.slice(2, 6).toUpperCase()} restored`, 'success');
    } catch {
      setNodeState(node.address, 'error');
      showToast('Failed to restore node', 'danger');
    }
  };

  const handleUpdateTrust = async (addr: string, score: number) => {
    setNodeState(addr, 'loading');
    try {
      await NodeService.updateTrustScore(addr, score);
      showToast(`Trust score updated to ${score}%`);
    } catch {
      setNodeState(addr, 'error');
      showToast('Failed to update trust score', 'danger');
    }
  };

  const handleViewChain = async (node: ManagedNode) => {
    setSelectedNode(node);
    try {
      const data = await TransactionService.getTransactions({ nodeId: node.address, limit: 20 });
      setChainRecords(data);
    } catch { setChainRecords([]); }
    setChainModal(true);
  };

  // ── Filter & search ──────────────────────────────────────────────────
  const visible = nodes.filter(n => {
    const matchSearch = !search || n.address.toLowerCase().includes(search.toLowerCase()) || getRoleLabel(n.role).toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || n.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // ── Summary counts ────────────────────────────────────────────────────
  const counts = {
    trusted:    nodes.filter(n => n.status === 'trusted').length,
    suspicious: nodes.filter(n => n.status === 'suspicious').length,
    malicious:  nodes.filter(n => n.status === 'malicious').length,
    isolated:   nodes.filter(n => n.status === 'isolated').length,
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="position-fixed top-0 end-0 p-3" style={{ zIndex: 9999 }}>
          <Alert variant={toast.variant} className="mb-0 shadow-lg d-flex align-items-center gap-2" style={{ fontSize: '13px' }}>
            {toast.variant === 'success' ? <ShieldCheck size={15} /> : <ShieldX size={15} />}
            {toast.msg}
          </Alert>
        </div>
      )}

      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 className="text-light fw-bold mb-1">Node Management</h4>
          <p className="text-secondary small mb-0">Admin panel — isolate, restore, and manage 6G network nodes</p>
        </div>
        <div className="d-flex align-items-center gap-2">
          {lastUpdated && <span className="text-secondary small d-flex align-items-center gap-1"><RefreshCw size={12} />{lastUpdated.toLocaleTimeString()}</span>}
          {loading && <Spinner animation="border" variant="primary" size="sm" />}
          <Button size="sm" variant="outline-secondary" onClick={fetchNodes} style={{ fontSize: '11px' }}>
            <RefreshCw size={12} className="me-1" />Refresh
          </Button>
        </div>
      </div>

      {/* Summary pills */}
      <Row className="g-3 mb-4">
        {(Object.entries(counts) as [NodeStatus, number][]).map(([status, count]) => {
          const s = STATUS_STYLE[status];
          return (
            <Col key={status} xs={6} md={3}>
              <Card
                bg="dark" border="secondary" className="shadow-sm"
                style={{ cursor: 'pointer' }}
                onClick={() => setFilter(statusFilter === status ? 'all' : status)}
              >
                <Card.Body className="py-3 px-3 d-flex align-items-center gap-3">
                  <span className={s.color}>{s.icon}</span>
                  <div>
                    <div className={`fs-4 fw-bold ${s.color}`}>{count}</div>
                    <div className="text-secondary" style={{ fontSize: '11px' }}>{s.label}</div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* Filters row */}
      <div className="d-flex gap-2 flex-wrap mb-3 align-items-center">
        <div className="position-relative flex-grow-1" style={{ maxWidth: '280px' }}>
          <Search size={14} className="position-absolute text-secondary" style={{ top: '50%', left: 10, transform: 'translateY(-50%)' }} />
          <Form.Control
            type="text"
            placeholder="Search by address or role…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-dark text-light border-secondary ps-4"
            style={{ fontSize: '12px' }}
          />
        </div>
        <ButtonGroup size="sm">
          {(['all', 'trusted', 'suspicious', 'malicious', 'isolated'] as const).map(s => (
            <Button
              key={s}
              variant={statusFilter === s ? 'primary' : 'outline-secondary'}
              onClick={() => setFilter(s)}
              style={{ fontSize: '11px' }}
            >
              {s === 'all' ? 'All' : STATUS_STYLE[s]?.label}
            </Button>
          ))}
        </ButtonGroup>
      </div>

      {/* Main Table */}
      <Card bg="dark" border="secondary" className="shadow-lg">
        <Card.Header className="bg-black bg-opacity-25 border-bottom border-secondary p-3 d-flex align-items-center justify-content-between">
          <h6 className="mb-0 text-secondary text-uppercase" style={{ letterSpacing: '1px', fontSize: '12px' }}>
            <Server size={13} className="me-2" />Network Node Registry
          </h6>
          <Badge bg="secondary" className="font-monospace" style={{ fontSize: '10px' }}>
            {visible.length}/{nodes.length} nodes
          </Badge>
        </Card.Header>

        <Card.Body className="p-0">
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <Table hover variant="dark" className="mb-0">
              <thead style={{ position: 'sticky', top: 0, backgroundColor: '#111116', zIndex: 1 }}>
                <tr>
                  <th className="text-secondary fw-normal px-3 py-2 small">Node ID</th>
                  <th className="text-secondary fw-normal py-2 small">Role</th>
                  <th className="text-secondary fw-normal py-2 small" style={{ minWidth: 160 }}>Trust Score</th>
                  <th className="text-secondary fw-normal py-2 small">Status</th>
                  <th className="text-secondary fw-normal py-2 small">Last Activity</th>
                  <th className="text-secondary fw-normal py-2 small text-end pe-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && visible.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-secondary py-5 small">Loading nodes…</td></tr>
                ) : visible.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-secondary py-5 small">No nodes match filter</td></tr>
                ) : visible.map(node => {
                  const isLoading = node.actionState === 'loading';
                  const nlabel = `Node ${node.address.slice(2,6).toUpperCase()}`;
                  return (
                    <tr key={node.address}>
                      {/* Node ID */}
                      <td className="px-3 py-2 align-middle">
                        <div className="fw-bold text-light small">{nlabel}</div>
                        <div className="font-monospace text-secondary" style={{ fontSize: '10px' }}>
                          {node.address.slice(0, 12)}…{node.address.slice(-4)}
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-2 align-middle small text-light">
                        <div className="d-flex align-items-center">{getRoleIcon(node.role)}{getRoleLabel(node.role)}</div>
                      </td>

                      {/* Trust Score */}
                      <td className="py-2 align-middle" style={{ minWidth: 160 }}>
                        <ScoreBar score={node.trustScore} />
                      </td>

                      {/* Status */}
                      <td className="py-2 align-middle">
                        <StatusBadge status={node.status} />
                      </td>

                      {/* Last Activity */}
                      <td className="py-2 align-middle text-secondary small">
                        {new Date(node.lastActivity).toLocaleTimeString()}
                      </td>

                      {/* Actions */}
                      <td className="py-2 align-middle text-end pe-3">
                        <ButtonGroup size="sm">
                          {/* Isolate / Restore toggle */}
                          {node.status !== 'isolated' ? (
                            <Button
                              variant="outline-danger"
                              disabled={isLoading}
                              onClick={() => handleIsolate(node)}
                              title="Isolate Node"
                              style={{ fontSize: '10px' }}
                            >
                              {isLoading ? <Spinner animation="border" size="sm" style={{ width: 10, height: 10 }} /> : <><Lock size={11} className="me-1" />Isolate</>}
                            </Button>
                          ) : (
                            <Button
                              variant="outline-success"
                              disabled={isLoading}
                              onClick={() => handleRestore(node)}
                              title="Restore Node"
                              style={{ fontSize: '10px' }}
                            >
                              {isLoading ? <Spinner animation="border" size="sm" style={{ width: 10, height: 10 }} /> : <><Unlock size={11} className="me-1" />Restore</>}
                            </Button>
                          )}

                          {/* Update trust */}
                          <Button
                            variant="outline-primary"
                            disabled={isLoading}
                            onClick={() => { setSelectedNode(node); setUpdateModal(true); }}
                            title="Update Trust Score"
                            style={{ fontSize: '10px' }}
                          >
                            <Sliders size={11} className="me-1" />Trust
                          </Button>

                          {/* View blockchain */}
                          <Button
                            variant="outline-info"
                            disabled={isLoading}
                            onClick={() => handleViewChain(node)}
                            title="View Blockchain Records"
                            style={{ fontSize: '10px' }}
                          >
                            <Database size={11} className="me-1" />Chain
                          </Button>
                        </ButtonGroup>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </Card.Body>

        <Card.Footer className="bg-transparent border-top border-secondary p-2 text-secondary" style={{ fontSize: '11px' }}>
          Showing {visible.length} of {nodes.length} nodes &nbsp;·&nbsp; Actions are recorded immutably on the blockchain ledger
        </Card.Footer>
      </Card>

      {/* Modals */}
      <UpdateTrustModal
        node={selectedNode}
        show={updateModal}
        onHide={() => setUpdateModal(false)}
        onSave={handleUpdateTrust}
      />
      <BlockchainRecordModal
        node={selectedNode}
        records={chainRecords}
        show={chainModal}
        onHide={() => setChainModal(false)}
      />
    </div>
  );
};

export default NodeManagementPanelPage;

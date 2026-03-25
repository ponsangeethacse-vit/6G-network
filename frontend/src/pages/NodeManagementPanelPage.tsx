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
type ActionState = 'idle' | 'loading' | 'success' | 'error';

interface ManagedNode {
  nodeId: string;
  type: string;
  senderAddress: string;
  receiverAddress: string;
  trustScore: number;
  status: string;
  createdAt: string;
  actionState: ActionState;
  rfFingerprint?: string;
  csiBehavior?: number;
  snr?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
type NodeStatus = 'trusted' | 'suspicious' | 'malicious' | 'isolated' | 'active' | 'removed';

const classify = (score: number, status?: string): NodeStatus => {
  const s = status?.toLowerCase();
  if (s === 'removed') return 'removed';
  
  // If we have a trust score, use it for security classification
  // (Ignoring score === 0 as 'isolated' if you want to keep 'malicious' as the label)
  if (score >= 70) return 'trusted';
  if (score >= 40) return 'suspicious';
  if (score > 0)  return 'malicious';
  if (score === 0) return 'malicious'; // or 'isolated'

  if (s === 'active' || s === 'healthy' || s === 'normal') return 'active';
  return 'malicious';
};

const getRoleIcon = (type: string, size = 15) => {
  switch (type) {
    case 'User Device': return <Smartphone size={size} className="text-info me-2" />;
    case 'Base Station': return <Server size={size} className="text-primary me-2" />;
    case 'Edge Node': return <Cpu size={size} className="text-warning me-2" />;
    default: return <Activity size={size} className="text-secondary me-2" />;
  }
};

const STATUS_STYLE: Record<string, { bg: string; color: string; icon: React.ReactNode; label: string }> = {
  trusted:    { bg: 'success', color: 'text-success', icon: <ShieldCheck size={12} className="me-1" />,  label: 'Trusted'    },
  suspicious: { bg: 'warning', color: 'text-warning', icon: <ShieldAlert size={12} className="me-1" />,  label: 'Suspicious' },
  malicious:  { bg: 'danger',  color: 'text-danger',  icon: <ShieldX size={12} className="me-1" />,     label: 'Malicious'  },
  isolated:   { bg: 'dark',    color: 'text-secondary',icon: <ShieldOff size={12} className="me-1" />,   label: 'Isolated'   },
  active:      { bg: 'info',    color: 'text-info',     icon: <Activity size={12} className="me-1" />,    label: 'Active'      },
  removed:     { bg: 'secondary',color: 'text-secondary',icon: <ShieldOff size={12} className="me-1" />,   label: 'Removed'     },
};

const StatusBadge = ({ status, score }: { status: string; score: number }) => {
  const sKey = classify(score, status);
  const s = STATUS_STYLE[sKey] || STATUS_STYLE.active;
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
  onSave: (nodeId: string, score: number) => void;
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
          <span className="font-monospace text-info">{node?.nodeId}</span>
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
        <Button variant="primary" size="sm" onClick={() => { node && onSave(node.nodeId, score); onHide(); }}>
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
        <Database size={16} className="text-info" /> Blockchain Records — {node?.nodeId}
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

// ─── Add Node Modal ───────────────────────────────────────────────────────────
interface AddModalProps {
  show: boolean;
  onHide: () => void;
  onSave: (nodeData: any) => void;
}
const AddNodeModal = ({ show, onHide, onSave }: AddModalProps) => {
  const [formData, setFormData] = useState({
    nodeId: `NODE_${Math.floor(Math.random() * 1000)}`,
    type: 'IoT Device',
    senderAddress: '0x' + Array.from({length: 40}, () => Math.floor(Math.random() * 16).toString(16)).join(''),
    receiverAddress: '0x' + Array.from({length: 40}, () => Math.floor(Math.random() * 16).toString(16)).join(''),
    trustScore: 80,
    rfFingerprint: '',
    csiBehavior: 0.85,
    snr: 25.0
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} centered contentClassName="bg-dark border border-secondary text-light">
      <Modal.Header className="border-secondary">
        <Modal.Title className="fs-6 d-flex align-items-center gap-2">
          <Activity size={16} className="text-success" /> Initialize New Node
        </Modal.Title>
        <button className="btn-close btn-close-white" onClick={onHide} />
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <Row className="g-3">
            <Col md={12}>
              <Form.Label className="small text-secondary">Node ID</Form.Label>
              <Form.Control 
                className="bg-dark border-secondary text-light" 
                value={formData.nodeId} 
                onChange={e => setFormData({...formData, nodeId: e.target.value})}
                required 
              />
            </Col>
            <Col md={12}>
              <Form.Label className="small text-secondary">Node Type</Form.Label>
              <Form.Select 
                className="bg-dark border-secondary text-light"
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value})}
              >
                <option value="IoT Device">IoT Device</option>
                <option value="User Device">User Device</option>
                <option value="Edge Node">Edge Node</option>
                <option value="Base Station">Base Station</option>
              </Form.Select>
            </Col>
            <Col md={6}>
              <Form.Label className="small text-secondary">Sender Address</Form.Label>
              <Form.Control 
                className="bg-dark border-secondary text-light font-monospace small" 
                value={formData.senderAddress} 
                onChange={e => setFormData({...formData, senderAddress: e.target.value})}
                required 
              />
            </Col>
            <Col md={6}>
              <Form.Label className="small text-secondary">Receiver Address</Form.Label>
              <Form.Control 
                className="bg-dark border-secondary text-light font-monospace small" 
                value={formData.receiverAddress} 
                onChange={e => setFormData({...formData, receiverAddress: e.target.value})}
                required 
              />
            </Col>
            <Col md={12}>
              <Form.Label className="small text-secondary">Initial Trust Score: {formData.trustScore}%</Form.Label>
              <Form.Range 
                min={0} max={100} value={formData.trustScore}
                onChange={e => setFormData({...formData, trustScore: Number(e.target.value)})}
              />
            </Col>
            
            <Col md={12} className="mt-4 pt-2 border-top border-secondary border-opacity-10">
               <h6 className="text-info small mb-3 uppercase" style={{fontSize: '10px', letterSpacing: '1px'}}>Physical Layer Authentication (Advanced 5G Advanced)</h6>
            </Col>

            <Col md={6}>
              <Form.Label className="small text-secondary">RF Fingerprint (Custom)</Form.Label>
              <Form.Control 
                className="bg-dark border-secondary text-light font-monospace small" 
                placeholder="Leave blank for auto-gen"
                value={formData.rfFingerprint} 
                onChange={e => setFormData({...formData, rfFingerprint: e.target.value})}
              />
            </Col>
            <Col md={3}>
              <Form.Label className="small text-secondary">CSI Nominal</Form.Label>
              <Form.Control 
                type="number" step="0.01"
                className="bg-dark border-secondary text-light small" 
                value={formData.csiBehavior} 
                onChange={e => setFormData({...formData, csiBehavior: Number(e.target.value)})}
              />
            </Col>
            <Col md={3}>
              <Form.Label className="small text-secondary">SNR (dB)</Form.Label>
              <Form.Control 
                type="number" step="0.1"
                className="bg-dark border-secondary text-light small" 
                value={formData.snr} 
                onChange={e => setFormData({...formData, snr: Number(e.target.value)})}
              />
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer className="border-secondary">
          <Button variant="outline-secondary" size="sm" onClick={onHide}>Cancel</Button>
          <Button variant="success" size="sm" type="submit">Initialize Node</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const NodeManagementPanelPage = () => {
  const [nodes, setNodes]             = useState<ManagedNode[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [statusFilter, setFilter]     = useState<string | 'all'>('all');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [toast, setToast]             = useState<{ msg: string; variant: string } | null>(null);

  // Modals
  const [addModal, setAddModal]         = useState(false);
  const [updateModal, setUpdateModal]   = useState(false);
  const [chainModal, setChainModal]     = useState(false);
  const [selectedNode, setSelectedNode] = useState<ManagedNode | null>(null);
  const [chainRecords, setChainRecords] = useState<any[]>([]);

  // ── Fetch ─────────────────────────────────────────────────────────────
  const fetchNodes = useCallback(async () => {
    try {
      const data = await NodeService.getNodes();
      const raw = Array.isArray(data) ? data : (data.nodes ?? []);

      const [tsData, txData] = await Promise.all([
        TrustService.getTrustScores().catch(() => []),
        TransactionService.getTransactions({ limit: 100 }).catch(() => []),
      ]);

      // Map trust scores by nodeId
      const tsMap: Record<string, number> = {};
      tsData.forEach((t: any) => { tsMap[t.nodeId || t.address] = Math.round(t.trustScore * 100); });

      const enriched: ManagedNode[] = raw.map((n: any) => {
        const nodeId = n.nodeId || n.address;
        const score = n.trustScore !== undefined ? Math.round(n.trustScore * 100) : (tsMap[nodeId] ?? 85);
        return {
          nodeId: nodeId,
          type: n.type || 'IoT Device',
          senderAddress: n.senderAddress || 'N/A',
          receiverAddress: n.receiverAddress || 'N/A',
          trustScore: score,
          status: n.status || 'Active',
          createdAt: n.createdAt || new Date().toISOString(),
          actionState: 'idle' as ActionState,
          rfFingerprint: n.rfFingerprint,
          csiBehavior: n.csiBehavior,
          snr: n.snr
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
        n.nodeId === tick.node
          ? { ...n, trustScore: tick.trustScore, status: classify(tick.trustScore, n.status), lastActivity: Date.now() }
          : n
      ));
    });
    socket.on('node_action', (evt: { addr: string; trustScore: number; action: string }) => {
      setNodes(prev => prev.map(n =>
        n.nodeId === evt.addr
          ? { ...n, trustScore: evt.trustScore, status: classify(evt.trustScore, n.status), actionState: 'success' }
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
  const setNodeState = (nodeId: string, state: ActionState) =>
    setNodes(prev => prev.map(n => n.nodeId === nodeId ? { ...n, actionState: state } : n));

  const showToast = (msg: string, variant = 'success') => {
    setToast({ msg, variant });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddNode = async (formData: any) => {
    try {
      setLoading(true);
      await NodeService.createNode(formData);
      showToast(`Node ${formData.nodeId} initialized successfully`);
      fetchNodes();
    } catch (e) {
      showToast(`Failed to initialize node: ${e}`, 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (node: ManagedNode) => {
    if (!window.confirm(`Are you sure you want to remove node ${node.nodeId}?`)) return;
    setNodeState(node.nodeId, 'loading');
    try {
      await NodeService.deleteNode(node.nodeId);
      showToast(`Node ${node.nodeId} removed from network`);
      fetchNodes();
    } catch {
      setNodeState(node.nodeId, 'error');
      showToast('Failed to remove node', 'danger');
    }
  };

  const handleUpdateTrust = async (nodeId: string, score: number) => {
    setNodeState(nodeId, 'loading');
    try {
      await NodeService.updateTrustScore(nodeId, score);
      showToast(`Trust score updated to ${score}%`);
      fetchNodes();
    } catch {
      setNodeState(nodeId, 'error');
      showToast('Failed to update trust score', 'danger');
    }
  };

  const handleViewChain = async (node: ManagedNode) => {
    setSelectedNode(node);
    try {
      const data = await TransactionService.getTransactions({ nodeId: node.nodeId, limit: 20 });
      setChainRecords(data);
    } catch { setChainRecords([]); }
    setChainModal(true);
  };

  // ── Filter & search ──────────────────────────────────────────────────
  const visible = nodes.filter(n => {
    const matchSearch = !search || n.nodeId.toLowerCase().includes(search.toLowerCase()) || n.type.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || classify(n.trustScore, n.status) === statusFilter;
    return matchSearch && matchStatus;
  });

  // ── Summary counts ────────────────────────────────────────────────────
  const counts = {
    active:     nodes.filter(n => n.status?.toLowerCase() !== 'removed').length,
    trusted:    nodes.filter(n => classify(n.trustScore, n.status) === 'trusted').length,
    malicious:  nodes.filter(n => classify(n.trustScore, n.status) === 'malicious').length,
    removed:    nodes.filter(n => n.status?.toLowerCase() === 'removed').length,
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
          <p className="text-secondary small mb-0">Admin panel — initialize, remove, and manage Advanced 5G network nodes</p>
        </div>
        <div className="d-flex align-items-center gap-3">
          <Button size="sm" variant="success" onClick={() => setAddModal(true)} className="d-flex align-items-center gap-2">
            <Activity size={14} /> Initialize Node
          </Button>
          <div className="d-flex align-items-center gap-2">
            {lastUpdated && <span className="text-secondary small d-flex align-items-center gap-1"><RefreshCw size={12} />{lastUpdated.toLocaleTimeString()}</span>}
            {loading && <Spinner animation="border" variant="primary" size="sm" />}
            <Button size="sm" variant="outline-secondary" onClick={fetchNodes} style={{ fontSize: '11px' }}>
              <RefreshCw size={12} className="me-1" />Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Summary pills */}
      <Row className="g-3 mb-4">
        {(Object.entries(counts) as [string, number][]).map(([status, count]) => {
          const s = STATUS_STYLE[status] || STATUS_STYLE.active;
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
            placeholder="Search by ID or Type…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-dark text-light border-secondary ps-4"
            style={{ fontSize: '12px' }}
          />
        </div>
        <ButtonGroup size="sm">
          {(['all', 'trusted', 'malicious', 'active', 'removed'] as const).map(s => (
            <Button
              key={s}
              variant={statusFilter === s ? 'primary' : 'outline-secondary'}
              onClick={() => setFilter(s)}
              style={{ fontSize: '11px' }}
            >
              {s === 'all' ? 'All' : (STATUS_STYLE[s]?.label || s)}
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
                  <th className="text-secondary fw-normal py-2 small">Type</th>
                  <th className="text-secondary fw-normal py-2 small">Sender / Receiver</th>
                  <th className="text-secondary fw-normal py-2 small" style={{ minWidth: 140 }}>Trust Score</th>
                  <th className="text-secondary fw-normal py-2 small">Signal (SNR/CSI)</th>
                  <th className="text-secondary fw-normal py-2 small">Status</th>
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
                  return (
                    <tr key={node.nodeId}>
                      {/* Node ID */}
                      <td className="px-3 py-2 align-middle">
                        <div className="fw-bold text-light small">{node.nodeId}</div>
                        <div className="text-secondary" style={{ fontSize: '10px' }}>
                           {new Date(node.createdAt).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Type */}
                      <td className="py-2 align-middle small text-light">
                        <div className="d-flex align-items-center">{getRoleIcon(node.type)}{node.type}</div>
                      </td>

                      {/* Addresses */}
                      <td className="py-2 align-middle small text-secondary font-monospace" style={{fontSize: '10px'}}>
                         <div>S: {node.senderAddress.slice(0, 10)}…</div>
                         <div>R: {node.receiverAddress.slice(0, 10)}…</div>
                      </td>

                      {/* Trust Score */}
                      <td className="py-2 align-middle" style={{ minWidth: 140 }}>
                        <ScoreBar score={node.trustScore} />
                      </td>

                      {/* Signal Properties */}
                      <td className="py-2 align-middle text-secondary font-monospace" style={{ fontSize: '10px' }}>
                         <div>SNR: <span className="text-info">{node.snr?.toFixed(1) || '25.0'} dB</span></div>
                         <div>CSI: <span className="text-warning">{node.csiBehavior?.toFixed(2) || '0.85'}</span></div>
                      </td>

                      {/* Status */}
                      <td className="py-2 align-middle">
                        <StatusBadge status={node.status} score={node.trustScore} />
                      </td>

                      {/* Actions */}
                      <td className="py-2 align-middle text-end pe-3">
                        <ButtonGroup size="sm">
                          {node.status !== 'Removed' && (
                            <Button
                              variant="outline-danger"
                              disabled={isLoading}
                              onClick={() => handleRemove(node)}
                              title="Remove Node"
                              style={{ fontSize: '10px' }}
                            >
                              {isLoading ? <Spinner animation="border" size="sm" style={{ width: 10, height: 10 }} /> : <><ShieldX size={11} className="me-1" />Remove</>}
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
          Dynamically manage Advanced 5G network nodes &nbsp;·&nbsp; Operations are recorded on the blockchain ledger
        </Card.Footer>
      </Card>

      {/* Modals */}
      <AddNodeModal
        show={addModal}
        onHide={() => setAddModal(false)}
        onSave={handleAddNode}
      />
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

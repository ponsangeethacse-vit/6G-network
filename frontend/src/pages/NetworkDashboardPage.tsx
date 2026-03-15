import React, { useState, useEffect, useCallback } from 'react';
import { Row, Col, Card, Badge, Table, Spinner } from 'react-bootstrap';
import {
  Server, ShieldCheck, ShieldAlert, ShieldOff,
  Bell, Database, RefreshCw, Wifi, WifiOff, Activity
} from 'lucide-react';

const API_BASE = 'http://localhost:4000/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface NetworkNode {
  address: string;
  nodeId?: string;
  role?: number;
  trustScore?: number;
  status?: 'trusted' | 'suspicious' | 'isolated';
}

interface AttackAlert {
  nodeId: string;
  type: string;
  severity: 'high' | 'medium' | 'low';
  timestamp: number;
}

interface BlockchainBlock {
  index: number;
  hash: string;
  previousHash: string;
  transactions: any[];
}

interface DashboardMetrics {
  totalNodes: number;
  trustedNodes: number;
  suspiciousNodes: number;
  isolatedNodes: number;
  activeAlerts: number;
  blockchainTxCount: number;
}

// ─── Metric Card ─────────────────────────────────────────────────────────────
interface MetricCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;           // 'success' | 'warning' | 'danger' | 'info' | 'primary'
  glowColor: string;       // CSS rgba string
  subtitle?: string;
  pulse?: boolean;
}

const MetricCard = ({ title, value, icon, color, glowColor, subtitle, pulse }: MetricCardProps) => (
  <Card
    bg="dark"
    border="secondary"
    className="shadow-lg h-100 position-relative overflow-hidden"
    style={{ transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'default' }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
      (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 30px ${glowColor}`;
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
      (e.currentTarget as HTMLElement).style.boxShadow = '';
    }}
  >
    {/* Background accent glow */}
    <div
      className="position-absolute top-0 end-0"
      style={{ width: '120px', height: '120px', background: `radial-gradient(circle at top right, ${glowColor}, transparent 70%)`, pointerEvents: 'none' }}
    />

    <Card.Body className="p-4 d-flex align-items-start justify-content-between">
      <div>
        <p className="text-secondary small mb-2 text-uppercase fw-semibold" style={{ letterSpacing: '1px' }}>{title}</p>
        <div className="d-flex align-items-baseline gap-2">
          <span className={`display-6 fw-bold text-${color}`} style={{ lineHeight: 1 }}>
            {value}
          </span>
        </div>
        {subtitle && <p className="text-secondary small mt-2 mb-0">{subtitle}</p>}
      </div>

      <div
        className={`rounded-3 d-flex align-items-center justify-content-center flex-shrink-0`}
        style={{ width: '52px', height: '52px', backgroundColor: `${glowColor}`, position: 'relative' }}
      >
        {pulse && (
          <span
            className="position-absolute top-0 end-0 translate-middle rounded-circle bg-danger border border-dark"
            style={{ width: '12px', height: '12px', animation: 'blinker 1.2s step-start infinite' }}
          />
        )}
        <span className={`text-${color}`}>{icon}</span>
      </div>
    </Card.Body>
  </Card>
);

// ─── Severity Badge ───────────────────────────────────────────────────────────
const SeverityBadge = ({ severity }: { severity: string }) => {
  const map: Record<string, string> = { high: 'danger', medium: 'warning', low: 'info' };
  return <Badge bg={map[severity] || 'secondary'} className="text-uppercase" style={{ fontSize: '10px' }}>{severity}</Badge>;
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const NetworkDashboardPage = () => {
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [alerts, setAlerts] = useState<AttackAlert[]>([]);
  const [blocks, setBlocks] = useState<BlockchainBlock[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalNodes: 0, trustedNodes: 0, suspiciousNodes: 0,
    isolatedNodes: 0, activeAlerts: 0, blockchainTxCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // ── Fetch all data ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const [nodesRes, attacksRes, chainRes] = await Promise.allSettled([
        fetch(`${API_BASE}/nodes`),
        fetch(`${API_BASE}/attacks`),
        fetch(`${API_BASE}/blockchain`),
      ]);

      let fetchedNodes: NetworkNode[] = [];
      let fetchedAlerts: AttackAlert[] = [];
      let fetchedBlocks: BlockchainBlock[] = [];

      if (nodesRes.status === 'fulfilled' && nodesRes.value.ok) {
        const data = await nodesRes.value.json();
        fetchedNodes = data.nodes ?? data ?? [];
      }

      if (attacksRes.status === 'fulfilled' && attacksRes.value.ok) {
        fetchedAlerts = await attacksRes.value.json();
        if (!Array.isArray(fetchedAlerts)) fetchedAlerts = [];
      }

      if (chainRes.status === 'fulfilled' && chainRes.value.ok) {
        fetchedBlocks = await chainRes.value.json();
        if (!Array.isArray(fetchedBlocks)) fetchedBlocks = [];
      }

      // Derive status from trust score if present
      const classified = fetchedNodes.map(n => ({
        ...n,
        status: (n.trustScore ?? 100) >= 70
          ? 'trusted'
          : (n.trustScore ?? 100) >= 40
            ? 'suspicious'
            : 'isolated'
      })) as NetworkNode[];

      setNodes(classified);
      setAlerts(fetchedAlerts);
      setBlocks(fetchedBlocks);

      const trusted = classified.filter(n => n.status === 'trusted').length;
      const suspicious = classified.filter(n => n.status === 'suspicious').length;
      const isolated = classified.filter(n => n.status === 'isolated').length;
      const txCount = fetchedBlocks.reduce((sum, b) => sum + (b.transactions?.length ?? 0), 0);

      setMetrics({
        totalNodes: classified.length,
        trustedNodes: trusted,
        suspiciousNodes: suspicious,
        isolatedNodes: isolated,
        activeAlerts: fetchedAlerts.filter(a => a.severity === 'high').length,
        blockchainTxCount: txCount,
      });

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ── Cards config ────────────────────────────────────────────────────────────
  const cards: MetricCardProps[] = [
    {
      title: 'Total Network Nodes',
      value: metrics.totalNodes,
      icon: <Server size={24} />,
      color: 'primary',
      glowColor: 'rgba(13, 110, 253, 0.18)',
      subtitle: 'Active in mesh',
    },
    {
      title: 'Trusted Nodes',
      value: metrics.trustedNodes,
      icon: <ShieldCheck size={24} />,
      color: 'success',
      glowColor: 'rgba(25, 135, 84, 0.18)',
      subtitle: 'Trust score ≥ 70',
    },
    {
      title: 'Suspicious Nodes',
      value: metrics.suspiciousNodes,
      icon: <ShieldAlert size={24} />,
      color: 'warning',
      glowColor: 'rgba(255, 193, 7, 0.18)',
      subtitle: 'Score 40 – 69',
    },
    {
      title: 'Isolated Nodes',
      value: metrics.isolatedNodes,
      icon: <ShieldOff size={24} />,
      color: 'danger',
      glowColor: 'rgba(220, 53, 69, 0.18)',
      subtitle: 'Score < 40 (blocked)',
      pulse: metrics.isolatedNodes > 0,
    },
    {
      title: 'Active Alerts',
      value: metrics.activeAlerts,
      icon: <Bell size={24} />,
      color: metrics.activeAlerts > 0 ? 'danger' : 'secondary',
      glowColor: metrics.activeAlerts > 0 ? 'rgba(220, 53, 69, 0.18)' : 'rgba(108,117,125,0.1)',
      subtitle: 'High-severity events',
      pulse: metrics.activeAlerts > 0,
    },
    {
      title: 'Blockchain Transactions',
      value: metrics.blockchainTxCount,
      icon: <Database size={24} />,
      color: 'info',
      glowColor: 'rgba(13, 202, 240, 0.18)',
      subtitle: 'Recorded on-chain',
    },
  ];

  const statusColor: Record<string, string> = {
    trusted: 'success',
    suspicious: 'warning',
    isolated: 'danger',
  };

  const getRoleName = (role?: number) => {
    switch (role) {
      case 1: return 'IoT Edge Device';
      case 2: return 'Base Station';
      case 3: return 'Cellular Relay';
      default: return 'Unknown';
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header row */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 className="text-light fw-bold mb-1">Network Overview</h4>
          <p className="text-secondary small mb-0">
            Real-time 6G mesh monitoring &mdash; auto-refreshes every 5 s
          </p>
        </div>
        <div className="d-flex align-items-center gap-3">
          {lastUpdated && (
            <span className="text-secondary small d-flex align-items-center gap-1">
              <RefreshCw size={12} />
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          {loading
            ? <Spinner animation="border" variant="primary" size="sm" />
            : <Activity size={18} className="text-success" />
          }
        </div>
      </div>

      {/* ── Metric Cards ── */}
      <Row className="g-3 mb-4">
        {cards.map((card, i) => (
          <Col key={i} xs={12} sm={6} xl={4}>
            <MetricCard {...card} />
          </Col>
        ))}
      </Row>

      {/* ── Bottom rows: Node Table + Recent Alerts ── */}
      <Row className="g-3 mb-4">
        {/* Node Table */}
        <Col lg={7}>
          <Card bg="dark" border="secondary" className="shadow-lg h-100">
            <Card.Header className="bg-black bg-opacity-25 border-bottom border-secondary p-3 d-flex align-items-center justify-content-between">
              <h6 className="mb-0 text-secondary text-uppercase d-flex align-items-center gap-2" style={{ letterSpacing: '1px' }}>
                <Server size={15} /> Node Registry
              </h6>
              <Badge bg="secondary" className="font-monospace" style={{ fontSize: '10px' }}>{nodes.length} NODES</Badge>
            </Card.Header>

            <Card.Body className="p-0">
              <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                <Table hover variant="dark" className="mb-0" size="sm">
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: '#1a1a1f', zIndex: 1 }}>
                    <tr>
                      <th className="text-secondary fw-normal small px-3 py-2">Node Address</th>
                      <th className="text-secondary fw-normal small py-2">Role</th>
                      <th className="text-secondary fw-normal small py-2">Trust</th>
                      <th className="text-secondary fw-normal small py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nodes.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center text-secondary py-5 small">
                          <WifiOff size={28} className="mb-2 d-block mx-auto opacity-50" />
                          Waiting for network telemetry…
                        </td>
                      </tr>
                    ) : nodes.map((node, idx) => (
                      <tr key={idx}>
                        <td className="font-monospace px-3 py-2" style={{ fontSize: '11px', color: '#adb5bd', maxWidth: '200px' }}>
                          <span className="text-truncate d-block">{node.address ?? node.nodeId}</span>
                        </td>
                        <td className="small py-2 text-light">{getRoleName(node.role)}</td>
                        <td className="small py-2">
                          <span className={`fw-bold text-${statusColor[node.status ?? 'trusted']}`}>
                            {node.trustScore != null ? `${node.trustScore}%` : '—'}
                          </span>
                        </td>
                        <td className="py-2">
                          <Badge
                            bg={statusColor[node.status ?? 'trusted']}
                            className="text-uppercase"
                            style={{ fontSize: '10px' }}
                          >
                            {node.status ?? 'trusted'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Recent Alerts */}
        <Col lg={5}>
          <Card bg="dark" border="secondary" className="shadow-lg h-100">
            <Card.Header className="bg-black bg-opacity-25 border-bottom border-secondary p-3 d-flex align-items-center justify-content-between">
              <h6 className="mb-0 text-secondary text-uppercase d-flex align-items-center gap-2" style={{ letterSpacing: '1px' }}>
                <Bell size={15} /> Recent Alerts
              </h6>
              <Badge bg="danger" className="bg-opacity-75" style={{ fontSize: '10px' }}>LIVE</Badge>
            </Card.Header>

            <Card.Body className="p-3 d-flex flex-column gap-2" style={{ maxHeight: '320px', overflowY: 'auto' }}>
              {alerts.length === 0 ? (
                <div className="h-100 d-flex flex-column align-items-center justify-content-center text-secondary small opacity-50 py-4">
                  <ShieldCheck size={28} className="mb-2" />
                  No active threats. Network stable.
                </div>
              ) : alerts.slice(0, 8).map((alert, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded border d-flex justify-content-between align-items-start ${
                    alert.severity === 'high'
                      ? 'bg-danger bg-opacity-10 border-danger border-opacity-25'
                      : 'bg-warning bg-opacity-10 border-warning border-opacity-25'
                  }`}
                >
                  <div>
                    <p className="small fw-bold mb-0 text-light">{alert.type} Detected</p>
                    <p className="mb-0 font-monospace text-secondary" style={{ fontSize: '10px' }}>
                      {alert.nodeId?.slice(0, 20)}…
                    </p>
                  </div>
                  <div className="text-end flex-shrink-0 ms-2">
                    <SeverityBadge severity={alert.severity} />
                    <p className="mb-0 text-secondary mt-1" style={{ fontSize: '10px' }}>
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* ── Blockchain Recent Blocks ── */}
      <Card bg="dark" border="secondary" className="shadow-lg">
        <Card.Header className="bg-black bg-opacity-25 border-bottom border-secondary p-3 d-flex align-items-center justify-content-between">
          <h6 className="mb-0 text-secondary text-uppercase d-flex align-items-center gap-2" style={{ letterSpacing: '1px' }}>
            <Database size={15} /> Recent Blockchain Blocks
          </h6>
          <Badge bg="info" className="bg-opacity-75 text-dark font-monospace" style={{ fontSize: '10px' }}>PROOF-OF-TRUST</Badge>
        </Card.Header>

        <Card.Body className="p-3">
          {blocks.length === 0 ? (
            <p className="text-secondary small text-center py-3 mb-0">No blocks mined yet…</p>
          ) : (
            <div className="d-flex gap-3 overflow-auto pb-2">
              {[...blocks].reverse().slice(0, 6).map((block, idx) => (
                <div
                  key={idx}
                  className="flex-shrink-0 rounded border border-secondary p-3"
                  style={{ minWidth: '180px', backgroundColor: '#111116', fontSize: '11px' }}
                >
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <Database size={12} className="text-info" />
                    <span className="fw-bold font-monospace text-light">BLOCK #{block.index}</span>
                  </div>
                  <div className="text-secondary font-monospace mb-1">
                    <span className="d-block text-secondary" style={{ fontSize: '9px' }}>HASH</span>
                    <span className="text-info text-truncate d-block">{block.hash?.slice(0, 18)}…</span>
                  </div>
                  <div className="d-flex justify-content-between border-top border-secondary pt-2 mt-2">
                    <span className="text-secondary">TXs: {block.transactions?.length ?? 0}</span>
                    <span className="text-success fw-bold">✓ Valid</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Pulse animation style */}
      <style>{`
        @keyframes blinker { 50% { opacity: 0; } }
      `}</style>
    </div>
  );
};

export default NetworkDashboardPage;

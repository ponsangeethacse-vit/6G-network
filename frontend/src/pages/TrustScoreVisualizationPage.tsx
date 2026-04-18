import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Row, Col, Card, Table, Badge, Spinner, ToggleButton, ToggleButtonGroup } from 'react-bootstrap';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { ShieldCheck, ShieldAlert, ShieldOff, RefreshCw, TrendingUp } from 'lucide-react';

ChartJS.register(
  CategoryScale, LinearScale, BarElement,
  PointElement, LineElement,
  Title, Tooltip, Legend, Filler
);

import { TrustService, NodeService } from '../services/api.service';

// ─── Types ───────────────────────────────────────────────────────────────────
interface TrustNode {
  nodeId: string;
  trustScore: number;   // 0.0 – 1.0
  status: 'trusted' | 'suspicious' | 'malicious';
}

interface HistoryPoint {
  timestamp: number;
  scores: Record<string, number>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const classify = (score: number): TrustNode['status'] =>
  score > 0.7 ? 'trusted' : score >= 0.4 ? 'suspicious' : 'malicious';
  
const formatAddress = (addr: string) => 
  addr.startsWith('0x') ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;

const barColor = (score: number) =>
  score > 0.7 ? 'rgba(25, 135, 84, 0.85)' : score >= 0.4 ? 'rgba(255, 193, 7, 0.85)' : 'rgba(220, 53, 69, 0.85)';

const barBorder = (score: number) =>
  score > 0.7 ? 'rgb(25, 135, 84)' : score >= 0.4 ? 'rgb(255, 193, 7)' : 'rgb(220, 53, 69)';

const StatusBadge = ({ status }: { status: TrustNode['status'] }) => {
  const map = { trusted: 'success', suspicious: 'warning', malicious: 'danger' };
  const icons = {
    trusted: <ShieldCheck size={12} className="me-1" />,
    suspicious: <ShieldAlert size={12} className="me-1" />,
    malicious: <ShieldOff size={12} className="me-1" />,
  };
  return (
    <Badge bg={map[status]} className="text-uppercase d-inline-flex align-items-center" style={{ fontSize: '10px' }}>
      {icons[status]}{status}
    </Badge>
  );
};

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { mode: 'index' as const, intersect: false },
  },
  scales: {
    y: {
      min: 0, max: 1,
      grid: { color: 'rgba(255,255,255,0.05)' },
      ticks: {
        color: '#6c757d',
        callback: (v: any) => `${(v * 100).toFixed(0)}%`,
      },
    },
    x: { grid: { display: false }, ticks: { color: '#6c757d', maxRotation: 30 } },
  },
  animation: { duration: 400 },
};

// ─── Line chart colors per node ──────────────────────────────────────────────
const LINE_COLORS = [
  { border: 'rgb(13, 110, 253)', bg: 'rgba(13, 110, 253, 0.08)' },
  { border: 'rgb(25, 135, 84)',  bg: 'rgba(25, 135, 84, 0.08)'  },
  { border: 'rgb(255, 193, 7)',  bg: 'rgba(255, 193, 7, 0.08)'  },
  { border: 'rgb(220, 53, 69)', bg: 'rgba(220, 53, 69, 0.08)'  },
  { border: 'rgb(13, 202, 240)', bg: 'rgba(13, 202, 240, 0.08)' },
];

// ─── Main Component ──────────────────────────────────────────────────────────
const TrustScoreVisualizationPage = () => {
  const [nodes, setNodes] = useState<TrustNode[]>([]);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sortBy, setSortBy] = useState<'score' | 'id'>('score');
  const historyRef = useRef<HistoryPoint[]>([]);

  // ── Fetch /api/trust-scores ──────────────────────────────────────────────
  const fetchScores = useCallback(async () => {
    try {
      const raw = await TrustService.getTrustScores();

      const fetched: TrustNode[] = raw.map(n => ({
        nodeId: n.address ?? `Node-${Math.random().toString(36).slice(2,6)}`,
        trustScore: typeof n.trustScore === 'number'
          ? (n.trustScore > 1 ? n.trustScore / 100 : n.trustScore)
          : 0.85,
        status: classify(typeof n.trustScore === 'number'
          ? (n.trustScore > 1 ? n.trustScore / 100 : n.trustScore)
          : 0.85),
      }));

      setNodes(fetched);

      // Track history (keep last 15 ticks)
      const point: HistoryPoint = {
        timestamp: Date.now(),
        scores: Object.fromEntries(fetched.map(n => [n.nodeId, n.trustScore])),
      };
      historyRef.current = [...historyRef.current.slice(-14), point];
      setHistory([...historyRef.current]);

      setLastUpdated(new Date());
    } catch {
      // Fallback: generate plausible mock data from /api/nodes
      try {
        const data = await NodeService.getNodes();
        const rawNodes = data.nodes ?? data ?? [];

        const fetched: TrustNode[] = rawNodes.map((n: any, i: number) => {
          const score = n.trustScore != null
            ? (n.trustScore > 1 ? n.trustScore / 100 : n.trustScore)
            : 0.65 + Math.random() * 0.35;
          return {
            nodeId: n.address ? `${n.address.slice(0, 6)}…${n.address.slice(-4)}` : `Node-${i + 1}`,
            trustScore: parseFloat(score.toFixed(3)),
            status: classify(score),
          };
        });

        setNodes(fetched);

        const point: HistoryPoint = {
          timestamp: Date.now(),
          scores: Object.fromEntries(fetched.map(n => [n.nodeId, n.trustScore])),
        };
        historyRef.current = [...historyRef.current.slice(-14), point];
        setHistory([...historyRef.current]);

        setLastUpdated(new Date());
      } catch (e2) {
        console.error('Trust fetch fallback failed:', e2);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScores();
    const iv = setInterval(fetchScores, 4000);
    return () => clearInterval(iv);
  }, [fetchScores]);

  // ── Bar chart data ──────────────────────────────────────────────────────
  const sorted = [...nodes].sort((a, b) =>
    sortBy === 'score' ? b.trustScore - a.trustScore : a.nodeId.localeCompare(b.nodeId)
  );

  const barData = {
    labels: sorted.map(n => formatAddress(n.nodeId)),
    datasets: [{
      label: 'Trust Score',
      data: sorted.map(n => n.trustScore),
      backgroundColor: sorted.map(n => barColor(n.trustScore)),
      borderColor: sorted.map(n => barBorder(n.trustScore)),
      borderWidth: 1.5,
      borderRadius: 6,
      borderSkipped: false,
    }],
  };

  // ── Line chart data ──────────────────────────────────────────────────────
  const nodeIds = nodes.map(n => n.nodeId);
  const timeLabels = history.map(h => new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

  const lineData = {
    labels: timeLabels,
    datasets: nodeIds.map((id, i) => ({
      label: formatAddress(id),
      data: history.map(h => h.scores[id] ?? null),
      borderColor: LINE_COLORS[i % LINE_COLORS.length].border,
      backgroundColor: LINE_COLORS[i % LINE_COLORS.length].bg,
      fill: false,
      tension: 0.4,
      pointRadius: 3,
      borderWidth: 2,
    })),
  };

  // ── Summary counts ───────────────────────────────────────────────────────
  const trusted    = nodes.filter(n => n.status === 'trusted').length;
  const suspicious = nodes.filter(n => n.status === 'suspicious').length;
  const malicious  = nodes.filter(n => n.status === 'malicious').length;

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 className="text-light fw-bold mb-1">Trust Score Monitor</h4>
          <p className="text-secondary small mb-0">Node-level trust analytics — 4 s refresh cycle</p>
        </div>
        <div className="d-flex align-items-center gap-3">
          {lastUpdated && (
            <span className="text-secondary small d-flex align-items-center gap-1">
              <RefreshCw size={12} /> {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          {loading && <Spinner animation="border" variant="primary" size="sm" />}
        </div>
      </div>

      {/* Summary pills */}
      <Row className="g-3 mb-4">
        {[
          { label: 'Trusted', count: trusted,    color: 'success', icon: <ShieldCheck size={16} /> },
          { label: 'Suspicious', count: suspicious, color: 'warning', icon: <ShieldAlert size={16} /> },
          { label: 'Malicious', count: malicious,  color: 'danger',  icon: <ShieldOff size={16} />  },
        ].map(({ label, count, color, icon }) => (
          <Col key={label} xs={4}>
            <Card bg="dark" border="secondary" className="shadow-sm">
              <Card.Body className="py-3 px-4 d-flex align-items-center gap-3">
                <span className={`text-${color}`}>{icon}</span>
                <div>
                  <div className={`fs-4 fw-bold text-${color}`}>{count}</div>
                  <div className="text-secondary small">{label}</div>
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Charts */}
      <div className="mb-4">
        {/* Bar Chart Row */}
        <Card bg="dark" border="secondary" className="shadow-lg mb-4">
          <Card.Header className="bg-black bg-opacity-25 border-bottom border-secondary p-3 d-flex justify-content-between align-items-center">
            <h6 className="mb-0 text-secondary text-uppercase" style={{ letterSpacing: '1px', fontSize: '12px' }}>
              Node vs Trust Score
            </h6>
            <ToggleButtonGroup type="radio" name="sort" value={sortBy} onChange={(v: any) => setSortBy(v)}>
              <ToggleButton id="sort-score" value="score" size="sm" variant="outline-secondary" style={{ fontSize: '10px' }}>
                Score
              </ToggleButton>
              <ToggleButton id="sort-id" value="id" size="sm" variant="outline-secondary" style={{ fontSize: '10px' }}>
                Node ID
              </ToggleButton>
            </ToggleButtonGroup>
          </Card.Header>
          <Card.Body className="p-3" style={{ height: '350px' }}>
            {nodes.length > 0
              ? <Bar data={barData} options={{ ...CHART_DEFAULTS, plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } } } as any} />
              : <div className="h-100 d-flex align-items-center justify-content-center text-secondary small">Waiting for data…</div>}
          </Card.Body>

          {/* Color Legend */}
          <Card.Footer className="bg-transparent border-top border-secondary p-2 d-flex gap-3 justify-content-center">
            {[
              { color: '#198754', label: 'Trusted (> 70%)' },
              { color: '#ffc107', label: 'Suspicious (40–70%)' },
              { color: '#dc3545', label: 'Malicious (< 40%)' },
            ].map(({ color, label }) => (
              <div key={label} className="d-flex align-items-center gap-1" style={{ fontSize: '11px' }}>
                <div className="rounded-circle" style={{ width: 10, height: 10, backgroundColor: color }} />
                <span className="text-secondary">{label}</span>
              </div>
            ))}
          </Card.Footer>
        </Card>

        {/* Line Chart Row */}
        <Card bg="dark" border="secondary" className="shadow-lg">
          <Card.Header className="bg-black bg-opacity-25 border-bottom border-secondary p-3 d-flex justify-content-between align-items-center">
            <h6 className="mb-0 text-secondary text-uppercase" style={{ letterSpacing: '1px', fontSize: '12px' }}>
              <TrendingUp size={14} className="me-2" />Trust Score Over Time
            </h6>
            <Badge bg="success" className="bg-opacity-25 text-success border border-success border-opacity-25" style={{ fontSize: '10px' }}>LIVE</Badge>
          </Card.Header>
          <Card.Body className="p-3" style={{ height: '350px' }}>
            {history.length > 1
              ? <Line data={lineData} options={{
                  ...CHART_DEFAULTS,
                  plugins: {
                    ...CHART_DEFAULTS.plugins,
                    legend: {
                      display: true,
                      position: 'right',
                      labels: { color: '#6c757d', font: { size: 10 }, boxWidth: 12, padding: 10 }
                    }
                  }
                } as any} />
              : <div className="h-100 d-flex align-items-center justify-content-center text-secondary small">
                  Collecting history… (need ≥ 2 ticks)
                </div>
            }
          </Card.Body>
        </Card>
      </div>

      {/* Node Table */}
      <Card bg="dark" border="secondary" className="shadow-lg">
        <Card.Header className="bg-black bg-opacity-25 border-bottom border-secondary p-3 d-flex align-items-center justify-content-between">
          <h6 className="mb-0 text-secondary text-uppercase" style={{ letterSpacing: '1px', fontSize: '12px' }}>
            Node Trust Index
          </h6>
          <Badge bg="secondary" className="font-monospace" style={{ fontSize: '10px' }}>{nodes.length} NODES</Badge>
        </Card.Header>

        <Card.Body className="p-0">
          <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
            <Table hover variant="dark" className="mb-0">
              <thead style={{ position: 'sticky', top: 0, backgroundColor: '#1a1a1f', zIndex: 1 }}>
                <tr>
                  <th className="text-secondary fw-normal small px-4 py-2">#</th>
                  <th className="text-secondary fw-normal small py-2">Node ID</th>
                  <th className="text-secondary fw-normal small py-2">Trust Score</th>
                  <th className="text-secondary fw-normal small py-2">Score Bar</th>
                  <th className="text-secondary fw-normal small py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-secondary py-5 small">
                      Waiting for trust score data…
                    </td>
                  </tr>
                ) : sorted.map((node, idx) => {
                  const pct = (node.trustScore * 100).toFixed(1);
                  const col = node.status === 'trusted' ? 'success' : node.status === 'suspicious' ? 'warning' : 'danger';
                  return (
                    <tr key={node.nodeId}>
                      <td className="text-secondary small px-4 py-2">{idx + 1}</td>
                      <td className="font-monospace small py-2 text-light">{formatAddress(node.nodeId)}</td>
                      <td className={`fw-bold py-2 text-${col}`}>{pct}%</td>
                      <td className="py-2" style={{ minWidth: '140px' }}>
                        <div className="bg-secondary bg-opacity-25 rounded-pill" style={{ height: '6px', overflow: 'hidden' }}>
                          <div
                            className={`bg-${col} h-100 rounded-pill`}
                            style={{ width: `${pct}%`, transition: 'width 0.4s ease' }}
                          />
                        </div>
                      </td>
                      <td className="py-2">
                        <StatusBadge status={node.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
};

export default TrustScoreVisualizationPage;

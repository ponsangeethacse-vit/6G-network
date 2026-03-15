import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Row, Col, Card, Badge, Spinner, Button } from 'react-bootstrap';
import CytoscapeComponent from 'react-cytoscapejs';
import { io } from 'socket.io-client';
import {
  Server, Smartphone, Cpu, Activity, Shield,
  ShieldCheck, ShieldAlert, ShieldOff, X,
  Clock, Fingerprint, Database, Wifi
} from 'lucide-react';

import { NodeService, TransactionService } from '../services/api.service';
const SOCKET_URL = 'http://localhost:4000';

// ─── Types ────────────────────────────────────────────────────────────────────
interface NetworkNode {
  address: string;
  role: number;
  trustScore?: number;   // 0–100
  status?: 'trusted' | 'suspicious' | 'malicious';
}

interface TxRecord {
  blockId: number;
  nodeId: string;
  action: string;
  txHash: string;
  timestamp: number;
  trustScore: number;
}

interface SelectedPanel {
  node: NetworkNode;
  activity: string[];
  lastTx: TxRecord | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const classify = (score: number): NetworkNode['status'] =>
  score >= 70 ? 'trusted' : score >= 40 ? 'suspicious' : 'malicious';

const nodeColor = (status?: NetworkNode['status']) => {
  switch (status) {
    case 'trusted':    return '#198754';  // green
    case 'suspicious': return '#ffc107';  // yellow
    case 'malicious':  return '#dc3545';  // red
    default:           return '#0d6efd';  // blue (loading)
  }
};

const nodeBorder = (status?: NetworkNode['status']) => {
  switch (status) {
    case 'trusted':    return '#0f5132';
    case 'suspicious': return '#997404';
    case 'malicious':  return '#842029';
    default:           return '#084298';
  }
};

const getRoleLabel = (role?: number) => {
  switch (role) {
    case 1: return 'IoT Device';
    case 2: return 'Base Station';
    case 3: return 'Cellular Relay';
    default: return 'Unknown';
  }
};

const getRoleIcon = (role?: number, size = 18) => {
  switch (role) {
    case 1: return <Smartphone size={size} className="text-info" />;
    case 2: return <Server size={size} className="text-primary" />;
    case 3: return <Cpu size={size} className="text-warning" />;
    default: return <Activity size={size} className="text-secondary" />;
  }
};

const StatusBadge = ({ status }: { status?: NetworkNode['status'] }) => {
  const map = { trusted: 'success', suspicious: 'warning', malicious: 'danger' };
  const icons = {
    trusted: <ShieldCheck size={12} className="me-1" />,
    suspicious: <ShieldAlert size={12} className="me-1" />,
    malicious: <ShieldOff size={12} className="me-1" />,
  };
  const s = status ?? 'trusted';
  return (
    <Badge bg={map[s]} className="text-uppercase d-inline-flex align-items-center" style={{ fontSize: '10px' }}>
      {icons[s]}{s}
    </Badge>
  );
};

// ─── Cytoscape stylesheet ────────────────────────────────────────────────────
const makeCyStylesheet = (nodes: NetworkNode[]) => {
  // Build per-node rules for color
  const nodeRules = nodes.map(n => ({
    selector: `#${n.address}`,
    style: {
      'background-color': nodeColor(n.status),
      'border-color': nodeBorder(n.status),
      'border-width': 3,
    },
  }));

  return [
    {
      selector: 'node',
      style: {
        'shape': 'ellipse',
        'width': 48,
        'height': 48,
        'label': 'data(label)',
        'color': '#ffffff',
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': 6,
        'font-size': 10,
        'font-weight': 'bold',
        'border-width': 2,
        'border-color': '#444',
        'background-color': '#0d6efd',
        'text-outline-color': '#0a0a0c',
        'text-outline-width': 2,
        'text-wrap': 'wrap',
        'text-max-width': 80,
        'transition-property': 'background-color border-color',
        'transition-duration': '0.4s' as any,
      },
    },
    {
      selector: 'node:selected',
      style: {
        'border-width': 5,
        'border-color': '#ffffff',
        'width': 58,
        'height': 58,
      },
    },
    {
      selector: 'edge',
      style: {
        'width': 1.5,
        'line-color': 'rgba(100,116,139,0.35)',
        'curve-style': 'bezier',
        'opacity': 0.8,
      },
    },
    {
      selector: 'edge.highlighted',
      style: {
        'line-color': 'rgba(13,110,253,0.7)',
        'width': 2.5,
        'opacity': 1,
      },
    },
    ...nodeRules,
  ];
};

// ─── Main Component ───────────────────────────────────────────────────────────
const NetworkDashboardPage = () => {
  const [nodes, setNodes]           = useState<NetworkNode[]>([]);
  const [selected, setSelected]     = useState<SelectedPanel | null>(null);
  const [loading, setLoading]       = useState(true);
  const [txLog, setTxLog]           = useState<TxRecord[]>([]);
  const cyRef                       = useRef<cytoscape.Core | null>(null);
  const localScores                 = useRef<Record<string, number>>({});

  // ── Build stable Cytoscape elements ────────────────────────────────────
  const buildElements = useCallback((ns: NetworkNode[]) => {
    const cyNodes = ns.map(n => ({
      data: {
        id: n.address,
        label: `${getRoleLabel(n.role)}\n${n.address.slice(2, 6).toUpperCase()}`,
        trustScore: n.trustScore ?? 85,
        status: n.status ?? 'trusted',
      },
    }));

    // Build a deterministic mesh (every node connects to 2 others)
    const cyEdges: any[] = [];
    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        cyEdges.push({
          data: {
            id: `e-${ns[i].address}-${ns[j].address}`,
            source: ns[i].address,
            target: ns[j].address,
          },
        });
      }
    }
    return [...cyNodes, ...cyEdges];
  }, []);

  // ── Fetch nodes + transactions ──────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const [nodesData, txData] = await Promise.all([
        NodeService.getNodes().then(r => r.nodes ?? []),
        TransactionService.getTransactions({ limit: 50 }),
      ]);

      const enriched: NetworkNode[] = nodesData.map((n: any) => {
        const score = localScores.current[n.address] ?? 85;
        return { ...n, trustScore: score, status: classify(score) };
      });

      setNodes(enriched);
      setTxLog(txData as any);
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }, []);

  // ── Socket: live trust updates ──────────────────────────────────────────
  useEffect(() => {
    const socket = io(SOCKET_URL);

    socket.on('trust_update', (tick: { node: string; trustScore: number }) => {
      localScores.current[tick.node] = tick.trustScore;
      const status = classify(tick.trustScore);

      setNodes(prev =>
        prev.map(n =>
          n.address === tick.node
            ? { ...n, trustScore: tick.trustScore, status }
            : n
        )
      );

      // Update Cytoscape node color live
      if (cyRef.current) {
        const cyNode = cyRef.current.$(`#${tick.node}`);
        if (cyNode.length) {
          cyNode.style({
            'background-color': nodeColor(status),
            'border-color': nodeBorder(status),
          });
        }
      }

      // Update selected panel if this is the selected node
      setSelected(prev => {
        if (!prev || prev.node.address !== tick.node) return prev;
        const updated = { ...prev.node, trustScore: tick.trustScore, status };
        const activity = [
          `${new Date().toLocaleTimeString()} — Trust updated to ${tick.trustScore}%`,
          ...prev.activity,
        ].slice(0, 6);
        return { ...prev, node: updated, activity };
      });
    });

    socket.on('new_transaction', (tx: TxRecord) => {
      setTxLog(prev => [tx, ...prev].slice(0, 50));
    });

    return () => { socket.disconnect(); };
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 10000);
    return () => clearInterval(iv);
  }, [fetchData]);

  // ── Node click handler ──────────────────────────────────────────────────
  const handleNodeClick = useCallback((addr: string) => {
    const node = nodes.find(n => n.address === addr);
    if (!node) return;

    // Highlight connected edges
    if (cyRef.current) {
      cyRef.current.edges().removeClass('highlighted');
      cyRef.current.$(`#${addr}`).connectedEdges().addClass('highlighted');
    }

    const nodeTxs = txLog.filter(t => t.nodeId === addr || t.nodeId?.includes?.(addr));
    const lastTx  = nodeTxs[0] ?? null;
    const activity = nodeTxs.slice(0, 5).map(
      t => `${new Date(t.timestamp).toLocaleTimeString()} — ${t.action}`
    );
    if (activity.length === 0) activity.push('No recent on-chain activity');

    setSelected({ node, activity, lastTx });
  }, [nodes, txLog]);

  // ── Setup Cy event listeners once ─────────────────────────────────────
  const initCy = useCallback((cy: cytoscape.Core) => {
    cyRef.current = cy;
    cy.removeAllListeners();
    cy.on('tap', 'node', evt => {
      handleNodeClick(evt.target.id());
    });
    cy.on('tap', evt => {
      if (evt.target === cy) {
        cy.edges().removeClass('highlighted');
        setSelected(null);
      }
    });
  }, [handleNodeClick]);

  const elements = buildElements(nodes);
  const scoreColor = (score?: number) =>
    !score ? 'secondary' : score >= 70 ? 'success' : score >= 40 ? 'warning' : 'danger';

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 className="text-light fw-bold mb-1">Network Topology</h4>
          <p className="text-secondary small mb-0">
            Live 6G mesh visualization — click a node to inspect details
          </p>
        </div>
        <div className="d-flex align-items-center gap-2">
          {/* Legend */}
          {[
            { color: '#198754', label: 'Trusted' },
            { color: '#ffc107', label: 'Suspicious' },
            { color: '#dc3545', label: 'Malicious' },
          ].map(({ color, label }) => (
            <div key={label} className="d-flex align-items-center gap-1" style={{ fontSize: '11px' }}>
              <div className="rounded-circle" style={{ width: 10, height: 10, backgroundColor: color, flexShrink: 0 }} />
              <span className="text-secondary">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <Row className="g-3">
        {/* ── Graph ── */}
        <Col lg={selected ? 8 : 12} style={{ transition: 'all 0.3s ease' }}>
          <Card bg="dark" border="secondary" className="shadow-lg overflow-hidden" style={{ height: '580px' }}>
            <Card.Body className="p-0 position-relative">
              {loading ? (
                <div className="h-100 d-flex align-items-center justify-content-center text-secondary">
                  <Spinner animation="border" variant="primary" className="me-2" />
                  Initializing 6G Network Mesh…
                </div>
              ) : nodes.length === 0 ? (
                <div className="h-100 d-flex flex-column align-items-center justify-content-center text-secondary opacity-50">
                  <Wifi size={40} className="mb-2" />
                  <span className="small">Awaiting network telemetry…</span>
                </div>
              ) : (
                <CytoscapeComponent
                  key={nodes.length}   /* remount if node count changes */
                  elements={elements}
                  style={{ width: '100%', height: '100%' }}
                  layout={{ name: 'cose', animate: true, padding: 40 } as any}
                  stylesheet={makeCyStylesheet(nodes) as any}
                  cy={initCy}
                />
              )}

              {/* Node count badge */}
              {!loading && nodes.length > 0 && (
                <div className="position-absolute top-0 start-0 m-3">
                  <Badge bg="dark" className="border border-secondary px-2 py-1" style={{ fontSize: '11px' }}>
                    <Wifi size={10} className="me-1 text-success" />{nodes.length} nodes
                  </Badge>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* ── Side Panel ── */}
        {selected && (
          <Col lg={4} style={{ transition: 'all 0.3s ease' }}>
            <Card bg="dark" border="secondary" className="shadow-lg" style={{ height: '580px', overflowY: 'auto' }}>
              <Card.Header className="bg-black bg-opacity-25 border-bottom border-secondary p-3 d-flex align-items-center justify-content-between">
                <span className="text-secondary text-uppercase fw-semibold" style={{ fontSize: '12px', letterSpacing: '1px' }}>
                  Node Inspector
                </span>
                <Button
                  variant="link"
                  size="sm"
                  className="text-secondary p-0 ms-auto"
                  onClick={() => {
                    setSelected(null);
                    cyRef.current?.edges().removeClass('highlighted');
                  }}
                >
                  <X size={18} />
                </Button>
              </Card.Header>

              <Card.Body className="p-4 d-flex flex-column gap-4">
                {/* Identity */}
                <div>
                  <div className="d-flex align-items-center gap-3 mb-3">
                    <div
                      className="rounded-3 d-flex align-items-center justify-content-center"
                      style={{
                        width: 52, height: 52,
                        backgroundColor: `${nodeColor(selected.node.status)}22`,
                        border: `2px solid ${nodeColor(selected.node.status)}`,
                        flexShrink: 0,
                      }}
                    >
                      {getRoleIcon(selected.node.role, 24)}
                    </div>
                    <div>
                      <div className="text-light fw-bold">
                        Node {selected.node.address.slice(2, 6).toUpperCase()}
                      </div>
                      <div className="text-secondary small">{getRoleLabel(selected.node.role)}</div>
                      <StatusBadge status={selected.node.status} />
                    </div>
                  </div>
                </div>

                {/* Node ID */}
                <div>
                  <p className="text-secondary mb-1 d-flex align-items-center gap-1 small" style={{ letterSpacing: '0.5px' }}>
                    <Fingerprint size={13} /> Node ID
                  </p>
                  <p className="font-monospace text-info small mb-0 text-break">{selected.node.address}</p>
                </div>

                {/* Trust Score */}
                <div>
                  <p className="text-secondary mb-2 d-flex align-items-center gap-1 small">
                    <Shield size={13} /> Trust Score
                  </p>
                  <div className={`display-6 fw-bold text-${scoreColor(selected.node.trustScore)}`}>
                    {selected.node.trustScore ?? '--'}
                    <span className="fs-6 text-secondary fw-normal ms-1">/ 100</span>
                  </div>
                  <div className="mt-2 bg-secondary bg-opacity-25 rounded-pill overflow-hidden" style={{ height: 8 }}>
                    <div
                      className={`bg-${scoreColor(selected.node.trustScore)} h-100 rounded-pill`}
                      style={{ width: `${selected.node.trustScore ?? 0}%`, transition: 'width 0.5s ease' }}
                    />
                  </div>
                </div>

                {/* Recent Activity */}
                <div>
                  <p className="text-secondary mb-2 d-flex align-items-center gap-1 small">
                    <Clock size={13} /> Recent Activity
                  </p>
                  <div className="d-flex flex-column gap-2">
                    {selected.activity.map((act, i) => (
                      <div key={i} className="p-2 rounded bg-secondary bg-opacity-10 border border-secondary border-opacity-25 small text-light">
                        {act}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Last Blockchain Record */}
                <div>
                  <p className="text-secondary mb-2 d-flex align-items-center gap-1 small">
                    <Database size={13} /> Last Blockchain Record
                  </p>
                  {selected.lastTx ? (
                    <div className="p-3 rounded border border-info border-opacity-25 bg-info bg-opacity-10">
                      <div className="d-flex justify-content-between mb-1">
                        <span className="text-secondary small">Block</span>
                        <span className="text-info font-monospace small">#{selected.lastTx.blockId}</span>
                      </div>
                      <div className="d-flex justify-content-between mb-1">
                        <span className="text-secondary small">Action</span>
                        <span className="text-light small fw-medium">{selected.lastTx.action}</span>
                      </div>
                      <div className="d-flex justify-content-between mb-1">
                        <span className="text-secondary small">TX Hash</span>
                        <span className="text-info font-monospace" style={{ fontSize: '10px' }}>
                          {selected.lastTx.txHash.slice(0, 10)}…
                        </span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span className="text-secondary small">Time</span>
                        <span className="text-secondary small">{new Date(selected.lastTx.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-secondary small opacity-50 fst-italic">No on-chain records yet</p>
                  )}
                </div>

              </Card.Body>
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
};

export default NetworkDashboardPage;

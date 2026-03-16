import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Row, Col, Card, Badge, Spinner, Button } from 'react-bootstrap';
import CytoscapeComponent from 'react-cytoscapejs';
import { io } from 'socket.io-client';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

import axios from 'axios';
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
  status?: 'healthy' | 'suspicious' | 'under_investigation' | 'malicious' | 'isolated';
  pipelineStages?: any[];
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
  localBlockchain?: any[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const classify = (score: number): NetworkNode['status'] => {
  if (score > 80) return 'healthy';
  if (score >= 60) return 'suspicious';
  if (score >= 40) return 'under_investigation';
  return 'malicious';
};

const nodeColor = (status?: NetworkNode['status']) => {
  switch (status) {
    case 'healthy':             return '#198754';  // green
    case 'suspicious':          return '#ffc107';  // yellow
    case 'under_investigation': return '#fd7e14';  // orange
    case 'malicious':           return '#dc3545';  // red
    default:                    return '#0d6efd';  // blue (loading)
  }
};

const nodeBorder = (status?: NetworkNode['status']) => {
  switch (status) {
    case 'healthy':             return '#0f5132';
    case 'suspicious':          return '#997404';
    case 'under_investigation': return '#9a4e0e';
    case 'malicious':           return '#842029';
    default:                    return '#084298';
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
  const config = {
    healthy: { 
      color: '#198754', bg: 'rgba(25, 135, 84, 0.1)', 
      icon: <ShieldCheck size={11} className="me-1" />, label: 'Healthy' 
    },
    suspicious: { 
      color: '#ffc107', bg: 'rgba(255, 193, 7, 0.1)', 
      icon: <ShieldAlert size={11} className="me-1" />, label: 'Suspicious' 
    },
    under_investigation: { 
      color: '#fd7e14', bg: 'rgba(253, 126, 20, 0.1)', 
      icon: <ShieldAlert size={11} className="me-1" />, label: 'Under Investigation' 
    },
    malicious: { 
      color: '#dc3545', bg: 'rgba(220, 53, 69, 0.1)', 
      icon: <ShieldOff size={11} className="me-1" />, label: 'Malicious' 
    },
    isolated: { 
      color: '#6c757d', bg: 'rgba(108, 117, 125, 0.1)', 
      icon: <ShieldOff size={11} className="me-1" />, label: 'Isolated' 
    }
  };

  const s = status ?? 'healthy';
  const item = config[s as keyof typeof config] || config.healthy;

  return (
    <Badge 
      style={{ 
        backgroundColor: item.bg, 
        color: item.color, 
        border: `1px solid ${item.color}33`, 
        fontSize: '10px' 
      }} 
      className="text-uppercase d-inline-flex align-items-center px-2 py-1"
    >
      {item.icon}{item.label}
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
  const [simAttack, setSimAttack]   = useState<string>('DDoS');
  const [loadingAttack, setLoadingAttack] = useState<boolean>(false);
  const [analyticsData, setAnalyticsData] = useState<{ time: string; avgTrust: number; alerts: number; maliciousNodes: number }[]>([]);

  // ── Analytics continuous intervals calculations ──
  useEffect(() => {
    const tick = () => {
      setAnalyticsData(prev => {
        const avg = nodes.reduce((sum, n) => sum + (n.trustScore || 0), 0) / (nodes.length || 1);
        const maliciousCount = nodes.filter(n => (n.trustScore || 0) < 40).length;
        
        // Rolling 60s frequency
        const nowMs = Date.now();
        const alertsRate = txLog.filter(t => {
          if (!t.timestamp) return false;
          return (nowMs - t.timestamp < 60000) && (t.action?.includes('Detected') || t.action?.includes('Revoked') || t.action?.includes('Suspicious'));
        }).length;

        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        const nextData = [...prev, { time: now, avgTrust: Math.round(avg), alerts: alertsRate, maliciousNodes: maliciousCount }];
        if (nextData.length > 8) return nextData.slice(1);
        return nextData;
      });
    };

    tick();
    const interval = setInterval(tick, 4000);

    return () => clearInterval(interval);
  }, [nodes, txLog]);

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

    // 🕸️ Build a circular Ring Mesh layout supporting 20+ nodes beautifully
    const cyEdges: any[] = [];
    for (let i = 0; i < ns.length; i++) {
       const next = (i + 1) % ns.length;
       cyEdges.push({
         data: { id: `e1-${ns[i].address}-${ns[next].address}`, source: ns[i].address, target: ns[next].address }
       });

       // Add secondary cross-links for meshes scaling stability
       const skip = (i + 2) % ns.length;
       if (ns.length > 4) {
         cyEdges.push({
           data: { id: `e2-${ns[i].address}-${ns[skip].address}`, source: ns[i].address, target: ns[skip].address }
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

  const handleLaunchAttack = async (nodeAddr: string, type: string, stop = false) => {
    setLoadingAttack(true);
    try {
      const endpoint = stop ? '/api/simulator/stop-attack' : '/api/simulator/attack';
      await axios.post(`${SOCKET_URL}${endpoint}`, { node: nodeAddr, attackType: type });
      
      // Update local state is optional as socket will push trust change
      setSelected(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          node: { ...prev.node, status: stop ? 'healthy' : 'malicious' },
        };
      });
    } catch (e) {
      console.error('[Simulator] Error triggering attack:', e);
    } finally {
      setLoadingAttack(false);
    }
  };

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

    // ⛓️ Fetch Local Node blockchain
    axios.get(`${SOCKET_URL}/api/nodes/${addr}/local-blockchain`)
      .then(res => {
        setSelected({ node, activity, lastTx, localBlockchain: res.data });
      })
      .catch(e => {
        setSelected({ node, activity, lastTx, localBlockchain: [] });
      });

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
    !score ? 'secondary' : score > 80 ? 'success' : score >= 60 ? 'warning' : score >= 40 ? 'warning' : 'danger';

  // Stats
  const totalAttacks = txLog.filter(t => t.action?.includes('Revoked') || t.action?.includes('Detected')).length;
  const underAttackNodes = nodes.filter(n => n.status === 'malicious' || n.status === 'suspicious' || n.status === 'under_investigation' || (n.trustScore && n.trustScore <= 80)).length;
  const isolatedNodes = nodes.filter(n => n.status === 'isolated').length;

  // ── Chart Config ──
  const chartData = {
    labels: analyticsData.map(d => d.time),
    datasets: [
      {
        label: 'Avg Trust',
        data: analyticsData.map(d => d.avgTrust),
        borderColor: '#0284c7', // Sky Blue
        backgroundColor: 'rgba(2, 132, 199, 0.1)',
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 1,
      },
      {
        label: 'Attacks / Min',
        data: analyticsData.map(d => d.alerts),
        borderColor: '#ea580c', // Orange
        backgroundColor: 'rgba(234, 88, 12, 0.1)',
        tension: 0.2,
        borderWidth: 1.5,
        pointRadius: 1,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 8 } } },
      y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#64748b', font: { size: 8 }, min: 0 } }
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h4 className="text-light fw-bold mb-1">Network Topology</h4>
          <p className="text-secondary small mb-0">
            Live 6G mesh visualization — click nodes to inspect details
          </p>
        </div>
        <div className="d-flex align-items-center gap-2">
          {/* Legend */}
          {[
            { color: '#198754', label: 'Trusted' },
            { color: '#ffc107', label: 'Suspicious' },
            { color: '#dc3545', label: 'Malicious' },
          ].map(({ color, label }) => (
            <div key={label} className="d-flex align-items-center gap-1">
              <div className="rounded-circle" style={{ width: 8, height: 8, backgroundColor: color }} />
              <span className="text-secondary" style={{ fontSize: '11px' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 📊 Top Stats Header Row */}
      <Row className="mb-4 g-3">
        <Col md={4}>
          <Card bg="dark" border="danger" className="border-opacity-25 shadow-sm">
            <Card.Body className="d-flex align-items-center gap-3">
              <div className="rounded-circle bg-danger bg-opacity-10 p-3">
                <ShieldAlert size={22} className="text-danger" />
              </div>
              <div>
                <p className="text-secondary small mb-1">Total Attacks</p>
                <h4 className="text-light fw-bold mb-0">{totalAttacks}</h4>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card bg="dark" border="warning" className="border-opacity-25 shadow-sm">
            <Card.Body className="d-flex align-items-center gap-3">
              <div className="rounded-circle bg-warning bg-opacity-10 p-3">
                <Activity size={22} className="text-warning" />
              </div>
              <div>
                <p className="text-secondary small mb-1">Nodes Under Attack</p>
                <h4 className="text-light fw-bold mb-0">{underAttackNodes}</h4>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card bg="dark" border="success" className="border-opacity-25 shadow-sm">
            <Card.Body className="d-flex align-items-center gap-3">
              <div className="rounded-circle bg-success bg-opacity-10 p-3">
                <ShieldCheck size={22} className="text-success" />
              </div>
              <div>
                <p className="text-secondary small mb-1">Nodes Isolated / Secure</p>
                <h4 className="text-light fw-bold mb-0">
                  {nodes.length > 0 ? nodes.filter(n => (n.trustScore || 0) >= 60).length : 0}
                </h4>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3">
        {/* ── Graph ── */}
        <Col lg={selected ? 8 : 12} style={{ transition: 'all 0.3s ease' }}>
          <Card bg="dark" border="secondary" className="shadow-lg overflow-hidden mb-3" style={{ height: '380px' }}>
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

          {/* 🚨 Live Security Alerts Feed */}
          <Card bg="dark" border="danger" className="border-opacity-10 shadow-sm" style={{ height: '185px' }}>
            <Card.Header className="bg-transparent border-bottom border-secondary border-opacity-10 py-2 d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2">
                <ShieldAlert size={15} className="text-danger" />
                <span className="fw-semibold text-light" style={{ fontSize: '12px', letterSpacing: '0.5px' }}>LIVE SECURITY ALERTS</span>
              </div>
              <Badge bg="danger" pill style={{ fontSize: '10px' }}>
                {txLog.filter(t => t.action?.includes('Revoked') || t.action?.includes('Detected') || t.action?.includes('Suspicious')).length} Active
              </Badge>
            </Card.Header>
            <Card.Body className="overflow-auto py-2">
              <div className="d-flex flex-column gap-1">
                {txLog.filter(t => t.action?.includes('Revoked') || t.action?.includes('Detected') || t.action?.includes('Suspicious')).length === 0 ? (
                  <div className="text-center text-secondary py-3 small opacity-50">No critical anomalies detected</div>
                ) : (
                  txLog.filter(t => t.action?.includes('Revoked') || t.action?.includes('Detected') || t.action?.includes('Suspicious')).map(alert => (
                    <div key={alert.txHash} className="d-flex align-items-center justify-content-between p-2 rounded bg-danger bg-opacity-10 border-start border-danger border-3">
                      <div className="d-flex align-items-center gap-2">
                        <Badge bg={alert.action?.includes('Revoked') ? 'danger' : 'warning'} className="text-uppercase" style={{ fontSize: '9px' }}>
                          {alert.action?.includes('Revoked') ? 'REVOKED' : 'ALERT'}
                        </Badge>
                        <span className="text-light small" style={{ fontSize: '11px' }}>
                          {alert.nodeId?.slice(0,6)}: <span className="text-secondary">{alert.action}</span>
                        </span>
                      </div>
                      <span className="text-secondary" style={{ fontSize: '10px' }}>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* ── Side Panel / Live Analytics ── */}
        <Col lg={4} style={{ transition: 'all 0.3s ease' }}>
          {selected ? (
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

                {/* 🛡️ Secure 6G Processing Pipeline Panels */}
                {selected.node.pipelineStages && selected.node.pipelineStages.length > 0 && (
                  <div className="pt-3 border-top border-secondary border-opacity-25">
                    <p className="text-secondary mb-3 d-flex align-items-center gap-1 small">
                      <Activity size={13} className="text-info" /> Secure 6G Response Pipeline
                    </p>
                    <div className="row row-cols-1 g-2" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                      {selected.node.pipelineStages.map((stage: any, index: number) => {
                        const isSuccess = stage.success !== false;
                        const isAnomaly = stage.detected === true || stage.is_anomalous === true;
                        
                        let dotColor = 'text-success';
                        if (!isSuccess || isAnomaly) dotColor = 'text-danger';
                        if (stage.stage?.includes('Aggregator') || stage.stage?.includes('Learning')) dotColor = 'text-info';

                        const score = stage.score !== undefined ? Number(stage.score) : null;

                        return (
                          <div key={index} className="col">
                            <div className="p-2 rounded bg-secondary bg-opacity-10 border border-secondary border-opacity-10 shadow-sm">
                              <div className="d-flex justify-content-between align-items-center mb-1">
                                <span className={`fw-bold d-flex align-items-center gap-1`} style={{ fontSize: '11px', color: dotColor === 'text-danger' ? '#f87171' : '#f1f5f9' }}>
                                  <div className={`rounded-circle ${dotColor.replace('text', 'bg')}`} style={{ width: 8, height: 8, flexShrink: 0 }} />
                                  {stage.stage}
                                </span>
                                {score !== null && (
                                  <Badge bg="dark" className="border border-secondary" style={{ fontSize: '10px' }}>
                                    {score < 1.1 ? (score * 100).toFixed(0) + '%' : score}
                                  </Badge>
                                )}
                              </div>
                              <span className="text-secondary d-block" style={{ fontSize: '10px', lineHeight: '1.2' }}>
                                {stage.details || stage.action || 'Processed'}
                              </span>

                              {/* 🔬 Visual Meters based on Stage */}
                              {stage.stage?.includes('Autoencoder') && score !== null && (
                                <div className="mt-2 bg-black bg-opacity-25 rounded-pill overflow-hidden" style={{ height: 4 }}>
                                  <div className="bg-warning h-100" style={{ width: `${Math.min(100, score * 100)}%`, transition: 'width 0.5s ease' }} />
                                </div>
                              )}

                              {stage.stage?.includes('LSTM') && score !== null && (
                                <div className="mt-2 bg-black bg-opacity-25 rounded-pill overflow-hidden" style={{ height: 4 }}>
                                  <div className="bg-danger h-100" style={{ width: `${Math.min(100, score * 100)}%`, transition: 'width 0.5s ease' }} />
                                </div>
                              )}

                              {stage.stage?.includes('Dempster-Shafer') && stage.scores && (
                                <div className="d-flex flex-column gap-1 mt-2">
                                  <div className="progress bg-black bg-opacity-25 rounded-pill overflow-hidden" style={{ height: 4 }}>
                                    <div className="progress-bar bg-success" style={{ width: `${(stage.scores.belief_benign || 0) * 100}%` }} />
                                    <div className="progress-bar bg-danger" style={{ width: `${(stage.scores.belief_malicious || 0) * 100}%` }} />
                                  </div>
                                  <div className="d-flex justify-content-between text-secondary" style={{ fontSize: '8px' }}>
                                    <span>Benign: {((stage.scores.belief_benign || 0) * 100).toFixed(0)}%</span>
                                    <span>Malicious: {((stage.scores.belief_malicious || 0) * 100).toFixed(0)}%</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Simulation Controls */}
                <div className="pt-3 border-top border-secondary border-opacity-25">
                  <p className="text-secondary mb-2 d-flex align-items-center gap-1 small">
                    <ShieldAlert size={13} className="text-warning" /> Security Simulation
                  </p>
                  <div className="d-flex gap-2">
                    <select 
                      className="form-select btn btn-sm btn-outline-secondary text-start text-light bg-dark"
                      style={{ borderColor: 'rgba(255,255,255,0.1)' }}
                      value={simAttack}
                      onChange={(e) => setSimAttack(e.target.value)}
                      disabled={loadingAttack}
                    >
                      <option value="DDoS">DDoS Attack</option>
                      <option value="Sybil">Sybil Attack</option>
                      <option value="DataManipulation">Data Manipulation</option>
                      <option value="PoisonedGradients">Poisoned Gradients</option>
                      <option value="DelayedUpdate">Delayed Update</option>
                      <option value="CoordinatedAttack">Coordinated Attack</option>
                    </select>
                    <Button 
                      size="sm" 
                      variant={selected.node.status === 'malicious' || selected.node.status === 'suspicious' ? "secondary" : "danger"}
                      onClick={() => handleLaunchAttack(selected.node.address, simAttack, selected.node.status === 'malicious' || selected.node.status === 'suspicious')}
                      disabled={loadingAttack}
                    >
                      {loadingAttack ? <Spinner animation="border" size="sm" /> : (selected.node.status === 'malicious' || selected.node.status === 'suspicious' ? "Stop" : "Launch")}
                    </Button>
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

                {/* ⛓️ Local Node Blockchain Ledger */}
                <div className="pt-3 border-top border-secondary border-opacity-25 mt-3">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <p className="text-secondary mb-0 d-flex align-items-center gap-1 small">
                      <Database size={13} className="text-warning" /> Local Blockchain Ledger
                    </p>
                    {selected.localBlockchain && selected.localBlockchain.length > 1 && (
                      <Badge bg="dark" className="border border-secondary border-opacity-25 text-secondary small">
                        {selected.localBlockchain.length - 1} Blocks
                      </Badge>
                    )}
                  </div>
                  <div className="d-flex flex-column gap-2" style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                    {selected.localBlockchain && selected.localBlockchain.length > 1 ? (
                      selected.localBlockchain.filter((b: any) => b.eventType !== 'genesis').reverse().map((block: any, i: number) => (
                        <div key={i} className="p-2 rounded border border-secondary border-opacity-10 bg-secondary bg-opacity-10">
                          <div className="d-flex justify-content-between align-items-center mb-1">
                            <Badge bg={
                              block.eventType === 'packet_sent' ? 'primary' :
                              block.eventType === 'packet_received' ? 'success' :
                              block.eventType === 'packet_blocked' ? 'danger' : 'warning'
                            } style={{ fontSize: '9px' }}>
                              {block.eventType.toUpperCase().replace('_', ' ')}
                            </Badge>
                            <span className="text-secondary" style={{ fontSize: '9px' }}>
                              {new Date(block.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="text-light small fw-medium" style={{ fontSize: '11px' }}>
                            Packet <span className="text-info">#{block.packetId}</span>
                          </div>
                          <div className="text-secondary d-flex align-items-center gap-1 mt-1" style={{ fontSize: '10px' }}>
                            <span>Hash:</span>
                            <span className="font-monospace text-warning text-opacity-75">{block.hash.slice(0, 14)}…</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-secondary small opacity-50 fst-italic">No local ledger records yet</p>
                    )}
                  </div>
                </div>

              </Card.Body>
            </Card>
          ) : (
            <Card bg="dark" border="secondary" className="shadow-lg overflow-hidden" style={{ height: '580px' }}>
              <Card.Header className="bg-black bg-opacity-25 border-bottom border-secondary p-3 d-flex align-items-center gap-2">
                <Activity size={16} className="text-info" />
                <span className="text-secondary text-uppercase fw-semibold" style={{ fontSize: '11px', letterSpacing: '1px' }}>
                  Live Network Analytics
                </span>
              </Card.Header>
              <Card.Body className="p-3 d-flex flex-column" style={{ height: 'calc(100% - 100px)' }}>
                <div style={{ height: '230px' }} className="mb-3">
                  {analyticsData.length > 0 ? (
                    <Line data={chartData} options={chartOptions} />
                  ) : (
                    <div className="h-100 d-flex align-items-center justify-content-center text-secondary opacity-50 small">
                       Buffering live analytics telemetry…
                    </div>
                  )}
                </div>

                <div className="d-flex flex-column gap-2 mt-auto">
                   <div className="p-3 rounded bg-secondary bg-opacity-10 border border-secondary border-opacity-10 shadow-sm">
                      <span className="text-secondary small d-block mb-1">Average Trust Score</span>
                      <h4 className="text-info fw-bold mb-0">
                        {analyticsData.length > 0 ? analyticsData[analyticsData.length - 1].avgTrust : '--'}%
                      </h4>
                   </div>
                   <div className="p-3 rounded bg-secondary bg-opacity-10 border border-secondary border-opacity-10 shadow-sm">
                      <span className="text-secondary small d-block mb-1">Attacks (Last Minute)</span>
                      <h4 className="text-warning fw-bold mb-0">
                        {analyticsData.length > 0 ? analyticsData[analyticsData.length - 1].alerts : '--'}
                      </h4>
                   </div>
                   <div className="p-3 rounded bg-secondary bg-opacity-10 border border-secondary border-opacity-10 shadow-sm">
                      <span className="text-secondary small d-block mb-1">Active Malicious Nodes</span>
                      <h4 className="text-danger fw-bold mb-0">
                        {analyticsData.length > 0 ? analyticsData[analyticsData.length - 1].maliciousNodes : '--'}
                      </h4>
                   </div>
                </div>
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default NetworkDashboardPage;

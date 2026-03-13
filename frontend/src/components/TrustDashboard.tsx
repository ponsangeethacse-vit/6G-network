import React, { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { Line } from 'react-chartjs-2';
import { 
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, 
  LineElement, Title, Tooltip, Legend, Filler 
} from 'chart.js';
import { AlertTriangle, Server, Smartphone, Cpu, Activity, UserX, Shield } from 'lucide-react';
import { Container, Row, Col, Card, Badge, ListGroup } from 'react-bootstrap';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

interface DashboardProps {
  socket: Socket;
  socketUrl: string;
}

interface NodeData {
  address: string;
  role: number;
}

interface TrafficTick {
  node: string;
  packetSize: number;
  packetRate: number;
  isMaliciousMode: boolean;
  trustScore: number;
}

const getRoleIcon = (role: number) => {
  switch (role) {
    case 1: return <Smartphone size={20} className="text-info" />;
    case 2: return <Server size={20} className="text-primary" />;
    case 3: return <Cpu size={20} className="text-info" />;
    default: return <Activity size={20} className="text-secondary" />;
  }
};

const getRoleName = (role: number) => {
  switch (role) {
    case 1: return 'IoT Edge Device';
    case 2: return 'Base Station';
    case 3: return 'Cellular Relay';
    default: return 'Unknown Node';
  }
};

export default function TrustDashboard({ socket, socketUrl }: DashboardProps) {
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  
  const [nodeHistory, setNodeHistory] = useState<Record<string, number[]>>({});
  const [nodePrediction, setNodePrediction] = useState<Record<string, number>>({});
  const [alerts, setAlerts] = useState<Array<{time: string, msg: string, node: string}>>([]);

  useEffect(() => {
    fetch(`${socketUrl}/api/nodes`)
      .then(res => res.json())
      .then(data => {
        if (data.nodes) {
          setNodes(data.nodes);
          if (data.nodes.length > 0 && !selectedNode) {
            setSelectedNode(data.nodes[0].address);
          }
        }
      })
      .catch(err => console.error("Failed to fetch nodes", err));

    socket.on('trust_update', (tick: TrafficTick) => {
      setNodeHistory(prev => {
        const history = prev[tick.node] ? [...prev[tick.node]] : [];
        history.push(tick.trustScore);
        if (history.length > 30) history.shift();
        return { ...prev, [tick.node]: history };
      });

      setNodes(prev => {
        if (!prev.find(n => n.address === tick.node)) {
           fetch(`${socketUrl}/api/nodes`)
            .then(res => res.json())
            .then(data => {
              if (data.nodes) setNodes(data.nodes);
            });
        }
        return prev;
      });

      if (selectedNode === tick.node || !selectedNode) {
        fetch(`${socketUrl}/api/trust/${tick.node}`)
          .then(res => res.json())
          .then(data => {
            if (data.predictedNextScore) {
              setNodePrediction(prev => ({ ...prev, [tick.node]: data.predictedNextScore }));
            }
          });
      }

      if (tick.trustScore < 60) {
        setAlerts(prev => {
          const newAlerts = [
            { time: new Date().toLocaleTimeString(), msg: `Anomaly Detected! Score plummeted to ${tick.trustScore}. Zero-Trust Block Activated.`, node: tick.node },
            ...prev
          ];
          return newAlerts.slice(0, 5);
        });
      }
    });

    return () => {
      socket.off('trust_update');
    };
  }, [socket, selectedNode, socketUrl]);

  const chartData = {
    labels: Array.from({ length: 30 }, (_, i) => i),
    datasets: [
      {
        label: 'Fusion Trust Score (%)',
        data: selectedNode ? (nodeHistory[selectedNode] || []) : [],
        borderColor: 'rgb(13, 110, 253)',
        backgroundColor: 'rgba(13, 110, 253, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2,
      },
      {
        label: 'Anomaly Threshold',
        data: Array.from({ length: 30 }, () => 60),
        borderColor: 'rgba(220, 53, 69, 0.5)',
        borderDash: [5, 5],
        borderWidth: 1,
        pointRadius: 0,
        fill: false,
      }
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { min: 0, max: 100, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
      x: { display: false, grid: { display: false } }
    },
    plugins: {
      legend: { display: false },
      tooltip: { mode: 'index' as const, intersect: false }
    },
    animation: { duration: 0 }
  };

  const currentScore = selectedNode && nodeHistory[selectedNode] 
    ? nodeHistory[selectedNode][nodeHistory[selectedNode].length - 1] 
    : 100;
  
  const predictedScore = selectedNode ? nodePrediction[selectedNode] || null : null;
  const isBlocked = currentScore < 60;

  return (
    <Row className="g-4">
      <Col lg={4} xl={3}>
        <Card bg="dark" border="secondary" className="shadow-lg h-100">
          <Card.Header className="bg-black bg-opacity-25 border-bottom border-secondary p-3">
            <h5 className="mb-0 text-light d-flex align-items-center gap-2">
              <Activity className="text-primary" size={20} /> Active 6G Nodes
            </h5>
          </Card.Header>
          <ListGroup variant="flush" className="overflow-auto bg-dark" style={{ maxHeight: '600px' }}>
            {nodes.map(node => {
              const nodeScore = nodeHistory[node.address] ? nodeHistory[node.address][nodeHistory[node.address].length - 1] : 100;
              const nodeBlocked = nodeScore < 60;
              return (
                <ListGroup.Item 
                  key={node.address}
                  action
                  onClick={() => setSelectedNode(node.address)}
                  className={`bg-dark text-light border-bottom border-secondary p-3 ${selectedNode === node.address ? 'border-primary border-start border-4' : 'border-start border-4 border-transparent'}`}
                  style={{ backgroundColor: selectedNode === node.address ? 'rgba(13, 110, 253, 0.1)' : 'transparent', cursor: 'pointer' }}
                >
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <div className="d-flex align-items-center gap-2">
                      {getRoleIcon(node.role)}
                      <span className="fw-medium text-light small">{getRoleName(node.role)}</span>
                    </div>
                    <Badge bg={nodeBlocked ? 'danger' : 'success'} pill>
                      {nodeBlocked ? 'Blocked' : 'Trusted'}
                    </Badge>
                  </div>
                  <div className="text-secondary small font-monospace text-truncate mb-2">{node.address}</div>
                  <div className="d-flex align-items-center justify-content-between mt-1">
                    <span className="small text-secondary">Trust Score</span>
                    <span className={`small fw-bold ${nodeBlocked ? 'text-danger' : 'text-primary'}`}>{nodeScore}%</span>
                  </div>
                </ListGroup.Item>
              );
            })}
            {nodes.length === 0 && <div className="p-4 text-center text-secondary small">Awaiting Network Telemetry...</div>}
          </ListGroup>
        </Card>
      </Col>

      <Col lg={8} xl={9}>
        <Row className="g-4 mb-4">
          <Col md={4}>
            <Card bg="dark" border="secondary" className="shadow-lg h-100 position-relative overflow-hidden">
              <div className="position-absolute top-0 end-0 p-3 opacity-25">
                <Activity size={48} className="text-secondary" />
              </div>
              <Card.Body className="p-4">
                <h6 className="text-secondary fw-medium mb-1">Real-Time Fusion Score</h6>
                <div className="d-flex align-items-baseline gap-2 mb-2">
                  <span className={`display-5 fw-bold ${isBlocked ? 'text-danger' : 'text-primary'}`}>{currentScore}</span>
                  <span className="text-secondary fw-medium">/ 100</span>
                </div>
                <p className="small text-secondary mb-0">ML Weighted Direct + Indirect Trust</p>
              </Card.Body>
            </Card>
          </Col>

          <Col md={4}>
            <Card bg="dark" border="secondary" className="shadow-lg h-100 position-relative overflow-hidden">
              <div className="position-absolute top-0 end-0 p-3 opacity-25">
                <Activity size={48} className="text-secondary" />
              </div>
              <Card.Body className="p-4">
                <h6 className="text-secondary fw-medium mb-1">Predicted Trend (LSTM Proxy)</h6>
                <div className="d-flex align-items-baseline gap-2 mb-2">
                  <span className={`display-5 fw-bold ${predictedScore && predictedScore < 60 ? 'text-warning' : 'text-success'}`}>
                    {predictedScore ? Math.round(predictedScore) : '--'}
                  </span>
                </div>
                <p className="small text-secondary mb-0">Next cycle prediction trajectory</p>
              </Card.Body>
            </Card>
          </Col>

          <Col md={4}>
            <Card bg="dark" border={isBlocked ? 'danger' : 'secondary'} className="shadow-lg h-100 position-relative overflow-hidden" style={{ backgroundColor: isBlocked ? 'rgba(220, 53, 69, 0.1)' : '' }}>
               <div className="position-absolute top-0 end-0 p-3 opacity-25">
                <UserX size={48} className="text-secondary" />
               </div>
               <Card.Body className="p-4">
                 <h6 className="text-secondary fw-medium mb-1">Access Control Policy</h6>
                 <div className="d-flex align-items-center gap-3 mt-3">
                    {isBlocked ? (
                      <>
                        <div className="rounded-circle bg-danger bg-opacity-25 d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px' }}>
                          <AlertTriangle className="text-danger" size={20} />
                        </div>
                        <div>
                          <div className="text-danger fw-bold">REVOKED</div>
                          <div className="small text-danger opacity-75">Blockchain contract blocked</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="rounded-circle bg-success bg-opacity-25 d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px' }}>
                          <Shield className="text-success" size={20} />
                        </div>
                        <div>
                          <div className="text-success fw-bold">GRANTED</div>
                          <div className="small text-success opacity-75">Zero-Trust Verified</div>
                        </div>
                      </>
                    )}
                 </div>
               </Card.Body>
            </Card>
          </Col>
        </Row>

        <Card bg="dark" border="secondary" className="shadow-lg mb-4" style={{ height: '320px' }}>
          <Card.Body className="p-4 d-flex flex-column">
            <h6 className="text-light fw-semibold mb-3">Trust Fusion Lifeline</h6>
            <div className="flex-grow-1 position-relative">
              <Line data={chartData} options={chartOptions as any} />
            </div>
          </Card.Body>
        </Card>

        <Card bg="dark" border="secondary" className="shadow-lg overflow-hidden">
          <Card.Header className="bg-black bg-opacity-25 border-bottom border-secondary p-3 d-flex justify-content-between align-items-center">
            <h6 className="mb-0 text-light d-flex align-items-center gap-2">
              <AlertTriangle className="text-warning" size={20} /> Security Intelligence Alerts
            </h6>
            <Badge bg="secondary" text="light" className="font-monospace">LATEST_LOGS_ONLY</Badge>
          </Card.Header>
          <Card.Body className="p-3">
            <div className="d-flex flex-column gap-3">
              {alerts.length === 0 ? (
                <div className="text-center text-secondary small py-3">No recent security events. System is stable.</div>
              ) : (
                alerts.map((alert, idx) => (
                  <div key={idx} className="d-flex gap-3 align-items-start p-3 bg-danger bg-opacity-10 border border-danger border-opacity-25 rounded w-100">
                    <span className="text-danger small font-monospace flex-shrink-0 pt-1">{alert.time}</span>
                    <div>
                       <p className="text-light small fw-medium mb-1">{alert.msg}</p>
                       <p className="text-danger opacity-75 small font-monospace mb-0">{alert.node}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}

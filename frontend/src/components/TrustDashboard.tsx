import React, { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { Line } from 'react-chartjs-2';
import { 
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, 
  LineElement, Title, Tooltip, Legend, Filler 
} from 'chart.js';
import { AlertTriangle, Server, Smartphone, Cpu, Activity, UserX, Shield } from 'lucide-react';

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
    case 1: return <Smartphone className="w-5 h-5 text-blue-400" />;
    case 2: return <Server className="w-5 h-5 text-purple-400" />;
    case 3: return <Cpu className="w-5 h-5 text-cyan-400" />;
    default: return <Activity className="w-5 h-5 text-slate-400" />;
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
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2,
      },
      {
        label: 'Anomaly Threshold',
        data: Array.from({ length: 30 }, () => 60),
        borderColor: 'rgba(239, 68, 68, 0.5)',
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
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl lg:col-span-1">
        <div className="p-4 border-b border-slate-800 bg-slate-800/50">
          <h2 className="font-semibold text-slate-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" /> Active 6G Nodes
          </h2>
        </div>
        <div className="divide-y divide-slate-800/50 max-h-[600px] overflow-y-auto">
          {nodes.map(node => {
            const nodeScore = nodeHistory[node.address] ? nodeHistory[node.address][nodeHistory[node.address].length - 1] : 100;
            const nodeBlocked = nodeScore < 60;
            return (
              <button
                key={node.address}
                onClick={() => setSelectedNode(node.address)}
                className={`w-full text-left p-4 hover:bg-slate-800/50 transition-colors flex flex-col gap-2 ${selectedNode === node.address ? 'bg-blue-900/20 border-l-4 border-blue-500' : 'border-l-4 border-transparent'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getRoleIcon(node.role)}
                    <span className="font-medium text-slate-200 text-sm">{getRoleName(node.role)}</span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${nodeBlocked ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                    {nodeBlocked ? 'Blocked' : 'Trusted'}
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-mono truncate">{node.address}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-slate-400">Trust Score</span>
                  <span className={`text-sm font-bold ${nodeBlocked ? 'text-red-400' : 'text-blue-400'}`}>{nodeScore}%</span>
                </div>
              </button>
            );
          })}
          {nodes.length === 0 && <div className="p-8 text-center text-slate-500 text-sm">Awaiting Network Telemetry...</div>}
        </div>
      </div>

      <div className="lg:col-span-3 flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Activity className="w-16 h-16" />
            </div>
            <h3 className="text-slate-400 text-sm font-medium mb-1">Real-Time Fusion Score</h3>
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-bold ${isBlocked ? 'text-red-500' : 'text-blue-500'}`}>{currentScore}</span>
              <span className="text-slate-500 font-medium">/ 100</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">ML Weighted Direct + Indirect Trust</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Activity className="w-16 h-16" />
            </div>
            <h3 className="text-slate-400 text-sm font-medium mb-1">Predicted Trend (LSTM Proxy)</h3>
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-bold ${predictedScore && predictedScore < 60 ? 'text-orange-500' : 'text-emerald-500'}`}>
                {predictedScore ? Math.round(predictedScore) : '--'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">Next cycle prediction trajectory</p>
          </div>

          <div className={`bg-slate-900 border rounded-xl p-6 shadow-xl relative overflow-hidden transition-colors ${isBlocked ? 'border-red-500 bg-red-950/20' : 'border-slate-800'}`}>
             <div className="absolute top-0 right-0 p-4 opacity-10">
              <UserX className="w-16 h-16" />
             </div>
             <h3 className="text-slate-400 text-sm font-medium mb-1">Access Control Policy</h3>
             <div className="flex items-center gap-3 mt-2">
                {isBlocked ? (
                  <>
                    <div className="h-8 w-8 rounded-full bg-red-500/20 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    </div>
                    <div>
                      <div className="text-red-500 font-bold">REVOKED</div>
                      <div className="text-xs text-red-500/70">Blockchain contract blocked</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <Shield className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div>
                      <div className="text-emerald-500 font-bold">GRANTED</div>
                      <div className="text-xs text-emerald-500/70">Zero-Trust Verified</div>
                    </div>
                  </>
                )}
             </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl h-80 relative">
          <h2 className="text-slate-300 font-semibold mb-4 text-sm">Trust Fusion Lifeline</h2>
          <div className="absolute inset-0 top-14 left-6 right-6 bottom-6">
            <Line data={chartData} options={chartOptions as any} />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 bg-slate-800/50 flex justify-between items-center">
            <h2 className="font-semibold text-slate-100 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-400" /> Security Intelligence Alerts
            </h2>
            <span className="text-xs font-mono bg-slate-800 px-2 py-1 rounded text-slate-400">LATEST_LOGS_ONLY</span>
          </div>
          <div className="p-4 flex flex-col gap-3">
            {alerts.length === 0 ? (
              <div className="text-center text-slate-500 text-sm py-4">No recent security events. System is stable.</div>
            ) : (
              alerts.map((alert, idx) => (
                <div key={idx} className="flex gap-4 items-start p-3 bg-red-500/10 border border-red-500/20 rounded-lg animate-in slide-in-from-left-4 fade-in">
                  <span className="text-red-400 text-xs font-mono shrink-0 pt-0.5">{alert.time}</span>
                  <div>
                     <p className="text-red-100 text-sm font-medium">{alert.msg}</p>
                     <p className="text-red-400/70 text-xs font-mono mt-1">{alert.node}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

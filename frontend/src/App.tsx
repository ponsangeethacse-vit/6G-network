import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';

import DashboardLayout from './layouts/DashboardLayout';
import LoginPage from './pages/LoginPage';
import NetworkDashboardPage from './pages/NetworkDashboardPage';
import TrustScoreVisualizationPage from './pages/TrustScoreVisualizationPage';
import AttackDetectionMonitorPage from './pages/AttackDetectionMonitorPage';
import BlockchainTransactionViewerPage from './pages/BlockchainTransactionViewerPage';
import NodeManagementPanelPage from './pages/NodeManagementPanelPage';
import NodeTransferPage from './pages/NodeTransferPage';

const SOCKET_SERVER_URL = 'http://localhost:4000';

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [maliciousMode, setMaliciousMode] = useState(false);
  const [nodes, setNodes] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const newSocket = io(SOCKET_SERVER_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => setIsConnected(true));
    newSocket.on('disconnect', () => setIsConnected(false));
    
    newSocket.on('simulator_mode', (data: { maliciousMode: boolean }) => {
      setMaliciousMode(data.maliciousMode);
    });

    // Fetch initial nodes for global context
    fetch(`${SOCKET_SERVER_URL}/api/nodes`)
      .then(res => res.json())
      .then(data => {
        if (data.nodes) setNodes(data.nodes);
      })
      .catch(err => console.error("Failed to fetch initial nodes", err));

    newSocket.on('trust_update', (tick: any) => {
       setNodes(prev => {
         // Transform data to suit NetworkGraph nodes visualization if needed,
         // but TrustDashboard expects { address, role }
         if (!prev.find(n => n.address === tick.node)) {
            fetch(`${SOCKET_SERVER_URL}/api/nodes`)
             .then(res => res.json())
             .then(data => {
               if (data.nodes) setNodes(data.nodes);
             });
         }
         return prev;
       });
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const toggleMaliciousMode = async () => {
    try {
      const res = await fetch(`${SOCKET_SERVER_URL}/api/simulator/toggle`, {
        method: 'POST'
      });
      const data = await res.json();
      setMaliciousMode(data.maliciousMode);
    } catch (e) {
      console.error("Failed to toggle mode", e);
    }
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        
        <Route element={<DashboardLayout 
            socket={socket} 
            socketUrl={SOCKET_SERVER_URL} 
            maliciousMode={maliciousMode}
            isConnected={isConnected}
            toggleMaliciousMode={toggleMaliciousMode}
            nodes={nodes}
          />}
        >
          <Route path="/dashboard" element={<NetworkDashboardPage />} />
          <Route path="/dashboard/trust" element={<TrustScoreVisualizationPage />} />
          <Route path="/dashboard/alerts" element={<AttackDetectionMonitorPage />} />
          <Route path="/dashboard/blockchain" element={<BlockchainTransactionViewerPage />} />
          <Route path="/dashboard/nodes" element={<NodeManagementPanelPage />} />
          <Route path="/dashboard/transfers" element={<NodeTransferPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

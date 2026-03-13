import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { Container, Navbar, Button, Badge } from 'react-bootstrap';
import TrustDashboard from './components/TrustDashboard';
import { Shield, ShieldAlert, Activity } from 'lucide-react';

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
    <div className="min-vh-100 bg-dark text-light font-sans" style={{ backgroundColor: '#0a0a0c' }}>
      <Navbar bg="dark" variant="dark" expand="lg" sticky="top" className="border-bottom border-secondary mb-4" style={{ backgroundColor: 'rgba(33, 37, 41, 0.9)' }}>
        <Container>
          <Navbar.Brand href="#home" className="d-flex align-items-center gap-3">
            <Shield className="text-primary" size={32} />
            <span className="fw-bold fs-4 tracking-tight text-white">6G Trust Defender</span>
          </Navbar.Brand>
          
          <Navbar.Collapse className="justify-content-end">
            <div className="d-flex align-items-center gap-4">
              <div className="d-flex align-items-center gap-2 text-sm">
                <Badge bg={isConnected ? 'success' : 'danger'} pill className="p-2">
                  {isConnected ? 'System Online' : 'Connecting...'}
                </Badge>
              </div>
              <Button
                variant={maliciousMode ? 'outline-danger' : 'outline-success'}
                onClick={toggleMaliciousMode}
                className="d-flex align-items-center gap-2"
                style={{
                  boxShadow: maliciousMode ? '0 0 15px rgba(220, 53, 69, 0.3)' : 'none'
                }}
              >
                {maliciousMode ? <ShieldAlert size={16} /> : <Activity size={16} />}
                {maliciousMode ? 'Malicious Traffic: ON' : 'Normal Traffic'}
              </Button>
            </div>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <main>
        <Container fluid="lg" className="py-4">
          {socket && <TrustDashboard socket={socket} socketUrl={SOCKET_SERVER_URL} />}
        </Container>
      </main>
    </div>
  );
}

export default App;

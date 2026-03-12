import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
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
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
      <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-blue-500" />
              <span className="font-bold text-xl tracking-tight text-white">6G Trust Defender</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="relative flex h-3 w-3">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                </span>
                <span className="text-slate-400">{isConnected ? 'System Online' : 'Connecting...'}</span>
              </div>
              <button
                onClick={toggleMaliciousMode}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  maliciousMode 
                    ? 'bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.3)]' 
                    : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/50 hover:bg-emerald-500/20'
                }`}
              >
                {maliciousMode ? <ShieldAlert className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                {maliciousMode ? 'Malicious Traffic: ON' : 'Normal Traffic'}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {socket && <TrustDashboard socket={socket} socketUrl={SOCKET_SERVER_URL} />}
      </main>
    </div>
  );
}

export default App;

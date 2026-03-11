import React, { useState, useEffect } from 'react';
import { Shield, LayoutDashboard, Database, Activity, Terminal, ExternalLink, RefreshCw, Zap, Wallet } from 'lucide-react';
import NetworkGraph from './components/NetworkGraph';
import TrustDashboard from './components/TrustDashboard';
import AttackAlerts from './components/AttackAlerts';
import BlockchainExplorer from './components/BlockchainExplorer';
import { useRealtime } from './hooks/useRealtime';
import { useWeb3 } from './hooks/useWeb3';
import { simulateNodes, simulateAttack } from './services/api';
import { NetworkNode } from './types';

function App() {
  const { data: nodes, alerts } = useRealtime();
  const { account, connectWallet } = useWeb3();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSimulating, setIsSimulating] = useState(false);

  const handleSimulateNodes = async () => {
    setIsSimulating(true);
    try {
      await simulateNodes();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSimulateAttack = async (type: string) => {
    try {
      await simulateAttack(type);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 bg-[#0d0d10] p-6 flex flex-col gap-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-trust-accent rounded-lg flex items-center justify-center neon-border">
            <Shield className="text-black w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none">TrustGuard</h1>
            <span className="text-[10px] text-trust-accent tracking-[0.2em] font-semibold">6G DEFENSE</span>
          </div>
        </div>

        <nav className="flex flex-col gap-2">
          <NavItem 
            icon={<LayoutDashboard className="w-4 h-4" />} 
            label="Overview" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <NavItem 
            icon={<Activity className="w-4 h-4" />} 
            label="Network Mesh" 
            active={activeTab === 'network'} 
            onClick={() => setActiveTab('network')} 
          />
          <NavItem 
            icon={<Database className="w-4 h-4" />} 
            label="Ledger Explorer" 
            active={activeTab === 'blockchain'} 
            onClick={() => setActiveTab('blockchain')} 
          />
        </nav>

        <div className="mt-auto space-y-4">
            <button 
                onClick={connectWallet}
                className="w-full glass-card p-3 rounded-xl flex items-center gap-3 text-sm hover:bg-trust-accent/10 transition-colors border-trust-accent/20"
            >
                <Wallet className="w-4 h-4 text-trust-accent" />
                <span className="truncate">{account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Connect Web3'}</span>
            </button>
            <div className="p-4 rounded-xl bg-trust-accent/5 border border-trust-accent/10">
                <p className="text-[10px] text-trust-accent mb-2 uppercase font-bold">Network Status</p>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-trust-high animate-pulse" />
                    <span className="text-xs">Secure & Syncing</span>
                </div>
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold">Network Security Posture</h2>
            <p className="text-gray-400 text-sm">Real-time threat landscape for 6G Industrial Nodes</p>
          </div>
          <div className="flex gap-4">
              <button 
                onClick={handleSimulateNodes}
                disabled={isSimulating}
                className="px-4 py-2 border border-white/10 rounded-lg text-sm flex items-center gap-2 hover:bg-white/5 transition-all text-gray-300"
              >
                  <RefreshCw className={`w-4 h-4 ${isSimulating ? 'animate-spin' : ''}`} /> Initialize Network
              </button>
              <button 
                onClick={() => handleSimulateAttack('DDoS')}
                className="px-4 py-2 bg-trust-low/10 text-trust-low border border-trust-low/20 rounded-lg text-sm flex items-center gap-2 hover:bg-trust-low/20 transition-all font-semibold"
              >
                  <Zap className="w-4 h-4" /> Trigger Attack Simulation
              </button>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <TrustDashboard nodes={nodes || []} alerts={alerts} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AttackAlerts alerts={alerts} />
                <BlockchainExplorer />
            </div>
          </div>
        )}

        {activeTab === 'network' && (
          <div className="h-[600px] glass-card rounded-2xl overflow-hidden relative">
            <NetworkGraph nodes={nodes || []} />
          </div>
        )}

        {activeTab === 'blockchain' && (
           <div className="space-y-6">
               <BlockchainExplorer />
                <div className="glass-card p-6 rounded-xl">
                    <h3 className="text-sm font-semibold mb-4 text-gray-400">RAW TRANSACTION STREAM</h3>
                    <div className="font-mono text-xs text-gray-400 space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                        {nodes?.slice(0, 20).map((n: NetworkNode, i: number) => (
                            <div key={i} className="flex gap-4 p-2 hover:bg-white/5 rounded">
                                <span className="text-trust-accent">[{new Date().toLocaleTimeString()}]</span>
                                <span className="text-trust-mid">SIGN_TRUST_TX</span>
                                <span>|</span>
                                <span className="text-white">NODE: {n.nodeId}</span>
                                <span>|</span>
                                <span className="text-trust-high">SCORE: {n.trustScore.toFixed(4)}</span>
                                <span className="ml-auto text-[10px] text-gray-600">SIG: 0x{Math.random().toString(16).slice(2, 42)}</span>
                            </div>
                        ))}
                    </div>
                </div>
           </div>
        )}
      </main>
    </div>
  );
}

const NavItem = ({ icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
      active 
        ? 'bg-trust-accent/10 text-trust-accent border border-trust-accent/20' 
        : 'text-gray-400 hover:text-white hover:bg-white/5'
    }`}
  >
    {icon}
    <span className="font-semibold text-sm">{label}</span>
  </button>
);

export default App;

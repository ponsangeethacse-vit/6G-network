import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Activity, Shield, Zap, AlertTriangle } from 'lucide-react';
import { NetworkNode, SecurityAlert } from '../types';

const TrustDashboard = ({ nodes, alerts }: { nodes: NetworkNode[], alerts: SecurityAlert[] }) => {
  const avgTrust = nodes.reduce((acc, n) => acc + n.trustScore, 0) / (nodes.length || 1);
  const isolatedCount = nodes.filter(n => n.status === 'isolated').length;
  
  const trustDist = [
    { range: '0-0.2', count: nodes.filter(n => n.trustScore < 0.2).length },
    { range: '0.2-0.4', count: nodes.filter(n => n.trustScore >= 0.2 && n.trustScore < 0.4).length },
    { range: '0.4-0.6', count: nodes.filter(n => n.trustScore >= 0.4 && n.trustScore < 0.6).length },
    { range: '0.6-0.8', count: nodes.filter(n => n.trustScore >= 0.6 && n.trustScore < 0.8).length },
    { range: '0.8-1.0', count: nodes.filter(n => n.trustScore >= 0.8).length }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="glass-card p-4 rounded-xl border-l-4 border-trust-accent">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400 text-sm">Average Network Trust</span>
          <Shield className="text-trust-accent w-5 h-5" />
        </div>
        <div className="text-2xl font-bold neon-text">{(avgTrust * 100).toFixed(1)}%</div>
      </div>

      <div className="glass-card p-4 rounded-xl border-l-4 border-trust-high">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400 text-sm">Active Nodes</span>
          <Activity className="text-trust-high w-5 h-5" />
        </div>
        <div className="text-2xl font-bold">{nodes.length - isolatedCount} / {nodes.length}</div>
      </div>

      <div className="glass-card p-4 rounded-xl border-l-4 border-trust-low">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400 text-sm">Isolated Nodes</span>
          <AlertTriangle className="text-trust-low w-5 h-5" />
        </div>
        <div className="text-2xl font-bold">{isolatedCount}</div>
      </div>

      <div className="glass-card p-4 rounded-xl border-l-4 border-yellow-400">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400 text-sm">Total Alerts (24h)</span>
          <Zap className="text-yellow-400 w-5 h-5" />
        </div>
        <div className="text-2xl font-bold">{alerts.length}</div>
      </div>

      <div className="col-span-1 md:col-span-2 glass-card p-6 rounded-xl h-64">
        <h3 className="text-sm font-semibold mb-4 text-gray-400 uppercase tracking-wider">Trust Score Distribution</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={trustDist}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="range" stroke="#888" fontSize={12} />
            <YAxis stroke="#888" fontSize={12} />
            <Tooltip 
                contentStyle={{ backgroundColor: '#16161a', border: '1px solid #333', borderRadius: '8px' }}
                itemStyle={{ color: '#00f2ff' }}
            />
            <Bar dataKey="count" fill="#00f2ff" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="col-span-1 md:col-span-2 glass-card p-6 rounded-xl h-64">
        <h3 className="text-sm font-semibold mb-4 text-gray-400 uppercase tracking-wider">Real-time Trust Trend</h3>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={nodes.slice(0, 10).map((n, i) => ({ name: n.nodeId, trust: n.trustScore }))}>
            <defs>
              <linearGradient id="trustGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00f2ff" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#00f2ff" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="name" stroke="#888" fontSize={10} />
            <YAxis stroke="#888" fontSize={12} domain={[0, 1]} />
            <Tooltip contentStyle={{ backgroundColor: '#16161a', border: '1px solid #333' }} />
            <Area type="monotone" dataKey="trust" stroke="#00f2ff" fillOpacity={1} fill="url(#trustGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TrustDashboard;

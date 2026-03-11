import React from 'react';
import { ShieldAlert, Info, Clock } from 'lucide-react';
import { SecurityAlert } from '../types';

const AttackAlerts = ({ alerts }: { alerts: SecurityAlert[] }) => {
  return (
    <div className="glass-card p-6 rounded-xl h-[400px] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-trust-low" /> Core Network Security Logs
        </h3>
        <span className="text-[10px] bg-red-500/10 text-red-500 px-2 py-0.5 rounded border border-red-500/20">LIVE</span>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
        {alerts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-50 italic text-sm">
            <Info className="w-8 h-8 mb-2" />
            No active threats detected. Network monitoring stable.
          </div>
        ) : (
          alerts.map((alert, idx) => (
            <div key={idx} className={`p-3 rounded-lg border flex flex-col gap-1 animate-in fade-in slide-in-from-right duration-500 ${
                alert.severity === 'high' ? 'bg-red-500/5 border-red-500/20' : 'bg-yellow-500/5 border-yellow-500/20'
            }`}>
              <div className="flex justify-between items-start">
                <span className={`text-xs font-bold uppercase ${alert.severity === 'high' ? 'text-red-500' : 'text-yellow-500'}`}>
                  {alert.type} DETECTED
                </span>
                <span className="text-[10px] text-gray-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {new Date(alert.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm text-gray-300">Target Node: <span className="text-trust-accent font-mono">{alert.nodeId}</span></p>
              <div className="mt-1 flex gap-2">
                  <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded">Action: Automatic Isolation</span>
                  <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded">Protocol: Zero-Trust v3</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AttackAlerts;

import React from 'react';
import { ShieldAlert, Info, Clock } from 'lucide-react';
import { SecurityAlert } from '../types';
import { Card, Badge } from 'react-bootstrap';

const AttackAlerts = ({ alerts }: { alerts: SecurityAlert[] }) => {
  return (
    <Card bg="dark" border="secondary" className="h-100 shadow-lg" style={{ minHeight: '400px' }}>
      <Card.Header className="bg-black bg-opacity-25 border-bottom border-secondary p-3 d-flex align-items-center justify-content-between">
        <h6 className="mb-0 text-secondary text-uppercase d-flex align-items-center gap-2" style={{ letterSpacing: '1px' }}>
            <ShieldAlert className="text-danger" size={16} /> Core Network Security Logs
        </h6>
        <Badge bg="danger" className="border border-danger border-opacity-25 bg-opacity-10 text-danger">LIVE</Badge>
      </Card.Header>
      
      <Card.Body className="overflow-auto p-3 d-flex flex-column gap-3" style={{ maxHeight: '350px' }}>
        {alerts.length === 0 ? (
          <div className="h-100 d-flex flex-column align-items-center justify-content-center text-secondary opacity-50 fst-italic small">
            <Info size={32} className="mb-2" />
            No active threats detected. Network monitoring stable.
          </div>
        ) : (
          alerts.map((alert, idx) => (
            <div key={idx} className={`p-3 rounded border d-flex flex-column gap-1 ${
                alert.severity === 'critical' ? 'bg-danger bg-opacity-20 border-danger border-status-glow shadow-sm' :
                alert.severity === 'high' ? 'bg-danger bg-opacity-10 border-danger border-opacity-25' : 
                'bg-warning bg-opacity-10 border-warning border-opacity-25'
            }`}>
              <div className="d-flex justify-content-between align-items-start">
                <span className={`small fw-bold text-uppercase ${alert.severity === 'high' ? 'text-danger' : 'text-warning'}`}>
                  {alert.type} DETECTED
                </span>
                <span className="text-secondary d-flex align-items-center gap-1" style={{ fontSize: '10px' }}>
                  <Clock size={12} /> {new Date(alert.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="small text-light mb-1">Target Node: <span className="text-info font-monospace">{alert.nodeId}</span></p>
              <div className="d-flex gap-2">
                  <Badge bg="secondary" className="bg-opacity-25 fw-normal" style={{ fontSize: '10px' }}>Action: Automatic Isolation</Badge>
                  <Badge bg="secondary" className="bg-opacity-25 fw-normal" style={{ fontSize: '10px' }}>Protocol: Zero-Trust v3</Badge>
              </div>
            </div>
          ))
        )}
      </Card.Body>
    </Card>
  );
};

export default AttackAlerts;

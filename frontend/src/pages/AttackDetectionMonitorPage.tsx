import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Row, Col, Card, Badge, Button, ButtonGroup, Spinner, Table } from 'react-bootstrap';
import { io } from 'socket.io-client';
import {
  ShieldOff, ShieldAlert, Siren, AlertTriangle,
  Activity, Filter, RefreshCw, CheckCircle2, Clock, Cpu
} from 'lucide-react';

import { AttackService } from '../services/api.service';

const SOCKET_URL = 'http://localhost:4000';

// ─── Types ────────────────────────────────────────────────────────────────────
type Severity = 'critical' | 'high' | 'medium' | 'low';
type AttackType = 'All' | string;

interface Alert {
  id: string;
  nodeId: string;
  nodeLabel: string;
  type: string;
  message: string;
  detail: string;
  severity: Severity;
  trustScore: number;
  timestamp: number;
  resolved: boolean;
}

// ─── Severity config ─────────────────────────────────────────────────────────
const SEV: Record<Severity, { color: string; bg: string; border: string; label: string; icon: React.ReactNode }> = {
  critical: { color: 'text-danger',  bg: 'rgba(220,53,69,0.12)',   border: 'rgba(220,53,69,0.35)',  label: 'CRITICAL', icon: <ShieldOff size={14} /> },
  high:     { color: 'text-warning', bg: 'rgba(255,193,7,0.10)',   border: 'rgba(255,193,7,0.30)',  label: 'HIGH',     icon: <ShieldAlert size={14} /> },
  medium:   { color: 'text-info',    bg: 'rgba(13,202,240,0.08)',  border: 'rgba(13,202,240,0.25)', label: 'MEDIUM',   icon: <AlertTriangle size={14} /> },
  low:      { color: 'text-success', bg: 'rgba(25,135,84,0.08)',   border: 'rgba(25,135,84,0.20)',  label: 'LOW',      icon: <Activity size={14} /> },
};

const typeIcon = (type: string) => {
  const t = type.toLowerCase();
  if (t.includes('ddos'))       return <Siren size={15} className="text-danger" />;
  if (t.includes('sybil'))      return <Cpu size={15} className="text-warning" />;
  if (t.includes('data'))       return <ShieldOff size={15} className="text-info" />;
  if (t.includes('insider'))    return <ShieldAlert size={15} className="text-orange" style={{ color: '#fd7e14' }} />;
  if (t.includes('poison'))     return <AlertTriangle size={15} className="text-purple" style={{ color: '#af52de' }} />;
  if (t.includes('flooding'))   return <Activity size={15} className="text-danger" />;
  if (t.includes('spoof'))      return <ShieldOff size={15} className="text-warning" />;
  if (t.includes('suspicious')) return <AlertTriangle size={15} className="text-warning" />;
  return <AlertTriangle size={15} className="text-secondary" />;
};

// ─── Single alert row (feed) ─────────────────────────────────────────────────
const AlertRow = ({ alert, onResolve }: { alert: Alert; onResolve: (id: string) => void }) => {
  const sev = SEV[alert.severity] ?? SEV.low;
  const pulse = alert.severity === 'critical' && !alert.resolved;
  return (
    <div
      className={`p-3 rounded mb-2 border position-relative ${alert.resolved ? 'opacity-50' : ''}`}
      style={{ background: sev.bg, borderColor: sev.border, transition: 'opacity 0.3s' }}
    >
      {/* Critical pulse dot */}
      {pulse && (
        <span
          className="position-absolute top-0 end-0 m-2 rounded-circle bg-danger"
          style={{ width: 8, height: 8, animation: 'blinker 1s step-start infinite' }}
        />
      )}

      <div className="d-flex align-items-start justify-content-between gap-2">
        <div className="d-flex align-items-start gap-2 flex-grow-1">
          {typeIcon(alert.type)}
          <div>
            <p className={`mb-0 fw-bold small ${sev.color} text-capitalize`}>{alert.message}</p>
            <p className="mb-1 text-secondary" style={{ fontSize: '11px' }}>{alert.detail}</p>
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <Badge
                className={`${sev.color} border fw-normal`}
                style={{ background: sev.bg, borderColor: sev.border, fontSize: '10px' }}
              >
                {sev.icon}&nbsp;{sev.label}
              </Badge>
              <span className="text-secondary font-monospace" style={{ fontSize: '10px' }}>
                Trust: {alert.trustScore}%
              </span>
              <span className="text-secondary d-flex align-items-center gap-1" style={{ fontSize: '10px' }}>
                <Clock size={10} /> {new Date(alert.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>

        {!alert.resolved && (
          <Button
            size="sm"
            variant="outline-secondary"
            className="flex-shrink-0 py-0 px-2"
            style={{ fontSize: '10px' }}
            onClick={() => onResolve(alert.id)}
          >
            Resolve
          </Button>
        )}
        {alert.resolved && <CheckCircle2 size={16} className="text-success flex-shrink-0" />}
      </div>
    </div>
  );
};

// ─── Summary stat card ─────────────────────────────────────────────────────────
const StatCard = ({ label, count, color, icon }: { label: string; count: number; color: string; icon: React.ReactNode }) => (
  <Card bg="dark" border="secondary" className="shadow-sm">
    <Card.Body className="py-3 px-4 d-flex align-items-center gap-3">
      <span className={`text-${color}`}>{icon}</span>
      <div>
        <div className={`fs-4 fw-bold text-${color}`}>{count}</div>
        <div className="text-secondary" style={{ fontSize: '12px' }}>{label}</div>
      </div>
    </Card.Body>
  </Card>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const AttackDetectionMonitorPage = () => {
  const [alerts, setAlerts]           = useState<Alert[]>([]);
  const [loading, setLoading]         = useState(true);
  const [severityFilter, setSeverity] = useState<Severity | 'all'>('all');
  const [typeFilter, setTypeFilter]   = useState<AttackType>('All');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  // ── Fetch existing alerts via REST ────────────────────────────────────────
  const fetchAlerts = useCallback(async () => {
    try {
      const data = await AttackService.getAttacks({ limit: 50 });
      setAlerts(prev => {
        // Merge — keep local resolve state
        const resolved = new Set(prev.filter(a => a.resolved).map(a => a.id));
        return data.map(a => ({ ...a, resolved: resolved.has(a.id) }));
      });
      setLastUpdated(new Date());
    } catch {
      /* backend may not be ready yet */
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Subscribe to real-time socket alerts ─────────────────────────────────
  useEffect(() => {
    const socket = io(SOCKET_URL);
    socket.on('new_alert', (alert: Alert) => {
      setAlerts(prev => {
        if (prev.find(a => a.id === alert.id)) return prev;
        const next = [alert, ...prev].slice(0, 50);
        return next;
      });
      setLastUpdated(new Date());
    });
    return () => { socket.disconnect(); };
  }, []);

  // ── Poll as fallback ─────────────────────────────────────────────────────
  useEffect(() => {
    fetchAlerts();
    const iv = setInterval(fetchAlerts, 5000);
    return () => clearInterval(iv);
  }, [fetchAlerts]);

  // ── Scroll feed to top when new alert arrives ────────────────────────────
  useEffect(() => {
    feedRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [alerts.length]);

  // ── Resolve handler ──────────────────────────────────────────────────────
  const resolveAlert = (id: string) =>
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, resolved: true } : a));

  // ── Filtering ────────────────────────────────────────────────────────────
  const visible = alerts.filter(a => {
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
    if (typeFilter !== 'All' && a.type !== typeFilter) return false;
    return true;
  });

  // ── Counts ───────────────────────────────────────────────────────────────
  const critCount  = alerts.filter(a => a.severity === 'critical' && !a.resolved).length;
  const highCount  = alerts.filter(a => a.severity === 'high'     && !a.resolved).length;
  const medCount   = alerts.filter(a => a.severity === 'medium'   && !a.resolved).length;
  const resolved   = alerts.filter(a => a.resolved).length;

  // ── Attack type breakdown for mini table ─────────────────────────────────
  // Derive types dynamically from current alert history
  const dynamicTypes = Array.from(new Set(alerts.map(a => a.type))).sort();
  const typeBreakdown = dynamicTypes.map(t => ({
    type: t,
    total: alerts.filter(a => a.type === t).length,
    critical: alerts.filter(a => a.type === t && a.severity === 'critical').length,
    active: alerts.filter(a => a.type === t && !a.resolved).length,
  }));

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Header ── */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 className="text-light fw-bold mb-1">Attack Detection Monitor</h4>
          <p className="text-secondary small mb-0">
            Live Advanced 5G threat telemetry and anomaly detection
 &nbsp;·&nbsp; Socket + REST feed
          </p>
        </div>
        <div className="d-flex align-items-center gap-3">
          {lastUpdated && (
            <span className="text-secondary small d-flex align-items-center gap-1">
              <RefreshCw size={12} /> {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          {loading && <Spinner animation="border" variant="danger" size="sm" />}
        </div>
      </div>

      {/* ── Stat cards ── */}
      <Row className="g-3 mb-4">
        <Col xs={6} md={3}>
          <StatCard label="Critical" count={critCount} color="danger"  icon={<ShieldOff size={20} />} />
        </Col>
        <Col xs={6} md={3}>
          <StatCard label="High"     count={highCount} color="warning" icon={<ShieldAlert size={20} />} />
        </Col>
        <Col xs={6} md={3}>
          <StatCard label="Medium"   count={medCount}  color="info"    icon={<AlertTriangle size={20} />} />
        </Col>
        <Col xs={6} md={3}>
          <StatCard label="Resolved" count={resolved}  color="success" icon={<CheckCircle2 size={20} />} />
        </Col>
      </Row>

      <Row className="g-3">
        {/* ── Alert Feed ── */}
        <Col lg={8}>
          <Card bg="dark" border="secondary" className="shadow-lg h-100">
            <Card.Header className="bg-black bg-opacity-25 border-bottom border-secondary p-3">
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                <h6 className="mb-0 text-secondary text-uppercase d-flex align-items-center gap-2" style={{ letterSpacing: '1px', fontSize: '12px' }}>
                  <Filter size={13} /> Live Alert Feed
                  {critCount > 0 && (
                    <Badge bg="danger" pill className="ms-1" style={{ animation: 'blinker 1.2s step-start infinite' }}>
                      {critCount} CRITICAL
                    </Badge>
                  )}
                </h6>
                <div className="d-flex gap-2 flex-wrap">
                  {/* Severity filter */}
                  <ButtonGroup size="sm">
                    {(['all', 'critical', 'high', 'medium'] as const).map(s => (
                      <Button
                        key={s}
                        variant={severityFilter === s ? 'primary' : 'outline-secondary'}
                        onClick={() => setSeverity(s)}
                        style={{ fontSize: '10px' }}
                      >
                        {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                      </Button>
                    ))}
                  </ButtonGroup>
                </div>
              </div>

              {/* Attack type filter row */}
              <div className="d-flex gap-2 flex-wrap mt-2">
                {['All', ...dynamicTypes].map(t => (
                  <Button
                    key={t}
                    size="sm"
                    variant={typeFilter === t ? 'outline-info' : 'outline-secondary'}
                    onClick={() => setTypeFilter(t)}
                    className="d-flex align-items-center gap-1"
                    style={{ fontSize: '10px' }}
                  >
                    {t !== 'All' && typeIcon(t)}{t}
                  </Button>
                ))}
              </div>
            </Card.Header>

            <Card.Body
              ref={feedRef}
              className="p-3 overflow-auto"
              style={{ maxHeight: '520px' }}
            >
              {visible.length === 0 ? (
                <div className="h-100 d-flex flex-column align-items-center justify-content-center text-secondary py-5 opacity-50">
                  <CheckCircle2 size={36} className="mb-2 text-success" />
                  <span className="small">No alerts match the current filter</span>
                </div>
              ) : visible.map(alert => (
                <AlertRow key={alert.id} alert={alert} onResolve={resolveAlert} />
              ))}
            </Card.Body>

            <Card.Footer className="bg-transparent border-top border-secondary p-2 text-secondary" style={{ fontSize: '11px' }}>
              Showing {visible.length} of {alerts.length} total alerts
            </Card.Footer>
          </Card>
        </Col>

        {/* ── Attack Breakdown Panel ── */}
        <Col lg={4}>
          <div className="d-flex flex-column gap-3 h-100">

            {/* Attack type breakdown table */}
            <Card bg="dark" border="secondary" className="shadow-lg">
              <Card.Header className="bg-black bg-opacity-25 border-bottom border-secondary p-3">
                <h6 className="mb-0 text-secondary text-uppercase" style={{ letterSpacing: '1px', fontSize: '12px' }}>
                  Attack Breakdown
                </h6>
              </Card.Header>
              <Card.Body className="p-0">
                <Table variant="dark" hover className="mb-0" size="sm">
                  <thead>
                    <tr>
                      <th className="text-secondary fw-normal px-3 py-2 small">Type</th>
                      <th className="text-secondary fw-normal py-2 small text-center">Total</th>
                      <th className="text-secondary fw-normal py-2 small text-center">Active</th>
                      <th className="text-secondary fw-normal py-2 small text-center">Crit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {typeBreakdown.map(({ type, total, active, critical }) => (
                      <tr key={type} style={{ cursor: 'pointer' }} onClick={() => setTypeFilter(type as AttackType)}>
                        <td className="px-3 py-2 d-flex align-items-center gap-2 small text-light border-0 text-capitalize">
                          {typeIcon(type)}{type}
                        </td>
                        <td className="text-center py-2 small text-secondary">{total}</td>
                        <td className="text-center py-2 small">
                          <Badge bg={active > 0 ? 'warning' : 'secondary'} style={{ fontSize: '10px' }}>{active}</Badge>
                        </td>
                        <td className="text-center py-2 small">
                          <Badge bg={critical > 0 ? 'danger' : 'secondary'} style={{ fontSize: '10px' }}>{critical}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>

            {/* Legend */}
            <Card bg="dark" border="secondary" className="shadow-lg">
              <Card.Header className="bg-black bg-opacity-25 border-bottom border-secondary p-3">
                <h6 className="mb-0 text-secondary text-uppercase" style={{ letterSpacing: '1px', fontSize: '12px' }}>
                  Severity Legend
                </h6>
              </Card.Header>
              <Card.Body className="p-3 d-flex flex-column gap-2">
                {(Object.entries(SEV) as [Severity, typeof SEV[Severity]][]).map(([key, s]) => (
                  <div
                    key={key}
                    className="d-flex align-items-center gap-3 p-2 rounded"
                    style={{ background: s.bg, border: `1px solid ${s.border}` }}
                  >
                    <span className={s.color}>{s.icon}</span>
                    <div>
                      <div className={`fw-bold small ${s.color}`}>{s.label}</div>
                      <div className="text-secondary" style={{ fontSize: '10px' }}>
                        {key === 'critical' && 'Trust score < 30% — immediate action required'}
                        {key === 'high'     && 'Trust score 30–50% — block pending'}
                        {key === 'medium'   && 'Trust score 50–60% — under observation'}
                        {key === 'low'      && 'Borderline activity — monitoring only'}
                      </div>
                    </div>
                  </div>
                ))}
              </Card.Body>
            </Card>

          </div>
        </Col>
      </Row>

      {/* Blink animation */}
      <style>{`@keyframes blinker { 50% { opacity: 0; } }`}</style>
    </div>
  );
};

export default AttackDetectionMonitorPage;

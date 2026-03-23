import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Button, Table, Badge, Row, Col, Alert, Spinner } from 'react-bootstrap';
import { Send, Clock, ShieldCheck, ShieldAlert, RefreshCw, Navigation2, CheckCircle } from 'lucide-react';
import { NodeService, TransactionService } from '../services/api.service';

const NodeTransferPage = () => {
    const [nodes, setNodes] = useState<any[]>([]);
    const [transfers, setTransfers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    
    // Form State
    const [sender, setSender] = useState('');
    const [receiver, setReceiver] = useState('');
    const [data, setData] = useState('');
    const [message, setMessage] = useState<{ text: string; variant: string } | null>(null);

    // Simulation State
    const [simPath, setSimPath] = useState<string[]>([]);
    const [simStep, setSimStep] = useState<number>(-1);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [nodesData, transfersData] = await Promise.all([
                NodeService.getNodes().then(r => r.nodes || []),
                TransactionService.getTransactions({ limit: 50 })
            ]);
            setNodes(nodesData);
            setTransfers(transfersData && Array.isArray(transfersData) ? transfersData : []);
        } catch (err: any) {
            setMessage({ text: `Failed to load data: ${err.message}`, variant: 'danger' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const iv = setInterval(fetchData, 12000); // refresh list
        return () => clearInterval(iv);
    }, [fetchData]);

    const handleSendPacket = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!sender || !receiver || !data) {
            setMessage({ text: 'Please fill all required fields.', variant: 'warning' });
            return;
        }
        if (sender === receiver) {
            setMessage({ text: 'Sender and Receiver cannot be the same node.', variant: 'warning' });
            return;
        }

        setSubmitting(true);
        setSimPath([]);
        setSimStep(-1);
        setMessage(null);

        try {
            const resp = await TransactionService.sendPacket({ src: sender, dst: receiver, data });
            
            if (resp.success && resp.path && resp.path.length > 0) {
                setSimPath(resp.path);
                setSimStep(0);
                
                let stepIter = 0;
                const iv = setInterval(() => {
                    stepIter++;
                    if (stepIter >= resp.path.length) {
                        clearInterval(iv);
                        setMessage({ text: 'Message Delivered successfully to destination node.', variant: 'success' });
                        fetchData(); // refresh ledger list
                    } else {
                        setSimStep(stepIter);
                    }
                }, 450); // 450ms hop delay Simulation
            } else {
                setMessage({ text: 'Message could not be delivered due to malicious nodes blocking all paths.', variant: 'danger' });
            }
        } catch (err: any) {
            setMessage({ text: err.message || 'Routing failed or destination unreachable.', variant: 'danger' });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="p-1">
            {message && (
                <Alert variant={message.variant} dismissible onClose={() => setMessage(null)} className="mb-3 border-secondary border-opacity-25 bg-secondary bg-opacity-10 text-light">
                    <div className="d-flex align-items-center gap-2">
                        {message.variant === 'success' ? <ShieldCheck className="text-success" size={16} /> : <ShieldAlert className="text-danger" size={16} />}
                        <span style={{ fontSize: '13px' }}>{message.text}</span>
                    </div>
                </Alert>
            )}

            <Row className="g-3">
                {/* 1. Controller Section */}
                <Col lg={4}>
                    <div className="d-flex flex-column gap-3">
                        <Card bg="dark" border="secondary" className="shadow-lg border-opacity-25">
                            <Card.Header className="bg-black bg-opacity-25 border-bottom border-secondary border-opacity-25 p-3">
                                <h6 className="mb-0 text-secondary text-uppercase d-flex align-items-center gap-2" style={{ letterSpacing: '0.5px', fontSize: '11px' }}>
                                    <Send size={13} className="text-primary" /> Execute Route Simulation
                                </h6>
                            </Card.Header>
                            <Card.Body className="p-3">
                                <Form onSubmit={handleSendPacket}>
                                    <Form.Group className="mb-3">
                                        <Form.Label className="small text-secondary">Sender Node</Form.Label>
                                        <Form.Select 
                                            value={sender} 
                                            onChange={e => setSender(e.target.value)}
                                            className="bg-dark text-light border-secondary border-opacity-25"
                                            style={{ fontSize: '12px' }}
                                        >
                                            <option value="">-- Select Sender --</option>
                                            {nodes.map(n => (
                                                <option key={n.address} value={n.address}>
                                                    {n.address.slice(2, 8).toUpperCase()} ({n.role === 1 ? 'Edge' : n.role === 2 ? 'FOG' : 'Cloud'})
                                                </option>
                                            ))}
                                        </Form.Select>
                                    </Form.Group>

                                    <Form.Group className="mb-3">
                                        <Form.Label className="small text-secondary">Receiver Node</Form.Label>
                                        <Form.Select 
                                            value={receiver} 
                                            onChange={e => setReceiver(e.target.value)}
                                            className="bg-dark text-light border-secondary border-opacity-25"
                                            style={{ fontSize: '12px' }}
                                            disabled={!sender}
                                        >
                                            <option value="">-- Select Receiver --</option>
                                            {nodes.filter(n => n.address !== sender).map(n => (
                                                <option key={n.address} value={n.address}>
                                                    {n.address.slice(2, 8).toUpperCase()} ({n.role === 1 ? 'Edge' : 'Core'})
                                                </option>
                                            ))}
                                        </Form.Select>
                                    </Form.Group>

                                    <Form.Group className="mb-4">
                                        <Form.Label className="small text-secondary">Message Payload</Form.Label>
                                        <Form.Control 
                                            type="text"
                                            placeholder="Enter message content..."
                                            value={data}
                                            onChange={e => setData(e.target.value)}
                                            className="bg-dark text-light border-secondary border-opacity-25"
                                            style={{ fontSize: '12px' }}
                                        />
                                    </Form.Group>

                                    <Button 
                                        type="submit" 
                                        variant="primary" 
                                        className="w-100 d-flex align-items-center justify-content-center gap-2 btn-sm"
                                        disabled={submitting || simStep >= 0 && simStep < simPath.length}
                                    >
                                        {submitting ? <Spinner animation="border" size="sm" /> : <Navigation2 size={14} />}
                                        {submitting ? 'Calculating Route...' : 'Send Message'}
                                    </Button>
                                </Form>
                            </Card.Body>
                        </Card>

                        {/* 📍 Visual Trace Map */}
                        {simPath.length > 0 && (
                            <Card bg="dark" border="secondary" className="shadow-lg border-opacity-25">
                                <Card.Header className="bg-black bg-opacity-25 border-bottom border-secondary border-opacity-25 p-3">
                                    <h6 className="mb-0 text-secondary text-uppercase d-flex align-items-center gap-2" style={{ letterSpacing: '0.5px', fontSize: '11px' }}>
                                        <Navigation2 size={13} className="text-success" /> Active Route Trace
                                    </h6>
                                </Card.Header>
                                <Card.Body className="p-3">
                                    <div className="d-flex flex-column gap-2">
                                        {simPath.map((node, i) => {
                                            const isPast = i < simStep;
                                            const isCurrent = i === simStep;
                                            const isDest = i === simPath.length - 1;
                                            
                                            let badgeBg = 'secondary bg-opacity-10';
                                            let textColor = 'text-secondary';
                                            if (isPast) { badgeBg = 'success bg-opacity-25'; textColor = 'text-success'; }
                                            if (isCurrent) { badgeBg = 'primary bg-opacity-25'; textColor = 'text-primary fw-bold'; }

                                            return (
                                                <div key={i} className="d-flex align-items-center gap-2">
                                                    <div className={`rounded-circle d-flex align-items-center justify-content-center ${badgeBg} border border-secondary border-opacity-10`} style={{ width: '22px', height: '22px', fontSize: '10px' }}>
                                                        {isPast ? <CheckCircle size={11} /> : i + 1}
                                                    </div>
                                                    <span className={`${textColor}`} style={{ fontSize: '12px' }}>
                                                        {node.slice(2, 8).toUpperCase()} {isDest ? '(Dest)' : i === 0 ? '(Src)' : ''}
                                                    </span>
                                                    {isCurrent && <Badge bg="primary" style={{ fontSize: '9px' }} className="ms-auto animate-pulse">HOPPING</Badge>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </Card.Body>
                            </Card>
                        )}
                    </div>
                </Col>

                {/* 2. Ledger Section */}
                <Col lg={8}>
                    <Card bg="dark" border="secondary" className="shadow-lg h-100 border-opacity-25">
                        <Card.Header className="bg-black bg-opacity-25 border-bottom border-secondary border-opacity-25 p-3 d-flex align-items-center justify-content-between">
                            <h6 className="mb-0 text-secondary text-uppercase d-flex align-items-center gap-2" style={{ letterSpacing: '0.5px', fontSize: '11px' }}>
                                <Clock size={13} className="text-info" /> Blockchain Transaction Log
                            </h6>
                            <Button size="sm" variant="outline-secondary" onClick={fetchData} className="py-0 px-2" style={{ fontSize: '11px' }}>
                                <RefreshCw size={11} className="me-1" />
                            </Button>
                        </Card.Header>
                        <Card.Body className="p-0">
                            <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
                                <Table hover variant="dark" className="mb-0 border-0">
                                    <thead style={{ position: 'sticky', top: 0, backgroundColor: '#111116', zIndex: 1 }}>
                                        <tr>
                                            <th className="text-secondary fw-normal px-3 py-2 small" style={{ fontSize: '11px' }}>Block ID</th>
                                            <th className="text-secondary fw-normal py-2 small" style={{ fontSize: '11px' }}>Node Address</th>
                                            <th className="text-secondary fw-normal py-2 small" style={{ fontSize: '11px' }}>Action Event</th>
                                            <th className="text-secondary fw-normal py-2 small" style={{ fontSize: '11px' }}>Timestamp</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading && transfers.length === 0 ? (
                                            <tr><td colSpan={4} className="text-center text-secondary py-4 small">Loading operations…</td></tr>
                                        ) : transfers.length === 0 ? (
                                            <tr><td colSpan={4} className="text-center text-secondary py-4 small">No items recorded yet.</td></tr>
                                        ) : transfers.map((t, i) => (
                                            <tr key={i} className="border-bottom border-secondary border-opacity-10">
                                                <td className="px-3 py-2 align-middle font-monospace text-secondary" style={{ fontSize: '11px' }}>
                                                    {String(t.blockId || i).slice(0, 8)}
                                                </td>
                                                <td className="py-2 align-middle fw-medium text-light small">
                                                    {t.nodeId ? t.nodeId.slice(2, 8).toUpperCase() : 'N/A'}
                                                </td>
                                                <td className="py-2 align-middle">
                                                    <Badge bg={
                                                        t.action?.includes('Detected') || t.action?.includes('Revoked') ? 'danger' :
                                                        t.action?.includes('Added') || t.action?.includes('Validated') ? 'success' : 'info'
                                                    } style={{ fontSize: '9px' }}>
                                                        {t.action?.toUpperCase() || 'TX'}
                                                    </Badge>
                                                </td>
                                                <td className="py-2 align-middle text-secondary" style={{ fontSize: '11px' }}>
                                                    {t.timestamp ? new Date(typeof t.timestamp === 'number' && t.timestamp < 1000000000000 ? t.timestamp * 1000 : t.timestamp).toLocaleTimeString() : 'N/A'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default NodeTransferPage;

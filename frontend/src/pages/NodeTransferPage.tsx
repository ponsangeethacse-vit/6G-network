import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Button, Table, Badge, Row, Col, Alert, Spinner } from 'react-bootstrap';
import { Send, ArrowLeftRight, Clock, ShieldCheck, ShieldAlert, RefreshCw } from 'lucide-react';
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
    const [behavior, setBehavior] = useState('Normal');
    
    const [message, setMessage] = useState<{ text: string; variant: string } | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [nodesData, transfersData] = await Promise.all([
                NodeService.getAdminNodes(),
                TransactionService.getAdminTransfers()
            ]);
            setNodes(nodesData || []);
            setTransfers(transfersData || []);
        } catch (err: any) {
            setMessage({ text: `Failed to load data: ${err.message}`, variant: 'danger' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const iv = setInterval(fetchData, 10000); // 10s auto refresh
        return () => clearInterval(iv);
    }, [fetchData]);

    const handleTransfer = async (e: React.FormEvent) => {
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
        try {
            await TransactionService.executeTransfer({
                senderNodeId: sender,
                receiverNodeId: receiver,
                data: data,
                behavior: behavior
            });
            setMessage({ text: 'Transfer successfully initiated and logged on Blockchain.', variant: 'success' });
            setData(''); // reset data field
            fetchData(); // refresh list
        } catch (err: any) {
            setMessage({ text: `Execution failed: ${err.message}`, variant: 'danger' });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="p-1">
            {message && (
                <Alert variant={message.variant} dismissible onClose={() => setMessage(null)} className="mb-4">
                    {message.variant === 'success' ? <ShieldCheck className="me-2" size={16} /> : <ShieldAlert className="me-2" size={16} />}
                    {message.text}
                </Alert>
            )}

            <Row className="g-4">
                {/* 1. Form Section */}
                <Col lg={4}>
                    <Card bg="dark" border="secondary" className="shadow-lg h-100">
                        <Card.Header className="bg-black bg-opacity-25 border-bottom border-secondary p-3">
                            <h6 className="mb-0 text-secondary text-uppercase d-flex align-items-center gap-2" style={{ letterSpacing: '1px', fontSize: '12px' }}>
                                <Send size={13} className="text-primary" /> Execute Secure Transfer
                            </h6>
                        </Card.Header>
                        <Card.Body className="p-3">
                            <Form onSubmit={handleTransfer}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="small text-secondary">Sender Node ID</Form.Label>
                                    <Form.Select 
                                        value={sender} 
                                        onChange={e => setSender(e.target.value)}
                                        className="bg-dark text-light border-secondary"
                                        style={{ fontSize: '12px' }}
                                    >
                                        <option value="">-- Select Sender --</option>
                                        {nodes.map(n => (
                                            <option key={n.nodeId} value={n.nodeId}>
                                                {n.nodeId} ({n.status})
                                            </option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label className="small text-secondary">Receiver Node ID</Form.Label>
                                    <Form.Select 
                                        value={receiver} 
                                        onChange={e => setReceiver(e.target.value)}
                                        className="bg-dark text-light border-secondary"
                                        style={{ fontSize: '12px' }}
                                    >
                                        <option value="">-- Select Receiver --</option>
                                        {nodes.map(n => (
                                            <option key={n.nodeId} value={n.nodeId}>
                                                {n.nodeId} ({n.status})
                                            </option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label className="small text-secondary">Transfer Data</Form.Label>
                                    <Form.Control 
                                        type="text"
                                        placeholder="Enter secure message, packet ID, or data..."
                                        value={data}
                                        onChange={e => setData(e.target.value)}
                                        className="bg-dark text-light border-secondary"
                                        style={{ fontSize: '12px' }}
                                    />
                                </Form.Group>

                                <Form.Group className="mb-4">
                                    <Form.Label className="small text-secondary">Communication Behavior</Form.Label>
                                    <div className="d-flex gap-2">
                                        <Button 
                                            size="sm" 
                                            variant={behavior === 'Normal' ? 'success' : 'outline-success'}
                                            onClick={() => setBehavior('Normal')}
                                            className="flex-grow-1"
                                            style={{ fontSize: '11px' }}
                                        >
                                            Normal
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            variant={behavior === 'Malicious' ? 'danger' : 'outline-danger'}
                                            onClick={() => setBehavior('Malicious')}
                                            className="flex-grow-1"
                                            style={{ fontSize: '11px' }}
                                        >
                                            Malicious
                                        </Button>
                                    </div>
                                    {behavior === 'Malicious' && (
                                        <Form.Text className="text-danger" style={{ fontSize: '10px' }}>
                                            ⚠️ Warning: Setting Malicious behavior simulates threat and drops node trust.
                                        </Form.Text>
                                    )}
                                </Form.Group>

                                <Button 
                                    type="submit" 
                                    variant="primary" 
                                    className="w-100 d-flex align-items-center justify-content-center gap-2"
                                    disabled={submitting}
                                >
                                    {submitting ? <Spinner animation="border" size="sm" /> : <ArrowLeftRight size={16} />}
                                    {submitting ? 'Processing...' : 'Submit Transaction'}
                                </Button>
                            </Form>
                        </Card.Body>
                    </Card>
                </Col>

                {/* 2. Table Section */}
                <Col lg={8}>
                    <Card bg="dark" border="secondary" className="shadow-lg h-100">
                        <Card.Header className="bg-black bg-opacity-25 border-bottom border-secondary p-3 d-flex align-items-center justify-content-between">
                            <h6 className="mb-0 text-secondary text-uppercase d-flex align-items-center gap-2" style={{ letterSpacing: '1px', fontSize: '12px' }}>
                                <Clock size={13} className="text-info" /> Recent Transfers Ledger
                            </h6>
                            <Button size="sm" variant="outline-secondary" onClick={fetchData} className="py-0 px-2" style={{ fontSize: '11px' }}>
                                <RefreshCw size={11} className="me-1" />
                            </Button>
                        </Card.Header>
                        <Card.Body className="p-0">
                            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                                <Table hover variant="dark" className="mb-0 border-0">
                                    <thead style={{ position: 'sticky', top: 0, backgroundColor: '#111116', zIndex: 1 }}>
                                        <tr>
                                            <th className="text-secondary fw-normal px-3 py-2 small">Transfer ID</th>
                                            <th className="text-secondary fw-normal py-2 small">Sender</th>
                                            <th className="text-secondary fw-normal py-2 small">Receiver</th>
                                            <th className="text-secondary fw-normal py-2 small">Data</th>
                                            <th className="text-secondary fw-normal py-2 small">Status</th>
                                            <th className="text-secondary fw-normal py-2 small">Time</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading && transfers.length === 0 ? (
                                            <tr><td colSpan={6} className="text-center text-secondary py-4 small">Loading transfers…</td></tr>
                                        ) : transfers.length === 0 ? (
                                            <tr><td colSpan={6} className="text-center text-secondary py-4 small">No transfer history found.</td></tr>
                                        ) : transfers.map((t, i) => (
                                            <tr key={i} className="border-bottom border-secondary border-opacity-25">
                                                <td className="px-3 py-2 align-middle font-monospace text-secondary" style={{ fontSize: '11px' }}>
                                                    {t._id.slice(-8).toUpperCase()}
                                                </td>
                                                <td className="py-2 align-middle fw-bold text-light small">{t.senderNodeId}</td>
                                                <td className="py-2 align-middle fw-bold text-light small">{t.receiverNodeId}</td>
                                                <td className="py-2 align-middle text-secondary small" style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {t.data}
                                                </td>
                                                <td className="py-2 align-middle">
                                                    <Badge bg={t.status === 'Success' ? 'success' : t.status === 'Failed' ? 'danger' : 'warning'} style={{ fontSize: '9px' }}>
                                                        {t.status}
                                                    </Badge>
                                                </td>
                                                <td className="py-2 align-middle text-secondary small">
                                                    {new Date(t.createdAt).toLocaleTimeString()}
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

import React, { useState } from 'react';
import { Button, Dropdown, Badge, Spinner, Modal, Form, Alert } from 'react-bootstrap';
import { Wallet, Link2, Link2Off, ChevronDown, ExternalLink, AlertCircle } from 'lucide-react';
import { useWeb3 } from '../services/Web3Context';
import { useWalletStatus } from '../services/web3.hooks';
import { WEB3_CONFIG } from '../services/web3.config';

// ─── Web3 Connection Widget ────────────────────────────────────────────────────
// Drop this into any page or the DashboardLayout top bar to expose wallet
// connection, wallet info, and quick-disconnect.
const Web3ConnectionWidget: React.FC = () => {
  const { status, error, connectMetaMask, connectLocalNode, disconnect } = useWeb3();
  const wallet = useWalletStatus();
  const [showModal, setShowModal]   = useState(false);
  const [nodeUrl, setNodeUrl]       = useState(WEB3_CONFIG.providers.hardhat);
  const [connecting, setConnecting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleMetaMask = async () => {
    setConnecting(true);
    setLocalError(null);
    try { await connectMetaMask(); setShowModal(false); }
    catch (e: any) { setLocalError(e.message ?? 'Connection failed'); }
    finally { setConnecting(false); }
  };

  const handleLocalNode = async () => {
    setConnecting(true);
    setLocalError(null);
    try { await connectLocalNode(nodeUrl); setShowModal(false); }
    catch (e: any) { setLocalError(e.message ?? 'Connection failed'); }
    finally { setConnecting(false); }
  };

  // ── Connected state — show wallet dropdown ─────────────────────────────────
  if (status === 'connected' && wallet.address) {
    return (
      <Dropdown align="end">
        <Dropdown.Toggle
          variant="outline-success"
          size="sm"
          className="d-flex align-items-center gap-2 border-success border-opacity-50"
          style={{ fontSize: '11px', background: 'rgba(25,135,84,0.08)' }}
        >
          <div className="rounded-circle bg-success" style={{ width: 8, height: 8, animation: 'blinker 2s linear infinite' }} />
          <Wallet size={13} />
          {wallet.shortAddress}
          <ChevronDown size={12} />
        </Dropdown.Toggle>
        <Dropdown.Menu className="bg-dark border border-secondary shadow-lg" style={{ minWidth: '240px' }}>
          <div className="px-3 py-2 border-bottom border-secondary">
            <div className="text-secondary" style={{ fontSize: '10px' }}>CONNECTED WALLET</div>
            <div className="font-monospace text-info small mt-1">{wallet.shortAddress}</div>
          </div>
          <div className="px-3 py-2 border-bottom border-secondary">
            <div className="d-flex justify-content-between small">
              <span className="text-secondary">Network</span>
              <Badge bg="primary" style={{ fontSize: '10px' }}>{wallet.network}</Badge>
            </div>
            <div className="d-flex justify-content-between small mt-1">
              <span className="text-secondary">Balance</span>
              <span className="text-light">{wallet.balance} ETH</span>
            </div>
            <div className="d-flex justify-content-between small mt-1">
              <span className="text-secondary">Chain ID</span>
              <span className="text-secondary font-monospace">{wallet.chainId}</span>
            </div>
          </div>
          <Dropdown.Item
            className="text-danger d-flex align-items-center gap-2 small py-2"
            onClick={disconnect}
          >
            <Link2Off size={12} /> Disconnect
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    );
  }

  // ── Connecting state ───────────────────────────────────────────────────────
  if (status === 'connecting') {
    return (
      <Button variant="outline-secondary" size="sm" disabled style={{ fontSize: '11px' }}>
        <Spinner animation="border" size="sm" className="me-1" style={{ width: 10, height: 10 }} />
        Connecting…
      </Button>
    );
  }

  // ── Disconnected / Error — show connect button ─────────────────────────────
  return (
    <>
      <Button
        variant="outline-warning"
        size="sm"
        className="d-flex align-items-center gap-2"
        style={{ fontSize: '11px', background: 'rgba(255,193,7,0.06)' }}
        onClick={() => setShowModal(true)}
      >
        <Link2 size={13} />
        Connect Wallet
        {status === 'error' && <AlertCircle size={12} className="text-danger" />}
      </Button>

      {/* Connection Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered
        contentClassName="bg-dark border border-secondary text-light">
        <Modal.Header className="border-secondary">
          <Modal.Title className="fs-6 d-flex align-items-center gap-2">
            <Wallet size={16} className="text-warning" /> Connect to Blockchain
          </Modal.Title>
          <button className="btn-close btn-close-white" onClick={() => setShowModal(false)} />
        </Modal.Header>
        <Modal.Body>
          {(localError ?? error) && (
            <Alert variant="danger" className="small py-2 mb-3 d-flex align-items-start gap-2">
              <AlertCircle size={14} className="flex-shrink-0 mt-0" />
              <span>{localError ?? error}</span>
            </Alert>
          )}

          {/* MetaMask */}
          <div className="p-3 rounded border border-warning border-opacity-25 bg-warning bg-opacity-10 mb-3">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <div>
                <div className="text-light fw-bold small">MetaMask</div>
                <div className="text-secondary" style={{ fontSize: '11px' }}>Browser extension wallet</div>
              </div>
              <img src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg"
                alt="MetaMask" style={{ width: 32, height: 32 }} />
            </div>
            <Button
              variant="warning" size="sm" className="w-100"
              onClick={handleMetaMask} disabled={connecting}
              style={{ fontSize: '12px' }}
            >
              {connecting ? <><Spinner animation="border" size="sm" style={{ width: 12, height: 12 }} className="me-1" />Connecting…</> : 'Connect MetaMask'}
            </Button>
          </div>

          {/* Local Node */}
          <div className="p-3 rounded border border-primary border-opacity-25 bg-primary bg-opacity-10">
            <div className="text-light fw-bold small mb-1">Local Ethereum Node</div>
            <div className="text-secondary mb-2" style={{ fontSize: '11px' }}>Ganache · Hardhat · Any RPC</div>
            <Form.Control
              type="text"
              value={nodeUrl}
              onChange={e => setNodeUrl(e.target.value)}
              className="bg-dark text-light border-secondary mb-2"
              style={{ fontSize: '11px' }}
              placeholder="http://127.0.0.1:8545"
            />
            <div className="d-flex gap-2 mb-2">
              {[
                { label: 'Hardhat', url: WEB3_CONFIG.providers.hardhat },
                { label: 'Ganache', url: WEB3_CONFIG.providers.ganache },
              ].map(({ label, url }) => (
                <Button key={label} size="sm" variant="outline-secondary"
                  style={{ fontSize: '10px' }} onClick={() => setNodeUrl(url)}>
                  {label}
                </Button>
              ))}
            </div>
            <Button
              variant="primary" size="sm" className="w-100"
              onClick={handleLocalNode} disabled={connecting}
              style={{ fontSize: '12px' }}
            >
              {connecting ? <><Spinner animation="border" size="sm" style={{ width: 12, height: 12 }} className="me-1" />Connecting…</> : 'Connect to Local Node'}
            </Button>
          </div>

          {/* Contract address reference */}
          <div className="mt-3 p-2 rounded bg-secondary bg-opacity-10 border border-secondary border-opacity-25">
            <div className="text-secondary" style={{ fontSize: '10px' }}>CONFIGURED CONTRACT ADDRESSES</div>
            <div className="font-monospace mt-1" style={{ fontSize: '10px' }}>
              <div className="d-flex justify-content-between">
                <span className="text-secondary">TrustLedger</span>
                <span className="text-info">{WEB3_CONFIG.contracts.TrustLedger.slice(0, 14)}…</span>
              </div>
              <div className="d-flex justify-content-between mt-1">
                <span className="text-secondary">NodeRegistry</span>
                <span className="text-info">{WEB3_CONFIG.contracts.NodeRegistry.slice(0, 14)}…</span>
              </div>
            </div>
            <div className="text-secondary mt-1" style={{ fontSize: '10px' }}>
              Edit <code className="text-warning">src/services/web3.config.ts</code> to change addresses.
            </div>
          </div>
        </Modal.Body>
      </Modal>
      <style>{`@keyframes blinker { 50% { opacity: 0.3; } }`}</style>
    </>
  );
};

export default Web3ConnectionWidget;

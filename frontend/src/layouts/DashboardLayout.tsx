import React from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Navbar, Container, Button, Badge } from 'react-bootstrap';
import { Shield, ShieldAlert, Activity, Navigation, BarChart3, Lock, Database, Server, LogOut, ArrowLeftRight } from 'lucide-react';

interface DashboardLayoutProps {
  socket: any;
  socketUrl: string;
  maliciousMode: boolean;
  isConnected: boolean;
  toggleMaliciousMode: () => void;
  nodes: any[];
}

const DashboardLayout = ({ 
  socket, 
  socketUrl, 
  maliciousMode, 
  isConnected, 
  toggleMaliciousMode,
  nodes 
}: DashboardLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate('/');
  };

  const navLinks = [
    { path: '/dashboard', label: 'Network Overview', icon: <Navigation size={18} /> },
    { path: '/dashboard/trust', label: 'Trust Scores', icon: <BarChart3 size={18} /> },
    { path: '/dashboard/alerts', label: 'Attack Monitor', icon: <Lock size={18} /> },
    { path: '/dashboard/blockchain', label: 'Blockchain Ledger', icon: <Database size={18} /> },
    { path: '/dashboard/transfers', label: 'Node Transfers', icon: <ArrowLeftRight size={18} /> },
    { path: '/dashboard/nodes', label: 'Node Management', icon: <Server size={18} /> },
  ];

  return (
    <div className="min-vh-100 d-flex text-light font-sans" style={{ backgroundColor: '#0a0a0c' }}>
      
      {/* Sidebar */}
      <div className="bg-dark border-end border-secondary d-flex flex-column" style={{ width: '280px', backgroundColor: '#111116' }}>
        <div className="p-4 border-bottom border-secondary d-flex align-items-center gap-3">
          <Shield className="text-primary" size={32} />
          <span className="fw-bold fs-5 tracking-tight text-white line-height-1">Advanced 5G Trust<br/>Defender</span>
        </div>
        
        <div className="flex-grow-1 p-3 d-flex flex-column gap-2">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <NavLink 
                key={link.path}
                to={link.path} 
                className={`d-flex align-items-center gap-3 p-3 rounded text-decoration-none transition-all ${
                  isActive ? 'bg-primary bg-opacity-10 text-primary fw-bold border border-primary border-opacity-50' : 'text-secondary hover-bg-dark'
                }`}
                style={{ transition: 'all 0.2s ease' }}
              >
                {link.icon}
                {link.label}
              </NavLink>
            );
          })}
        </div>

        <div className="p-4 border-top border-secondary mt-auto">
          <div className="d-flex align-items-center gap-3 text-secondary small mb-3">
             <div className="bg-success rounded-circle" style={{ width: '10px', height: '10px' }}></div>
             Operator Active
          </div>
          <Button variant="outline-danger" className="w-100 d-flex align-items-center justify-content-center gap-2" onClick={handleLogout}>
            <LogOut size={16} /> Logout
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow-1 d-flex flex-column h-100 overflow-hidden">
        
        {/* Topbar */}
        <Navbar bg="dark" variant="dark" expand="lg" sticky="top" className="border-bottom border-secondary px-4 py-3" style={{ backgroundColor: 'rgba(33, 37, 41, 0.9)' }}>
          <div className="d-flex w-100 justify-content-between align-items-center">
            
            <div className="d-flex align-items-center gap-3">
               <h5 className="mb-0 text-light fw-medium">
                  {navLinks.find(l => l.path === location.pathname)?.label || 'Dashboard'}
               </h5>
            </div>

            <div className="d-flex align-items-center gap-4">
              <div className="d-flex align-items-center gap-2 text-sm">
                <Badge bg={isConnected ? 'success' : 'danger'} pill className="p-2">
                  {isConnected ? 'System Online' : 'Connecting...'}
                </Badge>
              </div>
            </div>

          </div>
        </Navbar>

        {/* Dynamic Page Content */}
        <main className="flex-grow-1 overflow-auto p-4 position-relative">
          <Outlet context={{ socket, socketUrl, maliciousMode, isConnected, nodes }} />
        </main>
      </div>

    </div>
  );
};

export default DashboardLayout;

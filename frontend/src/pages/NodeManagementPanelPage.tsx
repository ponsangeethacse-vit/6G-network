import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, Table, Badge } from 'react-bootstrap';
import { Server, Smartphone, Cpu, Activity } from 'lucide-react';

const getRoleIcon = (role: number) => {
  switch (role) {
    case 1: return <Smartphone size={16} className="text-info me-2" />;
    case 2: return <Server size={16} className="text-primary me-2" />;
    case 3: return <Cpu size={16} className="text-info me-2" />;
    default: return <Activity size={16} className="text-secondary me-2" />;
  }
};

const getRoleName = (role: number) => {
  switch (role) {
    case 1: return 'IoT Edge Device';
    case 2: return 'Base Station';
    case 3: return 'Cellular Relay';
    default: return 'Unknown Node';
  }
};

const NodeManagementPanelPage = () => {
  const { nodes } = useOutletContext<any>();

  return (
    <div className="h-100 d-flex flex-column">
      <h4 className="text-light mb-4">Node Management</h4>
      <Card bg="dark" border="secondary" className="shadow-lg">
        <Card.Body>
          {nodes && nodes.length > 0 ? (
            <Table hover variant="dark" className="mb-0">
              <thead>
                <tr>
                  <th>Node ID</th>
                  <th>Role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((node: any, idx: number) => (
                  <tr key={idx}>
                    <td className="font-monospace text-secondary align-middle">{node.address || node.nodeId}</td>
                    <td className="align-middle">
                        <div className="d-flex align-items-center">
                            {getRoleIcon(node.role)}
                            {getRoleName(node.role)}
                        </div>
                    </td>
                    <td className="align-middle">
                      <Badge bg="success">Active</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
             <div className="text-center text-secondary py-5">
                Connecting to network to fetch nodes...
             </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default NodeManagementPanelPage;

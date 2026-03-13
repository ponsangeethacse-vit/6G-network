import React, { useMemo } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';

interface NodeData {
  nodeId: string;
  type: string;
  trustScore: number;
  status: string;
}

const NetworkGraph = ({ nodes }: { nodes: NodeData[] }) => {
  const elements = useMemo(() => {
    const cyNodes = nodes.map(node => ({
        data: { id: node.nodeId, label: node.nodeId, trustScore: node.trustScore, status: node.status }
    }));
    
    const cyEdges: any[] = [];
    for (let i = 0; i < nodes.length; i++) {
        for (let j = 0; j < 2; j++) {
            const targetIdx = Math.floor(Math.random() * nodes.length);
            if (targetIdx !== i) {
                cyEdges.push({
                    data: {
                        source: nodes[i].nodeId,
                        target: nodes[targetIdx].nodeId,
                        id: `${nodes[i].nodeId}-${nodes[targetIdx].nodeId}`
                    }
                });
            }
        }
    }
    
    return [...cyNodes, ...cyEdges];
  }, [nodes]);

  if (!nodes || nodes.length === 0) return (
      <div className="w-100 h-100 d-flex align-items-center justify-content-center text-info">
          Initializing 6G Network Mesh...
      </div>
  );

  return (
    <div className="w-100 h-100 position-relative" style={{ backgroundColor: '#0a0a0c', minHeight: '400px' }}>
      <CytoscapeComponent 
        elements={elements} 
        style={{ width: '100%', height: '100%' }}
        layout={{ name: 'cose' }}
        stylesheet={[
          {
            selector: 'node',
            style: {
              'background-color': (ele: any) => {
                 const status = ele.data('status');
                 const score = ele.data('trustScore');
                 if (status === 'isolated') return '#dc3545';
                 if (score > 0.7) return '#198754';
                 if (score > 0.3) return '#ffc107';
                 return '#dc3545';
              },
              'label': 'data(label)',
              'color': '#fff',
              'text-valign': 'center',
              'text-halign': 'center',
              'font-size': '10px'
            }
          },
          {
            selector: 'edge',
            style: {
              'width': 1,
              'line-color': 'rgba(13, 110, 253, 0.2)',
              'curve-style': 'bezier'
            }
          }
        ]}
      />
      <div className="position-absolute bottom-0 start-0 m-3 p-2 bg-dark border border-secondary rounded shadow-sm" style={{ fontSize: '0.75rem', zIndex: 10 }}>
          <div className="d-flex align-items-center gap-2 mb-1">
              <div className="rounded-circle bg-success" style={{ width: '12px', height: '12px' }} /> <span className="text-light">High Trust ({'>'}0.7)</span>
          </div>
          <div className="d-flex align-items-center gap-2 mb-1">
              <div className="rounded-circle bg-warning" style={{ width: '12px', height: '12px' }} /> <span className="text-light">Medium Trust (0.3 - 0.7)</span>
          </div>
          <div className="d-flex align-items-center gap-2">
              <div className="rounded-circle bg-danger" style={{ width: '12px', height: '12px' }} /> <span className="text-light">Low Trust / Isolated ({'<'}0.3)</span>
          </div>
      </div>
    </div>
  );
};

export default NetworkGraph;

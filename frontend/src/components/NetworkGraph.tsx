import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, Line, Text, Float } from '@react-three/drei';
import * as THREE from 'three';

interface NodeData {
  nodeId: string;
  type: string;
  trustScore: number;
  status: string;
}

const NodeMesh = ({ data, position }: { data: NodeData; position: [number, number, number] }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const color = useMemo(() => {
    if (data.status === 'isolated') return '#ff4b4b';
    if (data.trustScore > 0.7) return '#00e676';
    if (data.trustScore > 0.3) return '#ffca28';
    return '#ff4b4b';
  }, [data.trustScore, data.status]);

  useFrame((state) => {
    if (meshRef.current) {
        meshRef.current.position.y += Math.sin(state.clock.elapsedTime + position[0]) * 0.005;
    }
  });

  return (
    <group position={position}>
      <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
        <Sphere ref={meshRef} args={[0.2, 16, 16]}>
          <meshStandardMaterial 
            color={color} 
            emissive={color} 
            emissiveIntensity={0.5} 
            roughness={0.2} 
            metalness={0.8} 
          />
        </Sphere>
      </Float>
      <Text
        position={[0, 0.4, 0]}
        fontSize={0.1}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {data.nodeId}
      </Text>
    </group>
  );
};

const Connections = ({ nodes, positions }: { nodes: NodeData[], positions: [number, number, number][] }) => {
    const lines = useMemo(() => {
        const result = [];
        for (let i = 0; i < nodes.length; i++) {
            // Connect to 2 random nodes to simulate a network
            for (let j = 0; j < 2; j++) {
                const targetIdx = Math.floor(Math.random() * nodes.length);
                if (targetIdx !== i) {
                    result.push([positions[i], positions[targetIdx]]);
                }
            }
        }
        return result;
    }, [nodes, positions]);

    return (
        <group>
            {lines.map((points, idx) => (
                <Line
                    key={idx}
                    points={points}
                    color="rgba(0, 242, 255, 0.1)"
                    lineWidth={0.5}
                    transparent
                    opacity={0.2}
                />
            ))}
        </group>
    );
}

const NetworkGraph = ({ nodes }: { nodes: NodeData[] }) => {
  const nodePositions = useMemo(() => {
    return nodes.map(() => [
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10
    ] as [number, number, number]);
  }, [nodes.length]);

  if (!nodes || nodes.length === 0) return (
      <div className="w-full h-full flex items-center justify-center text-trust-accent">
          Initializing 6G Network Mesh...
      </div>
  );

  return (
    <div className="w-full h-full bg-[#0a0a0c] relative">
      <Canvas camera={{ position: [0, 0, 15], fov: 60 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <pointLight position={[-10, -10, -10]} color="#00f2ff" intensity={0.5} />
        
        <group>
            {nodes.map((node, i) => (
                <NodeMesh key={node.nodeId} data={node} position={nodePositions[i]} />
            ))}
            <Connections nodes={nodes} positions={nodePositions} />
        </group>

        <OrbitControls enableDamping dampingFactor={0.05} />
      </Canvas>
      <div className="absolute bottom-4 left-4 glass-card p-3 rounded-lg text-xs space-y-1 border-trust-accent/20">
          <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-trust-high" /> <span>High Trust (>0.7)</span>
          </div>
          <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-trust-mid" /> <span>Medium Trust (0.3 - 0.7)</span>
          </div>
          <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-trust-low" /> <span>Low Trust / Isolated (<0.3)</span>
          </div>
      </div>
    </div>
  );
};

export default NetworkGraph;

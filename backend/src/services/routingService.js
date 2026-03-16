/**
 * 6G TrustGuard - Routing Service
 * Implements Trust-Aware Dijkstra shortest-path finding matching 
 * the dashboard dynamic mesh topology.
 */

const PENALTY_MALICIOUS = 5000;
const PENALTY_LOW_TRUST = 1000;

/**
 * Builds adjacency list following the frontend Ring Mesh layer:
 * node[i] -> (i+1)%N AND (i+2)%N
 */
function getAdjacencyList(nodes) {
  const adj = {};
  const len = nodes.length;

  nodes.forEach((node, i) => {
    const addr = node.address;
    if (!adj[addr]) adj[addr] = [];

    // 1. Next link (Ring)
    const nextIdx = (i + 1) % len;
    const nextAddr = nodes[nextIdx].address;
    adj[addr].push(nextAddr);

    // 2. Skip link (Chord)
    if (len > 4) {
      const skipIdx = (i + 2) % len;
      const skipAddr = nodes[skipIdx].address;
      adj[addr].push(skipAddr);
    }
  });

  // Since edges are undirected, we mirror back connections just in case
  const bidirAdj = { ...adj };
  Object.keys(adj).forEach(u => {
    adj[u].forEach(v => {
      if (!bidirAdj[v]) bidirAdj[v] = [];
      if (!bidirAdj[v].includes(u)) bidirAdj[v].push(u);
    });
  });

  return bidirAdj;
}

/**
 * Calculates edge weight between node U and node V
 * Weighted predominantly by node V's trust and attack vector.
 */
function getEdgeWeight(targetAddr, trustScores = {}, activeAttacks = {}) {
  const score = trustScores[targetAddr] ?? 85; 
  const attack = activeAttacks[targetAddr] || 'Normal';

  // Base cost ensures shorter paths win incrementally if scores equal
  let cost = 101 - score; 

  // Malicious attack penalty
  if (attack !== 'Normal') {
    cost += PENALTY_MALICIOUS;
  }
  // Low trust score penalty (<60)
  else if (score < 60) {
    cost += PENALTY_LOW_TRUST;
  }

  return Math.max(1, cost); // Ensure positive
}

/**
 * Dijkstra's Shortest Path Algorithm
 */
function calculateRoute(nodes, trustScores, activeAttacks, src, dst) {
  const adj = getAdjacencyList(nodes);
  const distances = {};
  const prev = {};
  const nodesQueue = new Set();

  if (!adj[src] || !adj[dst]) {
    return []; // Invalid endpoints
  }

  nodes.forEach(n => {
    distances[n.address] = Infinity;
    prev[n.address] = null;
    nodesQueue.add(n.address);
  });

  distances[src] = 0;

  while (nodesQueue.size > 0) {
    // Find node with minimum distance
    let u = null;
    for (const node of nodesQueue) {
      if (u === null || distances[node] < distances[u]) {
        u = node;
      }
    }

    if (u === dst || distances[u] === Infinity) {
      break; 
    }

    nodesQueue.delete(u);

    // Traverse neighbors
    const neighbors = adj[u] || [];
    for (const v of neighbors) {
      if (!nodesQueue.has(v)) continue;

      const weight = getEdgeWeight(v, trustScores, activeAttacks);
      const alt = distances[u] + weight;

      if (alt < distances[v]) {
        distances[v] = alt;
        prev[v] = u;
      }
    }
  }

  // Reconstruct path
  const path = [];
  let curr = dst;
  while (curr !== null) {
    path.unshift(curr);
    curr = prev[curr];
  }

  // If path consists of only 1 element and it's not the src, it's unreachable
  if (path.length === 1 && path[0] !== src) {
    return [];
  }

  return path;
}

module.exports = {
  getAdjacencyList,
  calculateRoute,
  getEdgeWeight
};

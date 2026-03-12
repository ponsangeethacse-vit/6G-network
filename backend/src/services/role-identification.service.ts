import { blockchainService } from './blockchain.service';

export enum NodeRole {
  Unknown = 0,
  DataRequester = 1,
  ServiceProvider = 2,
  Communicator = 3
}

export interface NodeMetrics {
  packetSize: number;
  packetRate: number;
  connectionDuration: number;
  protocolType: string;
}

export class RoleIdentificationService {
  
  // A mapping of active nodes discovered via simulated traffic
  private activeNodes: Map<string, NodeRole> = new Map();

  async processTrafficPattern(sourceNode: string, metrics: NodeMetrics) {
    // 1. Determine role based on traffic heuristics
    let determinedRole = NodeRole.Unknown;

    if (metrics.packetSize > 1000 && metrics.packetRate > 50) {
      // High bandwidth -> ServiceProvider
      determinedRole = NodeRole.ServiceProvider;
    } else if (metrics.packetRate > 10 && metrics.packetRate <= 50) {
      // Medium rate -> Communicator
      determinedRole = NodeRole.Communicator;
    } else if (metrics.packetRate <= 10) {
      // Low rate -> DataRequester (IoT device etc)
      determinedRole = NodeRole.DataRequester;
    }

    // 2. Register or Update Role in Blockchain if needed
    if (!this.activeNodes.has(sourceNode)) {
      await this.registerNodeOnChain(sourceNode, determinedRole);
      this.activeNodes.set(sourceNode, determinedRole);
    } else {
      const currentRole = this.activeNodes.get(sourceNode);
      if (currentRole !== determinedRole) {
        await this.updateNodeRoleOnChain(sourceNode, determinedRole);
        this.activeNodes.set(sourceNode, determinedRole);
      } else {
        await this.recordInteractionOnChain(sourceNode);
      }
    }

    return determinedRole;
  }

  private async registerNodeOnChain(nodeAddress: string, role: NodeRole) {
    try {
      if (!blockchainService.nodeRegistryContract) return;

      const tx = await blockchainService.nodeRegistryContract.registerNode(nodeAddress, role);
      await tx.wait();
      console.log(`[RoleId] Registered node ${nodeAddress} with role ${role}`);
    } catch (e: any) {
      if (e.message && e.message.includes('Node already registered')) {
        // Safe to ignore if already registered
      } else {
        console.error(`[RoleId] Error registering node ${nodeAddress}:`, e.message);
      }
    }
  }

  private async updateNodeRoleOnChain(nodeAddress: string, role: NodeRole) {
    try {
      if (!blockchainService.nodeRegistryContract) return;
      
      const tx = await blockchainService.nodeRegistryContract.updateRole(nodeAddress, role);
      await tx.wait();
      console.log(`[RoleId] Updated node ${nodeAddress} to role ${role}`);
    } catch (e: any) {
      console.error(`[RoleId] Error updating role for ${nodeAddress}:`, e.message);
    }
  }

  private async recordInteractionOnChain(nodeAddress: string) {
    try {
      if (!blockchainService.nodeRegistryContract) return;

      const tx = await blockchainService.nodeRegistryContract.recordInteraction(nodeAddress);
      await tx.wait();
    } catch (e: any) {
       console.error(`[RoleId] Error recording interaction for ${nodeAddress}:`, e.message);
    }
  }

  getActiveNodes() {
    return Array.from(this.activeNodes.entries()).map(([address, role]) => ({ address, role }));
  }
}

export const roleIdentificationService = new RoleIdentificationService();

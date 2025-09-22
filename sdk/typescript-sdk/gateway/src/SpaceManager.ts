import { v4 as uuidv4 } from 'uuid';
import { 
  Space, 
  ConnectedClient, 
  Envelope, 
  Participant,
  PresencePayload,
  SystemWelcomePayload,
  PROTOCOL_VERSION 
} from './types';

/**
 * Manages spaces and client connections
 */
export class SpaceManager {
  private spaces: Map<string, Space> = new Map();
  private clientToSpace: Map<string, string> = new Map();
  private maxSpaces: number;
  private maxClientsPerSpace: number;
  private maxHistorySize: number;

  constructor(
    maxSpaces: number = 100,
    maxClientsPerSpace: number = 100,
    maxHistorySize: number = 1000
  ) {
    this.maxSpaces = maxSpaces;
    this.maxClientsPerSpace = maxClientsPerSpace;
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Create a new space
   */
  createSpace(name: string, adminIds?: string[]): Space {
    if (this.spaces.size >= this.maxSpaces) {
      throw new Error(`Maximum number of spaces (${this.maxSpaces}) reached`);
    }

    const id = `space-${uuidv4()}`;
    const space: Space = {
      id,
      name,
      clients: new Map(),
      created: new Date(),
      messageHistory: [],
      maxHistorySize: this.maxHistorySize,
      metadata: {},
      adminIds: new Set(adminIds || []),
    };

    this.spaces.set(id, space);
    return space;
  }

  /**
   * Get or create a space by name
   */
  getOrCreateSpace(name: string): Space {
    // Check if space exists by name
    for (const space of this.spaces.values()) {
      if (space.name === name) {
        return space;
      }
    }
    
    // Create new space
    return this.createSpace(name);
  }

  /**
   * Get space by ID
   */
  getSpace(id: string): Space | undefined {
    return this.spaces.get(id);
  }

  /**
   * Get space by name
   */
  getSpaceByName(name: string): Space | undefined {
    for (const space of this.spaces.values()) {
      if (space.name === name) {
        return space;
      }
    }
    return undefined;
  }

  /**
   * Add client to space
   */
  addClient(spaceId: string, client: ConnectedClient): void {
    const space = this.spaces.get(spaceId);
    if (!space) {
      throw new Error(`Space ${spaceId} not found`);
    }

    if (space.clients.size >= this.maxClientsPerSpace) {
      throw new Error(`Space ${spaceId} is full (max ${this.maxClientsPerSpace} clients)`);
    }

    // Remove from previous space if exists
    const previousSpaceId = this.clientToSpace.get(client.participantId);
    if (previousSpaceId) {
      this.removeClient(previousSpaceId, client.participantId);
    }

    space.clients.set(client.participantId, client);
    this.clientToSpace.set(client.participantId, spaceId);
    client.spaceId = spaceId;

    // Send welcome message
    this.sendWelcome(client, space);

    // Broadcast join to other clients
    this.broadcastPresence(space, client, 'join');
  }

  /**
   * Remove client from space
   */
  removeClient(spaceId: string, participantId: string): void {
    const space = this.spaces.get(spaceId);
    if (!space) return;

    const client = space.clients.get(participantId);
    if (!client) return;

    space.clients.delete(participantId);
    this.clientToSpace.delete(participantId);

    // Broadcast leave to remaining clients
    this.broadcastPresence(space, client, 'leave');

    // Clean up empty spaces (optional)
    if (space.clients.size === 0 && !space.adminIds.size) {
      this.spaces.delete(spaceId);
    }
  }

  /**
   * Get client by participant ID
   */
  getClient(participantId: string): ConnectedClient | undefined {
    const spaceId = this.clientToSpace.get(participantId);
    if (!spaceId) return undefined;
    
    const space = this.spaces.get(spaceId);
    if (!space) return undefined;
    
    return space.clients.get(participantId);
  }

  /**
   * Broadcast message to space
   */
  broadcast(space: Space, envelope: Envelope, excludeIds?: string[]): void {
    // Add to history
    if (space.messageHistory.length >= space.maxHistorySize) {
      space.messageHistory.shift();
    }
    space.messageHistory.push(envelope);

    // Send to all clients except excluded ones
    const excludeSet = new Set(excludeIds || []);
    for (const client of space.clients.values()) {
      if (!excludeSet.has(client.participantId)) {
        this.sendToClient(client, envelope);
      }
    }
  }

  /**
   * Send message to specific clients
   */
  sendToTargets(space: Space, envelope: Envelope, targetIds: string[]): void {
    // Add to history
    if (space.messageHistory.length >= space.maxHistorySize) {
      space.messageHistory.shift();
    }
    space.messageHistory.push(envelope);

    // Send to targeted clients
    for (const targetId of targetIds) {
      const client = space.clients.get(targetId);
      if (client) {
        this.sendToClient(client, envelope);
      }
    }
  }

  /**
   * Send welcome message to new client
   */
  private sendWelcome(client: ConnectedClient, space: Space): void {
    const participants: Participant[] = Array.from(space.clients.values())
      .filter(c => c.participantId !== client.participantId)
      .map(c => ({
        id: c.participantId,
        capabilities: c.capabilities,
      }));

    const welcomePayload: SystemWelcomePayload = {
      you: {
        id: client.participantId,
        capabilities: client.capabilities,
      },
      participants,
    };

    const envelope: Envelope = {
      protocol: PROTOCOL_VERSION,
      id: uuidv4(),
      ts: new Date().toISOString(),
      from: 'system',
      to: [client.participantId],
      kind: 'system/welcome',
      payload: welcomePayload,
    };

    this.sendToClient(client, envelope);
  }

  broadcastPresenceUpdate(space: Space, client: ConnectedClient): void {
    this.broadcastPresence(space, client, 'update');
  }

  /**
   * Broadcast presence event
   */
  private broadcastPresence(
    space: Space,
    client: ConnectedClient,
    event: 'join' | 'leave' | 'update'
  ): void {
    const presencePayload: PresencePayload = {
      event,
      participant: {
        id: client.participantId,
        capabilities: client.capabilities,
      },
    };

    const envelope: Envelope = {
      protocol: PROTOCOL_VERSION,
      id: uuidv4(),
      ts: new Date().toISOString(),
      from: 'system',
      kind: 'system/presence',
      payload: presencePayload,
    };

    // Send to all other clients
    for (const otherClient of space.clients.values()) {
      if (otherClient.participantId !== client.participantId) {
        this.sendToClient(otherClient, envelope);
      }
    }
  }

  /**
   * Send envelope to client
   */
  private sendToClient(client: ConnectedClient, envelope: Envelope): void {
    if (client.ws.readyState === client.ws.OPEN) {
      client.ws.send(JSON.stringify(envelope));
      client.lastActivity = new Date();
    }
  }

  /**
   * Get all spaces
   */
  getAllSpaces(): Space[] {
    return Array.from(this.spaces.values());
  }

  /**
   * Get space statistics
   */
  getStats() {
    return {
      totalSpaces: this.spaces.size,
      totalClients: this.clientToSpace.size,
      spacesInfo: Array.from(this.spaces.values()).map(space => ({
        id: space.id,
        name: space.name,
        clients: space.clients.size,
        messages: space.messageHistory.length,
        created: space.created.toISOString(),
      })),
    };
  }

  /**
   * Clean up disconnected clients
   */
  cleanupDisconnectedClients(): void {
    for (const space of this.spaces.values()) {
      for (const [participantId, client] of space.clients.entries()) {
        if (client.ws.readyState !== client.ws.OPEN) {
          this.removeClient(space.id, participantId);
        }
      }
    }
  }
}
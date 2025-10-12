import { EventEmitter } from 'events';
import Phaser from 'phaser';
import { MEWClient, ClientOptions } from '../MEWClient.js';
import { MovementStream } from './network/MovementStream.js';
import { GameStateSnapshot, JoinFormValues, MovementFrame, PlayerSpawn, ShipDefinition, ShipFrame } from './types.js';
import { MultiplayerIsometricScene } from './MultiplayerIsometricScene.js';

export interface MultiplayerGameOptions {
  containerId?: string;
  description?: string;
  spaceId?: string;
}

const DEFAULT_SPACE_ID = 'isometric-demo-space';
const DEFAULT_CONTAINER_ID = 'game-root';

const HUMAN_SPAWNS: PlayerSpawn[] = [
  { id: 'human-1', name: 'Aurora', kind: 'human', tileX: 10, tileY: 10 },
  { id: 'human-2', name: 'Bishop', kind: 'human', tileX: 12, tileY: 12 },
  { id: 'human-3', name: 'Cinder', kind: 'human', tileX: 8, tileY: 12 },
  { id: 'human-4', name: 'Delta', kind: 'human', tileX: 14, tileY: 10 }
];

const AGENT_SPAWNS: PlayerSpawn[] = [
  { id: 'agent-1', name: 'Mew-Alpha', kind: 'mew-agent', tileX: 20, tileY: 18 },
  { id: 'agent-2', name: 'Mew-Beta', kind: 'mew-agent', tileX: 22, tileY: 18 },
  { id: 'agent-3', name: 'Mew-Gamma', kind: 'mew-agent', tileX: 20, tileY: 20 },
  { id: 'agent-4', name: 'Mew-Delta', kind: 'mew-agent', tileX: 22, tileY: 20 }
];

const SHIPS: ShipDefinition[] = [
  { id: 'skiff-1', name: 'Azure Skiff', tileX: 28, tileY: 18, width: 6, height: 4, deckSpeed: 2 },
  { id: 'skiff-2', name: 'Crimson Sloop', tileX: 30, tileY: 12, width: 8, height: 5, deckSpeed: 2 }
];

export class MultiplayerGameClient extends EventEmitter {
  private readonly formValues: JoinFormValues;
  private readonly options: MultiplayerGameOptions;
  private client?: MEWClient;
  private movementStream?: MovementStream;
  private scene?: MultiplayerIsometricScene;
  private game?: Phaser.Game;
  private localPlayerId?: string;
  private snapshotHandler?: (snapshot: GameStateSnapshot) => void;

  constructor(formValues: JoinFormValues, options: MultiplayerGameOptions = {}) {
    super();
    this.formValues = formValues;
    this.options = options;
  }

  async start(initialSnapshot?: GameStateSnapshot): Promise<void> {
    this.localPlayerId = this.formValues.username || `pilot-${Date.now()}`;

    const gateway = this.buildGatewayUrl();
    const clientOptions: ClientOptions = {
      gateway,
      space: this.options.spaceId ?? DEFAULT_SPACE_ID,
      token: this.formValues.token,
      participant_id: this.localPlayerId,
      capabilities: [
        { kind: 'chat' },
        { kind: 'stream/request' },
        { kind: 'stream/open' },
        { kind: 'stream/close' }
      ]
    };

    this.client = new MEWClient(clientOptions);
    this.movementStream = new MovementStream(this.client, { description: this.options.description });

    this.registerClientEvents();
    await this.client.connect();
    await this.movementStream.open();

    const containerId = this.options.containerId ?? DEFAULT_CONTAINER_ID;
    this.scene = new MultiplayerIsometricScene({
      localPlayerId: this.localPlayerId,
      onLocalMovement: (frame) => this.handleLocalMovement(frame),
      humanPlayers: HUMAN_SPAWNS,
      agentPlayers: AGENT_SPAWNS,
      ships: SHIPS,
      initialSnapshot
    });

    this.snapshotHandler = (snapshot: GameStateSnapshot) => {
      this.movementStream?.sendSnapshot(snapshot);
    };
    this.scene.events.on('snapshot-ready', this.snapshotHandler);

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 1024,
      height: 768,
      parent: containerId,
      scene: [this.scene],
      backgroundColor: '#0b132b'
    };

    this.game = new Phaser.Game(config);

    this.registerStreamHandlers();
  }

  async stop(): Promise<void> {
    if (this.scene && this.snapshotHandler) {
      this.scene.events.off('snapshot-ready', this.snapshotHandler);
    }
    this.game?.destroy(true);
    this.game = undefined;
    this.scene = undefined;
    this.movementStream?.removeAllListeners();
    this.movementStream = undefined;
    this.client?.disconnect();
    this.client?.removeAllListeners();
    this.client = undefined;
  }

  private registerClientEvents(): void {
    if (!this.client) {
      return;
    }

    this.client.onWelcome((payload) => {
      this.emit('welcome', payload);
    });

    this.client.onDisconnected(() => this.emit('disconnected'));
    this.client.onError((error) => this.emit('error', error));
  }

  private registerStreamHandlers(): void {
    if (!this.movementStream || !this.scene) {
      return;
    }

    this.movementStream.on('movement', (frame: MovementFrame) => {
      if (frame.playerId === this.localPlayerId) {
        return;
      }
      this.scene?.handleMovementFrame(frame);
    });

    this.movementStream.on('ship', (frame: ShipFrame) => {
      this.scene?.handleShipFrame(frame);
    });

    this.movementStream.on('snapshot', (snapshot: GameStateSnapshot) => {
      this.scene?.applySnapshot(snapshot);
    });
  }

  private handleLocalMovement(frame: MovementFrame): void {
    this.movementStream?.sendMovementUpdate(frame);
  }

  private buildGatewayUrl(): string {
    const { gatewayUrl, port } = this.formValues;
    const trimmed = gatewayUrl.replace(/\/$/, '');
    if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) {
      return `${trimmed}:${port}`;
    }
    return `ws://${trimmed}:${port}`;
  }
}

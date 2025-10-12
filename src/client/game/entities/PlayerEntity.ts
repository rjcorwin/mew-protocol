import Phaser from 'phaser';
import { PlayerRenderable, PlayerState } from '../types.js';
import { isoToScreen } from '../utils/isometric.js';

const PLAYER_RADIUS = 12;

export class PlayerEntity {
  public readonly state: PlayerState;
  public readonly renderable: PlayerRenderable;
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, state: PlayerState) {
    this.scene = scene;
    this.state = state;
    const { x, y } = isoToScreen(state.tileX, state.tileY, state.z);

    const container = scene.add.container(x, y);
    const sprite = scene.add.circle(0, 0, PLAYER_RADIUS, state.definition.kind === 'human' ? 0x4cc9f0 : 0xf72585, 1);
    sprite.setStrokeStyle(2, 0xffffff, 0.8);

    const label = scene.add.text(0, -PLAYER_RADIUS - 12, state.definition.displayName, {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center'
    });
    label.setOrigin(0.5, 1);

    container.add([sprite, label]);

    this.renderable = {
      container,
      sprite,
      label
    };
  }

  updateState(next: PlayerState): void {
    const now = performance.now();
    const previous = { ...this.state };
    Object.assign(this.state, next, { lastUpdated: now });

    const { x, y } = isoToScreen(next.tileX, next.tileY, next.z);
    const duration = next.isMoving ? Math.max(100, 1000 * (1 / next.definition.speed)) : 150;

    this.renderable.interpolation = {
      fromX: this.renderable.container.x,
      fromY: this.renderable.container.y,
      toX: x,
      toY: y,
      startTime: now,
      duration
    };

    if (previous.onShipId !== next.onShipId) {
      this.renderable.sprite.setFillStyle(next.onShipId ? 0xffb703 : next.definition.kind === 'human' ? 0x4cc9f0 : 0xf72585);
    }
  }

  update(dt: number): void {
    const interp = this.renderable.interpolation;
    if (!interp) {
      return;
    }

    const now = performance.now();
    const elapsed = now - interp.startTime;
    const t = Math.min(1, elapsed / interp.duration);
    const eased = Phaser.Math.Easing.Quadratic.Out(t);
    this.renderable.container.setPosition(
      Phaser.Math.Linear(interp.fromX, interp.toX, eased),
      Phaser.Math.Linear(interp.fromY, interp.toY, eased)
    );

    if (t >= 1) {
      this.renderable.interpolation = undefined;
    }
  }

  destroy(): void {
    this.renderable.container.destroy(true);
  }
}

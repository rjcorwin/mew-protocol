import Phaser from 'phaser';
import { ShipRenderable, ShipState } from '../types.js';
import { isoToScreen } from '../utils/isometric.js';

export class ShipEntity {
  public readonly state: ShipState;
  public readonly renderable: ShipRenderable;
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, state: ShipState) {
    this.scene = scene;
    this.state = state;
    const { x, y } = isoToScreen(state.tileX, state.tileY, 0);

    const container = scene.add.container(x, y);
    const widthPx = state.width * 32;
    const heightPx = state.height * 16;

    const deck = scene.add.rectangle(0, 0, widthPx, heightPx, 0x264653, 0.8);
    deck.setStrokeStyle(2, 0xe9c46a, 0.9);
    deck.setOrigin(0.5, 0.5);

    const label = scene.add.text(0, -heightPx / 2 - 16, state.name, {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ffb703',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center'
    });
    label.setOrigin(0.5, 1);

    container.add([deck, label]);

    this.renderable = {
      container,
      deck,
      label
    };
  }

  updateState(next: ShipState): void {
    Object.assign(this.state, next);
    const { x, y } = isoToScreen(next.tileX, next.tileY, 0);
    this.renderable.container.setPosition(x, y);
  }

  destroy(): void {
    this.renderable.container.destroy(true);
  }
}

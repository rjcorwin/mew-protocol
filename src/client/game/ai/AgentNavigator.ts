import { PlayerState, WORLD_HEIGHT_TILES, WORLD_WIDTH_TILES } from '../types.js';
import { clampTile } from '../utils/isometric.js';

const TARGET_EPSILON = 0.1;

export class AgentNavigator {
  private target?: { tileX: number; tileY: number };

  pickNextTarget(state: PlayerState): void {
    this.target = {
      tileX: clampTile(Math.floor(Math.random() * WORLD_WIDTH_TILES), WORLD_WIDTH_TILES - 1),
      tileY: clampTile(Math.floor(Math.random() * WORLD_HEIGHT_TILES), WORLD_HEIGHT_TILES - 1)
    };
  }

  update(state: PlayerState, deltaMs: number): PlayerState {
    if (!this.target || this.atTarget(state)) {
      this.pickNextTarget(state);
    }

    if (!this.target) {
      return state;
    }

    const step = (state.definition.speed * deltaMs) / 1000;
    const dx = this.target.tileX - state.tileX;
    const dy = this.target.tileY - state.tileY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= step || distance < TARGET_EPSILON) {
      return {
        ...state,
        tileX: this.target.tileX,
        tileY: this.target.tileY,
        velocityX: 0,
        velocityY: 0,
        isMoving: false
      };
    }

    const dirX = dx / distance;
    const dirY = dy / distance;
    const nextX = state.tileX + dirX * step;
    const nextY = state.tileY + dirY * step;

    return {
      ...state,
      tileX: nextX,
      tileY: nextY,
      velocityX: dirX * state.definition.speed,
      velocityY: dirY * state.definition.speed,
      isMoving: true
    };
  }

  private atTarget(state: PlayerState): boolean {
    if (!this.target) {
      return true;
    }

    return (
      Math.abs(state.tileX - this.target.tileX) < TARGET_EPSILON &&
      Math.abs(state.tileY - this.target.tileY) < TARGET_EPSILON
    );
  }
}

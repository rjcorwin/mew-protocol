import { TILE_HEIGHT, TILE_WIDTH } from '../types.js';

export interface ScreenPoint {
  x: number;
  y: number;
}

export const isoToScreen = (tileX: number, tileY: number, elevation = 0): ScreenPoint => {
  const x = (tileX - tileY) * (TILE_WIDTH / 2);
  const y = (tileX + tileY) * (TILE_HEIGHT / 2) - elevation;
  return { x, y };
};

export const screenToIso = (x: number, y: number): ScreenPoint => {
  const tileX = (x / (TILE_WIDTH / 2) + y / (TILE_HEIGHT / 2)) / 2;
  const tileY = (y / (TILE_HEIGHT / 2) - x / (TILE_WIDTH / 2)) / 2;
  return { x: tileX, y: tileY };
};

export const clampTile = (value: number, max: number): number => {
  return Math.max(0, Math.min(value, max));
};

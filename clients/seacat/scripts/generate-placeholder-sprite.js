#!/usr/bin/env node

/**
 * Generate a placeholder 8-direction sprite sheet for testing
 * Output: 128x256 PNG with 32x32 frames (4 columns x 8 rows)
 */

import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRAME_WIDTH = 32;
const FRAME_HEIGHT = 32;
const COLS = 4;
const ROWS = 8;
const SHEET_WIDTH = FRAME_WIDTH * COLS;
const SHEET_HEIGHT = FRAME_HEIGHT * ROWS;

// Direction names and colors
const directions = [
  { name: 'south', color: '#ff6b6b' },      // Red
  { name: 'southwest', color: '#ff9f4a' },  // Orange
  { name: 'west', color: '#ffd93d' },       // Yellow
  { name: 'northwest', color: '#6bcf7f' },  // Light green
  { name: 'north', color: '#4dabf7' },      // Blue
  { name: 'northeast', color: '#748ffc' },  // Purple
  { name: 'east', color: '#ff6bc7' },       // Pink
  { name: 'southeast', color: '#ff8787' },  // Light red
];

const canvas = createCanvas(SHEET_WIDTH, SHEET_HEIGHT);
const ctx = canvas.getContext('2d');

// Fill background with transparency
ctx.clearRect(0, 0, SHEET_WIDTH, SHEET_HEIGHT);

// Draw each direction (8 rows)
directions.forEach((dir, row) => {
  // Draw 4 frames of animation per direction
  for (let col = 0; col < COLS; col++) {
    const x = col * FRAME_WIDTH;
    const y = row * FRAME_HEIGHT;

    // Animation offset (frames move slightly)
    const animOffset = Math.sin((col / COLS) * Math.PI * 2) * 2;

    // Draw character body (circle)
    ctx.fillStyle = dir.color;
    ctx.beginPath();
    ctx.arc(
      x + FRAME_WIDTH / 2,
      y + FRAME_HEIGHT / 2 + animOffset,
      10,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Draw direction indicator (arrow)
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    // Arrow direction based on facing
    const angles = {
      'south': Math.PI / 2,        // Down
      'southwest': Math.PI * 3/4,
      'west': Math.PI,             // Left
      'northwest': Math.PI * 5/4,
      'north': Math.PI * 3/2,      // Up
      'northeast': Math.PI * 7/4,
      'east': 0,                   // Right
      'southeast': Math.PI / 4,
    };

    const angle = angles[dir.name];
    const arrowLength = 6;
    const centerX = x + FRAME_WIDTH / 2;
    const centerY = y + FRAME_HEIGHT / 2 + animOffset;

    // Draw arrow line
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + Math.cos(angle) * arrowLength,
      centerY + Math.sin(angle) * arrowLength
    );
    ctx.stroke();

    // Draw arrow head
    const headAngle1 = angle - Math.PI / 6;
    const headAngle2 = angle + Math.PI / 6;
    const headLength = 3;
    const tipX = centerX + Math.cos(angle) * arrowLength;
    const tipY = centerY + Math.sin(angle) * arrowLength;

    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(
      tipX + Math.cos(headAngle1 + Math.PI) * headLength,
      tipY + Math.sin(headAngle1 + Math.PI) * headLength
    );
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(
      tipX + Math.cos(headAngle2 + Math.PI) * headLength,
      tipY + Math.sin(headAngle2 + Math.PI) * headLength
    );
    ctx.stroke();

    // Draw outline
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, FRAME_WIDTH, FRAME_HEIGHT);
  }
});

// Save to file
const outputPath = path.join(__dirname, '../assets/sprites/player.png');
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(outputPath, buffer);

console.log(`✅ Generated placeholder sprite sheet: ${outputPath}`);
console.log(`   Dimensions: ${SHEET_WIDTH}x${SHEET_HEIGHT}`);
console.log(`   Frames: ${COLS}x${ROWS} = ${COLS * ROWS} total`);
console.log(`   Frame size: ${FRAME_WIDTH}x${FRAME_HEIGHT}`);

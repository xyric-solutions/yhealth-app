/**
 * @file Ishihara-style Plate Generator
 * @description Generates authentic color vision test plates using packed dot patterns.
 *
 * KEY: Real Ishihara plates have:
 * - Warm-toned circular background FILLED with dots (no gaps visible)
 * - 800-1500 tightly packed dots of varying sizes
 * - Character formed by HUE difference only (matched lightness/saturation)
 * - Dots touching or overlapping slightly for dense coverage
 */

import { getPalette, randomHSL } from './colorPalettes';
import type { PlateType, Difficulty } from './colorPalettes';

// ─── Seeded PRNG ────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

// ─── Character Mask ─────────────────────────────────────────────────

function createCharacterMask(character: string, size: number): Uint8Array {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, size, size);

  // Use very bold, thick font — single chars get huge, multi-char slightly smaller
  const fontSize = character.length === 1
    ? Math.round(size * 0.6)
    : Math.round(size * 0.42);

  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${fontSize}px "Arial Black", "Impact", Arial, sans-serif`;

  // Add slight stroke for thicker character
  ctx.strokeStyle = 'white';
  ctx.lineWidth = Math.max(4, fontSize * 0.06);
  ctx.strokeText(character, size / 2, size / 2 + size * 0.01);
  ctx.fillText(character, size / 2, size / 2 + size * 0.01);

  const imageData = ctx.getImageData(0, 0, size, size);
  const mask = new Uint8Array(size * size);
  for (let i = 0; i < mask.length; i++) {
    mask[i] = imageData.data[i * 4] > 60 ? 1 : 0;
  }
  return mask;
}

function sampleMask(mask: Uint8Array, size: number, x: number, y: number, radius: number): boolean {
  // Sample a grid of points within the dot radius
  const samples = [
    [0, 0], [-0.5, 0], [0.5, 0], [0, -0.5], [0, 0.5],
    [-0.35, -0.35], [0.35, 0.35], [-0.35, 0.35], [0.35, -0.35],
  ];

  let hits = 0;
  for (const [dx, dy] of samples) {
    const sx = Math.round(x + dx * radius);
    const sy = Math.round(y + dy * radius);
    if (sx >= 0 && sx < size && sy >= 0 && sy < size) {
      if (mask[sy * size + sx] === 1) hits++;
    }
  }
  return hits >= 3; // majority inside character
}

// ─── Dot Packing ────────────────────────────────────────────────────

interface Dot {
  x: number;
  y: number;
  r: number;
}

function packDots(size: number, plateRadius: number, rng: () => number): Dot[] {
  const center = size / 2;
  const dots: Dot[] = [];
  const maxAttempts = 12000;
  const targetCount = 1000;
  let attempts = 0;

  // Size distribution: mostly small dots with some medium and few large
  // This creates the authentic dense Ishihara look
  const sizeWeights = [
    { min: 2.5, max: 4, weight: 0.35 },   // small
    { min: 4, max: 6.5, weight: 0.35 },    // medium-small
    { min: 6.5, max: 9, weight: 0.2 },     // medium
    { min: 9, max: 13, weight: 0.1 },      // large
  ];

  function pickRadius(): number {
    const roll = rng();
    let cumulative = 0;
    for (const sw of sizeWeights) {
      cumulative += sw.weight;
      if (roll <= cumulative) {
        return sw.min + rng() * (sw.max - sw.min);
      }
    }
    return 4 + rng() * 4;
  }

  while (dots.length < targetCount && attempts < maxAttempts) {
    attempts++;
    const r = pickRadius();
    const angle = rng() * Math.PI * 2;
    const maxDist = plateRadius - r - 1;
    const dist = Math.sqrt(rng()) * maxDist;
    const x = center + Math.cos(angle) * dist;
    const y = center + Math.sin(angle) * dist;

    // Check overlap — allow very slight overlap (gap = -0.5) for dense packing
    let overlaps = false;
    for (const d of dots) {
      const dx = d.x - x;
      const dy = d.y - y;
      const minDist = d.r + r - 0.5; // slight overlap allowed
      if (dx * dx + dy * dy < minDist * minDist) {
        overlaps = true;
        break;
      }
    }

    if (!overlaps) {
      dots.push({ x, y, r });
    }
  }

  return dots;
}

// ─── Main Generator ─────────────────────────────────────────────────

export interface GeneratePlateOptions {
  size?: number;
  plateType: PlateType;
  character: string;
  seed: string;
  difficulty?: Difficulty;
}

export function generatePlate(
  canvas: HTMLCanvasElement,
  options: GeneratePlateOptions,
): void {
  const {
    size = 320,
    plateType,
    character,
    seed,
    difficulty = 'standard',
  } = options;

  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const rng = mulberry32(hashSeed(seed + plateType + character));
  const palette = getPalette(plateType, difficulty);

  const center = size / 2;
  const plateRadius = size * 0.47;

  // Clear with transparent/dark outside the circle
  ctx.clearRect(0, 0, size, size);

  // Create character mask
  const mask = createCharacterMask(character, size);

  // Pack dots
  const dots = packDots(size, plateRadius, rng);

  // Clip to circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(center, center, plateRadius, 0, Math.PI * 2);
  ctx.clip();

  // Fill plate background with a warm neutral (like real Ishihara)
  ctx.fillStyle = 'hsl(30, 20%, 65%)';
  ctx.fillRect(0, 0, size, size);

  // Draw each dot
  for (const dot of dots) {
    const isChar = sampleMask(mask, size, dot.x, dot.y, dot.r);
    const range = isChar ? palette.character : palette.background;
    const color = randomHSL(range, rng);

    ctx.beginPath();
    ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  ctx.restore();

  // Subtle circular border
  ctx.beginPath();
  ctx.arc(center, center, plateRadius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/**
 * @file Color Palettes for Ishihara-style Plates
 * @description Authentic Ishihara color ranges.
 *
 * REAL Ishihara plates use:
 * - HIGH saturation (60-90%) for both character and background
 * - MATCHED lightness between character and background (within 5%)
 * - Hue difference is the ONLY distinguishing factor
 * - Warm color palette overall (oranges, greens, yellows, reds)
 */

export interface HSLRange {
  hMin: number; hMax: number;
  sMin: number; sMax: number;
  lMin: number; lMax: number;
}

export interface PlatePalette {
  background: HSLRange;
  character: HSLRange;
}

/**
 * CONTROL: Very obvious — red/orange number on green/teal background.
 * Everyone can see these. Used to validate the test is taken seriously.
 */
const CONTROL: PlatePalette = {
  background: { hMin: 70, hMax: 160, sMin: 55, sMax: 85, lMin: 48, lMax: 62 },
  character:  { hMin: 0, hMax: 30, sMin: 65, sMax: 90, lMin: 48, lMax: 62 },
};

/**
 * PROTAN: Red-orange character on olive-green background.
 * Protan-deficient users can't distinguish red from green at similar luminance.
 */
const PROTAN_STANDARD: PlatePalette = {
  background: { hMin: 70, hMax: 150, sMin: 50, sMax: 80, lMin: 45, lMax: 60 },
  character:  { hMin: 0, hMax: 25, sMin: 60, sMax: 85, lMin: 45, lMax: 60 },
};
const PROTAN_HARD: PlatePalette = {
  background: { hMin: 80, hMax: 140, sMin: 45, sMax: 65, lMin: 47, lMax: 57 },
  character:  { hMin: 5, hMax: 20, sMin: 50, sMax: 68, lMin: 47, lMax: 57 },
};

/**
 * DEUTAN: Green character on red-orange background.
 * Deutan-deficient users can't distinguish green from red.
 */
const DEUTAN_STANDARD: PlatePalette = {
  background: { hMin: 0, hMax: 35, sMin: 55, sMax: 80, lMin: 45, lMax: 60 },
  character:  { hMin: 80, hMax: 150, sMin: 55, sMax: 80, lMin: 45, lMax: 60 },
};
const DEUTAN_HARD: PlatePalette = {
  background: { hMin: 5, hMax: 30, sMin: 45, sMax: 65, lMin: 47, lMax: 57 },
  character:  { hMin: 85, hMax: 135, sMin: 45, sMax: 65, lMin: 47, lMax: 57 },
};

/**
 * TRITAN: Yellow-green character on blue-purple background.
 * Tritan-deficient users can't distinguish blue from yellow.
 */
const TRITAN_STANDARD: PlatePalette = {
  background: { hMin: 210, hMax: 280, sMin: 50, sMax: 75, lMin: 45, lMax: 60 },
  character:  { hMin: 40, hMax: 85, sMin: 55, sMax: 80, lMin: 48, lMax: 62 },
};
const TRITAN_HARD: PlatePalette = {
  background: { hMin: 220, hMax: 265, sMin: 42, sMax: 60, lMin: 47, lMax: 57 },
  character:  { hMin: 48, hMax: 78, sMin: 45, sMax: 63, lMin: 48, lMax: 58 },
};

export type PlateType = 'control' | 'protan' | 'deutan' | 'tritan';
export type Difficulty = 'standard' | 'hard';

const PALETTES: Record<PlateType, Record<Difficulty, PlatePalette>> = {
  control: { standard: CONTROL, hard: CONTROL },
  protan:  { standard: PROTAN_STANDARD, hard: PROTAN_HARD },
  deutan:  { standard: DEUTAN_STANDARD, hard: DEUTAN_HARD },
  tritan:  { standard: TRITAN_STANDARD, hard: TRITAN_HARD },
};

export function getPalette(plateType: PlateType, difficulty: Difficulty = 'standard'): PlatePalette {
  return PALETTES[plateType][difficulty];
}

/** Generate a random HSL color within the given range, wrapping hue at 360 */
export function randomHSL(range: HSLRange, rng: () => number): string {
  let h = range.hMin + rng() * (range.hMax - range.hMin);
  if (h >= 360) h -= 360;
  const s = range.sMin + rng() * (range.sMax - range.sMin);
  const l = range.lMin + rng() * (range.lMax - range.lMin);
  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}

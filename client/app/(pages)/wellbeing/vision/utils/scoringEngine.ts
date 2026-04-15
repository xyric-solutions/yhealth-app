/**
 * @file Scoring Engine for Color Vision Tests
 * @description Calculates classification and confidence from plate responses.
 * Runs client-side for instant results; server independently verifies.
 */

import type {
  VisionClassification,
  PlateType,
  SubmitPlateResponseInput,
  PlateConfig,
} from '@shared/types/domain/vision';

// ─── Plate Configuration Generator ──────────────────────────────────

// Mix of single digits and English letters for variety
const CHARACTERS = ['2', '3', '5', '6', '7', '8', '9', 'A', 'B', 'E', 'H', 'K', 'N', 'R', 'S'];

function shuffleArray<T>(arr: T[], rng: () => number): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function generateOptions(correct: string, rng: () => number): string[] {
  const pool = CHARACTERS.filter((c) => c !== correct);
  const distractors = shuffleArray(pool, rng).slice(0, 3);
  const options = [correct, ...distractors];
  return shuffleArray(options, rng);
}

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

/**
 * Generate the plate configuration for a test session.
 * Quick test: 10 plates (2 control, 3 protan, 3 deutan, 2 tritan)
 * Advanced: 15 plates (3 control, 4 protan, 4 deutan, 4 tritan)
 */
export function generatePlateConfigs(
  testType: 'color_vision_quick' | 'color_vision_advanced',
  seed: string,
): PlateConfig[] {
  const rng = mulberry32(hashSeed(seed));
  const chars = shuffleArray([...CHARACTERS], rng);

  let distribution: PlateType[];
  if (testType === 'color_vision_quick') {
    distribution = [
      'control', 'control',
      'protan', 'protan', 'protan',
      'deutan', 'deutan', 'deutan',
      'tritan', 'tritan',
    ];
  } else {
    distribution = [
      'control', 'control', 'control',
      'protan', 'protan', 'protan', 'protan',
      'deutan', 'deutan', 'deutan', 'deutan',
      'tritan', 'tritan', 'tritan', 'tritan',
    ];
  }

  // Shuffle plate order
  const shuffled = shuffleArray(distribution, rng);

  return shuffled.map((plateType, i) => {
    const character = chars[i % chars.length];
    const timer = 5 + Math.floor(rng() * 6); // 5-10 seconds
    return {
      plateType,
      character,
      options: generateOptions(character, rng),
      timerSeconds: timer,
    };
  });
}

// ─── Classification Logic ───────────────────────────────────────────

interface GroupAccuracy {
  correct: number;
  total: number;
}

export function classifyVision(
  responses: SubmitPlateResponseInput[],
): { classification: VisionClassification; confidence: number } {
  const groups: Record<string, GroupAccuracy> = {
    control: { correct: 0, total: 0 },
    protan: { correct: 0, total: 0 },
    deutan: { correct: 0, total: 0 },
    tritan: { correct: 0, total: 0 },
  };

  for (const r of responses) {
    const g = groups[r.plateType];
    if (!g) continue;
    g.total++;
    if (r.isCorrect) g.correct++;
  }

  const acc = (g: GroupAccuracy) => (g.total > 0 ? g.correct / g.total : 1);

  const controlAcc = acc(groups.control);
  const protanAcc = acc(groups.protan);
  const deutanAcc = acc(groups.deutan);
  const tritanAcc = acc(groups.tritan);

  // Invalid test
  if (controlAcc < 0.7) {
    return { classification: 'normal', confidence: 10 };
  }

  if (protanAcc < 0.4 && deutanAcc >= 0.7 && tritanAcc >= 0.7) {
    return { classification: 'protan_strong', confidence: Math.min(95, groups.protan.total * 15) };
  }
  if (protanAcc < 0.6 && deutanAcc >= 0.7 && tritanAcc >= 0.7) {
    return { classification: 'protan_weak', confidence: Math.min(85, groups.protan.total * 12) };
  }
  if (deutanAcc < 0.4 && protanAcc >= 0.7 && tritanAcc >= 0.7) {
    return { classification: 'deutan_strong', confidence: Math.min(95, groups.deutan.total * 15) };
  }
  if (deutanAcc < 0.6 && protanAcc >= 0.7 && tritanAcc >= 0.7) {
    return { classification: 'deutan_weak', confidence: Math.min(85, groups.deutan.total * 12) };
  }
  if (tritanAcc < 0.4 && protanAcc >= 0.7 && deutanAcc >= 0.7) {
    return { classification: 'tritan_strong', confidence: Math.min(95, groups.tritan.total * 15) };
  }
  if (tritanAcc < 0.6 && protanAcc >= 0.7 && deutanAcc >= 0.7) {
    return { classification: 'tritan_weak', confidence: Math.min(85, groups.tritan.total * 12) };
  }

  const minAcc = Math.min(protanAcc, deutanAcc, tritanAcc);
  return { classification: 'normal', confidence: Math.min(95, Math.round(minAcc * 100)) };
}

// ─── Score Summary ──────────────────────────────────────────────────

export interface TestSummary {
  correctCount: number;
  totalPlates: number;
  accuracyPercentage: number;
  averageResponseTimeMs: number;
  classification: VisionClassification;
  confidence: number;
}

export function computeSummary(responses: SubmitPlateResponseInput[]): TestSummary {
  const correctCount = responses.filter((r) => r.isCorrect).length;
  const totalPlates = responses.length;
  const accuracyPercentage = totalPlates > 0 ? (correctCount / totalPlates) * 100 : 0;

  const times = responses.filter((r) => r.responseTimeMs).map((r) => r.responseTimeMs!);
  const averageResponseTimeMs =
    times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

  const { classification, confidence } = classifyVision(responses);

  return {
    correctCount,
    totalPlates,
    accuracyPercentage,
    averageResponseTimeMs,
    classification,
    confidence,
  };
}

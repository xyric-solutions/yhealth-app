/**
 * @file Micro-Expression System
 * @description Brief flashes of emotion (200-500ms) that add realism to conversations.
 * Micro-expressions are involuntary emotional leaks that occur during speech,
 * adding authenticity and human-like imperfection to the avatar.
 *
 * Examples:
 * - Quick eyebrow raise when surprised by something said
 * - Momentary smirk when amused
 * - Fleeting concern flash when hearing bad news
 * - Brief confusion before understanding
 */

// ============================================
// TYPES
// ============================================

export interface MicroExpression {
  /** Name of the micro-expression. */
  name: string;
  /** Primary expression to blend in. */
  expression: string;
  /** Intensity of the expression (0-1). */
  intensity: number;
  /** Duration in milliseconds. */
  durationMs: number;
  /** How quickly it fades in (0-1, 1 = instant). */
  attackSpeed: number;
  /** How quickly it fades out (0-1, 1 = instant). */
  releaseSpeed: number;
  /** Probability weight for random selection. */
  weight: number;
  /** Head movement offset during expression. */
  headOffset?: { tilt?: number; nod?: number; turn?: number };
  /** Eye behavior modifier. */
  eyeModifier?: { widen?: number; blinkRate?: number };
}

export interface MicroExpressionState {
  isActive: boolean;
  expression: MicroExpression | null;
  startTime: number;
  progress: number;
  currentIntensity: number;
}

// ============================================
// MICRO-EXPRESSION LIBRARY
// ============================================

/** Context-appropriate micro-expressions for different conversation moments. */
export const MICRO_EXPRESSIONS: Record<string, MicroExpression[]> = {
  // General conversation fillers
  general: [
    {
      name: "subtle_nod",
      expression: "neutral",
      intensity: 0.15,
      durationMs: 400,
      attackSpeed: 0.3,
      releaseSpeed: 0.2,
      weight: 3,
      headOffset: { nod: 0.03 },
    },
    {
      name: "quick_blink",
      expression: "neutral",
      intensity: 0,
      durationMs: 150,
      attackSpeed: 1,
      releaseSpeed: 1,
      weight: 2,
      eyeModifier: { blinkRate: 2 },
    },
    {
      name: "slight_tilt",
      expression: "neutral",
      intensity: 0.1,
      durationMs: 600,
      attackSpeed: 0.2,
      releaseSpeed: 0.15,
      weight: 2,
      headOffset: { tilt: 0.02 },
    },
  ],

  // Reactions to positive information
  positive: [
    {
      name: "subtle_smile",
      expression: "happy",
      intensity: 0.3,
      durationMs: 500,
      attackSpeed: 0.4,
      releaseSpeed: 0.3,
      weight: 3,
      headOffset: { tilt: 0.015 },
    },
    {
      name: "pleasant_surprise",
      expression: "surprised",
      intensity: 0.25,
      durationMs: 400,
      attackSpeed: 0.5,
      releaseSpeed: 0.25,
      weight: 2,
      eyeModifier: { widen: 0.3 },
    },
    {
      name: "warm_empathy",
      expression: "empathy",
      intensity: 0.35,
      durationMs: 700,
      attackSpeed: 0.25,
      releaseSpeed: 0.2,
      weight: 2,
      headOffset: { tilt: 0.025, nod: 0.02 },
    },
  ],

  // Reactions to concerning information
  concerning: [
    {
      name: "fleeting_concern",
      expression: "concern",
      intensity: 0.4,
      durationMs: 500,
      attackSpeed: 0.3,
      releaseSpeed: 0.3,
      weight: 3,
      headOffset: { tilt: 0.03, nod: 0.02 },
    },
    {
      name: "empathy_flash",
      expression: "empathy",
      intensity: 0.35,
      durationMs: 600,
      attackSpeed: 0.35,
      releaseSpeed: 0.25,
      weight: 2,
      headOffset: { tilt: 0.02 },
    },
    {
      name: "thoughtful_furrow",
      expression: "contemplation",
      intensity: 0.3,
      durationMs: 800,
      attackSpeed: 0.2,
      releaseSpeed: 0.15,
      weight: 2,
      headOffset: { nod: 0.04 },
    },
  ],

  // Reactions to confusing information
  confusing: [
    {
      name: "confusion_flicker",
      expression: "confusion",
      intensity: 0.35,
      durationMs: 450,
      attackSpeed: 0.4,
      releaseSpeed: 0.3,
      weight: 3,
      headOffset: { tilt: 0.04 },
    },
    {
      name: "processing_blink",
      expression: "neutral",
      intensity: 0.1,
      durationMs: 200,
      attackSpeed: 0.5,
      releaseSpeed: 0.5,
      weight: 2,
      eyeModifier: { blinkRate: 1.5 },
    },
    {
      name: "curiosity_spike",
      expression: "curiosity",
      intensity: 0.3,
      durationMs: 500,
      attackSpeed: 0.35,
      releaseSpeed: 0.3,
      weight: 2,
      headOffset: { tilt: 0.025, nod: 0.02 },
    },
  ],

  // When emphasizing points
  emphasizing: [
    {
      name: "determination_flash",
      expression: "determination",
      intensity: 0.4,
      durationMs: 400,
      attackSpeed: 0.5,
      releaseSpeed: 0.35,
      weight: 3,
      headOffset: { nod: -0.02 },
    },
    {
      name: "confident_nod",
      expression: "neutral",
      intensity: 0.2,
      durationMs: 350,
      attackSpeed: 0.4,
      releaseSpeed: 0.3,
      weight: 2,
      headOffset: { nod: 0.035 },
    },
    {
      name: "slight_surprise",
      expression: "surprised",
      intensity: 0.2,
      durationMs: 300,
      attackSpeed: 0.5,
      releaseSpeed: 0.4,
      weight: 2,
      eyeModifier: { widen: 0.2 },
    },
  ],

  // When listening attentively
  listening: [
    {
      name: "attentive_ack",
      expression: "neutral",
      intensity: 0.15,
      durationMs: 250,
      attackSpeed: 0.5,
      releaseSpeed: 0.4,
      weight: 4,
      headOffset: { nod: 0.02 },
    },
    {
      name: "interest_spike",
      expression: "curiosity",
      intensity: 0.25,
      durationMs: 500,
      attackSpeed: 0.3,
      releaseSpeed: 0.25,
      weight: 2,
      headOffset: { tilt: 0.02 },
    },
    {
      name: "engagement_flash",
      expression: "excitement",
      intensity: 0.2,
      durationMs: 400,
      attackSpeed: 0.4,
      releaseSpeed: 0.3,
      weight: 1,
    },
  ],

  // Transitions between topics
  transitioning: [
    {
      name: "thoughtful_pause",
      expression: "contemplation",
      intensity: 0.3,
      durationMs: 700,
      attackSpeed: 0.2,
      releaseSpeed: 0.2,
      weight: 3,
      headOffset: { nod: 0.05 },
    },
    {
      name: "processing_moment",
      expression: "neutral",
      intensity: 0.1,
      durationMs: 400,
      attackSpeed: 0.3,
      releaseSpeed: 0.3,
      weight: 2,
      headOffset: { tilt: 0.015 },
    },
  ],
};

// ============================================
// MICRO-EXPRESSION ENGINE
// ============================================

export class MicroExpressionEngine {
  private state: MicroExpressionState = {
    isActive: false,
    expression: null,
    startTime: 0,
    progress: 0,
    currentIntensity: 0,
  };

  private lastTriggerTime = 0;
  private minIntervalMs = 2000;
  private contextWeights: Map<string, number> = new Map();

  /**
   * Trigger a micro-expression based on context and base emotion probability.
   * Returns true if a micro-expression was triggered.
   */
  trigger(
    context: string,
    baseEmotion: string,
    currentTime: number,
    overrideProb?: number
  ): boolean {
    // Check minimum interval
    if (currentTime - this.lastTriggerTime < this.minIntervalMs) {
      return false;
    }

    // Don't interrupt existing micro-expression
    if (this.state.isActive) {
      return false;
    }

    // Get context-appropriate expressions
    const expressions = MICRO_EXPRESSIONS[context] || MICRO_EXPRESSIONS.general;

    // Calculate trigger probability
    const emotionMod = this.getEmotionMicroProb(baseEmotion);
    const contextWeight = this.contextWeights.get(context) || 1;
    const triggerProb = overrideProb ?? emotionMod * contextWeight;

    if (Math.random() > triggerProb) {
      return false;
    }

    // Select weighted random expression
    const selected = this.selectWeighted(expressions);
    if (!selected) return false;

    // Start the micro-expression
    this.state = {
      isActive: true,
      expression: selected,
      startTime: currentTime,
      progress: 0,
      currentIntensity: 0,
    };
    this.lastTriggerTime = currentTime;

    return true;
  }

  /**
   * Update and get current micro-expression values.
   * Call this every frame. Returns current expression blend values.
   */
  tick(currentTime: number): {
    expression: string | null;
    intensity: number;
    headTilt: number;
    headNod: number;
    headTurn: number;
    eyeWiden: number;
    blinkMultiplier: number;
    isComplete: boolean;
  } {
    if (!this.state.isActive || !this.state.expression) {
      return {
        expression: null,
        intensity: 0,
        headTilt: 0,
        headNod: 0,
        headTurn: 0,
        eyeWiden: 0,
        blinkMultiplier: 1,
        isComplete: true,
      };
    }

    const elapsed = currentTime - this.state.startTime;
    const duration = this.state.expression.durationMs;
    const rawProgress = Math.min(elapsed / duration, 1);

    // Apply attack/release curve
    let intensity = 0;
    if (rawProgress < 0.5) {
      // Attack phase
      const attackProgress = rawProgress * 2;
      intensity = Math.pow(attackProgress, 1 / this.state.expression.attackSpeed);
    } else {
      // Release phase
      const releaseProgress = (rawProgress - 0.5) * 2;
      intensity = Math.pow(1 - releaseProgress, 1 / this.state.expression.releaseSpeed);
    }

    intensity *= this.state.expression.intensity;

    // Check completion
    if (rawProgress >= 1) {
      this.state.isActive = false;
      this.state.expression = null;
    } else {
      this.state.progress = rawProgress;
      this.state.currentIntensity = intensity;
    }

    const headOffset = this.state.expression?.headOffset;
    const eyeModifier = this.state.expression?.eyeModifier;

    return {
      expression: this.state.expression?.expression || null,
      intensity,
      headTilt: (headOffset?.tilt || 0) * intensity,
      headNod: (headOffset?.nod || 0) * intensity,
      headTurn: (headOffset?.turn || 0) * intensity,
      eyeWiden: (eyeModifier?.widen || 0) * intensity,
      blinkMultiplier: eyeModifier?.blinkRate || 1,
      isComplete: rawProgress >= 1,
    };
  }

  /**
   * Force trigger a specific micro-expression immediately.
   */
  forceTrigger(expression: MicroExpression, currentTime: number): void {
    this.state = {
      isActive: true,
      expression,
      startTime: currentTime,
      progress: 0,
      currentIntensity: 0,
    };
    this.lastTriggerTime = currentTime;
  }

  /**
   * Set context weight multiplier (default 1).
   */
  setContextWeight(context: string, weight: number): void {
    this.contextWeights.set(context, weight);
  }

  /**
   * Set minimum interval between micro-expressions (default 2000ms).
   */
  setMinInterval(ms: number): void {
    this.minIntervalMs = ms;
  }

  /**
   * Reset all state.
   */
  reset(): void {
    this.state = {
      isActive: false,
      expression: null,
      startTime: 0,
      progress: 0,
      currentIntensity: 0,
    };
    this.lastTriggerTime = 0;
  }

  private getEmotionMicroProb(emotion: string): number {
    // Base probabilities from emotion modulators
    const probs: Record<string, number> = {
      neutral: 0.1,
      happy: 0.15,
      sad: 0.05,
      angry: 0.2,
      relaxed: 0.08,
      surprised: 0.25,
      curiosity: 0.18,
      concern: 0.12,
      confusion: 0.22,
      disgust: 0.15,
      fear: 0.3,
      embarrassment: 0.2,
      excitement: 0.25,
      empathy: 0.1,
      contemplation: 0.08,
      determination: 0.12,
    };
    return probs[emotion] || 0.1;
  }

  private selectWeighted(expressions: MicroExpression[]): MicroExpression | null {
    const totalWeight = expressions.reduce((sum, e) => sum + e.weight, 0);
    let random = Math.random() * totalWeight;

    for (const expr of expressions) {
      random -= expr.weight;
      if (random <= 0) {
        return expr;
      }
    }

    return expressions[expressions.length - 1] || null;
  }
}

// ============================================
// CONVENIENCE
// ============================================

/** Create a new micro-expression engine instance. */
export function createMicroExpressionEngine(): MicroExpressionEngine {
  return new MicroExpressionEngine();
}

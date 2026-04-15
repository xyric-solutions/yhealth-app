/**
 * @file Avatar Smoothing Utilities
 * @description Pure math helpers for lip-sync and expression animation.
 */

/** Linear interpolation: move from `a` toward `b` by factor `t` (0-1). */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Clamp value between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Asymmetric attack/release smoother.
 * When target > current, use attackSpeed (fast rise — mouth opens quickly).
 * When target < current, use releaseSpeed (slow fall — mouth closes smoothly).
 */
export function attackRelease(
  current: number,
  target: number,
  attackSpeed: number,
  releaseSpeed: number
): number {
  const speed = target > current ? attackSpeed : releaseSpeed;
  return lerp(current, target, speed);
}

/**
 * Compute RMS (root mean square) from a Uint8Array of time-domain data.
 * AnalyserNode byte data is unsigned 0-255, centered at 128.
 * Returns normalized value 0..1.
 */
export function computeRMS(data: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const normalized = (data[i] - 128) / 128; // Convert to -1..1
    sum += normalized * normalized;
  }
  return Math.sqrt(sum / data.length);
}

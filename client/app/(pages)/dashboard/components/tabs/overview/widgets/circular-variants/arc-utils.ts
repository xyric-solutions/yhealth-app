/**
 * SVG math utilities for circular progress variants.
 * All functions assume a 200×200 viewBox centered at (100, 100).
 */

/** Convert degrees → radians */
export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Convert polar coords to cartesian (SVG coordinate system) */
export function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number
): { x: number; y: number } {
  const rad = degToRad(angleDeg);
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

/**
 * Generate an SVG arc path `d` string.
 * Angles are in degrees, 0° = 3 o'clock, going clockwise.
 * Typically pass startDeg - 90 to start from 12 o'clock.
 */
export function describeArc(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number
): string {
  const start = polarToCartesian(cx, cy, r, endDeg);
  const end = polarToCartesian(cx, cy, r, startDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

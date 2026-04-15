/**
 * @file Joint angle calculation utility
 * @description Computes the angle at a vertex given three 2D points using atan2.
 */

interface Point {
  x: number;
  y: number;
}

/**
 * Calculate the angle at vertex B given three points A-B-C using atan2.
 * Returns degrees in the range 0-180.
 *
 * @param a - First point (e.g. shoulder)
 * @param b - Vertex point where the angle is measured (e.g. elbow)
 * @param c - Third point (e.g. wrist)
 * @returns Angle in degrees, rounded to the nearest integer
 */
export function calcAngle(a: Point, b: Point, c: Point): number {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180) angle = 360 - angle;
  return Math.round(angle);
}

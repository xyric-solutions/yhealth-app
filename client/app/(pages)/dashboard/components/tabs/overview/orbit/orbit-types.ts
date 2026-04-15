/** Wellness Orbit Dashboard — shared types */

export interface OrbitNodeData {
  id: string;
  label: string;
  icon: string; // lucide icon name
  value: string | number;
  unit?: string;
  subtitle?: string;
  color: string; // hex — primary accent
  colorEnd?: string; // hex — gradient end
  /** 0–1 completion / health ratio for the ring fill */
  progress?: number;
  /** Route to navigate on click */
  href?: string;
}

export interface OrbitEdgeData {
  from: string;
  to: string;
  label?: string;
  strength?: number; // 0–1 visual weight
}

export interface OrbitConfig {
  /** Radius multiplier (1 = default, 0.7 = mobile) */
  radiusScale: number;
  /** Node size in px */
  nodeSize: number;
  /** Enable slow orbital rotation */
  rotate: boolean;
  /** Animation speed multiplier */
  speed: number;
}

/** Position on the SVG canvas */
export interface Point {
  x: number;
  y: number;
}

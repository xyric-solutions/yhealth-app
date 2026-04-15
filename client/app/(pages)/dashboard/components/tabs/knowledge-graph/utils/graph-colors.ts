/**
 * @file Graph Colors
 * @description Color utilities for the knowledge graph
 */

import type { GraphNodeCategory, EdgeCategory } from '@shared/types/domain/knowledge-graph';
import { CATEGORY_COLORS, EDGE_CATEGORY_COLORS } from '../constants/graph-config';

/**
 * Get the CSS color for a node category
 */
export function getCategoryColor(category: GraphNodeCategory): string {
  return CATEGORY_COLORS[category] || '#94A3B8';
}

/**
 * Get edge color based on category
 */
export function getEdgeCategoryColor(category: EdgeCategory): string {
  return EDGE_CATEGORY_COLORS[category] || '#94A3B8';
}

/**
 * Lighten a hex color for hover/selected states
 */
export function lightenColor(hex: string, amount: number = 0.3): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const newR = Math.min(255, Math.round(r + (255 - r) * amount));
  const newG = Math.min(255, Math.round(g + (255 - g) * amount));
  const newB = Math.min(255, Math.round(b + (255 - b) * amount));

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

/**
 * Dim a hex color for inactive/faded states
 */
export function dimColor(hex: string, amount: number = 0.5): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const newR = Math.round(r * amount);
  const newG = Math.round(g * amount);
  const newB = Math.round(b * amount);

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

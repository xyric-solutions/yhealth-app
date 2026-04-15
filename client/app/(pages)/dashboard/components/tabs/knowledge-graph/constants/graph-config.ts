import type { GraphNodeCategory, EdgeCategory } from '@shared/types/domain/knowledge-graph';

/** Vibrant category colors (reference: D3 knowledge graph palette) */
export const CATEGORY_COLORS: Record<GraphNodeCategory, string> = {
  fitness: '#FF006E',
  nutrition: '#06D6A0',
  hydration: '#3A86FF',
  wellbeing: '#8338EC',
  biometrics: '#118AB2',
  goals: '#FFBE0B',
  intelligence: '#FB5607',
  coaching: '#F72585',
  finance: '#06D6A0',
};

export const CATEGORY_LABELS: Record<GraphNodeCategory, string> = {
  fitness: 'Fitness',
  nutrition: 'Nutrition',
  hydration: 'Hydration',
  wellbeing: 'Wellbeing',
  biometrics: 'Biometrics',
  goals: 'Goals',
  intelligence: 'Intelligence',
  coaching: 'Coaching',
  finance: 'Finance',
};

export const EDGE_CATEGORY_COLORS: Record<EdgeCategory, string> = {
  temporal: '#475569',
  hierarchical: '#475569',
  causal: '#F59E0B',
  correlation: '#818CF8',
  semantic: '#C084FC',
};

export const DEFAULT_MAX_NODES = 300;
export const DEFAULT_GRAPH_STALE_TIME = 5 * 60 * 1000;
export const DEFAULT_GRAPH_GC_TIME = 30 * 60 * 1000;

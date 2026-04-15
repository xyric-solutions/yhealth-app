import { z } from 'zod';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const graphNodeCategoryEnum = z.enum([
  'fitness', 'nutrition', 'hydration', 'wellbeing', 'biometrics',
  'goals', 'intelligence', 'coaching', 'finance',
]);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const edgeCategoryEnum = z.enum([
  'temporal', 'hierarchical', 'causal', 'correlation', 'semantic',
]);

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const getGraphSchema = z.object({
  from: z.string().regex(dateRegex, 'Use YYYY-MM-DD format'),
  to: z.string().regex(dateRegex, 'Use YYYY-MM-DD format'),
  categories: z.string().optional().transform((val) =>
    val ? val.split(',').filter(Boolean) as z.infer<typeof graphNodeCategoryEnum>[] : undefined
  ),
  edgeCategories: z.string().optional().transform((val) =>
    val ? val.split(',').filter(Boolean) as z.infer<typeof edgeCategoryEnum>[] : undefined
  ),
  minEdgeStrength: z.string().optional().transform((val) =>
    val ? parseFloat(val) : undefined
  ),
  focusNodeId: z.string().uuid().optional(),
  focusDepth: z.string().optional().transform((val) =>
    val ? Math.min(3, Math.max(1, parseInt(val))) : undefined
  ),
  searchQuery: z.string().max(200).optional(),
  maxNodes: z.string().optional().transform((val) =>
    val ? Math.min(500, Math.max(10, parseInt(val))) : 200
  ),
  includeAI: z.string().optional().transform((val) => val === 'true'),
});

export const searchNodesSchema = z.object({
  query: z.string().min(1).max(200),
  from: z.string().regex(dateRegex).optional(),
  to: z.string().regex(dateRegex).optional(),
});

export const explainGraphSchema = z.object({
  graphSummary: z.object({
    totalNodes: z.number(),
    totalEdges: z.number(),
    nodeCountByCategory: z.record(z.number()).optional(),
    dateRange: z.object({
      from: z.string(),
      to: z.string(),
    }),
  }),
});

export const exportGraphSchema = z.object({
  format: z.enum(['json', 'csv']),
  from: z.string().regex(dateRegex),
  to: z.string().regex(dateRegex),
});

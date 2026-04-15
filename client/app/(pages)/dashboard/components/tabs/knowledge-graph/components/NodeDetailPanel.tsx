'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink } from 'lucide-react';
import type { GraphNode, GraphEdge } from '@shared/types/domain/knowledge-graph';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../constants/graph-config';

interface NodeDetailPanelProps {
  node: GraphNode | null;
  edges: GraphEdge[];
  onClose: () => void;
}

function DetailRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex justify-between items-start py-1.5 border-b border-white/5 last:border-0">
      <span className="text-xs text-slate-400 shrink-0 mr-2">{label}</span>
      <span className="text-xs text-white text-right">{value}</span>
    </div>
  );
}

function getNodeFields(node: GraphNode): Array<{ label: string; value: string | number | null | undefined }> {
  const d = node.data as Record<string, unknown>;

  switch (node.type) {
    case 'workout_session':
      return [
        { label: 'Duration', value: d.durationMinutes ? `${d.durationMinutes} min` : null },
        { label: 'Volume', value: d.totalVolume as number },
        { label: 'Difficulty', value: d.difficultyRating as number },
        { label: 'Energy', value: d.energyLevel as number },
        { label: 'Mood After', value: d.moodAfter as number },
        { label: 'XP', value: d.xpEarned as number },
        { label: 'Status', value: d.status as string },
      ];
    case 'meal':
      return [
        { label: 'Type', value: d.mealType as string },
        { label: 'Calories', value: d.calories ? `${d.calories} kcal` : null },
        { label: 'Protein', value: d.proteinGrams ? `${d.proteinGrams}g` : null },
        { label: 'Carbs', value: d.carbsGrams ? `${d.carbsGrams}g` : null },
        { label: 'Fat', value: d.fatGrams ? `${d.fatGrams}g` : null },
        { label: 'Health Score', value: d.healthScore as number },
      ];
    case 'mood_entry':
      return [
        { label: 'Emoji', value: d.moodEmoji as string },
        { label: 'Happiness', value: d.happinessRating ? `${d.happinessRating}/10` : null },
        { label: 'Energy', value: d.energyRating ? `${d.energyRating}/10` : null },
        { label: 'Stress', value: d.stressRating ? `${d.stressRating}/10` : null },
        { label: 'Anxiety', value: d.anxietyRating ? `${d.anxietyRating}/10` : null },
      ];
    case 'daily_score':
      return [
        { label: 'Total Score', value: d.totalScore as number },
        ...(d.componentScores
          ? Object.entries(d.componentScores as Record<string, number>).map(([k, v]) => ({
              label: k.charAt(0).toUpperCase() + k.slice(1),
              value: Math.round(v),
            }))
          : []),
      ];
    case 'sleep_session':
      return [
        { label: 'Hours', value: d.sleepHours ? `${(d.sleepHours as number).toFixed(1)}h` : null },
        { label: 'Provider', value: d.provider as string },
      ];
    case 'recovery_score':
      return [
        { label: 'Recovery', value: `${d.recoveryScore}%` },
      ];
    case 'strain_score':
      return [
        { label: 'Strain', value: d.strainScore as number },
      ];
    case 'contradiction':
      return [
        { label: 'Pillar A', value: d.pillarA as string },
        { label: 'Pillar B', value: d.pillarB as string },
        { label: 'Severity', value: d.severity as string },
        { label: 'Status', value: d.status as string },
      ];
    case 'health_goal':
    case 'life_goal':
      return [
        { label: 'Category', value: d.category as string },
        { label: 'Progress', value: d.progress ? `${d.progress}%` : null },
        { label: 'Status', value: d.status as string },
      ];
    case 'journal_entry':
      return [
        { label: 'Category', value: d.promptCategory as string },
        { label: 'Words', value: d.wordCount as number },
        { label: 'Sentiment', value: d.sentimentLabel as string },
      ];
    case 'stress_log':
      return [
        { label: 'Rating', value: `${d.stressRating}/10` },
        { label: 'Score', value: d.finalStressScore as number },
      ];
    default:
      return Object.entries(d)
        .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
        .slice(0, 6)
        .map(([k, v]) => ({
          label: k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
          value: String(v),
        }));
  }
}

export function NodeDetailPanel({ node, edges, onClose }: NodeDetailPanelProps) {
  const fields = useMemo(() => (node ? getNodeFields(node) : []), [node]);

  const connectedEdges = useMemo(() => {
    if (!node) return [];
    return edges.filter((e) => e.sourceNodeId === node.id || e.targetNodeId === node.id).slice(0, 10);
  }, [node, edges]);

  return (
    <AnimatePresence>
      {node && (
        <motion.div
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 300, opacity: 0 }}
          transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
          className="w-80 h-full bg-slate-800/90 border-l border-white/10 backdrop-blur-xl overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 bg-slate-800/95 backdrop-blur-sm z-10 p-4 border-b border-white/5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: CATEGORY_COLORS[node.category] }}
                />
                <h3 className="text-sm font-semibold text-white truncate">{node.label}</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-slate-300">
                {CATEGORY_LABELS[node.category]}
              </span>
              <span className="text-xs text-slate-500">{node.date}</span>
            </div>
          </div>

          {/* Details */}
          <div className="p-4 space-y-4">
            {/* Fields */}
            <div>
              <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Details</h4>
              <div className="bg-white/5 rounded-lg p-3">
                {fields.map((f, i) => (
                  <DetailRow key={i} label={f.label} value={f.value} />
                ))}
                {fields.length === 0 && (
                  <p className="text-xs text-slate-500">No details available</p>
                )}
              </div>
            </div>

            {/* Connected Edges */}
            {connectedEdges.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                  Connections ({connectedEdges.length})
                </h4>
                <div className="space-y-1.5">
                  {connectedEdges.map((edge) => (
                    <div
                      key={edge.id}
                      className="flex items-center gap-2 text-xs text-slate-300 bg-white/5 rounded-md px-2.5 py-1.5"
                    >
                      <div
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: edge.visual.color }}
                      />
                      <span className="truncate">
                        {edge.label || edge.type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-slate-500 ml-auto shrink-0">
                        {Math.round(edge.strength * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

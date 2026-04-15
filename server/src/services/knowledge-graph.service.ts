/**
 * @file Knowledge Graph Service
 * @description READ-ONLY aggregator that builds a knowledge graph from existing
 * database tables. Fetches nodes from 31 data sources in parallel, computes edges
 * deterministically in memory, and returns the assembled graph with visual encoding.
 *
 * This service does NOT write data — it is a pure read-side projection.
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import type {
  GraphNode,
  GraphNodeType,
  GraphNodeCategory,
  GraphEdge,
  EdgeCategory,
  EdgeType,
  GraphFilter,
  GraphDateRange,
  GraphStats,
  KnowledgeGraphData,
  NodeVisualEncoding,
  EdgeVisualEncoding,
} from '@shared/types/domain/knowledge-graph.js';
import { NODE_CATEGORY_COLORS } from '@shared/types/domain/knowledge-graph.js';

// ============================================
// VISUAL ENCODING HELPERS
// ============================================

function computeVisual(
  category: GraphNodeCategory,
  size: number,
  glowing = false,
): NodeVisualEncoding {
  return {
    color: NODE_CATEGORY_COLORS[category],
    size: Math.max(4, Math.min(20, size)),
    opacity: 1.0,
    glowing,
  };
}

const EDGE_COLOR_MAP: Record<EdgeCategory, string> = {
  temporal: '#94A3B8',
  hierarchical: '#64748B',
  causal: '#F59E0B',
  correlation: '#818CF8',
  semantic: '#C084FC',
};

function computeEdgeVisual(
  category: EdgeCategory,
  strength: number,
): EdgeVisualEncoding {
  return {
    color: EDGE_COLOR_MAP[category],
    thickness: 1 + strength * 3,
    dashPattern:
      category === 'correlation'
        ? 'dashed'
        : category === 'semantic'
          ? 'dotted'
          : 'solid',
    animated: category === 'causal',
    opacity: 0.6 + strength * 0.4,
  };
}

// ============================================
// SCALING HELPERS
// ============================================

/**
 * Linear scale: map a value from [min, max] → [outMin, outMax], clamped.
 */
function linearScale(
  value: number,
  min: number,
  max: number,
  outMin: number,
  outMax: number,
): number {
  if (max === min) return (outMin + outMax) / 2;
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return outMin + t * (outMax - outMin);
}

// ============================================
// NODE FETCHER TYPE
// ============================================

type NodeFetcher = (
  userId: string,
  from: string,
  to: string,
) => Promise<GraphNode[]>;

// ============================================
// CATEGORY → FETCHER MAPPING
// ============================================

/**
 * Maps GraphNodeCategory values to the fetcher keys they cover.
 * Used to filter which fetchers to run when `filter.categories` is provided.
 */
const CATEGORY_FETCHER_MAP: Record<GraphNodeCategory, string[]> = {
  fitness: ['workouts', 'yogaSessions', 'activityLogs'],
  nutrition: ['meals', 'nutritionPatterns'],
  hydration: ['water'],
  wellbeing: ['mood', 'stress', 'energy', 'journal', 'habits', 'dailyCheckins', 'breathingTests', 'meditationTimers', 'emotionLogs', 'dailyIntentions', 'emotionalCheckins', 'schedules'],
  biometrics: ['biometrics', 'whoopHealthData', 'progressRecords'],
  goals: ['healthGoals', 'lifeGoals', 'achievements'],
  intelligence: ['dailyScores', 'contradictions', 'correlations', 'weeklyReports'],
  coaching: ['voiceCalls', 'voiceJournalSessions', 'chatHistory'],
  finance: ['financeTransactions'],
};

// ============================================
// SERVICE
// ============================================

class KnowledgeGraphService {
  // ------------------------------------------
  // NODE FETCHERS
  // ------------------------------------------

  /**
   * Fetch workout session nodes from workout_logs.
   */
  private fetchWorkouts: NodeFetcher = async (userId, from, to) => {
    const result = await query(
      `SELECT id, workout_plan_id, workout_name, scheduled_date,
              duration_minutes, status, total_volume,
              difficulty_rating, energy_level, mood_after, xp_earned
       FROM workout_logs
       WHERE user_id = $1 AND scheduled_date BETWEEN $2 AND $3
       ORDER BY scheduled_date DESC`,
      [userId, from, to],
    );

    return result.rows.map((r) => {
      const duration = r.duration_minutes ?? 30;
      const size = linearScale(duration, 30, 90, 6, 14);
      return {
        id: r.id,
        type: 'workout_session' as GraphNodeType,
        category: 'fitness' as GraphNodeCategory,
        label: r.workout_name || 'Workout',
        date: r.scheduled_date,
        timestamp: r.scheduled_date,
        data: {
          workoutName: r.workout_name,
          scheduledDate: r.scheduled_date,
          durationMinutes: r.duration_minutes,
          status: r.status,
          totalVolume: r.total_volume ?? 0,
          difficultyRating: r.difficulty_rating,
          energyLevel: r.energy_level,
          moodAfter: r.mood_after,
          xpEarned: r.xp_earned ?? 0,
          planId: r.workout_plan_id ?? undefined,
        },
        visual: computeVisual('fitness', size),
        sourceTable: 'workout_logs',
      } as GraphNode;
    });
  };

  /**
   * Fetch meal nodes from meal_logs.
   */
  private fetchMeals: NodeFetcher = async (userId, from, to) => {
    const result = await query(
      `SELECT id, diet_plan_id, meal_type, meal_name, calories,
              protein_grams, carbs_grams, fat_grams, health_score, eaten_at
       FROM meal_logs
       WHERE user_id = $1 AND eaten_at::date BETWEEN $2 AND $3
       ORDER BY eaten_at DESC`,
      [userId, from, to],
    );

    return result.rows.map((r) => {
      const cals = r.calories ?? 400;
      const size = linearScale(cals, 200, 800, 6, 14);
      return {
        id: r.id,
        type: 'meal' as GraphNodeType,
        category: 'nutrition' as GraphNodeCategory,
        label: r.meal_name || r.meal_type || 'Meal',
        date: r.eaten_at?.toString().slice(0, 10) ?? '',
        timestamp: r.eaten_at?.toISOString?.() ?? r.eaten_at ?? '',
        data: {
          mealType: r.meal_type,
          mealName: r.meal_name,
          calories: r.calories,
          proteinGrams: r.protein_grams,
          carbsGrams: r.carbs_grams,
          fatGrams: r.fat_grams,
          healthScore: r.health_score,
          eatenAt: r.eaten_at,
          dietPlanId: r.diet_plan_id ?? undefined,
        },
        visual: computeVisual('nutrition', size),
        sourceTable: 'meal_logs',
      } as GraphNode;
    });
  };

  /**
   * Fetch mood entry nodes from mood_logs.
   */
  private fetchMood: NodeFetcher = async (userId, from, to) => {
    const result = await query(
      `SELECT id, mood_emoji, mode, happiness_rating, energy_rating,
              stress_rating, anxiety_rating, emotion_tags, logged_at
       FROM mood_logs
       WHERE user_id = $1 AND logged_at::date BETWEEN $2 AND $3
       ORDER BY logged_at DESC`,
      [userId, from, to],
    );

    return result.rows.map((r) => {
      const ratings = [
        r.happiness_rating,
        r.energy_rating,
        r.stress_rating,
        r.anxiety_rating,
      ].filter((v): v is number => v != null);
      const avg = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 5;
      const size = linearScale(avg, 1, 10, 6, 14);

      return {
        id: r.id,
        type: 'mood_entry' as GraphNodeType,
        category: 'wellbeing' as GraphNodeCategory,
        label: r.mood_emoji || 'Mood',
        date: r.logged_at?.toString().slice(0, 10) ?? '',
        timestamp: r.logged_at ?? '',
        data: {
          moodEmoji: r.mood_emoji,
          mode: r.mode,
          happinessRating: r.happiness_rating,
          energyRating: r.energy_rating,
          stressRating: r.stress_rating,
          anxietyRating: r.anxiety_rating,
          emotionTags: r.emotion_tags ?? [],
          loggedAt: r.logged_at,
        },
        visual: computeVisual('wellbeing', size),
        sourceTable: 'mood_logs',
      } as GraphNode;
    });
  };

  /**
   * Fetch stress log nodes from stress_logs.
   */
  private fetchStress: NodeFetcher = async (userId, from, to) => {
    const result = await query(
      `SELECT id, stress_rating, triggers, final_stress_score,
              check_in_type, logged_at
       FROM stress_logs
       WHERE user_id = $1 AND logged_at::date BETWEEN $2 AND $3
       ORDER BY logged_at DESC`,
      [userId, from, to],
    );

    return result.rows.map((r) => {
      const size = linearScale(r.stress_rating, 1, 10, 6, 14);
      return {
        id: r.id,
        type: 'stress_log' as GraphNodeType,
        category: 'wellbeing' as GraphNodeCategory,
        label: `Stress ${r.stress_rating}`,
        date: r.logged_at?.toString().slice(0, 10) ?? '',
        timestamp: r.logged_at ?? '',
        data: {
          stressRating: r.stress_rating,
          triggers: r.triggers ?? [],
          finalStressScore: r.final_stress_score,
          checkInType: r.check_in_type,
          loggedAt: r.logged_at,
        },
        visual: computeVisual('wellbeing', size),
        sourceTable: 'stress_logs',
      } as GraphNode;
    });
  };

  /**
   * Fetch energy log nodes from energy_logs.
   */
  private fetchEnergy: NodeFetcher = async (userId, from, to) => {
    const result = await query(
      `SELECT id, energy_rating, context_tag, logged_at
       FROM energy_logs
       WHERE user_id = $1 AND logged_at::date BETWEEN $2 AND $3
       ORDER BY logged_at DESC`,
      [userId, from, to],
    );

    return result.rows.map((r) => {
      const size = linearScale(r.energy_rating, 1, 10, 6, 14);
      return {
        id: r.id,
        type: 'energy_log' as GraphNodeType,
        category: 'wellbeing' as GraphNodeCategory,
        label: `Energy ${r.energy_rating}`,
        date: r.logged_at?.toString().slice(0, 10) ?? '',
        timestamp: r.logged_at ?? '',
        data: {
          energyRating: r.energy_rating,
          contextTag: r.context_tag,
          loggedAt: r.logged_at,
        },
        visual: computeVisual('wellbeing', size),
        sourceTable: 'energy_logs',
      } as GraphNode;
    });
  };

  /**
   * Fetch journal entry nodes from journal_entries.
   */
  private fetchJournal: NodeFetcher = async (userId, from, to) => {
    const result = await query(
      `SELECT id, prompt_category, word_count, sentiment_score,
              sentiment_label, mode, logged_at
       FROM journal_entries
       WHERE user_id = $1 AND logged_at::date BETWEEN $2 AND $3
       ORDER BY logged_at DESC`,
      [userId, from, to],
    );

    return result.rows.map((r) => {
      const wc = r.word_count ?? 50;
      const size = linearScale(wc, 20, 500, 6, 14);
      return {
        id: r.id,
        type: 'journal_entry' as GraphNodeType,
        category: 'wellbeing' as GraphNodeCategory,
        label: r.prompt_category || 'Journal',
        date: r.logged_at?.toString().slice(0, 10) ?? '',
        timestamp: r.logged_at ?? '',
        data: {
          promptCategory: r.prompt_category,
          wordCount: r.word_count ?? 0,
          sentimentScore: r.sentiment_score,
          sentimentLabel: r.sentiment_label,
          mode: r.mode,
          loggedAt: r.logged_at,
        },
        visual: computeVisual('wellbeing', size),
        sourceTable: 'journal_entries',
      } as GraphNode;
    });
  };

  /**
   * Fetch habit completion nodes from habit_logs + habits.
   */
  private fetchHabits: NodeFetcher = async (userId, from, to) => {
    const result = await query(
      `SELECT hl.id, h.habit_name, hl.completed, hl.value,
              hl.log_date, h.category
       FROM habit_logs hl
       JOIN habits h ON hl.habit_id = h.id
       WHERE hl.user_id = $1 AND hl.log_date BETWEEN $2 AND $3
       ORDER BY hl.log_date DESC`,
      [userId, from, to],
    );

    return result.rows.map((r) => ({
      id: r.id,
      type: 'habit_completion' as GraphNodeType,
      category: 'wellbeing' as GraphNodeCategory,
      label: r.habit_name || 'Habit',
      date: r.log_date,
      timestamp: r.log_date,
      data: {
        habitName: r.habit_name,
        completed: r.completed,
        value: r.value,
        logDate: r.log_date,
        category: r.category,
      },
      visual: computeVisual('wellbeing', 6),
      sourceTable: 'habit_logs',
    })) as GraphNode[];
  };

  /**
   * Fetch biometric nodes from daily_health_metrics.
   * Creates up to 3 nodes per row: sleep_session, recovery_score, strain_score.
   */
  private fetchBiometrics: NodeFetcher = async (userId, from, to) => {
    const result = await query(
      `SELECT id, metric_date, sleep_hours, recovery_score, strain_score, provider
       FROM daily_health_metrics
       WHERE user_id = $1 AND metric_date BETWEEN $2 AND $3
       ORDER BY metric_date DESC`,
      [userId, from, to],
    );

    const nodes: GraphNode[] = [];

    for (const r of result.rows) {
      const sleepVal = r.sleep_hours != null ? parseFloat(String(r.sleep_hours)) : NaN;
      if (!isNaN(sleepVal) && sleepVal > 0) {
        const size = linearScale(sleepVal, 4, 10, 6, 14);
        nodes.push({
          id: `${r.id}-sleep`,
          type: 'sleep_session',
          category: 'biometrics',
          label: `Sleep ${sleepVal.toFixed(1)}h`,
          date: String(r.metric_date).slice(0, 10),
          timestamp: String(r.metric_date).slice(0, 10),
          data: {
            sleepHours: sleepVal,
            metricDate: r.metric_date,
            provider: r.provider ?? 'whoop',
          },
          visual: computeVisual('biometrics', size),
          sourceTable: 'daily_health_metrics',
        } as GraphNode);
      }

      const recoveryVal = r.recovery_score != null ? parseFloat(String(r.recovery_score)) : NaN;
      if (!isNaN(recoveryVal)) {
        const size = linearScale(recoveryVal, 0, 100, 6, 14);
        nodes.push({
          id: `${r.id}-recovery`,
          type: 'recovery_score',
          category: 'biometrics',
          label: `Recovery ${Math.round(recoveryVal)}%`,
          date: String(r.metric_date).slice(0, 10),
          timestamp: String(r.metric_date).slice(0, 10),
          data: {
            recoveryScore: recoveryVal,
            metricDate: String(r.metric_date).slice(0, 10),
          },
          visual: computeVisual('biometrics', size),
          sourceTable: 'daily_health_metrics',
        } as GraphNode);
      }

      const strainVal = r.strain_score != null ? parseFloat(String(r.strain_score)) : NaN;
      if (!isNaN(strainVal)) {
        const size = linearScale(strainVal, 0, 21, 6, 14);
        nodes.push({
          id: `${r.id}-strain`,
          type: 'strain_score',
          category: 'biometrics',
          label: `Strain ${strainVal.toFixed(1)}`,
          date: String(r.metric_date).slice(0, 10),
          timestamp: String(r.metric_date).slice(0, 10),
          data: {
            strainScore: strainVal,
            metricDate: String(r.metric_date).slice(0, 10),
          },
          visual: computeVisual('biometrics', size),
          sourceTable: 'daily_health_metrics',
        } as GraphNode);
      }
    }

    return nodes;
  };

  /**
   * Fetch daily score hub nodes from daily_user_scores.
   */
  private fetchDailyScores: NodeFetcher = async (userId, from, to) => {
    const result = await query(
      `SELECT id, date, total_score, component_scores, explanation
       FROM daily_user_scores
       WHERE user_id = $1 AND date BETWEEN $2 AND $3
       ORDER BY date DESC`,
      [userId, from, to],
    );

    return result.rows.map((r) => ({
      id: r.id,
      type: 'daily_score' as GraphNodeType,
      category: 'intelligence' as GraphNodeCategory,
      label: `Score ${Number(r.total_score).toFixed(0)}`,
      date: r.date,
      timestamp: r.date,
      data: {
        date: r.date,
        totalScore: Number(r.total_score),
        componentScores: r.component_scores ?? {},
        explanation: r.explanation,
      },
      visual: computeVisual('intelligence', 18),
      sourceTable: 'daily_user_scores',
    })) as GraphNode[];
  };

  /**
   * Fetch active health goal nodes from user_goals.
   * No date filter — only filtered by status.
   */
  private fetchHealthGoals: NodeFetcher = async (userId) => {
    const result = await query(
      `SELECT id, title, category, pillar, progress, status,
              target_date, confidence_level
       FROM user_goals
       WHERE user_id = $1 AND status IN ('active', 'in_progress')`,
      [userId],
    );

    return result.rows.map((r) => {
      const size = linearScale(r.progress ?? 0, 0, 100, 6, 14);
      return {
        id: r.id,
        type: 'health_goal' as GraphNodeType,
        category: 'goals' as GraphNodeCategory,
        label: r.title || 'Goal',
        date: r.target_date ?? '',
        timestamp: r.target_date ?? '',
        data: {
          title: r.title,
          category: r.category,
          pillar: r.pillar,
          progress: r.progress ?? 0,
          status: r.status,
          targetDate: r.target_date,
          confidenceLevel: r.confidence_level ?? 0,
        },
        visual: computeVisual('goals', size),
        sourceTable: 'user_goals',
      } as GraphNode;
    });
  };

  /**
   * Fetch active life goal nodes from life_goals.
   * No date filter — only filtered by status.
   */
  private fetchLifeGoals: NodeFetcher = async (userId) => {
    const result = await query(
      `SELECT id, title, category, progress, status,
              tracking_method, journal_mention_count
       FROM life_goals
       WHERE user_id = $1 AND status IN ('active', 'in_progress')`,
      [userId],
    );

    return result.rows.map((r) => {
      const size = linearScale(r.progress ?? 0, 0, 100, 6, 14);
      return {
        id: r.id,
        type: 'life_goal' as GraphNodeType,
        category: 'goals' as GraphNodeCategory,
        label: r.title || 'Life Goal',
        date: '',
        timestamp: '',
        data: {
          title: r.title,
          category: r.category,
          progress: r.progress ?? 0,
          status: r.status,
          trackingMethod: r.tracking_method,
          journalMentionCount: r.journal_mention_count ?? 0,
        },
        visual: computeVisual('goals', size),
        sourceTable: 'life_goals',
      } as GraphNode;
    });
  };

  /**
   * Fetch contradiction nodes from cross_pillar_contradictions.
   */
  private fetchContradictions: NodeFetcher = async (userId, from, to) => {
    const result = await query(
      `SELECT id, rule_id, pillar_a, pillar_b, severity, evidence,
              ai_correction, status, detected_at
       FROM cross_pillar_contradictions
       WHERE user_id = $1 AND detected_at::date BETWEEN $2 AND $3
       ORDER BY detected_at DESC`,
      [userId, from, to],
    );

    return result.rows.map((r) => {
      const severitySize: Record<string, number> = {
        low: 8,
        medium: 10,
        high: 12,
        critical: 16,
      };
      const size = severitySize[r.severity] ?? 10;
      return {
        id: r.id,
        type: 'contradiction' as GraphNodeType,
        category: 'intelligence' as GraphNodeCategory,
        label: `${r.pillar_a} vs ${r.pillar_b}`,
        date: r.detected_at?.toString().slice(0, 10) ?? '',
        timestamp: r.detected_at ?? '',
        data: {
          ruleId: r.rule_id,
          pillarA: r.pillar_a,
          pillarB: r.pillar_b,
          severity: r.severity,
          description: r.ai_correction || `${r.pillar_a} contradicts ${r.pillar_b}`,
          status: r.status,
          aiCorrection: r.ai_correction,
        },
        visual: computeVisual('intelligence', size, true),
        sourceTable: 'cross_pillar_contradictions',
      } as GraphNode;
    });
  };

  /**
   * Fetch correlation pattern nodes from journal_patterns.
   * No date filter — only active patterns with type 'correlation'.
   */
  private fetchCorrelations: NodeFetcher = async (userId) => {
    const result = await query(
      `SELECT id, pattern_type, pattern_description, correlation_strength,
              confidence, computed_at
       FROM journal_patterns
       WHERE user_id = $1 AND is_active = true
       ORDER BY computed_at DESC`,
      [userId],
    );

    return result.rows.map((r) => {
      const strength = Math.abs(r.correlation_strength ?? 0);
      const size = linearScale(strength, 0, 1, 6, 14);
      const label =
        r.pattern_description && r.pattern_description.length > 50
          ? r.pattern_description.slice(0, 47) + '...'
          : r.pattern_description || r.pattern_type;
      return {
        id: r.id,
        type: 'correlation' as GraphNodeType,
        category: 'intelligence' as GraphNodeCategory,
        label,
        date: r.computed_at?.toString().slice(0, 10) ?? '',
        timestamp: r.computed_at ?? '',
        data: {
          patternType: r.pattern_type,
          correlationStrength: r.correlation_strength,
          confidence: r.confidence,
          headline: r.pattern_description,
        },
        visual: computeVisual('intelligence', size),
        sourceTable: 'journal_patterns',
      } as GraphNode;
    });
  };

  /**
   * Fetch daily check-in nodes from daily_checkins.
   */
  private fetchDailyCheckins: NodeFetcher = async (userId, from, to) => {
    const result = await query(
      `SELECT id, checkin_date, mood_score, energy_score,
              sleep_quality, stress_score, tags
       FROM daily_checkins
       WHERE user_id = $1 AND checkin_date BETWEEN $2 AND $3
       ORDER BY checkin_date DESC`,
      [userId, from, to],
    );

    return result.rows.map((r) => ({
      id: r.id,
      type: 'daily_checkin' as GraphNodeType,
      category: 'wellbeing' as GraphNodeCategory,
      label: 'Daily Check-in',
      date: r.checkin_date,
      timestamp: r.checkin_date,
      data: {
        moodScore: r.mood_score,
        energyScore: r.energy_score,
        sleepQuality: r.sleep_quality,
        stressScore: r.stress_score,
        tags: r.tags ?? [],
      },
      visual: computeVisual('wellbeing', 8),
      sourceTable: 'daily_checkins',
    })) as GraphNode[];
  };

  /**
   * Fetch water intake nodes from water_intake_logs.
   */
  private fetchWater: NodeFetcher = async (userId, from, to) => {
    const result = await query(
      `SELECT id, log_date, glasses_consumed, target_glasses, goal_achieved
       FROM water_intake_logs
       WHERE user_id = $1 AND log_date BETWEEN $2 AND $3
       ORDER BY log_date DESC`,
      [userId, from, to],
    );

    return result.rows.map((r) => ({
      id: r.id,
      type: 'water_intake' as GraphNodeType,
      category: 'hydration' as GraphNodeCategory,
      label: `Water ${r.glasses_consumed ?? 0}/${r.target_glasses ?? 8}`,
      date: r.log_date,
      timestamp: r.log_date,
      data: {
        logDate: r.log_date,
        glassesConsumed: r.glasses_consumed ?? 0,
        targetGlasses: r.target_glasses ?? 8,
        goalAchieved: r.goal_achieved ?? false,
      },
      visual: computeVisual('hydration', 8),
      sourceTable: 'water_intake_logs',
    })) as GraphNode[];
  };

  /**
   * Fetch voice call nodes from voice_calls + call_summaries.
   */
  private fetchVoiceCalls: NodeFetcher = async (userId, from, to) => {
    const result = await query(
      `SELECT vc.id, vc.session_type, vc.call_duration, vc.created_at,
              cs.summary, cs.key_insights, cs.emotional_trend
       FROM voice_calls vc
       LEFT JOIN call_summaries cs ON cs.call_id = vc.id
       WHERE vc.user_id = $1 AND vc.created_at::date BETWEEN $2 AND $3
       ORDER BY vc.created_at DESC`,
      [userId, from, to],
    );

    return result.rows.map((r) => {
      const dur = r.call_duration ?? 0;
      const size = linearScale(dur, 60, 1800, 6, 14);
      return {
        id: r.id,
        type: 'voice_call' as GraphNodeType,
        category: 'coaching' as GraphNodeCategory,
        label: 'Voice Call',
        date: r.created_at?.toString().slice(0, 10) ?? '',
        timestamp: r.created_at ?? '',
        data: {
          sessionType: r.session_type,
          summary: r.summary ?? null,
          keyInsights: r.key_insights ?? [],
          emotionalTrend: r.emotional_trend ?? null,
          durationSeconds: dur,
        },
        visual: computeVisual('coaching', size),
        sourceTable: 'voice_calls',
      } as GraphNode;
    });
  };

  // ------------------------------------------
  // EXTENDED NODE FETCHERS (Phase 1 expansion)
  // ------------------------------------------

  /**
   * Fetch breathing test nodes from breathing_tests.
   */
  private fetchBreathingTests: NodeFetcher = async (userId, from, to) => {
    try {
      const sql = `SELECT id, test_type, total_duration_seconds, consistency_score, lung_capacity_estimate, difficulty_rating, completed_at FROM breathing_tests WHERE user_id = $1 AND completed_at::date BETWEEN $2 AND $3 ORDER BY completed_at DESC LIMIT 30`;
      logger.debug('KnowledgeGraph: fetchBreathingTests', { userId, from, to });
      const result = await query(sql, [userId, from, to]);

      return result.rows.map((r) => {
        const dur = r.total_duration_seconds ?? 30;
        const size = linearScale(dur, 30, 300, 6, 14);
        return {
          id: r.id,
          type: 'breathing_test' as GraphNodeType,
          category: 'wellbeing' as GraphNodeCategory,
          label: `${r.test_type || 'Breathing'} Test`,
          date: r.completed_at?.toString().slice(0, 10) ?? '',
          timestamp: r.completed_at ?? '',
          data: {
            testType: r.test_type,
            totalDurationSeconds: r.total_duration_seconds,
            consistencyScore: r.consistency_score,
            lungCapacityEstimate: r.lung_capacity_estimate,
            difficultyRating: r.difficulty_rating,
          },
          visual: computeVisual('wellbeing', size),
          sourceTable: 'breathing_tests',
        } as GraphNode;
      });
    } catch (err: any) {
      if (err?.code === '42P01') return [];
      logger.warn('KnowledgeGraph: fetchBreathingTests failed', { error: err?.message ?? String(err) });
      return [];
    }
  };

  /**
   * Fetch yoga session log nodes from yoga_session_logs joined with yoga_sessions.
   */
  private fetchYogaSessions: NodeFetcher = async (userId, from, to) => {
    try {
      const sql = `SELECT l.id, s.title, s.session_type, s.difficulty, l.actual_duration_seconds, l.completion_rate, l.mood_before, l.mood_after, l.started_at FROM yoga_session_logs l LEFT JOIN yoga_sessions s ON l.session_id = s.id WHERE l.user_id = $1 AND l.started_at::date BETWEEN $2 AND $3 ORDER BY l.started_at DESC LIMIT 30`;
      logger.debug('KnowledgeGraph: fetchYogaSessions', { userId, from, to });
      const result = await query(sql, [userId, from, to]);

      return result.rows.map((r) => {
        const dur = r.actual_duration_seconds ?? 300;
        const size = linearScale(dur, 300, 3600, 6, 14);
        return {
          id: r.id,
          type: 'yoga_session' as GraphNodeType,
          category: 'fitness' as GraphNodeCategory,
          label: r.title || 'Yoga Session',
          date: r.started_at?.toString().slice(0, 10) ?? '',
          timestamp: r.started_at ?? '',
          data: {
            title: r.title || 'Yoga Session',
            sessionType: r.session_type,
            difficulty: r.difficulty,
            durationMinutes: Math.round((r.actual_duration_seconds ?? 0) / 60),
          },
          visual: computeVisual('fitness', size),
          sourceTable: 'yoga_session_logs',
        } as GraphNode;
      });
    } catch (err: any) {
      if (err?.code === '42P01') return [];
      logger.warn('KnowledgeGraph: fetchYogaSessions failed', { error: err?.message ?? String(err) });
      return [];
    }
  };

  /**
   * Fetch meditation timer nodes from meditation_timers.
   */
  private fetchMeditationTimers: NodeFetcher = async (userId, from, to) => {
    try {
      const sql = `SELECT id, mode, duration_minutes, ambient_sound, completed, started_at FROM meditation_timers WHERE user_id = $1 AND started_at::date BETWEEN $2 AND $3 ORDER BY started_at DESC LIMIT 30`;
      logger.debug('KnowledgeGraph: fetchMeditationTimers', { userId, from, to });
      const result = await query(sql, [userId, from, to]);

      return result.rows.map((r) => {
        const dur = r.duration_minutes ?? 5;
        const size = linearScale(dur, 5, 60, 6, 14);
        return {
          id: r.id,
          type: 'meditation_session' as GraphNodeType,
          category: 'wellbeing' as GraphNodeCategory,
          label: `${r.mode || 'Guided'} Meditation`,
          date: r.started_at?.toString().slice(0, 10) ?? '',
          timestamp: r.started_at ?? '',
          data: {
            mode: r.mode,
            durationMinutes: r.duration_minutes,
            ambientSound: r.ambient_sound,
            completed: r.completed ?? false,
          },
          visual: computeVisual('wellbeing', size),
          sourceTable: 'meditation_timers',
        } as GraphNode;
      });
    } catch (err: any) {
      if (err?.code === '42P01') return [];
      logger.warn('KnowledgeGraph: fetchMeditationTimers failed', { error: err?.message ?? String(err) });
      return [];
    }
  };

  /**
   * Fetch voice journal session nodes from voice_journal_sessions.
   */
  private fetchVoiceJournalSessions: NodeFetcher = async (userId, from, to) => {
    try {
      const sql = `SELECT id, summary_mood, summary_themes, exchange_count, total_duration_seconds, created_at FROM voice_journal_sessions WHERE user_id = $1 AND created_at::date BETWEEN $2 AND $3 ORDER BY created_at DESC LIMIT 30`;
      logger.debug('KnowledgeGraph: fetchVoiceJournalSessions', { userId, from, to });
      const result = await query(sql, [userId, from, to]);

      return result.rows.map((r) => {
        const exchanges = r.exchange_count ?? 2;
        const size = linearScale(exchanges, 2, 20, 6, 14);
        return {
          id: r.id,
          type: 'voice_journal' as GraphNodeType,
          category: 'coaching' as GraphNodeCategory,
          label: 'Voice Journal',
          date: r.created_at?.toString().slice(0, 10) ?? '',
          timestamp: r.created_at ?? '',
          data: {
            summaryMood: r.summary_mood,
            summaryThemes: r.summary_themes ?? [],
            exchangeCount: r.exchange_count ?? 0,
          },
          visual: computeVisual('coaching', size),
          sourceTable: 'voice_journal_sessions',
        } as GraphNode;
      });
    } catch (err: any) {
      if (err?.code === '42P01') return [];
      logger.warn('KnowledgeGraph: fetchVoiceJournalSessions failed', { error: err?.message ?? String(err) });
      return [];
    }
  };

  /**
   * Fetch emotion detection nodes from emotion_logs.
   */
  private fetchEmotionLogs: NodeFetcher = async (userId, from, to) => {
    try {
      const sql = `SELECT id, emotion_category, confidence_score, source, timestamp FROM emotion_logs WHERE user_id = $1 AND timestamp::date BETWEEN $2 AND $3 ORDER BY timestamp DESC LIMIT 30`;
      logger.debug('KnowledgeGraph: fetchEmotionLogs', { userId, from, to });
      const result = await query(sql, [userId, from, to]);

      return result.rows.map((r) => {
        const conf = r.confidence_score ?? 30;
        const size = linearScale(conf, 30, 100, 6, 14);
        const emotion = r.emotion_category ?? 'unknown';
        return {
          id: r.id,
          type: 'emotion_detection' as GraphNodeType,
          category: 'wellbeing' as GraphNodeCategory,
          label: emotion.charAt(0).toUpperCase() + emotion.slice(1),
          date: r.timestamp?.toString().slice(0, 10) ?? '',
          timestamp: r.timestamp ?? '',
          data: {
            emotionCategory: r.emotion_category,
            confidenceScore: r.confidence_score,
            source: r.source,
          },
          visual: computeVisual('wellbeing', size),
          sourceTable: 'emotion_logs',
        } as GraphNode;
      });
    } catch (err: any) {
      if (err?.code === '42P01') return [];
      logger.warn('KnowledgeGraph: fetchEmotionLogs failed', { error: err?.message ?? String(err) });
      return [];
    }
  };

  /**
   * Fetch Whoop health data records (heart rate, HRV, steps, body temp, VO2 max, etc.)
   */
  private fetchWhoopHealthData: NodeFetcher = async (userId, from, to) => {
    try {
      const result = await query(
        `SELECT id, data_type::text, recorded_at, value, unit, provider::text
         FROM health_data_records
         WHERE user_id = $1
           AND recorded_at::date BETWEEN $2 AND $3
         ORDER BY recorded_at DESC
         LIMIT 200`,
        [userId, from, to],
      );

      const nodes: GraphNode[] = [];

      for (const r of result.rows) {
        const dataType = String(r.data_type);
        const val = typeof r.value === 'object' && r.value !== null ? r.value : {} as Record<string, any>;
        const dateStr = new Date(r.recorded_at).toISOString().split('T')[0];
        const provider = r.provider || 'whoop';

        if (dataType === 'recovery') {
          const recoveryScore = Number(val.recovery_score ?? val.score?.recovery_score ?? 0);
          const hrv = Number(val.hrv_rmssd_ms ?? val.score?.hrv_rmssd_milli ?? 0);
          const rhr = Number(val.resting_heart_rate_bpm ?? val.score?.resting_heart_rate ?? 0);
          const spo2 = val.spo2_percent ?? val.score?.spo2_percentage ?? null;
          const skinTemp = val.skin_temp_celsius ?? val.score?.skin_temp_celsius ?? null;
          const size = linearScale(recoveryScore, 0, 100, 6, 14);

          const parts = [`Recovery ${Math.round(recoveryScore)}%`];
          if (hrv > 0) parts.push(`HRV ${Math.round(hrv)}ms`);
          if (rhr > 0) parts.push(`RHR ${Math.round(rhr)}`);

          nodes.push({
            id: r.id,
            type: 'recovery_score',
            category: 'biometrics',
            label: parts.join(' · '),
            date: dateStr,
            timestamp: new Date(r.recorded_at).toISOString(),
            data: {
              recoveryScore,
              metricDate: dateStr,
              hrvRmssd: hrv || null,
              restingHeartRate: rhr || null,
              spo2Percent: spo2 != null ? Number(spo2) : null,
              skinTempCelsius: skinTemp != null ? Number(skinTemp) : null,
              calibrating: val.calibrating ?? val.score?.user_calibrating ?? false,
              provider,
            },
            visual: computeVisual('biometrics', size),
            sourceTable: 'health_data_records',
          } as GraphNode);

        } else if (dataType === 'sleep') {
          const durationMin = Number(val.duration_minutes ?? 0);
          const sleepHours = durationMin > 0 ? durationMin / 60 : 0;
          const qualityScore = Number(val.sleep_quality_score ?? 0);
          const efficiency = val.sleep_efficiency_percent ?? null;
          const consistency = val.sleep_consistency_percent ?? null;
          const respRate = val.respiratory_rate_bpm ?? null;
          const sleepDebt = val.sleep_debt_minutes ?? null;
          const stages = val.stages ?? null;
          const isNap = val.is_nap ?? false;
          const size = linearScale(sleepHours, 4, 10, 6, 14);

          const label = isNap
            ? `Nap ${Math.round(durationMin)}m`
            : `Sleep ${sleepHours.toFixed(1)}h${qualityScore > 0 ? ` · ${Math.round(qualityScore)}%` : ''}`;

          nodes.push({
            id: r.id,
            type: 'sleep_session',
            category: 'biometrics',
            label,
            date: dateStr,
            timestamp: new Date(r.recorded_at).toISOString(),
            data: {
              sleepHours: sleepHours || null,
              metricDate: dateStr,
              provider,
              qualityScore: qualityScore || null,
              efficiencyPercent: efficiency != null ? Number(efficiency) : null,
              consistencyPercent: consistency != null ? Number(consistency) : null,
              respiratoryRate: respRate != null ? Number(respRate) : null,
              sleepDebtMinutes: sleepDebt != null ? Number(sleepDebt) : null,
              stages: stages ? {
                remMinutes: Number(stages.rem_minutes ?? 0),
                deepMinutes: Number(stages.deep_minutes ?? 0),
                lightMinutes: Number(stages.light_minutes ?? 0),
                awakeMinutes: Number(stages.awake_minutes ?? 0),
              } : null,
              isNap: isNap,
            },
            visual: computeVisual('biometrics', size),
            sourceTable: 'health_data_records',
          } as GraphNode);

        } else if (dataType === 'strain' || dataType === 'workouts') {
          const strainScore = Number(val.strain_score ?? 0);
          const strainNorm = Number(val.strain_score_normalized ?? 0);
          const calories = Number(val.calories_kcal ?? 0);
          const avgHr = Number(val.avg_heart_rate_bpm ?? 0);
          const maxHr = Number(val.max_heart_rate_bpm ?? 0);
          const duration = Number(val.duration_minutes ?? 0);
          const activityType = val.activity_type ?? null;
          const distance = val.distance_meters ?? null;
          const hrZones = val.heart_rate_zones ?? null;
          const size = linearScale(strainScore, 0, 21, 6, 14);

          const parts = [`Strain ${strainScore.toFixed(1)}`];
          if (calories > 0) parts.push(`${Math.round(calories)} kcal`);
          if (activityType) parts.push(String(activityType).replace(/_/g, ' '));

          nodes.push({
            id: r.id,
            type: 'strain_score',
            category: 'biometrics',
            label: parts.join(' · '),
            date: dateStr,
            timestamp: new Date(r.recorded_at).toISOString(),
            data: {
              strainScore,
              metricDate: dateStr,
              strainNormalized: strainNorm || null,
              calories: calories || null,
              avgHeartRate: avgHr || null,
              maxHeartRate: maxHr || null,
              durationMinutes: duration || null,
              activityType,
              distanceMeters: distance != null ? Number(distance) : null,
              heartRateZones: hrZones ? {
                zone0: Number(hrZones.zone_0_minutes ?? 0),
                zone1: Number(hrZones.zone_1_minutes ?? 0),
                zone2: Number(hrZones.zone_2_minutes ?? 0),
                zone3: Number(hrZones.zone_3_minutes ?? 0),
                zone4: Number(hrZones.zone_4_minutes ?? 0),
                zone5: Number(hrZones.zone_5_minutes ?? 0),
              } : null,
              provider,
            },
            visual: computeVisual('biometrics', size),
            sourceTable: 'health_data_records',
          } as GraphNode);

        } else {
          // Generic fallback for other health data types (heart_rate, hrv, steps, etc.)
          const numVal = typeof val === 'object' && 'value' in val ? Number(val.value) : 0;
          const size = linearScale(Math.abs(numVal), 0, 200, 6, 14);
          const typeLabels: Record<string, string> = {
            heart_rate: 'Heart Rate', hrv: 'HRV', steps: 'Steps',
            calories: 'Calories', body_temp: 'Body Temp', vo2_max: 'VO2 Max',
            training_load: 'Training Load', gps_activities: 'GPS Activity',
          };
          const label = `${typeLabels[dataType] || dataType} ${numVal ? numVal.toFixed(0) : ''}${r.unit ? ` ${r.unit}` : ''}`.trim();

          nodes.push({
            id: r.id,
            type: 'recovery_score',
            category: 'biometrics',
            label,
            date: dateStr,
            timestamp: new Date(r.recorded_at).toISOString(),
            data: {
              recoveryScore: numVal,
              metricDate: dateStr,
              provider,
            },
            visual: computeVisual('biometrics', size),
            sourceTable: 'health_data_records',
          } as GraphNode);
        }
      }

      return nodes;
    } catch (error: any) {
      if (error?.code === '42P01') return [];
      logger.warn('[KnowledgeGraph] fetchWhoopHealthData failed', { error: error?.message });
      return [];
    }
  };

  /**
   * Fetch progress record nodes from progress_records.
   */
  private fetchProgressRecords: NodeFetcher = async (userId, from, to) => {
    try {
      const sql = `SELECT id, record_date, record_type, value, source FROM progress_records WHERE user_id = $1 AND record_date BETWEEN $2 AND $3 ORDER BY record_date DESC LIMIT 30`;
      logger.debug('KnowledgeGraph: fetchProgressRecords', { userId, from, to });
      const result = await query(sql, [userId, from, to]);

      return result.rows.map((r) => {
        const recType = r.record_type ?? 'unknown';
        return {
          id: r.id,
          type: 'progress_record' as GraphNodeType,
          category: 'biometrics' as GraphNodeCategory,
          label: recType.charAt(0).toUpperCase() + recType.slice(1) + ' Record',
          date: r.record_date,
          timestamp: r.record_date,
          data: {
            recordDate: r.record_date,
            recordType: r.record_type,
            value: r.value ?? {},
            source: r.source,
          },
          visual: computeVisual('biometrics', 8),
          sourceTable: 'progress_records',
        } as GraphNode;
      });
    } catch (err: any) {
      if (err?.code === '42P01') return [];
      logger.warn('KnowledgeGraph: fetchProgressRecords failed', { error: err?.message ?? String(err) });
      return [];
    }
  };

  /**
   * Fetch daily intention nodes from daily_intentions.
   */
  private fetchDailyIntentions: NodeFetcher = async (userId, from, to) => {
    try {
      const sql = `SELECT id, intention_date, intention_text, fulfilled, reflection FROM daily_intentions WHERE user_id = $1 AND intention_date BETWEEN $2 AND $3 ORDER BY intention_date DESC LIMIT 30`;
      logger.debug('KnowledgeGraph: fetchDailyIntentions', { userId, from, to });
      const result = await query(sql, [userId, from, to]);

      return result.rows.map((r) => {
        const text = r.intention_text ?? '';
        const label = text.length > 40 ? text.slice(0, 37) + '...' : text || 'Intention';
        const size = r.fulfilled ? 10 : 6;
        return {
          id: r.id,
          type: 'daily_intention' as GraphNodeType,
          category: 'wellbeing' as GraphNodeCategory,
          label,
          date: r.intention_date,
          timestamp: r.intention_date,
          data: {
            intentionDate: r.intention_date,
            intentionText: r.intention_text,
            fulfilled: r.fulfilled,
            reflection: r.reflection,
          },
          visual: computeVisual('wellbeing', size),
          sourceTable: 'daily_intentions',
        } as GraphNode;
      });
    } catch (err: any) {
      if (err?.code === '42P01') return [];
      logger.warn('KnowledgeGraph: fetchDailyIntentions failed', { error: err?.message ?? String(err) });
      return [];
    }
  };

  /**
   * Fetch weekly analysis report nodes from weekly_analysis_reports.
   */
  private fetchWeeklyReports: NodeFetcher = async (userId, from, to) => {
    try {
      const sql = `SELECT id, week_end_date, summary, narrative FROM weekly_analysis_reports WHERE user_id = $1 AND week_end_date BETWEEN $2 AND $3 ORDER BY week_end_date DESC LIMIT 30`;
      logger.debug('KnowledgeGraph: fetchWeeklyReports', { userId, from, to });
      const result = await query(sql, [userId, from, to]);

      return result.rows.map((r) => ({
        id: r.id,
        type: 'weekly_report' as GraphNodeType,
        category: 'intelligence' as GraphNodeCategory,
        label: `Week of ${r.week_end_date ?? 'Unknown'}`,
        date: r.week_end_date,
        timestamp: r.week_end_date,
        data: {
          weekEndDate: r.week_end_date,
          avgScore: 0,
          scoreTrend: 'stable',
          topInsights: [],
        },
        visual: computeVisual('intelligence', 14),
        sourceTable: 'weekly_analysis_reports',
      })) as GraphNode[];
    } catch (err: any) {
      if (err?.code === '42P01') return [];
      logger.warn('KnowledgeGraph: fetchWeeklyReports failed', { error: err?.message ?? String(err) });
      return [];
    }
  };

  /**
   * Fetch emotional check-in session nodes from emotional_checkin_sessions.
   */
  private fetchEmotionalCheckins: NodeFetcher = async (userId, from, to) => {
    try {
      const sql = `SELECT id, screening_type, overall_anxiety_score, overall_mood_score, risk_level, question_count, started_at FROM emotional_checkin_sessions WHERE user_id = $1 AND started_at::date BETWEEN $2 AND $3 ORDER BY started_at DESC LIMIT 30`;
      logger.debug('KnowledgeGraph: fetchEmotionalCheckins', { userId, from, to });
      const result = await query(sql, [userId, from, to]);

      return result.rows.map((r) => {
        const qc = r.question_count ?? 3;
        const size = linearScale(qc, 3, 15, 6, 14);
        return {
          id: r.id,
          type: 'emotional_screening' as GraphNodeType,
          category: 'wellbeing' as GraphNodeCategory,
          label: `${r.screening_type || 'Emotional'} Check-in`,
          date: r.started_at?.toString().slice(0, 10) ?? '',
          timestamp: r.started_at ?? '',
          data: {
            screeningType: r.screening_type,
            overallAnxietyScore: r.overall_anxiety_score,
            overallMoodScore: r.overall_mood_score,
            riskLevel: r.risk_level,
            questionCount: r.question_count,
          },
          visual: computeVisual('wellbeing', size),
          sourceTable: 'emotional_checkin_sessions',
        } as GraphNode;
      });
    } catch (err: any) {
      if (err?.code === '42P01') return [];
      logger.warn('KnowledgeGraph: fetchEmotionalCheckins failed', { error: err?.message ?? String(err) });
      return [];
    }
  };

  /**
   * Fetch active nutrition adherence pattern nodes from nutrition_adherence_patterns.
   * No date range filter — patterns are active/inactive, uses last_occurrence as date.
   */
  private fetchNutritionPatterns: NodeFetcher = async (userId) => {
    try {
      const sql = `SELECT id, pattern_type, pattern_key, success_rate, confidence_score, ai_insight, last_occurrence FROM nutrition_adherence_patterns WHERE user_id = $1 AND is_active = true ORDER BY confidence_score DESC LIMIT 30`;
      logger.debug('KnowledgeGraph: fetchNutritionPatterns', { userId });
      const result = await query(sql, [userId]);

      const today = new Date().toISOString().slice(0, 10);

      return result.rows.map((r) => {
        const conf = r.confidence_score ?? 0.3;
        const size = linearScale(conf, 0.3, 1.0, 6, 14);
        const key = (r.pattern_key ?? 'unknown').replace(/_/g, ' ');
        const label = key.charAt(0).toUpperCase() + key.slice(1);
        return {
          id: r.id,
          type: 'nutrition_pattern' as GraphNodeType,
          category: 'nutrition' as GraphNodeCategory,
          label,
          date: r.last_occurrence?.toString().slice(0, 10) ?? today,
          timestamp: r.last_occurrence ?? today,
          data: {
            patternType: r.pattern_type,
            patternKey: r.pattern_key,
            successRate: r.success_rate,
            confidenceScore: r.confidence_score,
            aiInsight: r.ai_insight,
          },
          visual: computeVisual('nutrition', size),
          sourceTable: 'nutrition_adherence_patterns',
        } as GraphNode;
      });
    } catch (err: any) {
      if (err?.code === '42P01') return [];
      logger.warn('KnowledgeGraph: fetchNutritionPatterns failed', { error: err?.message ?? String(err) });
      return [];
    }
  };

  /**
   * Fetch user chat message nodes from rag_messages joined with rag_conversations.
   * Only user messages; content truncated to 100 chars by the query.
   */
  private fetchChatHistory: NodeFetcher = async (userId, from, to) => {
    try {
      const sql = `SELECT m.id, m.role, LEFT(m.content, 100) as content_preview, m.conversation_id, m.created_at FROM rag_messages m JOIN rag_conversations c ON m.conversation_id = c.id WHERE m.user_id = $1 AND m.role = 'user' AND m.created_at::date BETWEEN $2 AND $3 ORDER BY m.created_at DESC LIMIT 30`;
      logger.debug('KnowledgeGraph: fetchChatHistory', { userId, from, to });
      const result = await query(sql, [userId, from, to]);

      return result.rows.map((r) => {
        const preview = r.content_preview ?? '';
        const label = preview.length > 50 ? preview.slice(0, 47) + '...' : preview || 'Chat Message';
        const contentLen = preview.length;
        const size = linearScale(contentLen, 10, 100, 6, 12);
        return {
          id: r.id,
          type: 'chat_message' as GraphNodeType,
          category: 'coaching' as GraphNodeCategory,
          label,
          date: r.created_at?.toString().slice(0, 10) ?? '',
          timestamp: r.created_at ?? '',
          data: {
            role: r.role,
            contentPreview: preview,
            conversationId: r.conversation_id,
          },
          visual: computeVisual('coaching', size),
          sourceTable: 'rag_messages',
        } as GraphNode;
      });
    } catch (err: any) {
      if (err?.code === '42P01') return [];
      logger.warn('KnowledgeGraph: fetchChatHistory failed', { error: err?.message ?? String(err) });
      return [];
    }
  };

  /**
   * Fetch activity log nodes from activity_logs.
   */
  private fetchActivityLogs: NodeFetcher = async (userId, from, to) => {
    try {
      const sql = `SELECT id, activity_id, status, scheduled_date, actual_value, target_value, duration, mood FROM activity_logs WHERE user_id = $1 AND scheduled_date BETWEEN $2 AND $3 ORDER BY scheduled_date DESC LIMIT 30`;
      logger.debug('KnowledgeGraph: fetchActivityLogs', { userId, from, to });
      const result = await query(sql, [userId, from, to]);

      return result.rows.map((r) => {
        const actId = (r.activity_id ?? 'activity').replace(/-/g, ' ');
        const label = actId.charAt(0).toUpperCase() + actId.slice(1);
        const status = r.status ?? '';
        const size = status === 'completed' ? 10 : status === 'skipped' ? 6 : 8;
        return {
          id: r.id,
          type: 'activity_completion' as GraphNodeType,
          category: 'fitness' as GraphNodeCategory,
          label,
          date: r.scheduled_date,
          timestamp: r.scheduled_date,
          data: {
            activityId: r.activity_id,
            status: r.status,
            scheduledDate: r.scheduled_date,
            actualValue: r.actual_value,
            targetValue: r.target_value,
          },
          visual: computeVisual('fitness', size),
          sourceTable: 'activity_logs',
        } as GraphNode;
      });
    } catch (err: any) {
      if (err?.code === '42P01') return [];
      logger.warn('KnowledgeGraph: fetchActivityLogs failed', { error: err?.message ?? String(err) });
      return [];
    }
  };

  /**
   * Fetch daily schedule nodes from daily_schedules.
   * Attempts to include item_count via subquery; gracefully handles missing schedule_items table.
   */
  private fetchSchedules: NodeFetcher = async (userId, from, to) => {
    try {
      let sql = `SELECT id, schedule_date, (SELECT COUNT(*) FROM schedule_items si WHERE si.schedule_id = ds.id) as item_count FROM daily_schedules ds WHERE ds.user_id = $1 AND ds.schedule_date BETWEEN $2 AND $3 ORDER BY ds.schedule_date DESC LIMIT 30`;
      logger.debug('KnowledgeGraph: fetchSchedules', { userId, from, to });
      let result;
      try {
        result = await query(sql, [userId, from, to]);
      } catch {
        // Fallback if schedule_items table does not exist
        sql = `SELECT id, schedule_date, 0 as item_count FROM daily_schedules ds WHERE ds.user_id = $1 AND ds.schedule_date BETWEEN $2 AND $3 ORDER BY ds.schedule_date DESC LIMIT 30`;
        result = await query(sql, [userId, from, to]);
      }

      return result.rows.map((r) => {
        const items = r.item_count ?? 0;
        const size = linearScale(items, 1, 10, 6, 14);
        return {
          id: r.id,
          type: 'schedule_entry' as GraphNodeType,
          category: 'wellbeing' as GraphNodeCategory,
          label: `Schedule ${r.schedule_date ?? ''}`,
          date: r.schedule_date,
          timestamp: r.schedule_date,
          data: {
            scheduleDate: r.schedule_date,
            itemCount: items,
            completionRate: null,
          },
          visual: computeVisual('wellbeing', size),
          sourceTable: 'daily_schedules',
        } as GraphNode;
      });
    } catch (err: any) {
      if (err?.code === '42P01') return [];
      logger.warn('KnowledgeGraph: fetchSchedules failed', { error: err?.message ?? String(err) });
      return [];
    }
  };

  /**
   * Fetch finance transaction nodes from finance_transactions.
   */
  private fetchFinanceTransactions: NodeFetcher = async (userId, from, to) => {
    try {
      const sql = `SELECT id, amount, transaction_type::text, category::text, title, transaction_date FROM finance_transactions WHERE user_id = $1 AND transaction_date BETWEEN $2 AND $3 ORDER BY transaction_date DESC LIMIT 30`;
      logger.debug('KnowledgeGraph: fetchFinanceTransactions', { userId, from, to });
      const result = await query(sql, [userId, from, to]);

      return result.rows.map((r) => {
        const amt = Math.abs(r.amount ?? 10);
        const size = linearScale(amt, 10, 1000, 6, 14);
        return {
          id: r.id,
          type: 'finance_transaction' as GraphNodeType,
          category: 'finance' as GraphNodeCategory,
          label: r.title || `${r.transaction_type ?? ''} ${r.category ?? ''}`.trim() || 'Transaction',
          date: r.transaction_date,
          timestamp: r.transaction_date,
          data: {
            amount: r.amount,
            transactionType: r.transaction_type,
            category: r.category,
            title: r.title,
            transactionDate: r.transaction_date,
          },
          visual: computeVisual('finance', size),
          sourceTable: 'finance_transactions',
        } as GraphNode;
      });
    } catch (err: any) {
      if (err?.code === '42P01') return [];
      logger.warn('KnowledgeGraph: fetchFinanceTransactions failed', { error: err?.message ?? String(err) });
      return [];
    }
  };

  /**
   * Fetch achievement nodes from user_achievements joined with achievement_definitions.
   * No date range filter — achievements are permanent. Uses unlocked_at as date.
   */
  private fetchAchievements: NodeFetcher = async (userId) => {
    try {
      const sql = `SELECT ua.user_id || '-' || ua.achievement_id as id, ua.achievement_id, ad.name, ua.progress, ua.unlocked_at FROM user_achievements ua LEFT JOIN achievement_definitions ad ON ua.achievement_id = ad.id WHERE ua.user_id = $1 ORDER BY ua.unlocked_at DESC NULLS LAST LIMIT 30`;
      logger.debug('KnowledgeGraph: fetchAchievements', { userId });
      const result = await query(sql, [userId]);

      const today = new Date().toISOString().slice(0, 10);

      return result.rows.map((r) => {
        const progress = r.progress ?? 0;
        const size = linearScale(progress, 0, 100, 6, 14);
        return {
          id: r.id,
          type: 'achievement' as GraphNodeType,
          category: 'goals' as GraphNodeCategory,
          label: r.name || 'Achievement',
          date: r.unlocked_at?.toString().slice(0, 10) ?? today,
          timestamp: r.unlocked_at ?? today,
          data: {
            achievementId: r.achievement_id,
            achievementName: r.name || 'Achievement',
            progress,
            unlockedAt: r.unlocked_at,
          },
          visual: computeVisual('goals', size),
          sourceTable: 'user_achievements',
        } as GraphNode;
      });
    } catch (err: any) {
      if (err?.code === '42P01') return [];
      logger.warn('KnowledgeGraph: fetchAchievements failed', { error: err?.message ?? String(err) });
      return [];
    }
  };

  // ------------------------------------------
  // FETCHER REGISTRY
  // ------------------------------------------

  private readonly fetcherMap: Record<string, NodeFetcher> = {
    workouts: this.fetchWorkouts,
    meals: this.fetchMeals,
    mood: this.fetchMood,
    stress: this.fetchStress,
    energy: this.fetchEnergy,
    journal: this.fetchJournal,
    habits: this.fetchHabits,
    biometrics: this.fetchBiometrics,
    whoopHealthData: this.fetchWhoopHealthData,
    dailyScores: this.fetchDailyScores,
    healthGoals: this.fetchHealthGoals,
    lifeGoals: this.fetchLifeGoals,
    contradictions: this.fetchContradictions,
    correlations: this.fetchCorrelations,
    dailyCheckins: this.fetchDailyCheckins,
    water: this.fetchWater,
    voiceCalls: this.fetchVoiceCalls,
    // Phase 1 expansion fetchers
    breathingTests: this.fetchBreathingTests,
    yogaSessions: this.fetchYogaSessions,
    meditationTimers: this.fetchMeditationTimers,
    voiceJournalSessions: this.fetchVoiceJournalSessions,
    emotionLogs: this.fetchEmotionLogs,
    progressRecords: this.fetchProgressRecords,
    dailyIntentions: this.fetchDailyIntentions,
    weeklyReports: this.fetchWeeklyReports,
    emotionalCheckins: this.fetchEmotionalCheckins,
    nutritionPatterns: this.fetchNutritionPatterns,
    chatHistory: this.fetchChatHistory,
    activityLogs: this.fetchActivityLogs,
    schedules: this.fetchSchedules,
    financeTransactions: this.fetchFinanceTransactions,
    achievements: this.fetchAchievements,
  };

  // ------------------------------------------
  // EDGE BUILDING
  // ------------------------------------------

  /**
   * Build all edges deterministically from the collected nodes.
   */
  private buildEdges(nodes: GraphNode[]): GraphEdge[] {
    const edges: GraphEdge[] = [];
    let edgeIdx = 0;

    const makeEdgeId = () => `edge-${++edgeIdx}`;

    // Index nodes by date for temporal edges
    const nodesByDate = new Map<string, GraphNode[]>();
    const nodesById = new Map<string, GraphNode>();

    for (const node of nodes) {
      nodesById.set(node.id, node);
      if (node.date) {
        const dateKey = node.date.toString().slice(0, 10);
        if (!nodesByDate.has(dateKey)) {
          nodesByDate.set(dateKey, []);
        }
        nodesByDate.get(dateKey)!.push(node);
      }
    }

    // --- Temporal edges (same_day): hub-and-spoke through daily_score ---
    for (const [dateKey, dayNodes] of nodesByDate) {
      const hub = dayNodes.find((n) => n.type === 'daily_score');
      if (!hub) continue;

      for (const node of dayNodes) {
        if (node.id === hub.id) continue;
        edges.push({
          id: makeEdgeId(),
          type: 'same_day' as EdgeType,
          category: 'temporal' as EdgeCategory,
          sourceNodeId: hub.id,
          targetNodeId: node.id,
          sourceNodeType: hub.type,
          targetNodeType: node.type,
          strength: 0.5,
          confidence: 1.0,
          label: dateKey,
          visual: computeEdgeVisual('temporal', 0.5),
        });
      }
    }

    // --- Hierarchical edges: workout → workout_plan ---
    const workoutPlanNodes = nodes.filter((n) => n.type === 'workout_plan');
    const workoutPlanIds = new Set(workoutPlanNodes.map((n) => n.id));

    for (const node of nodes) {
      if (node.type === 'workout_session') {
        const planId = (node.data as any)?.planId;
        if (planId && workoutPlanIds.has(planId)) {
          edges.push({
            id: makeEdgeId(),
            type: 'belongs_to_plan' as EdgeType,
            category: 'hierarchical' as EdgeCategory,
            sourceNodeId: node.id,
            targetNodeId: planId,
            sourceNodeType: node.type,
            targetNodeType: 'workout_plan',
            strength: 0.8,
            confidence: 1.0,
            visual: computeEdgeVisual('hierarchical', 0.8),
          });
        }
      }
    }

    // --- Hierarchical edges: meal → diet_plan ---
    const dietPlanNodes = nodes.filter((n) => n.type === 'diet_plan');
    const dietPlanIds = new Set(dietPlanNodes.map((n) => n.id));

    for (const node of nodes) {
      if (node.type === 'meal') {
        const dpId = (node.data as any)?.dietPlanId;
        if (dpId && dietPlanIds.has(dpId)) {
          edges.push({
            id: makeEdgeId(),
            type: 'follows_diet' as EdgeType,
            category: 'hierarchical' as EdgeCategory,
            sourceNodeId: node.id,
            targetNodeId: dpId,
            sourceNodeType: node.type,
            targetNodeType: 'diet_plan',
            strength: 0.8,
            confidence: 1.0,
            visual: computeEdgeVisual('hierarchical', 0.8),
          });
        }
      }
    }

    // --- Hierarchical edges: goal_milestone → life_goal / health_goal ---
    const goalNodeIds = new Set(
      nodes.filter((n) => n.type === 'life_goal' || n.type === 'health_goal').map((n) => n.id),
    );

    for (const node of nodes) {
      if (node.type === 'goal_milestone') {
        // Check if parent goal exists in the graph by looking at data
        const parentGoalId = (node.data as any)?.goalId;
        if (parentGoalId && goalNodeIds.has(parentGoalId)) {
          const parentNode = nodesById.get(parentGoalId);
          edges.push({
            id: makeEdgeId(),
            type: 'milestone_of' as EdgeType,
            category: 'hierarchical' as EdgeCategory,
            sourceNodeId: node.id,
            targetNodeId: parentGoalId,
            sourceNodeType: node.type,
            targetNodeType: parentNode?.type ?? 'health_goal',
            strength: 0.9,
            confidence: 1.0,
            visual: computeEdgeVisual('hierarchical', 0.9),
          });
        }
      }
    }

    // --- Causal edges: contradiction → related daily_score nodes ---
    for (const node of nodes) {
      if (node.type === 'contradiction') {
        const contradictionDate = node.date?.toString().slice(0, 10);
        if (!contradictionDate) continue;

        const dayNodes = nodesByDate.get(contradictionDate);
        if (!dayNodes) continue;

        const hub = dayNodes.find((n) => n.type === 'daily_score');
        if (hub) {
          edges.push({
            id: makeEdgeId(),
            type: 'contradiction_between' as EdgeType,
            category: 'causal' as EdgeCategory,
            sourceNodeId: node.id,
            targetNodeId: hub.id,
            sourceNodeType: node.type,
            targetNodeType: hub.type,
            strength: 0.7,
            confidence: 0.8,
            label: node.label,
            visual: computeEdgeVisual('causal', 0.7),
          });
        }
      }
    }

    // --- Correlation edges: link correlated domain nodes ---
    for (const node of nodes) {
      if (node.type === 'correlation') {
        const patternType = (node.data as any)?.patternType as string | undefined;
        if (!patternType) continue;

        // patternType format: "domain1_domain2" (e.g., "mood_workout", "stress_sleep")
        const parts = patternType.split('_');
        if (parts.length < 2) continue;

        const strength = Math.abs((node.data as any)?.correlationStrength ?? 0.5);

        // Find representative nodes for each domain in the graph
        const domain1Nodes = this.findDomainNodes(nodes, parts[0]!);
        const domain2Nodes = this.findDomainNodes(nodes, parts[1]!);

        // Link correlation node to the first representative of each domain
        if (domain1Nodes.length > 0) {
          edges.push({
            id: makeEdgeId(),
            type: strength > 0 ? 'positively_correlated' : 'negatively_correlated',
            category: 'correlation' as EdgeCategory,
            sourceNodeId: node.id,
            targetNodeId: domain1Nodes[0]!.id,
            sourceNodeType: node.type,
            targetNodeType: domain1Nodes[0]!.type,
            strength: Math.abs(strength),
            confidence: 0.7,
            visual: computeEdgeVisual('correlation', Math.abs(strength)),
          });
        }

        if (domain2Nodes.length > 0) {
          edges.push({
            id: makeEdgeId(),
            type: strength > 0 ? 'positively_correlated' : 'negatively_correlated',
            category: 'correlation' as EdgeCategory,
            sourceNodeId: node.id,
            targetNodeId: domain2Nodes[0]!.id,
            sourceNodeType: node.type,
            targetNodeType: domain2Nodes[0]!.type,
            strength: Math.abs(strength),
            confidence: 0.7,
            visual: computeEdgeVisual('correlation', Math.abs(strength)),
          });
        }
      }
    }

    // ── Phase 3: Cross-domain causal & hierarchical edges ──

    // 1. Workout → Mood After (causal)
    const workoutNodes = nodes.filter(n => n.type === 'workout_session');
    const moodNodes = nodes.filter(n => n.type === 'mood_entry');
    for (const w of workoutNodes) {
      if ((w.data as any)?.moodAfter != null) {
        const sameDayMoods = moodNodes.filter(m => m.date === w.date);
        for (const m of sameDayMoods) {
          edges.push({
            id: makeEdgeId(),
            type: 'workout_mood_impact',
            category: 'causal',
            sourceNodeId: w.id,
            targetNodeId: m.id,
            sourceNodeType: w.type,
            targetNodeType: m.type,
            strength: 0.7,
            confidence: 0.6,
            label: 'Impacts mood',
            visual: computeEdgeVisual('causal', 0.7),
          });
        }
      }
    }

    // 2. Sleep → Energy Next Day (causal)
    const sleepNodes = nodes.filter(n => n.type === 'sleep_session');
    const energyNodes = nodes.filter(n => n.type === 'energy_log');
    for (const s of sleepNodes) {
      const nextDay = new Date(s.date);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().split('T')[0];
      const nextDayEnergy = energyNodes.filter(e => e.date === nextDayStr);
      for (const e of nextDayEnergy) {
        edges.push({
          id: makeEdgeId(),
          type: 'sleep_energy_impact',
          category: 'causal',
          sourceNodeId: s.id,
          targetNodeId: e.id,
          sourceNodeType: s.type,
          targetNodeType: e.type,
          strength: 0.8,
          confidence: 0.7,
          label: 'Impacts energy',
          visual: computeEdgeVisual('causal', 0.8),
        });
      }
    }

    // 3. Breathing → Stress Reduction (causal)
    const breathingNodes = nodes.filter(n => n.type === 'breathing_test');
    const stressNodes = nodes.filter(n => n.type === 'stress_log');
    for (const b of breathingNodes) {
      const sameDayStress = stressNodes.filter(s => s.date === b.date);
      for (const s of sameDayStress) {
        edges.push({
          id: makeEdgeId(),
          type: 'breathing_stress_reduction',
          category: 'causal',
          sourceNodeId: b.id,
          targetNodeId: s.id,
          sourceNodeType: b.type,
          targetNodeType: s.type,
          strength: 0.6,
          confidence: 0.5,
          label: 'Reduces stress',
          visual: computeEdgeVisual('causal', 0.6),
        });
      }
    }

    // 4. Sleep → Recovery Next Day (causal) — better sleep drives higher recovery
    const recoveryNodes = nodes.filter(n => n.type === 'recovery_score');
    for (const s of sleepNodes) {
      const nextDay = new Date(s.date);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().split('T')[0];
      // Also check same day (sleep recorded at night, recovery in morning)
      const relatedRecoveries = recoveryNodes.filter(r => r.date === nextDayStr || r.date === s.date);
      for (const r of relatedRecoveries) {
        edges.push({
          id: makeEdgeId(),
          type: 'sleep_recovery_impact',
          category: 'causal',
          sourceNodeId: s.id,
          targetNodeId: r.id,
          sourceNodeType: s.type,
          targetNodeType: r.type,
          strength: 0.9,
          confidence: 0.8,
          label: 'Drives recovery',
          visual: computeEdgeVisual('causal', 0.9),
        });
      }
    }

    // 5. Strain → Recovery Impact (causal) — high strain lowers next-day recovery
    const strainNodes = nodes.filter(n => n.type === 'strain_score');
    for (const st of strainNodes) {
      const nextDay = new Date(st.date);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().split('T')[0];
      const nextRecoveries = recoveryNodes.filter(r => r.date === nextDayStr);
      for (const r of nextRecoveries) {
        edges.push({
          id: makeEdgeId(),
          type: 'strain_recovery_impact',
          category: 'causal',
          sourceNodeId: st.id,
          targetNodeId: r.id,
          sourceNodeType: st.type,
          targetNodeType: r.type,
          strength: 0.8,
          confidence: 0.7,
          label: 'Impacts recovery',
          visual: computeEdgeVisual('causal', 0.8),
        });
      }
    }

    // 6. Recovery → Strain Readiness (causal) — recovery determines training capacity
    for (const r of recoveryNodes) {
      const sameDayStrain = strainNodes.filter(st => st.date === r.date);
      for (const st of sameDayStrain) {
        edges.push({
          id: makeEdgeId(),
          type: 'recovery_strain_readiness',
          category: 'causal',
          sourceNodeId: r.id,
          targetNodeId: st.id,
          sourceNodeType: r.type,
          targetNodeType: st.type,
          strength: 0.7,
          confidence: 0.6,
          label: 'Enables strain',
          visual: computeEdgeVisual('causal', 0.7),
        });
      }
    }

    // 7. Weekly Report → Daily Scores (hierarchical)
    const reportNodes = nodes.filter(n => n.type === 'weekly_report');
    const scoreNodes = nodes.filter(n => n.type === 'daily_score');
    for (const r of reportNodes) {
      const weekEnd = new Date(r.date);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekEnd.getDate() - 6);
      const weekStartStr = weekStart.toISOString().split('T')[0];
      const weekEndStr = r.date;
      const scoresInRange = scoreNodes.filter(s => s.date >= weekStartStr && s.date <= weekEndStr);
      for (const s of scoresInRange) {
        edges.push({
          id: makeEdgeId(),
          type: 'report_aggregates',
          category: 'hierarchical',
          sourceNodeId: r.id,
          targetNodeId: s.id,
          sourceNodeType: r.type,
          targetNodeType: s.type,
          strength: 0.9,
          confidence: 1.0,
          label: 'Aggregates',
          visual: computeEdgeVisual('hierarchical', 0.9),
        });
      }
    }

    // 5. Achievement → Goal (hierarchical)
    const achievementNodes = nodes.filter(n => n.type === 'achievement');
    const goalNodes = nodes.filter(n => n.type === 'health_goal' || n.type === 'life_goal');
    for (const a of achievementNodes) {
      // Link to first matching goal (simple heuristic)
      if (goalNodes.length > 0) {
        const target = goalNodes[0];
        edges.push({
          id: makeEdgeId(),
          type: 'achievement_of',
          category: 'hierarchical',
          sourceNodeId: a.id,
          targetNodeId: target.id,
          sourceNodeType: a.type,
          targetNodeType: target.type,
          strength: 0.7,
          confidence: 0.5,
          label: 'Achievement of',
          visual: computeEdgeVisual('hierarchical', 0.7),
        });
      }
    }

    return edges;
  }

  /**
   * Find nodes that belong to a given domain keyword.
   * Matches against node types that contain the domain substring.
   */
  private findDomainNodes(nodes: GraphNode[], domain: string): GraphNode[] {
    const domainTypeMap: Record<string, GraphNodeType[]> = {
      mood: ['mood_entry'],
      stress: ['stress_log'],
      energy: ['energy_log'],
      sleep: ['sleep_session'],
      workout: ['workout_session'],
      exercise: ['workout_session'],
      nutrition: ['meal'],
      meal: ['meal'],
      recovery: ['recovery_score'],
      strain: ['strain_score'],
      journal: ['journal_entry'],
      habit: ['habit_completion'],
      water: ['water_intake'],
      hydration: ['water_intake'],
    };

    const matchingTypes = domainTypeMap[domain.toLowerCase()];
    if (!matchingTypes) return [];

    return nodes.filter((n) => matchingTypes.includes(n.type));
  }

  // ------------------------------------------
  // NODE LIMITING
  // ------------------------------------------

  /**
   * Trim nodes to maxNodes, always keeping daily_score hub nodes.
   */
  private limitNodes(nodes: GraphNode[], maxNodes: number): GraphNode[] {
    if (nodes.length <= maxNodes) return nodes;

    const hubs = nodes.filter((n) => n.type === 'daily_score');
    const nonHubs = nodes.filter((n) => n.type !== 'daily_score');

    // Sort non-hub nodes by size (importance) descending
    nonHubs.sort((a, b) => b.visual.size - a.visual.size);

    const remaining = Math.max(0, maxNodes - hubs.length);
    return [...hubs, ...nonHubs.slice(0, remaining)];
  }

  // ------------------------------------------
  // STATS COMPUTATION
  // ------------------------------------------

  private computeStats(
    nodes: GraphNode[],
    edges: GraphEdge[],
    dateRange: GraphDateRange,
  ): GraphStats {
    const nodeCountByCategory: Partial<Record<GraphNodeCategory, number>> = {};
    for (const node of nodes) {
      nodeCountByCategory[node.category] =
        (nodeCountByCategory[node.category] ?? 0) + 1;
    }

    const edgeCountByCategory: Partial<Record<EdgeCategory, number>> = {};
    for (const edge of edges) {
      edgeCountByCategory[edge.category] =
        (edgeCountByCategory[edge.category] ?? 0) + 1;
    }

    return {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      nodeCountByCategory,
      edgeCountByCategory,
      dateRange,
    };
  }

  // ------------------------------------------
  // CORE PUBLIC METHOD
  // ------------------------------------------

  /**
   * Build the knowledge graph for a user with the given filter.
   *
   * 1. Runs 31 parallel SQL queries (filtered by category if provided)
   * 2. Builds edges deterministically in memory
   * 3. Applies node limits
   * 4. Computes stats
   */
  async buildGraph(
    userId: string,
    filter: GraphFilter,
  ): Promise<KnowledgeGraphData> {
    const start = Date.now();
    const { from, to } = filter.dateRange;

    logger.info('KnowledgeGraph: building graph', {
      userId,
      dateRange: filter.dateRange,
      categories: filter.categories,
      maxNodes: filter.maxNodes,
    });

    // Determine which fetchers to run based on category filter
    let fetcherKeys: string[];

    if (filter.categories && filter.categories.length > 0) {
      const keySet = new Set<string>();
      for (const cat of filter.categories) {
        const keys = CATEGORY_FETCHER_MAP[cat] ?? [];
        for (const k of keys) {
          keySet.add(k);
        }
      }
      fetcherKeys = Array.from(keySet);
    } else {
      fetcherKeys = Object.keys(this.fetcherMap);
    }

    // Run all selected fetchers in parallel with per-fetcher error isolation
    const fetcherEntries = fetcherKeys.map((key) => ({
      key,
      fetcher: this.fetcherMap[key]!,
    }));

    const results = await Promise.all(
      fetcherEntries.map(async ({ key, fetcher }) => {
        const fetchStart = Date.now();
        try {
          const nodes = await fetcher(userId, from, to);
          const fetchDuration = Date.now() - fetchStart;
          if (fetchDuration > 2000) {
            logger.warn('KnowledgeGraph: slow fetcher', {
              fetcher: key,
              durationMs: fetchDuration,
              nodeCount: nodes.length,
            });
          }
          return nodes;
        } catch (err) {
          const fetchDuration = Date.now() - fetchStart;
          logger.warn('KnowledgeGraph: fetcher failed, skipping', {
            fetcher: key,
            durationMs: fetchDuration,
            error: err instanceof Error ? err.message : String(err),
          });
          return [] as GraphNode[];
        }
      }),
    );

    // Flatten all nodes
    let allNodes = results.flat();

    // Apply node type filter if provided
    if (filter.nodeTypes && filter.nodeTypes.length > 0) {
      const allowedTypes = new Set(filter.nodeTypes);
      allNodes = allNodes.filter((n) => allowedTypes.has(n.type));
    }

    // Apply node limit (default 200)
    const maxNodes = filter.maxNodes ?? 200;
    allNodes = this.limitNodes(allNodes, maxNodes);

    // Build edges from the collected (and limited) nodes
    let edges = this.buildEdges(allNodes);

    // Apply edge category filter if provided
    if (filter.edgeCategories && filter.edgeCategories.length > 0) {
      const allowedEdgeCats = new Set(filter.edgeCategories);
      edges = edges.filter((e) => allowedEdgeCats.has(e.category));
    }

    // Apply edge type filter if provided
    if (filter.edgeTypes && filter.edgeTypes.length > 0) {
      const allowedEdgeTypes = new Set(filter.edgeTypes);
      edges = edges.filter((e) => allowedEdgeTypes.has(e.type));
    }

    // Apply minimum edge strength filter
    if (filter.minEdgeStrength != null) {
      edges = edges.filter((e) => e.strength >= filter.minEdgeStrength!);
    }

    // Apply minimum edge confidence filter
    if (filter.minEdgeConfidence != null) {
      edges = edges.filter((e) => e.confidence >= filter.minEdgeConfidence!);
    }

    // Apply edge limit if provided
    if (filter.maxEdges != null && edges.length > filter.maxEdges) {
      edges.sort((a, b) => b.strength - a.strength);
      edges = edges.slice(0, filter.maxEdges);
    }

    // Remove isolated nodes if requested (default: include them)
    if (filter.includeIsolatedNodes === false) {
      const connectedNodeIds = new Set<string>();
      for (const edge of edges) {
        connectedNodeIds.add(edge.sourceNodeId);
        connectedNodeIds.add(edge.targetNodeId);
      }
      allNodes = allNodes.filter((n) => connectedNodeIds.has(n.id));
    }

    // Compute stats
    const stats = this.computeStats(allNodes, edges, filter.dateRange);

    const duration = Date.now() - start;
    logger.info('KnowledgeGraph: graph built', {
      userId,
      durationMs: duration,
      totalNodes: allNodes.length,
      totalEdges: edges.length,
    });

    return {
      nodes: allNodes,
      edges,
      meta: {
        userId,
        filter,
        stats,
        computedAt: new Date().toISOString(),
      },
    };
  }

  // ------------------------------------------
  // NODE DETAIL
  // ------------------------------------------

  /**
   * Fetch full detail for a single node, including 1-hop neighbors.
   */
  async getNodeDetail(
    userId: string,
    nodeId: string,
    nodeType: GraphNodeType,
  ): Promise<{
    node: GraphNode | null;
    neighbors: GraphNode[];
    edges: GraphEdge[];
  }> {
    const tableMap: Partial<Record<GraphNodeType, string>> = {
      workout_session: 'workout_logs',
      meal: 'meal_logs',
      mood_entry: 'mood_logs',
      stress_log: 'stress_logs',
      energy_log: 'energy_logs',
      journal_entry: 'journal_entries',
      daily_checkin: 'daily_checkins',
      water_intake: 'water_intake_logs',
      health_goal: 'user_goals',
      life_goal: 'life_goals',
      daily_score: 'daily_user_scores',
      voice_call: 'voice_calls',
      // Phase 1 expansion
      breathing_test: 'breathing_tests',
      yoga_session: 'yoga_session_logs',
      meditation_session: 'meditation_timers',
      voice_journal: 'voice_journal_sessions',
      emotion_detection: 'emotion_logs',
      progress_record: 'progress_records',
      daily_intention: 'daily_intentions',
      weekly_report: 'weekly_analysis_reports',
      emotional_screening: 'emotional_checkin_sessions',
      nutrition_pattern: 'nutrition_adherence_patterns',
      chat_message: 'rag_messages',
      activity_completion: 'activity_logs',
      schedule_entry: 'daily_schedules',
      finance_transaction: 'finance_transactions',
      achievement: 'user_achievements',
    };

    const table = tableMap[nodeType];
    if (!table) {
      return { node: null, neighbors: [], edges: [] };
    }

    try {
      const result = await query(
        `SELECT * FROM ${table} WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [nodeId, userId],
      );

      if (result.rows.length === 0) {
        return { node: null, neighbors: [], edges: [] };
      }

      const row = result.rows[0];

      // Determine the date for fetching neighbors
      const dateField =
        row.scheduled_date ?? row.date ?? row.log_date ?? row.metric_date ?? row.checkin_date;
      const timestampField =
        row.eaten_at ?? row.logged_at ?? row.created_at ?? row.detected_at;

      const nodeDate = dateField?.toString().slice(0, 10) ??
        timestampField?.toString().slice(0, 10) ?? '';

      if (!nodeDate) {
        return { node: null, neighbors: [], edges: [] };
      }

      // Fetch a small graph for that date to get 1-hop neighbors
      const miniGraph = await this.buildGraph(userId, {
        dateRange: { from: nodeDate, to: nodeDate },
        maxNodes: 50,
      });

      const targetNode = miniGraph.nodes.find((n) => n.id === nodeId) ?? null;
      const connectedEdges = miniGraph.edges.filter(
        (e) => e.sourceNodeId === nodeId || e.targetNodeId === nodeId,
      );
      const neighborIds = new Set<string>();
      for (const e of connectedEdges) {
        if (e.sourceNodeId !== nodeId) neighborIds.add(e.sourceNodeId);
        if (e.targetNodeId !== nodeId) neighborIds.add(e.targetNodeId);
      }
      const neighbors = miniGraph.nodes.filter(
        (n) => neighborIds.has(n.id) && n.id !== nodeId,
      );

      return {
        node: targetNode,
        neighbors,
        edges: connectedEdges,
      };
    } catch (err) {
      logger.warn('KnowledgeGraph: getNodeDetail failed', {
        nodeId,
        nodeType,
        error: err instanceof Error ? err.message : String(err),
      });
      return { node: null, neighbors: [], edges: [] };
    }
  }

  // ------------------------------------------
  // NODE SEARCH
  // ------------------------------------------

  /**
   * Search nodes by label across multiple source tables.
   * Uses ILIKE for case-insensitive partial matching.
   */
  async searchNodes(
    userId: string,
    searchQuery: string,
    dateRange: GraphDateRange,
  ): Promise<GraphNode[]> {
    if (!searchQuery || searchQuery.trim().length === 0) {
      return [];
    }

    const pattern = `%${searchQuery.trim()}%`;
    const { from, to } = dateRange;

    // Run searches across key tables in parallel
    const searches = [
      // Workouts
      query(
        `SELECT id, workout_name AS label, scheduled_date AS date, 'workout_session' AS type
         FROM workout_logs
         WHERE user_id = $1 AND scheduled_date BETWEEN $2 AND $3
           AND workout_name ILIKE $4
         LIMIT 20`,
        [userId, from, to, pattern],
      ).catch(() => ({ rows: [] })),

      // Meals
      query(
        `SELECT id, COALESCE(meal_name, meal_type) AS label, eaten_at::date AS date, 'meal' AS type
         FROM meal_logs
         WHERE user_id = $1 AND eaten_at::date BETWEEN $2 AND $3
           AND (meal_name ILIKE $4 OR meal_type ILIKE $4)
         LIMIT 20`,
        [userId, from, to, pattern],
      ).catch(() => ({ rows: [] })),

      // Journal entries
      query(
        `SELECT id, COALESCE(prompt_category, 'Journal') AS label, logged_at::date AS date, 'journal_entry' AS type
         FROM journal_entries
         WHERE user_id = $1 AND logged_at::date BETWEEN $2 AND $3
           AND (entry_text ILIKE $4 OR prompt_category::text ILIKE $4)
         LIMIT 20`,
        [userId, from, to, pattern],
      ).catch(() => ({ rows: [] })),

      // Habits
      query(
        `SELECT hl.id, h.habit_name AS label, hl.log_date AS date, 'habit_completion' AS type
         FROM habit_logs hl
         JOIN habits h ON hl.habit_id = h.id
         WHERE hl.user_id = $1 AND hl.log_date BETWEEN $2 AND $3
           AND h.habit_name ILIKE $4
         LIMIT 20`,
        [userId, from, to, pattern],
      ).catch(() => ({ rows: [] })),

      // Health goals
      query(
        `SELECT id, title AS label, target_date AS date, 'health_goal' AS type
         FROM user_goals
         WHERE user_id = $1 AND status IN ('active', 'in_progress')
           AND title ILIKE $2
         LIMIT 20`,
        [userId, pattern],
      ).catch(() => ({ rows: [] })),

      // Life goals
      query(
        `SELECT id, title AS label, '' AS date, 'life_goal' AS type
         FROM life_goals
         WHERE user_id = $1 AND status IN ('active', 'in_progress')
           AND title ILIKE $2
         LIMIT 20`,
        [userId, pattern],
      ).catch(() => ({ rows: [] })),
    ];

    const results = await Promise.all(searches);

    const typeToCategory: Record<string, GraphNodeCategory> = {
      workout_session: 'fitness',
      meal: 'nutrition',
      journal_entry: 'wellbeing',
      habit_completion: 'wellbeing',
      health_goal: 'goals',
      life_goal: 'goals',
    };

    const nodes: GraphNode[] = [];

    for (const result of results) {
      for (const row of result.rows) {
        const nodeType = row.type as GraphNodeType;
        const category = typeToCategory[nodeType] ?? ('wellbeing' as GraphNodeCategory);
        nodes.push({
          id: row.id,
          type: nodeType,
          category,
          label: row.label || nodeType,
          date: row.date?.toString().slice(0, 10) ?? '',
          timestamp: row.date ?? '',
          data: {} as any,
          visual: computeVisual(category, 8),
          sourceTable: '',
        });
      }
    }

    return nodes;
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const knowledgeGraphService = new KnowledgeGraphService();

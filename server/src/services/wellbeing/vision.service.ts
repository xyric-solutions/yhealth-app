/**
 * @file Vision Testing Service
 * @description Manages color vision tests, eye exercises, streaks, and analytics
 */

import { query } from '../../database/pg.js';
import { ApiError } from '../../utils/ApiError.js';
import type {
  VisionTestSession,
  VisionTestResponse,
  VisionStreak,
  VisionMilestone,
  VisionMilestoneType,
  VisionStats,
  VisionClassification,
  SubmitPlateResponseInput,
} from '../../../../shared/types/domain/vision.js';
import type {
  StartVisionTestInput,
  CompleteVisionTestInput,
  StartEyeExerciseInput,
  CompleteEyeExerciseInput,
  VisionHistoryInput,
} from '../../validators/vision.validator.js';

// ============================================
// DB ROW TYPES
// ============================================

interface SessionRow {
  id: string;
  user_id: string;
  test_type: string;
  difficulty: string;
  total_plates: number;
  correct_count: number;
  accuracy_percentage: string;
  average_response_time_ms: number | null;
  total_duration_seconds: number | null;
  vision_classification: string | null;
  confidence_score: string | null;
  exercise_type: string | null;
  exercise_duration_seconds: number | null;
  plate_seed: string | null;
  notes: string | null;
  mood_before: number | null;
  mood_after: number | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ResponseRow {
  id: string;
  session_id: string;
  plate_index: number;
  plate_type: string;
  correct_answer: string;
  user_answer: string | null;
  is_correct: boolean;
  response_time_ms: number | null;
  timed_out: boolean;
  created_at: string;
}

interface StreakRow {
  id: string;
  user_id: string;
  current_streak: number;
  longest_streak: number;
  total_sessions: number;
  total_exercises: number;
  last_session_date: string | null;
  milestones_achieved: VisionMilestone[] | string;
  created_at: string;
  updated_at: string;
}

// ============================================
// SERVICE
// ============================================

class VisionService {

  // ------------------------------------------
  // START TEST
  // ------------------------------------------

  async startTest(userId: string, input: StartVisionTestInput): Promise<VisionTestSession> {
    const totalPlates = input.testType === 'color_vision_quick' ? 10 : 15;
    const seed = `${userId.slice(0, 8)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const result = await query<SessionRow>(
      `INSERT INTO vision_test_sessions (
        user_id, test_type, difficulty, total_plates, plate_seed, mood_before, started_at
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      RETURNING *`,
      [userId, input.testType, input.difficulty || 'standard', totalPlates, seed, input.moodBefore || null]
    );

    return this.mapSessionRow(result.rows[0]);
  }

  // ------------------------------------------
  // COMPLETE TEST
  // ------------------------------------------

  async completeTest(userId: string, sessionId: string, input: CompleteVisionTestInput): Promise<VisionTestSession> {
    // Verify ownership
    const existing = await query<SessionRow>(
      'SELECT * FROM vision_test_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );
    if (existing.rows.length === 0) throw ApiError.notFound('Session not found');
    if (existing.rows[0].completed_at) throw ApiError.badRequest('Session already completed');

    // Insert responses
    for (const r of input.responses) {
      await query(
        `INSERT INTO vision_test_responses (
          session_id, plate_index, plate_type, correct_answer, user_answer,
          is_correct, response_time_ms, timed_out
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [sessionId, r.plateIndex, r.plateType, r.correctAnswer, r.userAnswer || null,
         r.isCorrect, r.responseTimeMs || null, r.timedOut || false]
      );
    }

    // Calculate results
    const correctCount = input.responses.filter(r => r.isCorrect).length;
    const accuracy = input.responses.length > 0 ? (correctCount / input.responses.length) * 100 : 0;
    const responseTimes = input.responses.filter(r => r.responseTimeMs).map(r => r.responseTimeMs!);
    const avgResponseTime = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : null;

    // Classify vision
    const { classification, confidence } = this.classifyVision(input.responses);

    // Update session
    const result = await query<SessionRow>(
      `UPDATE vision_test_sessions SET
        correct_count = $1, accuracy_percentage = $2, average_response_time_ms = $3,
        total_duration_seconds = $4, vision_classification = $5, confidence_score = $6,
        mood_after = $7, notes = $8, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $9 AND user_id = $10
      RETURNING *`,
      [correctCount, accuracy, avgResponseTime, input.totalDurationSeconds,
       classification, confidence, input.moodAfter || null, input.notes || null,
       sessionId, userId]
    );

    // Update streak
    await this.updateStreak(userId, new Date(), 'test');

    return this.mapSessionRow(result.rows[0]);
  }

  // ------------------------------------------
  // EYE EXERCISES
  // ------------------------------------------

  async startExercise(userId: string, input: StartEyeExerciseInput): Promise<VisionTestSession> {
    const result = await query<SessionRow>(
      `INSERT INTO vision_test_sessions (
        user_id, test_type, difficulty, total_plates, exercise_type,
        exercise_duration_seconds, mood_before, started_at
      ) VALUES ($1, 'eye_exercise', 'standard', 0, $2, $3, $4, CURRENT_TIMESTAMP)
      RETURNING *`,
      [userId, input.exerciseType, input.durationSeconds, input.moodBefore || null]
    );

    return this.mapSessionRow(result.rows[0]);
  }

  async completeExercise(userId: string, sessionId: string, input: CompleteEyeExerciseInput): Promise<VisionTestSession> {
    const existing = await query<SessionRow>(
      'SELECT * FROM vision_test_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );
    if (existing.rows.length === 0) throw ApiError.notFound('Session not found');

    const startedAt = new Date(existing.rows[0].started_at);
    const durationSeconds = Math.round((Date.now() - startedAt.getTime()) / 1000);

    const result = await query<SessionRow>(
      `UPDATE vision_test_sessions SET
        total_duration_seconds = $1, mood_after = $2, notes = $3,
        completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND user_id = $5
      RETURNING *`,
      [durationSeconds, input.moodAfter || null, input.notes || null, sessionId, userId]
    );

    await this.updateStreak(userId, new Date(), 'exercise');

    return this.mapSessionRow(result.rows[0]);
  }

  // ------------------------------------------
  // HISTORY & STATS
  // ------------------------------------------

  async getHistory(userId: string, filter: VisionHistoryInput): Promise<{ sessions: VisionTestSession[]; total: number }> {
    const conditions = ['user_id = $1'];
    const params: (string | number)[] = [userId];
    let idx = 2;

    if (filter.testType) {
      conditions.push(`test_type = $${idx++}`);
      params.push(filter.testType);
    }
    if (filter.startDate) {
      conditions.push(`started_at >= $${idx++}`);
      params.push(filter.startDate);
    }
    if (filter.endDate) {
      conditions.push(`started_at <= $${idx++}`);
      params.push(filter.endDate);
    }

    const where = conditions.join(' AND ');

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM vision_test_sessions WHERE ${where}`,
      params
    );

    const result = await query<SessionRow>(
      `SELECT * FROM vision_test_sessions WHERE ${where}
       ORDER BY started_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, filter.limit || 20, filter.offset || 0]
    );

    return {
      sessions: result.rows.map(r => this.mapSessionRow(r)),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  async getStats(userId: string): Promise<VisionStats> {
    const streak = await this.getStreak(userId);

    // Aggregate stats
    const statsResult = await query<{
      total_tests: string;
      total_exercises: string;
      avg_accuracy: string;
      avg_response_time: string;
    }>(
      `SELECT
        COUNT(*) FILTER (WHERE test_type != 'eye_exercise' AND completed_at IS NOT NULL) as total_tests,
        COUNT(*) FILTER (WHERE test_type = 'eye_exercise' AND completed_at IS NOT NULL) as total_exercises,
        COALESCE(AVG(accuracy_percentage) FILTER (WHERE test_type != 'eye_exercise' AND completed_at IS NOT NULL), 0) as avg_accuracy,
        COALESCE(AVG(average_response_time_ms) FILTER (WHERE test_type != 'eye_exercise' AND completed_at IS NOT NULL), 0) as avg_response_time
      FROM vision_test_sessions WHERE user_id = $1`,
      [userId]
    );

    const s = statsResult.rows[0];

    // Latest classification
    const latestResult = await query<{ vision_classification: string }>(
      `SELECT vision_classification FROM vision_test_sessions
       WHERE user_id = $1 AND vision_classification IS NOT NULL AND completed_at IS NOT NULL
       ORDER BY completed_at DESC LIMIT 1`,
      [userId]
    );

    // Classification history (last 10)
    const classHistory = await query<{ date: string; classification: string; accuracy: string }>(
      `SELECT completed_at::date as date, vision_classification as classification, accuracy_percentage as accuracy
       FROM vision_test_sessions
       WHERE user_id = $1 AND vision_classification IS NOT NULL AND completed_at IS NOT NULL
       ORDER BY completed_at DESC LIMIT 10`,
      [userId]
    );

    // Accuracy trend (last 20 tests)
    const accuracyTrend = await query<{ date: string; accuracy: string }>(
      `SELECT started_at::date as date, accuracy_percentage as accuracy
       FROM vision_test_sessions
       WHERE user_id = $1 AND test_type != 'eye_exercise' AND completed_at IS NOT NULL
       ORDER BY started_at DESC LIMIT 20`,
      [userId]
    );

    // Response time trend
    const rtTrend = await query<{ date: string; avg_ms: string }>(
      `SELECT started_at::date as date, average_response_time_ms as avg_ms
       FROM vision_test_sessions
       WHERE user_id = $1 AND test_type != 'eye_exercise' AND completed_at IS NOT NULL AND average_response_time_ms IS NOT NULL
       ORDER BY started_at DESC LIMIT 20`,
      [userId]
    );

    // Suggested exercises based on classification
    const latestClass = latestResult.rows[0]?.vision_classification as VisionClassification | undefined;
    const suggestedExercises = this.getSuggestedExercises(latestClass);

    return {
      totalTests: parseInt(s.total_tests, 10),
      totalExercises: parseInt(s.total_exercises, 10),
      averageAccuracy: parseFloat(s.avg_accuracy) || 0,
      averageResponseTimeMs: parseFloat(s.avg_response_time) || 0,
      latestClassification: latestClass,
      classificationHistory: classHistory.rows.map(r => ({
        date: r.date,
        classification: r.classification as VisionClassification,
        accuracy: parseFloat(r.accuracy),
      })),
      accuracyTrend: accuracyTrend.rows.map(r => ({
        date: r.date,
        accuracy: parseFloat(r.accuracy),
      })).reverse(),
      responseTimeTrend: rtTrend.rows.map(r => ({
        date: r.date,
        avgMs: parseFloat(r.avg_ms),
      })).reverse(),
      streak,
      suggestedExercises,
    };
  }

  async getSessionById(userId: string, sessionId: string): Promise<VisionTestSession & { responses: VisionTestResponse[] }> {
    const sessionResult = await query<SessionRow>(
      'SELECT * FROM vision_test_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );
    if (sessionResult.rows.length === 0) throw ApiError.notFound('Session not found');

    const responsesResult = await query<ResponseRow>(
      'SELECT * FROM vision_test_responses WHERE session_id = $1 ORDER BY plate_index',
      [sessionId]
    );

    return {
      ...this.mapSessionRow(sessionResult.rows[0]),
      responses: responsesResult.rows.map(r => this.mapResponseRow(r)),
    };
  }

  // ------------------------------------------
  // STREAKS
  // ------------------------------------------

  async getStreak(userId: string): Promise<VisionStreak> {
    const result = await query<StreakRow>(
      'SELECT * FROM vision_streaks WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      // Auto-create
      const created = await query<StreakRow>(
        `INSERT INTO vision_streaks (user_id) VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING
         RETURNING *`,
        [userId]
      );
      if (created.rows.length > 0) return this.mapStreakRow(created.rows[0]);

      // Race condition — re-fetch
      const refetch = await query<StreakRow>('SELECT * FROM vision_streaks WHERE user_id = $1', [userId]);
      return this.mapStreakRow(refetch.rows[0]);
    }

    return this.mapStreakRow(result.rows[0]);
  }

  private async updateStreak(userId: string, sessionDate: Date, type: 'test' | 'exercise'): Promise<VisionStreak> {
    const today = sessionDate.toISOString().split('T')[0];
    let streak = await this.getStreak(userId);

    const lastDate = streak.lastSessionDate;
    let newCurrent = streak.currentStreak;

    if (!lastDate) {
      newCurrent = 1;
    } else {
      const last = new Date(lastDate);
      const diff = Math.floor((sessionDate.getTime() - last.getTime()) / 86400000);
      if (diff === 0) {
        // Same day — no streak change
      } else if (diff === 1) {
        newCurrent = streak.currentStreak + 1;
      } else {
        newCurrent = 1; // streak broken
      }
    }

    const newLongest = Math.max(streak.longestStreak, newCurrent);
    const sessInc = type === 'test' ? 1 : 0;
    const exInc = type === 'exercise' ? 1 : 0;

    await query(
      `UPDATE vision_streaks SET
        current_streak = $1, longest_streak = $2,
        total_sessions = total_sessions + $3, total_exercises = total_exercises + $4,
        last_session_date = $5, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $6`,
      [newCurrent, newLongest, sessInc, exInc, today, userId]
    );

    streak = { ...streak, currentStreak: newCurrent, longestStreak: newLongest, lastSessionDate: today };
    await this.checkMilestones(userId, streak);

    return streak;
  }

  private async checkMilestones(userId: string, streak: VisionStreak): Promise<void> {
    const achieved = new Set(streak.milestonesAchieved.map(m => m.milestone));
    const newMilestones: VisionMilestone[] = [];
    const now = new Date().toISOString();

    const checks: [VisionMilestoneType, boolean][] = [
      ['first_test', streak.totalSessions >= 1],
      ['10_sessions', streak.totalSessions >= 10],
      ['50_sessions', streak.totalSessions >= 50],
      ['7_day_streak', streak.currentStreak >= 7],
      ['30_day_streak', streak.currentStreak >= 30],
    ];

    for (const [milestone, condition] of checks) {
      if (condition && !achieved.has(milestone)) {
        newMilestones.push({ milestone, achievedAt: now });
      }
    }

    if (newMilestones.length > 0) {
      const all = [...streak.milestonesAchieved, ...newMilestones];
      await query(
        `UPDATE vision_streaks SET milestones_achieved = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
        [JSON.stringify(all), userId]
      );
    }
  }

  // ------------------------------------------
  // CLASSIFICATION
  // ------------------------------------------

  private classifyVision(responses: SubmitPlateResponseInput[]): { classification: VisionClassification; confidence: number } {
    const groups: Record<string, { correct: number; total: number }> = {
      control: { correct: 0, total: 0 },
      protan: { correct: 0, total: 0 },
      deutan: { correct: 0, total: 0 },
      tritan: { correct: 0, total: 0 },
    };

    for (const r of responses) {
      const g = groups[r.plateType];
      if (!g) continue;
      g.total++;
      if (r.isCorrect) g.correct++;
    }

    const acc = (g: { correct: number; total: number }) => g.total > 0 ? g.correct / g.total : 1;

    const controlAcc = acc(groups.control);
    const protanAcc = acc(groups.protan);
    const deutanAcc = acc(groups.deutan);
    const tritanAcc = acc(groups.tritan);

    // Invalid test if control accuracy too low
    if (controlAcc < 0.7) {
      return { classification: 'normal', confidence: 10 };
    }

    // Check for deficiencies
    if (protanAcc < 0.4 && deutanAcc >= 0.7 && tritanAcc >= 0.7) {
      return { classification: 'protan_strong', confidence: Math.min(95, groups.protan.total * 15) };
    }
    if (protanAcc < 0.6 && deutanAcc >= 0.7 && tritanAcc >= 0.7) {
      return { classification: 'protan_weak', confidence: Math.min(85, groups.protan.total * 12) };
    }
    if (deutanAcc < 0.4 && protanAcc >= 0.7 && tritanAcc >= 0.7) {
      return { classification: 'deutan_strong', confidence: Math.min(95, groups.deutan.total * 15) };
    }
    if (deutanAcc < 0.6 && protanAcc >= 0.7 && tritanAcc >= 0.7) {
      return { classification: 'deutan_weak', confidence: Math.min(85, groups.deutan.total * 12) };
    }
    if (tritanAcc < 0.4 && protanAcc >= 0.7 && deutanAcc >= 0.7) {
      return { classification: 'tritan_strong', confidence: Math.min(95, groups.tritan.total * 15) };
    }
    if (tritanAcc < 0.6 && protanAcc >= 0.7 && deutanAcc >= 0.7) {
      return { classification: 'tritan_weak', confidence: Math.min(85, groups.tritan.total * 12) };
    }

    // Normal vision
    const minAcc = Math.min(protanAcc, deutanAcc, tritanAcc);
    const confidence = Math.min(95, Math.round(minAcc * 100));
    return { classification: 'normal', confidence };
  }

  private getSuggestedExercises(classification?: VisionClassification): string[] {
    const base = ['Eye Palming (2 min)', 'Focus Shifting (3 min)', 'Eye Circles (2 min)'];
    if (!classification || classification === 'normal') return base;

    if (classification.startsWith('protan') || classification.startsWith('deutan')) {
      return [...base, 'Trataka Candle Gazing (5 min)', 'Color Awareness Training', 'Contrast Enhancement Exercises'];
    }
    if (classification.startsWith('tritan')) {
      return [...base, 'Blue-Yellow Discrimination Practice', 'Outdoor Natural Light Exercise'];
    }
    return base;
  }

  // ------------------------------------------
  // ROW MAPPERS
  // ------------------------------------------

  private mapSessionRow(row: SessionRow): VisionTestSession {
    return {
      id: row.id,
      userId: row.user_id,
      testType: row.test_type as VisionTestSession['testType'],
      difficulty: row.difficulty as VisionTestSession['difficulty'],
      totalPlates: row.total_plates,
      correctCount: row.correct_count,
      accuracyPercentage: parseFloat(row.accuracy_percentage) || 0,
      averageResponseTimeMs: row.average_response_time_ms ?? undefined,
      totalDurationSeconds: row.total_duration_seconds ?? undefined,
      visionClassification: (row.vision_classification as VisionClassification) ?? undefined,
      confidenceScore: row.confidence_score ? parseFloat(row.confidence_score) : undefined,
      exerciseType: row.exercise_type as VisionTestSession['exerciseType'] ?? undefined,
      exerciseDurationSeconds: row.exercise_duration_seconds ?? undefined,
      plateSeed: row.plate_seed ?? undefined,
      notes: row.notes ?? undefined,
      moodBefore: row.mood_before ?? undefined,
      moodAfter: row.mood_after ?? undefined,
      startedAt: row.started_at,
      completedAt: row.completed_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapResponseRow(row: ResponseRow): VisionTestResponse {
    return {
      id: row.id,
      sessionId: row.session_id,
      plateIndex: row.plate_index,
      plateType: row.plate_type as VisionTestResponse['plateType'],
      correctAnswer: row.correct_answer,
      userAnswer: row.user_answer ?? undefined,
      isCorrect: row.is_correct,
      responseTimeMs: row.response_time_ms ?? undefined,
      timedOut: row.timed_out,
      createdAt: row.created_at,
    };
  }

  private mapStreakRow(row: StreakRow): VisionStreak {
    const milestones = typeof row.milestones_achieved === 'string'
      ? JSON.parse(row.milestones_achieved)
      : row.milestones_achieved || [];

    return {
      id: row.id,
      userId: row.user_id,
      currentStreak: row.current_streak,
      longestStreak: row.longest_streak,
      totalSessions: row.total_sessions,
      totalExercises: row.total_exercises,
      lastSessionDate: row.last_session_date ?? undefined,
      milestonesAchieved: milestones,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const visionService = new VisionService();

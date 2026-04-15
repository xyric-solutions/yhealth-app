/**
 * @file Mindfulness Service
 * @description Handles mindfulness practice recommendations and logging (F7.7)
 */

import { query } from '../../database/pg.js';
import { ApiError } from '../../utils/ApiError.js';
import type {
  MindfulnessPractice,
  MindfulnessPracticeCategory,
  MindfulnessInstruction,
} from '@shared/types/domain/wellbeing.js';

interface PracticeRow {
  id: string;
  user_id: string | null;
  practice_name: string;
  practice_category: MindfulnessPracticeCategory;
  instructions: any; // JSONB
  duration_minutes: number | null;
  when_to_use: string | null;
  why_it_helps: string | null;
  is_system_practice: boolean;
  completed_at: Date | null;
  actual_duration_minutes: number | null;
  effectiveness_rating: number | null;
  context: string | null;
  note: string | null;
  recommended_at: Date | null;
  accepted: boolean | null;
  created_at: Date;
  updated_at: Date;
}

// System practice library
const SYSTEM_PRACTICES: Array<{
  name: string;
  category: MindfulnessPracticeCategory;
  instructions: MindfulnessInstruction[];
  durationMinutes: number;
  whenToUse: string;
  whyItHelps: string;
}> = [
  {
    name: '4-7-8 Breathing',
    category: 'breathing',
    instructions: [
      { step: 1, instruction: 'Exhale completely through your mouth' },
      { step: 2, instruction: 'Close your mouth and inhale through your nose for 4 counts' },
      { step: 3, instruction: 'Hold your breath for 7 counts' },
      { step: 4, instruction: 'Exhale through your mouth for 8 counts' },
      { step: 5, instruction: 'Repeat 3-4 times' },
    ],
    durationMinutes: 2,
    whenToUse: 'Use this when feeling anxious or overwhelmed. Best done sitting or lying down.',
    whyItHelps: 'This breathing pattern activates the parasympathetic nervous system, promoting calm.',
  },
  {
    name: 'Body Scan',
    category: 'meditation',
    instructions: [
      { step: 1, instruction: 'Lie down comfortably or sit with back straight' },
      { step: 2, instruction: 'Close your eyes and focus on your breath' },
      { step: 3, instruction: 'Slowly scan from your toes to your head, noticing sensations' },
      { step: 4, instruction: 'Spend 10-20 seconds on each body part' },
      { step: 5, instruction: 'If your mind wanders, gently return to the body scan' },
    ],
    durationMinutes: 10,
    whenToUse: 'Helpful for stress relief, body awareness, and before sleep.',
    whyItHelps: 'Promotes body awareness and helps release physical tension.',
  },
  {
    name: 'Walking Meditation',
    category: 'movement',
    instructions: [
      { step: 1, instruction: 'Find a quiet path, about 10-20 steps long' },
      { step: 2, instruction: 'Walk slowly, focusing on each step' },
      { step: 3, instruction: 'Notice the sensation of your feet touching the ground' },
      { step: 4, instruction: 'If your mind wanders, return focus to walking' },
      { step: 5, instruction: 'Walk for 5-10 minutes' },
    ],
    durationMinutes: 10,
    whenToUse: 'Great for when sitting still feels difficult or when you need movement.',
    whyItHelps: 'Combines physical movement with mindfulness, helping ground you in the present.',
  },
];

class MindfulnessService {
  async getPractices(userId?: string): Promise<MindfulnessPractice[]> {
    // Get system practices
    const systemResult = await query<PracticeRow>(
      `SELECT * FROM mindfulness_practices WHERE is_system_practice = true ORDER BY practice_name`
    );

    let userPractices: PracticeRow[] = [];
    if (userId) {
      const userResult = await query<PracticeRow>(
        `SELECT * FROM mindfulness_practices 
         WHERE user_id = $1 AND is_system_practice = false AND completed_at IS NOT NULL
         ORDER BY completed_at DESC`,
        [userId]
      );
      userPractices = userResult.rows;
    }

    return [...systemResult.rows.map((r) => this.mapRowToPractice(r)), ...userPractices.map((r) => this.mapRowToPractice(r))];
  }

  async getRecommendedPractice(userId: string, context?: 'high_stress' | 'low_energy' | 'low_mood' | 'poor_sleep'): Promise<MindfulnessPractice | null> {
    // Simple recommendation logic based on context
    // TODO: Enhance with AI-based personalization
    
    let recommendedCategory: MindfulnessPracticeCategory;
    
    switch (context) {
      case 'high_stress':
        recommendedCategory = 'breathing';
        break;
      case 'low_energy':
        recommendedCategory = 'movement';
        break;
      case 'low_mood':
        recommendedCategory = 'meditation';
        break;
      case 'poor_sleep':
        recommendedCategory = 'evening';
        break;
      default:
        recommendedCategory = 'breathing';
    }

    const result = await query<PracticeRow>(
      `SELECT * FROM mindfulness_practices 
       WHERE is_system_practice = true AND practice_category = $1 
       ORDER BY RANDOM() 
       LIMIT 1`,
      [recommendedCategory]
    );

    if (result.rows.length === 0) {
      return null;
    }

    // Log recommendation
    await query(
      `INSERT INTO mindfulness_practices (user_id, practice_name, practice_category, instructions, 
       duration_minutes, when_to_use, why_it_helps, is_system_practice, recommended_at, context)
       VALUES ($1, $2, $3, $4, $5, $6, $7, false, CURRENT_TIMESTAMP, $8)`,
      [
        userId,
        result.rows[0].practice_name,
        result.rows[0].practice_category,
        JSON.stringify(result.rows[0].instructions),
        result.rows[0].duration_minutes,
        result.rows[0].when_to_use,
        result.rows[0].why_it_helps,
        context || null,
      ]
    );

    return this.mapRowToPractice(result.rows[0]);
  }

  async logPractice(userId: string, input: {
    practiceName: string;
    practiceCategory: MindfulnessPracticeCategory;
    actualDurationMinutes?: number;
    effectivenessRating?: number;
    context?: string;
    note?: string;
  }): Promise<MindfulnessPractice> {
    // Get system practice details
    const systemPractice = await query<PracticeRow>(
      `SELECT * FROM mindfulness_practices 
       WHERE is_system_practice = true AND practice_name = $1 AND practice_category = $2 
       LIMIT 1`,
      [input.practiceName, input.practiceCategory]
    );

    if (systemPractice.rows.length === 0) {
      throw ApiError.badRequest('Practice not found in library');
    }

    const practice = systemPractice.rows[0];

    const result = await query<PracticeRow>(
      `INSERT INTO mindfulness_practices (
        user_id, practice_name, practice_category, instructions,
        duration_minutes, when_to_use, why_it_helps, is_system_practice,
        completed_at, actual_duration_minutes, effectiveness_rating, context, note
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        userId,
        practice.practice_name,
        practice.practice_category,
        practice.instructions,
        practice.duration_minutes,
        practice.when_to_use,
        practice.why_it_helps,
        new Date().toISOString(),
        input.actualDurationMinutes || null,
        input.effectivenessRating || null,
        input.context || null,
        input.note || null,
      ]
    );

    return this.mapRowToPractice(result.rows[0]);
  }

  async getPracticeHistory(userId: string, limit = 20): Promise<MindfulnessPractice[]> {
    const result = await query<PracticeRow>(
      `SELECT * FROM mindfulness_practices
       WHERE user_id = $1 AND is_system_practice = false AND completed_at IS NOT NULL
       ORDER BY completed_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows.map((r) => this.mapRowToPractice(r));
  }

  async initializeSystemPractices(): Promise<void> {
    // Check if practices already exist
    const existing = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM mindfulness_practices WHERE is_system_practice = true`
    );

    if (parseInt(existing.rows[0].count, 10) > 0) {
      return; // Already initialized
    }

    // Insert system practices
    for (const practice of SYSTEM_PRACTICES) {
      await query(
        `INSERT INTO mindfulness_practices (
          user_id, practice_name, practice_category, instructions,
          duration_minutes, when_to_use, why_it_helps, is_system_practice
        ) VALUES (NULL, $1, $2, $3, $4, $5, $6, true)`,
        [
          practice.name,
          practice.category,
          JSON.stringify(practice.instructions),
          practice.durationMinutes,
          practice.whenToUse,
          practice.whyItHelps,
        ]
      );
    }
  }

  private mapRowToPractice(row: PracticeRow): MindfulnessPractice {
    return {
      id: row.id,
      userId: row.user_id || undefined,
      practiceName: row.practice_name,
      practiceCategory: row.practice_category,
      instructions: Array.isArray(row.instructions)
        ? row.instructions
        : typeof row.instructions === 'string'
        ? JSON.parse(row.instructions)
        : [],
      durationMinutes: row.duration_minutes || undefined,
      whenToUse: row.when_to_use || undefined,
      whyItHelps: row.why_it_helps || undefined,
      isSystemPractice: row.is_system_practice,
      completedAt: row.completed_at?.toISOString(),
      actualDurationMinutes: row.actual_duration_minutes || undefined,
      effectivenessRating: row.effectiveness_rating || undefined,
      context: row.context || undefined,
      note: row.note || undefined,
      recommendedAt: row.recommended_at?.toISOString(),
      accepted: row.accepted || undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}

export const mindfulnessService = new MindfulnessService();
export default mindfulnessService;


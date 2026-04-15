/**
 * @file Competition Seed Data
 * @description Seeds sample competitions for testing
 */

import { query, closePool } from './pg.js';

interface CompetitionSeed {
  name: string;
  description: string;
  type: 'ai_generated' | 'admin_created';
  start_date: Date;
  end_date: Date;
  status: 'draft' | 'active' | 'ended';
  rules: Record<string, unknown>;
  eligibility?: Record<string, unknown>;
  scoring_weights: {
    workout: number;
    nutrition: number;
    wellbeing: number;
    biometrics: number;
    engagement: number;
    consistency: number;
  };
  prize_metadata?: {
    badges?: string[];
    rewards?: string[];
    top_n?: number;
  };
}

const COMPETITIONS: CompetitionSeed[] = [
  {
    name: 'February Fitness Challenge',
    description: 'Compete in our monthly fitness challenge! Track your workouts, nutrition, and recovery to climb the leaderboard.',
    type: 'admin_created',
    start_date: new Date('2026-02-01'),
    end_date: new Date('2026-02-28'),
    status: 'active',
    rules: {
      metric: 'total_score',
      aggregation: 'total',
      min_days: 5,
    },
    eligibility: {
      regions: [],
      subscription_tiers: [],
    },
    scoring_weights: {
      workout: 25,
      nutrition: 20,
      wellbeing: 15,
      biometrics: 15,
      engagement: 10,
      consistency: 15,
    },
    prize_metadata: {
      badges: ['February Champion', 'Fitness Warrior'],
      rewards: ['Premium Subscription (1 month)', 'Balencia Merchandise'],
      top_n: 10,
    },
  },
  {
    name: 'Daily Workout Streak',
    description: 'Maintain a daily workout streak and compete with others! Consistency is key.',
    type: 'ai_generated',
    start_date: new Date('2026-02-16'),
    end_date: new Date('2026-02-23'),
    status: 'active',
    rules: {
      metric: 'workout',
      aggregation: 'streak',
      min_days: 1,
    },
    eligibility: {
      regions: [],
      subscription_tiers: [],
    },
    scoring_weights: {
      workout: 40,
      nutrition: 15,
      wellbeing: 10,
      biometrics: 15,
      engagement: 10,
      consistency: 10,
    },
    prize_metadata: {
      badges: ['Streak Master'],
      rewards: ['Workout Gear'],
      top_n: 5,
    },
  },
  {
    name: 'Nutrition Excellence',
    description: 'Focus on your nutrition goals! Track meals, hit macros, and maintain healthy eating habits.',
    type: 'admin_created',
    start_date: new Date('2026-02-10'),
    end_date: new Date('2026-02-24'),
    status: 'active',
    rules: {
      metric: 'nutrition',
      aggregation: 'average',
      min_days: 7,
    },
    eligibility: {
      regions: [],
      subscription_tiers: [],
    },
    scoring_weights: {
      workout: 10,
      nutrition: 40,
      wellbeing: 15,
      biometrics: 10,
      engagement: 10,
      consistency: 15,
    },
    prize_metadata: {
      badges: ['Nutrition Expert'],
      rewards: ['Meal Plan Subscription'],
      top_n: 10,
    },
  },
  {
    name: 'Wellness Warrior',
    description: 'Prioritize your wellbeing! Track recovery, sleep, and stress management.',
    type: 'ai_generated',
    start_date: new Date('2026-02-15'),
    end_date: new Date('2026-03-15'),
    status: 'active',
    rules: {
      metric: 'wellbeing',
      aggregation: 'average',
      min_days: 10,
    },
    eligibility: {
      regions: [],
      subscription_tiers: [],
    },
    scoring_weights: {
      workout: 10,
      nutrition: 15,
      wellbeing: 30,
      biometrics: 20,
      engagement: 10,
      consistency: 15,
    },
    prize_metadata: {
      badges: ['Wellness Champion'],
      rewards: ['Recovery Tools'],
      top_n: 15,
    },
  },
];

async function seedCompetitions(): Promise<void> {
  console.log('🏆 Starting competition seed...\n');

  try {
    // Check existing competitions
    const existing = await query<{ id: string; name: string }>(
      'SELECT id, name FROM competitions'
    );

    const existingNames = new Set(existing.rows.map((r) => r.name.toLowerCase()));

    const competitionsToInsert = COMPETITIONS.filter(
      (comp) => !existingNames.has(comp.name.toLowerCase())
    );

    if (competitionsToInsert.length === 0) {
      console.log('✅ All competitions already exist');
      return;
    }

    console.log(`📊 Inserting ${competitionsToInsert.length} competition(s)...\n`);

    for (const competition of competitionsToInsert) {
      await query(
        `INSERT INTO competitions (
          name, description, type, start_date, end_date, status,
          rules, eligibility, scoring_weights, prize_metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          competition.name,
          competition.description,
          competition.type,
          competition.start_date,
          competition.end_date,
          competition.status,
          JSON.stringify(competition.rules),
          competition.eligibility ? JSON.stringify(competition.eligibility) : null,
          JSON.stringify(competition.scoring_weights),
          competition.prize_metadata ? JSON.stringify(competition.prize_metadata) : null,
        ]
      );

      console.log(`✅ Created: "${competition.name}"`);
      console.log(`   Type: ${competition.type}`);
      console.log(`   Status: ${competition.status}`);
      console.log(`   Duration: ${competition.start_date.toLocaleDateString()} - ${competition.end_date.toLocaleDateString()}`);
      console.log(`   Scoring: Workout ${competition.scoring_weights.workout}%, Nutrition ${competition.scoring_weights.nutrition}%, Wellbeing ${competition.scoring_weights.wellbeing}%, Biometrics ${competition.scoring_weights.biometrics}%, Engagement ${competition.scoring_weights.engagement}%, Consistency ${competition.scoring_weights.consistency}%\n`);
    }

    console.log('🎉 Competition seed completed successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   Total competitions: ${COMPETITIONS.length}`);
    console.log(`   Newly created: ${competitionsToInsert.length}`);
    console.log(`   Already existed: ${existing.rows.length}`);

  } catch (error) {
    console.error('❌ Competition seed failed:', error);
    throw error;
  } finally {
    await closePool();
  }
}

// Run seed
seedCompetitions().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});


-- ============================================
-- COMPREHENSIVE MIGRATION: All new tables & fields
-- ============================================
-- Consolidates all pending migrations into a single idempotent script.
-- Safe to run multiple times (uses IF NOT EXISTS / IF NOT EXISTS patterns).
-- Run via: npm run db:migrate:all
-- Or:      tsx src/database/run-migration.ts add-all-new-tables.sql

-- ============================================
-- 1. NEWSLETTER SUBSCRIPTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    interests TEXT[] DEFAULT '{}',
    source VARCHAR(50) DEFAULT 'footer',
    created_at TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'utc'),
    CONSTRAINT newsletter_subscriptions_email_unique UNIQUE (email)
);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscriptions_created_at
  ON newsletter_subscriptions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscriptions_source
  ON newsletter_subscriptions (source);

-- ============================================
-- 2. TESTIMONIALS
-- ============================================
CREATE TABLE IF NOT EXISTS testimonials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    role VARCHAR(100) NOT NULL,
    avatar_url VARCHAR(2000),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    content TEXT NOT NULL,
    verified BOOLEAN DEFAULT false,
    pillar VARCHAR(20) CHECK (pillar IN ('fitness', 'nutrition', 'wellbeing')),
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_testimonials_is_active ON testimonials(is_active);
CREATE INDEX IF NOT EXISTS idx_testimonials_pillar ON testimonials(pillar);
CREATE INDEX IF NOT EXISTS idx_testimonials_display_order ON testimonials(display_order);
CREATE INDEX IF NOT EXISTS idx_testimonials_rating ON testimonials(rating);
CREATE INDEX IF NOT EXISTS idx_testimonials_featured ON testimonials(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_testimonials_search ON testimonials USING gin(
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(role, '') || ' ' || coalesce(content, ''))
);

-- Seed testimonials (skip if already seeded)
INSERT INTO testimonials (name, role, avatar_url, rating, content, verified, pillar, is_active, is_featured, display_order)
VALUES
  ('Sarah Johnson', 'Fitness Enthusiast', '/avatars/sarah.jpg', 5, 'YHealth completely transformed my approach to wellness. The AI insights helped me understand my body better than any other app. I''ve lost 20 pounds and feel more energetic than ever!', true, 'fitness', true, true, 1),
  ('Michael Chen', 'Software Engineer', '/avatars/michael.jpg', 5, 'As someone who spends long hours at the desk, YHealth''s reminders and personalized exercise recommendations have been a game-changer. My back pain is gone and I sleep so much better now.', true, 'wellbeing', true, false, 2),
  ('Emily Rodriguez', 'Working Mom', '/avatars/emily.jpg', 5, 'Balancing work and family left no time for my health. YHealth made it easy with quick workouts and meal planning. The whole family is eating healthier now!', true, 'nutrition', true, false, 3),
  ('David Thompson', 'Marathon Runner', '/avatars/david.jpg', 5, 'The training insights and recovery tracking helped me shave 15 minutes off my marathon time. The integration with my fitness devices is seamless.', true, 'fitness', true, true, 4),
  ('Lisa Park', 'Yoga Instructor', '/avatars/lisa.jpg', 5, 'I recommend YHealth to all my students. The mindfulness features and stress tracking complement yoga practice beautifully. It''s holistic wellness at its best.', true, 'wellbeing', true, false, 5),
  ('James Wilson', 'Personal Trainer', '/avatars/james.jpg', 5, 'As a fitness professional, I''ve tried countless apps. YHealth stands out with its comprehensive approach. I use it with all my clients now.', true, 'fitness', true, false, 6),
  ('Amanda Foster', 'Nutritionist', '/avatars/amanda.jpg', 4, 'The meal tracking and nutritional insights are spot-on. My clients love how easy it is to log their meals and see their progress over time.', true, 'nutrition', true, false, 7),
  ('Robert Kim', 'Business Executive', '/avatars/robert.jpg', 5, 'With my busy schedule, I needed something that works around my life. YHealth''s smart scheduling and quick check-ins fit perfectly into my routine.', true, 'wellbeing', true, false, 8),
  ('Jennifer Adams', 'Healthcare Worker', '/avatars/jennifer.jpg', 5, 'Working night shifts made maintaining health difficult. The personalized recommendations adapted to my schedule beautifully. Highly recommended!', true, 'nutrition', true, false, 9),
  ('Chris Martinez', 'College Student', '/avatars/chris.jpg', 5, 'Affordable and effective! As a student on a budget, YHealth gives me premium features without breaking the bank. My energy levels have never been better.', true, 'fitness', true, false, 10),
  ('Sophia Lee', 'Wellness Coach', '/avatars/sophia.jpg', 5, 'The holistic approach to health tracking is exactly what I recommend to my clients. Sleep, nutrition, exercise, and mental wellness all in one place.', true, 'wellbeing', true, true, 11),
  ('Daniel Brown', 'Retired Teacher', '/avatars/daniel.jpg', 4, 'At 65, I was skeptical about health apps. YHealth proved me wrong with its easy interface and gentle reminders. My doctor is impressed with my progress!', true, 'nutrition', true, false, 12)
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. USER COACHING PROFILES (AI-generated)
-- ============================================
CREATE TABLE IF NOT EXISTS user_coaching_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profile_data JSONB NOT NULL,
    adherence_scores JSONB,
    key_insights JSONB,
    risk_flags JSONB,
    predictions JSONB,
    next_best_actions JSONB,
    goal_alignment JSONB,
    data_gaps JSONB,
    coaching_tone VARCHAR(20) DEFAULT 'direct',
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    generation_model VARCHAR(50),
    generation_tokens INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);
CREATE INDEX IF NOT EXISTS idx_user_coaching_profiles_user_id ON user_coaching_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_coaching_profiles_generated_at ON user_coaching_profiles(generated_at);
CREATE INDEX IF NOT EXISTS idx_user_coaching_profiles_tone ON user_coaching_profiles(coaching_tone);

-- ============================================
-- 4. USER CLASSIFICATIONS (5-tier behavioral analysis)
-- ============================================
CREATE TABLE IF NOT EXISTS user_classifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tier VARCHAR(30) NOT NULL CHECK (tier IN ('elite_performer', 'improving', 'plateau', 'declining', 'at_risk_dropout')),
    score NUMERIC(5,2) NOT NULL,
    factors JSONB NOT NULL,
    previous_tier VARCHAR(30),
    tier_changed_at TIMESTAMPTZ,
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);
CREATE INDEX IF NOT EXISTS idx_uc_user ON user_classifications(user_id);
CREATE INDEX IF NOT EXISTS idx_uc_tier ON user_classifications(tier);

-- ============================================
-- 5. INTENSITY PRESCRIPTIONS (recovery-to-training mapping)
-- ============================================
CREATE TABLE IF NOT EXISTS intensity_prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    recovery_score INTEGER,
    hrv_rmssd NUMERIC(6,2),
    resting_hr INTEGER,
    sleep_hours NUMERIC(4,2),
    prescribed_intensity VARCHAR(20) NOT NULL CHECK (prescribed_intensity IN ('rest', 'light', 'moderate', 'hard', 'peak')),
    max_hr_zone INTEGER CHECK (max_hr_zone BETWEEN 1 AND 5),
    recommended_duration_min INTEGER,
    reasoning TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_ip_user_date ON intensity_prescriptions(user_id, date DESC);

-- ============================================
-- 6. PERSONALITY MODE EVENTS (AI personality tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS personality_mode_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mode VARCHAR(40) NOT NULL,
    trigger_reason TEXT NOT NULL,
    score NUMERIC(5,2),
    context JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pme_user_date ON personality_mode_events(user_id, created_at DESC);

-- ============================================
-- 7. USER INTERVENTIONS (AI intervention framework)
-- ============================================
CREATE TABLE IF NOT EXISTS user_interventions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contradiction_id UUID,
    intervention_type VARCHAR(50) NOT NULL,
    decision_tree VARCHAR(50) NOT NULL,
    original_value JSONB,
    adjusted_value JSONB,
    reasoning TEXT NOT NULL,
    user_notified BOOLEAN DEFAULT false,
    user_accepted BOOLEAN,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ui_user_date ON user_interventions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ui_user_pending ON user_interventions(user_id, user_accepted) WHERE user_accepted IS NULL;
CREATE INDEX IF NOT EXISTS idx_ui_decision_tree ON user_interventions(decision_tree);

-- ============================================
-- 8. CROSS-PILLAR CONTRADICTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS cross_pillar_contradictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rule_id VARCHAR(50) NOT NULL,
    pillar_a VARCHAR(30) NOT NULL,
    pillar_b VARCHAR(30) NOT NULL,
    severity VARCHAR(10) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    evidence JSONB NOT NULL,
    ai_correction TEXT,
    status VARCHAR(20) DEFAULT 'detected' CHECK (status IN ('detected', 'notified', 'resolved', 'dismissed')),
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cpc_user_date ON cross_pillar_contradictions(user_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_cpc_status ON cross_pillar_contradictions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_cpc_rule_id ON cross_pillar_contradictions(rule_id);

-- ============================================
-- 9. GAMIFICATION UPGRADE TABLES
-- ============================================

-- Variable reward drops
CREATE TABLE IF NOT EXISTS variable_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_type VARCHAR(30) NOT NULL,
    reward_value JSONB NOT NULL,
    trigger_event VARCHAR(50) NOT NULL,
    probability NUMERIC(4,3),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vr_user_date ON variable_rewards(user_id, created_at DESC);

-- Daily micro-commitments (pledges)
CREATE TABLE IF NOT EXISTS daily_pledges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    pledge_text TEXT NOT NULL,
    category VARCHAR(30) NOT NULL,
    target_value NUMERIC(10,2),
    actual_value NUMERIC(10,2),
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date, category)
);
CREATE INDEX IF NOT EXISTS idx_dp_user_date ON daily_pledges(user_id, date DESC);

-- Teams for social accountability
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'accountability' CHECK (type IN ('accountability', 'competition')),
    max_members INTEGER DEFAULT 5,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('captain', 'member')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (team_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_tm_user ON team_members(user_id);

-- Achievement tree definitions (5 trees x 5 tiers = 25)
CREATE TABLE IF NOT EXISTS achievement_definitions (
    id VARCHAR(50) PRIMARY KEY,
    tree VARCHAR(30) NOT NULL CHECK (tree IN ('consistency', 'strength', 'nutrition', 'recovery', 'social')),
    tier INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 5),
    title VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    requirement JSONB NOT NULL,
    xp_reward INTEGER NOT NULL,
    badge_icon VARCHAR(50),
    prerequisite_id VARCHAR(50) REFERENCES achievement_definitions(id)
);

-- User achievement progress tracking
CREATE TABLE IF NOT EXISTS user_achievements (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id VARCHAR(50) NOT NULL REFERENCES achievement_definitions(id),
    progress NUMERIC(5,2) DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    unlocked_at TIMESTAMPTZ,
    PRIMARY KEY (user_id, achievement_id)
);
CREATE INDEX IF NOT EXISTS idx_ua_user ON user_achievements(user_id);

-- ============================================
-- 10. VIEW-ONCE MESSAGES (WhatsApp-style)
-- ============================================
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_view_once BOOLEAN DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS view_once_opened_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_messages_view_once ON messages(is_view_once) WHERE is_view_once = true;

-- ============================================
-- 11. SUBSCRIPTION TABLES (Stripe)
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    stripe_price_id VARCHAR(255) UNIQUE,
    stripe_product_id VARCHAR(255),
    amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'usd',
    interval VARCHAR(20) NOT NULL CHECK (interval IN ('month', 'year')),
    features JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0 CHECK (sort_order >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_slug ON subscription_plans(slug);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_stripe_price_id ON subscription_plans(stripe_price_id);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_is_active ON subscription_plans(is_active);

CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
    stripe_subscription_id VARCHAR(255) UNIQUE,
    stripe_customer_id VARCHAR(255),
    status VARCHAR(50) NOT NULL CHECK (status IN (
        'active', 'canceled', 'past_due', 'trialing',
        'incomplete', 'incomplete_expired'
    )),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT false,
    canceled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_subscriptions_one_active_per_user
    ON user_subscriptions(user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_subscription_id ON user_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan_id ON user_subscriptions(plan_id);

-- Users: stripe_customer_id
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);

-- ============================================
-- 12. VISITOR VISITS (analytics)
-- ============================================
CREATE TABLE IF NOT EXISTS visitor_visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    visited_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    visitor_key VARCHAR(64) NOT NULL,
    country_code VARCHAR(2),
    country_name VARCHAR(100),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);
CREATE INDEX IF NOT EXISTS idx_visitor_visits_visited_at ON visitor_visits(visited_at);
CREATE INDEX IF NOT EXISTS idx_visitor_visits_country ON visitor_visits(country_code);

-- ============================================
-- 13. PRODUCT TOUR (user_preferences column)
-- ============================================
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS product_tour_completed BOOLEAN DEFAULT false;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS product_tour_completed_at TIMESTAMP;

-- ============================================
-- 14. EXERCISE INGESTION COLUMNS
-- ============================================
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS source_id VARCHAR(100);
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS body_part VARCHAR(100);
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS target_muscles TEXT[] DEFAULT '{}';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS external_metadata JSONB DEFAULT '{}';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS idx_exercises_search_vector ON exercises USING GIN(search_vector);
CREATE UNIQUE INDEX IF NOT EXISTS idx_exercises_source_source_id ON exercises(source, source_id) WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_exercises_active_source ON exercises(source, is_active) WHERE is_active = true AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_exercises_body_part ON exercises(body_part) WHERE body_part IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_exercises_not_deleted ON exercises(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_exercises_target_muscles ON exercises USING GIN(target_muscles);

-- Backfill source for existing exercises
UPDATE exercises SET source = 'manual' WHERE source IS NULL;

-- ============================================
-- 15. EXERCISE LOOKUP TABLES (muscles, equipment, body_parts, exercise_media)
-- ============================================
CREATE TABLE IF NOT EXISTS muscles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    body_region VARCHAR(50),
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_muscles_slug ON muscles(slug);
CREATE INDEX IF NOT EXISTS idx_muscles_body_region ON muscles(body_region);

CREATE TABLE IF NOT EXISTS equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50),
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_equipment_slug ON equipment(slug);
CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category);

CREATE TABLE IF NOT EXISTS body_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_body_parts_slug ON body_parts(slug);

CREATE TABLE IF NOT EXISTS exercise_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('gif', 'image', 'video', 'thumbnail')),
    url TEXT NOT NULL,
    r2_key TEXT,
    width INTEGER,
    height INTEGER,
    source VARCHAR(50) DEFAULT 'exercisedb',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_exercise_media_exercise_id ON exercise_media(exercise_id);
CREATE INDEX IF NOT EXISTS idx_exercise_media_type ON exercise_media(type);
CREATE INDEX IF NOT EXISTS idx_exercise_media_source ON exercise_media(source);

-- ============================================
-- 16. FINANCE MODULE
-- ============================================
DO $$ BEGIN CREATE TYPE finance_transaction_type AS ENUM ('income', 'expense'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE finance_category AS ENUM ('food', 'transport', 'bills', 'health', 'entertainment', 'shopping', 'subscriptions', 'savings', 'education', 'salary', 'freelance', 'investments', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE budget_status AS ENUM ('active', 'exceeded', 'healthy'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE saving_goal_status AS ENUM ('in_progress', 'achieved', 'paused'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE ai_insight_type AS ENUM ('pattern', 'alert', 'suggestion', 'forecast'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE recurring_interval AS ENUM ('daily', 'weekly', 'monthly', 'yearly'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS finance_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    currency VARCHAR(3) DEFAULT 'USD',
    monthly_income DECIMAL(12,2) DEFAULT 0,
    budget_limit DECIMAL(12,2),
    timezone VARCHAR(50) DEFAULT 'UTC',
    ai_insights_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS finance_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    transaction_type finance_transaction_type NOT NULL,
    category finance_category NOT NULL DEFAULT 'other',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_recurring BOOLEAN DEFAULT false,
    recurring_interval recurring_interval,
    tags TEXT[] DEFAULT '{}',
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fin_tx_user_date ON finance_transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_fin_tx_user_category ON finance_transactions(user_id, category);

CREATE TABLE IF NOT EXISTS finance_budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category finance_category NOT NULL,
    monthly_limit DECIMAL(12,2) NOT NULL CHECK (monthly_limit > 0),
    current_spend DECIMAL(12,2) DEFAULT 0,
    alert_threshold INTEGER DEFAULT 80 CHECK (alert_threshold BETWEEN 1 AND 100),
    month VARCHAR(7) NOT NULL,
    status budget_status DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, category, month)
);
CREATE INDEX IF NOT EXISTS idx_fin_budget_user_month ON finance_budgets(user_id, month);

CREATE TABLE IF NOT EXISTS finance_saving_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    target_amount DECIMAL(12,2) NOT NULL CHECK (target_amount > 0),
    current_amount DECIMAL(12,2) DEFAULT 0,
    deadline DATE,
    category finance_category DEFAULT 'savings',
    status saving_goal_status DEFAULT 'in_progress',
    emoji VARCHAR(10) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finance_ai_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    insight_type ai_insight_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    is_dismissed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fin_insights_user ON finance_ai_insights(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS finance_monthly_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month VARCHAR(7) NOT NULL,
    total_income DECIMAL(12,2) DEFAULT 0,
    total_expenses DECIMAL(12,2) DEFAULT 0,
    savings_rate DECIMAL(5,2) DEFAULT 0,
    category_breakdown JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, month)
);
CREATE INDEX IF NOT EXISTS idx_fin_snapshot_user_month ON finance_monthly_snapshots(user_id, month DESC);

-- ============================================
-- 17. STREAK SYSTEM
-- ============================================
CREATE TABLE IF NOT EXISTS user_streaks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    last_activity_date DATE,
    streak_started_at DATE,
    total_active_days INTEGER NOT NULL DEFAULT 0,
    freezes_available INTEGER NOT NULL DEFAULT 0 CHECK (freezes_available >= 0 AND freezes_available <= 3),
    freezes_used_total INTEGER NOT NULL DEFAULT 0,
    last_freeze_date DATE,
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_streaks_user ON user_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_streaks_current ON user_streaks(current_streak DESC);

CREATE TABLE IF NOT EXISTS streak_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL,
    activity_type VARCHAR(50) NOT NULL,
    source_id VARCHAR(100),
    streak_day INTEGER NOT NULL,
    xp_earned INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, activity_date, activity_type)
);
CREATE INDEX IF NOT EXISTS idx_streak_activity_user_date ON streak_activity_log(user_id, activity_date DESC);

CREATE TABLE IF NOT EXISTS streak_freeze_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    freeze_date DATE NOT NULL,
    source VARCHAR(30) NOT NULL,
    xp_cost INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, freeze_date)
);
CREATE INDEX IF NOT EXISTS idx_streak_freeze_user ON streak_freeze_log(user_id, freeze_date DESC);

CREATE TABLE IF NOT EXISTS streak_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    milestone_days INTEGER NOT NULL UNIQUE,
    tier_name VARCHAR(30) NOT NULL,
    reward_type VARCHAR(30) NOT NULL,
    xp_bonus INTEGER NOT NULL DEFAULT 0,
    freezes_earned INTEGER NOT NULL DEFAULT 0,
    title_unlocked VARCHAR(50),
    badge_icon VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO streak_rewards (milestone_days, tier_name, reward_type, xp_bonus, freezes_earned, title_unlocked, badge_icon) VALUES
    (3,   'Spark',        'badge',              25,    0, NULL,               'spark'),
    (7,   'Flame',        'badge_freeze',       100,   1, 'Week Warrior',     'flame'),
    (14,  'Blaze',        'badge_title',        200,   0, 'Fortnight Fighter','blaze'),
    (30,  'Inferno',      'badge_freeze_title', 500,   1, 'Month Master',    'inferno'),
    (60,  'Wildfire',     'badge_title',        1000,  0, 'Sixty Strong',    'wildfire'),
    (90,  'Supernova',    'badge_freeze_title', 2000,  1, 'Streak Legend',   'supernova'),
    (180, 'Phoenix',      'badge_title',        5000,  0, 'Half-Year Hero',  'phoenix'),
    (365, 'Eternal Flame','badge_title',        10000, 0, 'Year of Fire',    'eternal')
ON CONFLICT (milestone_days) DO NOTHING;

-- ============================================
-- DONE
-- ============================================

-- ============================================
-- FINANCE MODULE MIGRATION
-- ============================================

-- Enums
DO $$ BEGIN CREATE TYPE finance_transaction_type AS ENUM ('income', 'expense'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE finance_category AS ENUM ('food', 'transport', 'bills', 'health', 'entertainment', 'shopping', 'subscriptions', 'savings', 'education', 'salary', 'freelance', 'investments', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE budget_status AS ENUM ('active', 'exceeded', 'healthy'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE saving_goal_status AS ENUM ('in_progress', 'achieved', 'paused'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE ai_insight_type AS ENUM ('pattern', 'alert', 'suggestion', 'forecast'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE recurring_interval AS ENUM ('daily', 'weekly', 'monthly', 'yearly'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Finance Profiles
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

-- Transactions
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
CREATE INDEX IF NOT EXISTS idx_fin_tx_user_type ON finance_transactions(user_id, transaction_type);
CREATE INDEX IF NOT EXISTS idx_fin_tx_user_deleted ON finance_transactions(user_id, is_deleted);

-- Budgets
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

-- Saving Goals
CREATE TABLE IF NOT EXISTS finance_saving_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    target_amount DECIMAL(12,2) NOT NULL CHECK (target_amount > 0),
    current_amount DECIMAL(12,2) DEFAULT 0,
    deadline DATE,
    category finance_category DEFAULT 'savings',
    status saving_goal_status DEFAULT 'in_progress',
    emoji VARCHAR(10) DEFAULT '🎯',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fin_goals_user ON finance_saving_goals(user_id, status);

-- AI Insights
CREATE TABLE IF NOT EXISTS finance_ai_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    insight_type ai_insight_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    actionable BOOLEAN DEFAULT false,
    related_category finance_category,
    savings_potential DECIMAL(12,2),
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    dismissed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fin_insights_user ON finance_ai_insights(user_id, dismissed, expires_at);

-- Monthly Snapshots
CREATE TABLE IF NOT EXISTS finance_monthly_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month VARCHAR(7) NOT NULL,
    total_income DECIMAL(12,2) DEFAULT 0,
    total_expense DECIMAL(12,2) DEFAULT 0,
    net_savings DECIMAL(12,2) DEFAULT 0,
    category_breakdown JSONB DEFAULT '{}',
    ai_summary TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, month)
);

CREATE INDEX IF NOT EXISTS idx_fin_snapshot_user_month ON finance_monthly_snapshots(user_id, month DESC);

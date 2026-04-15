-- ============================================
-- USERS TABLE
-- ============================================
-- Core user accounts (supports local and social auth)

DROP TABLE IF EXISTS users CASCADE;
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    gender gender,
    role_id UUID NOT NULL REFERENCES roles(id) DEFAULT '11111111-1111-1111-1111-111111111101',
    is_active BOOLEAN DEFAULT true,
    is_email_verified BOOLEAN DEFAULT false,
    avatar VARCHAR(500),
    phone VARCHAR(20),

    -- Auth provider (local, google, apple)
    auth_provider auth_provider DEFAULT 'local',
    -- Provider user ID (for social auth - e.g., Google sub ID or JWT token)
    provider_id TEXT,

    -- Onboarding
    onboarding_status onboarding_status DEFAULT 'registered',
    onboarding_completed_at TIMESTAMP,

    -- Gamification
    total_xp INTEGER DEFAULT 0,
    current_level INTEGER DEFAULT 1,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_activity_date DATE,

    -- Security tokens
    last_login TIMESTAMP,
    refresh_token TEXT,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP,
    email_verification_token VARCHAR(255),
    email_verification_expires TIMESTAMP,
    phone_verification_code VARCHAR(10),
    phone_verification_expires TIMESTAMP,

    -- Activity Status (current/default status)
    current_activity_status activity_status DEFAULT 'working',
    activity_status_updated_at TIMESTAMP,

    -- Daily Health Metrics (current snapshot from WHOOP)
    daily_sleep_hours DECIMAL(5,2), -- Daily sleep in hours
    daily_recovery_score INTEGER CHECK (daily_recovery_score >= 0 AND daily_recovery_score <= 100), -- Daily recovery score (0-100)
    daily_strain_score DECIMAL(5,2), -- Daily strain score
    daily_cycle_day INTEGER, -- Current cycle day
    daily_health_updated_at TIMESTAMP, -- Last update timestamp for daily metrics

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_created_at ON users(created_at DESC);
CREATE INDEX idx_users_onboarding_status ON users(onboarding_status);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_provider ON users(auth_provider, provider_id);

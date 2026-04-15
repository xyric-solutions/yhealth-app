-- Migration: Add Help Center, Community, and Webinars tables
-- Date: 2026-02-11

-- ============================================
-- HELP ARTICLES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS help_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    content TEXT,
    excerpt TEXT,
    category VARCHAR(100) NOT NULL DEFAULT 'general',
    status VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    views INTEGER DEFAULT 0,
    helpful_yes INTEGER DEFAULT 0,
    helpful_no INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_help_articles_slug ON help_articles(slug);
CREATE INDEX IF NOT EXISTS idx_help_articles_category ON help_articles(category);
CREATE INDEX IF NOT EXISTS idx_help_articles_status ON help_articles(status);
CREATE INDEX IF NOT EXISTS idx_help_articles_sort ON help_articles(sort_order, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_help_articles_search ON help_articles USING gin(
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, '') || ' ' || coalesce(excerpt, ''))
);

-- ============================================
-- COMMUNITY POSTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS community_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    content TEXT NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'general',
    post_type VARCHAR(50) NOT NULL DEFAULT 'discussion' CHECK (post_type IN ('discussion', 'question', 'tip', 'success_story', 'challenge', 'announcement')),
    status VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived', 'flagged')),
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    replies_count INTEGER DEFAULT 0,
    is_pinned BOOLEAN DEFAULT false,
    is_featured BOOLEAN DEFAULT false,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    author_first_name VARCHAR(100),
    author_last_name VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_posts_slug ON community_posts(slug);
CREATE INDEX IF NOT EXISTS idx_community_posts_category ON community_posts(category);
CREATE INDEX IF NOT EXISTS idx_community_posts_type ON community_posts(post_type);
CREATE INDEX IF NOT EXISTS idx_community_posts_status ON community_posts(status);
CREATE INDEX IF NOT EXISTS idx_community_posts_pinned ON community_posts(is_pinned) WHERE is_pinned = true;
CREATE INDEX IF NOT EXISTS idx_community_posts_featured ON community_posts(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_community_posts_search ON community_posts USING gin(
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))
);

-- ============================================
-- COMMUNITY REPLIES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS community_replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    author_first_name VARCHAR(100),
    author_last_name VARCHAR(100),
    likes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_replies_post ON community_replies(post_id);
CREATE INDEX IF NOT EXISTS idx_community_replies_author ON community_replies(author_id);

-- ============================================
-- WEBINARS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS webinars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(100) NOT NULL DEFAULT 'general',
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'live', 'completed', 'cancelled')),
    host_name VARCHAR(255),
    host_title VARCHAR(255),
    featured_image TEXT,
    scheduled_at TIMESTAMPTZ,
    duration_minutes INTEGER DEFAULT 60,
    max_registrations INTEGER,
    registration_count INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT false,
    meeting_url TEXT,
    recording_url TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webinars_slug ON webinars(slug);
CREATE INDEX IF NOT EXISTS idx_webinars_category ON webinars(category);
CREATE INDEX IF NOT EXISTS idx_webinars_status ON webinars(status);
CREATE INDEX IF NOT EXISTS idx_webinars_scheduled ON webinars(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_webinars_featured ON webinars(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_webinars_search ON webinars USING gin(
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
);

-- ============================================
-- WEBINAR REGISTRATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS webinar_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webinar_id UUID NOT NULL REFERENCES webinars(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    attended BOOLEAN DEFAULT false,
    UNIQUE(webinar_id, email)
);

CREATE INDEX IF NOT EXISTS idx_webinar_regs_webinar ON webinar_registrations(webinar_id);
CREATE INDEX IF NOT EXISTS idx_webinar_regs_email ON webinar_registrations(email);
CREATE INDEX IF NOT EXISTS idx_webinar_regs_user ON webinar_registrations(user_id);

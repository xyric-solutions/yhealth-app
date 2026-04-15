-- ============================================
-- TESTIMONIALS TABLE
-- ============================================
-- User testimonials/reviews for landing page display and admin management

CREATE TABLE IF NOT EXISTS testimonials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identity
    name VARCHAR(100) NOT NULL,
    role VARCHAR(100) NOT NULL,
    avatar_url VARCHAR(2000),

    -- Review
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    content TEXT NOT NULL,
    verified BOOLEAN DEFAULT false,
    pillar VARCHAR(20) CHECK (pillar IN ('fitness', 'nutrition', 'wellbeing')),

    -- Display
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_testimonials_is_active ON testimonials(is_active);
CREATE INDEX IF NOT EXISTS idx_testimonials_pillar ON testimonials(pillar);
CREATE INDEX IF NOT EXISTS idx_testimonials_display_order ON testimonials(display_order);
CREATE INDEX IF NOT EXISTS idx_testimonials_rating ON testimonials(rating);
CREATE INDEX IF NOT EXISTS idx_testimonials_featured ON testimonials(is_featured) WHERE is_featured = true;

-- Full text search
CREATE INDEX IF NOT EXISTS idx_testimonials_search ON testimonials USING gin(
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(role, '') || ' ' || coalesce(content, ''))
);

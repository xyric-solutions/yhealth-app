-- ============================================
-- BLOG REACTIONS TABLE
-- ============================================
-- Stores like/dislike reactions to blog posts
-- Each user can have only one reaction per blog (like or dislike)

CREATE TABLE IF NOT EXISTS blog_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blog_id UUID NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type VARCHAR(10) NOT NULL CHECK (reaction_type IN ('like', 'dislike')),

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- One reaction per user per blog
    UNIQUE(blog_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_blog_reactions_blog ON blog_reactions(blog_id);
CREATE INDEX IF NOT EXISTS idx_blog_reactions_user ON blog_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_blog_reactions_type ON blog_reactions(blog_id, reaction_type);

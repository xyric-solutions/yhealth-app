-- ============================================
-- Migration: Add blogs table
-- ============================================
-- Description: Creates blogs table if it doesn't exist
-- Date: 2024

-- Create enum types if they don't exist
DO $$ BEGIN
    CREATE TYPE blog_status AS ENUM ('draft', 'published', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE content_type AS ENUM ('markdown', 'html');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create blogs table if it doesn't exist
CREATE TABLE IF NOT EXISTS blogs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    excerpt TEXT,
    content TEXT NOT NULL,
    markdown_content TEXT,
    content_type content_type DEFAULT 'markdown',
    featured_image VARCHAR(500),
    tags TEXT[] DEFAULT '{}',
    category VARCHAR(100),

    status blog_status DEFAULT 'draft',
    published_at TIMESTAMP,
    reading_time INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,

    -- SEO Fields
    meta_title VARCHAR(255),
    meta_description TEXT,
    meta_keywords VARCHAR(500),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_blogs_slug ON blogs(slug);
CREATE INDEX IF NOT EXISTS idx_blogs_status ON blogs(status);
CREATE INDEX IF NOT EXISTS idx_blogs_author ON blogs(author_id);
CREATE INDEX IF NOT EXISTS idx_blogs_published_at ON blogs(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blogs_category ON blogs(category);
CREATE INDEX IF NOT EXISTS idx_blogs_status_published ON blogs(status, published_at DESC) WHERE status = 'published';

-- Full text search index (if not exists)
DO $$ BEGIN
    CREATE INDEX idx_blogs_search ON blogs USING gin(
        to_tsvector('english', coalesce(title, '') || ' ' || coalesce(excerpt, '') || ' ' || coalesce(content, ''))
    );
EXCEPTION
    WHEN duplicate_table THEN null;
END $$;

-- Add trigger for updated_at if it doesn't exist
DROP TRIGGER IF EXISTS update_blogs_updated_at ON blogs;
CREATE TRIGGER update_blogs_updated_at BEFORE UPDATE ON blogs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


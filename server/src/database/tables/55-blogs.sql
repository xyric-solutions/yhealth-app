-- ============================================
-- BLOGS TABLE
-- ============================================
-- Blog posts with content management

DROP TABLE IF EXISTS blogs CASCADE;
CREATE TABLE blogs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Content
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    excerpt TEXT,
    content TEXT NOT NULL, -- Rich text/HTML content
    markdown_content TEXT, -- Markdown source (optional)
    
    -- Media
    featured_image VARCHAR(2000), -- Increased to support long presigned URLs (R2, S3, etc.)
    
    -- Author
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Status and Publishing
    status blog_status DEFAULT 'draft',
    published_at TIMESTAMP,
    
    -- SEO
    meta_title VARCHAR(255),
    meta_description TEXT,
    meta_keywords VARCHAR(500),
    
    -- Analytics
    reading_time INTEGER DEFAULT 0, -- in minutes
    views INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_blogs_slug ON blogs(slug);
CREATE INDEX idx_blogs_author ON blogs(author_id);
CREATE INDEX idx_blogs_status ON blogs(status);
CREATE INDEX idx_blogs_published_at ON blogs(published_at DESC);
CREATE INDEX idx_blogs_status_published ON blogs(status, published_at DESC) WHERE status = 'published';

-- Full text search index
CREATE INDEX idx_blogs_search ON blogs USING gin(
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(excerpt, '') || ' ' || coalesce(content, ''))
);


-- ============================================
-- CONTACT SUBMISSIONS TABLE
-- ============================================
-- Stores contact form submissions from public pages

-- Create enum for contact submission status
DO $$ BEGIN
  CREATE TYPE contact_status AS ENUM ('new', 'read', 'in_progress', 'resolved', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create enum for contact priority
DO $$ BEGIN
  CREATE TYPE contact_priority AS ENUM ('low', 'normal', 'high', 'urgent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS contact_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status contact_status DEFAULT 'new',
    priority contact_priority DEFAULT 'normal',
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    admin_notes TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    resolved_at TIMESTAMP,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contact_submissions_status ON contact_submissions(status);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_priority ON contact_submissions(priority);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_email ON contact_submissions(email);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_created ON contact_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_assigned ON contact_submissions(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contact_submissions_search ON contact_submissions USING gin(
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(email, '') || ' ' || coalesce(subject, '') || ' ' || coalesce(message, ''))
);

-- ============================================
-- ROLES TABLE
-- ============================================
-- Custom roles for RBAC (Role-Based Access Control)

DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_roles_slug ON roles(slug);
CREATE INDEX idx_roles_is_system ON roles(is_system);

-- Seed default system roles
INSERT INTO roles (id, name, slug, description, is_system) VALUES
    ('11111111-1111-1111-1111-111111111101', 'User', 'user', 'Default application user', true),
    ('11111111-1111-1111-1111-111111111102', 'Admin', 'admin', 'Full administrative access', true),
    ('11111111-1111-1111-1111-111111111103', 'Moderator', 'moderator', 'Content moderation access', true),
    ('11111111-1111-1111-1111-111111111104', 'Doctor', 'doctor', 'Healthcare provider role', true),
    ('11111111-1111-1111-1111-111111111105', 'Patient', 'patient', 'Patient role', true),
    ('11111111-1111-1111-1111-111111111106', 'System', 'system', 'System/internal service accounts', true)
ON CONFLICT (slug) DO NOTHING;

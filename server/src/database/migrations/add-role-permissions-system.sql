-- Migration: Add Role-Permissions RBAC System
-- Creates roles, permissions tables and migrates users.role to users.role_id

-- ============================================
-- 1. CREATE ROLES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_roles_slug ON roles(slug);

-- Seed roles
INSERT INTO roles (id, name, slug, description, is_system) VALUES
    ('11111111-1111-1111-1111-111111111101', 'User', 'user', 'Default application user', true),
    ('11111111-1111-1111-1111-111111111102', 'Admin', 'admin', 'Full administrative access', true),
    ('11111111-1111-1111-1111-111111111103', 'Moderator', 'moderator', 'Content moderation access', true),
    ('11111111-1111-1111-1111-111111111104', 'Doctor', 'doctor', 'Healthcare provider role', true),
    ('11111111-1111-1111-1111-111111111105', 'Patient', 'patient', 'Patient role', true),
    ('11111111-1111-1111-1111-111111111106', 'System', 'system', 'System/internal service accounts', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- 2. CREATE PERMISSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(150) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);

-- Seed permissions
INSERT INTO permissions (slug, name, resource, action, description) VALUES
    ('admin.view', 'View Admin Dashboard', 'admin', 'view', 'Access admin dashboard'),
    ('admin.users.view', 'View Users', 'admin.users', 'view', 'View user list'),
    ('admin.users.create', 'Create Users', 'admin.users', 'create', 'Create new users'),
    ('admin.users.edit', 'Edit Users', 'admin.users', 'edit', 'Edit existing users'),
    ('admin.users.delete', 'Delete Users', 'admin.users', 'delete', 'Delete users'),
    ('admin.roles.view', 'View Roles', 'admin.roles', 'view', 'View role list'),
    ('admin.roles.create', 'Create Roles', 'admin.roles', 'create', 'Create new roles'),
    ('admin.roles.edit', 'Edit Roles', 'admin.roles', 'edit', 'Edit existing roles'),
    ('admin.roles.delete', 'Delete Roles', 'admin.roles', 'delete', 'Delete roles'),
    ('admin.blogs.view', 'View Blogs', 'admin.blogs', 'view', 'View blog list'),
    ('admin.blogs.create', 'Create Blogs', 'admin.blogs', 'create', 'Create new blogs'),
    ('admin.blogs.edit', 'Edit Blogs', 'admin.blogs', 'edit', 'Edit existing blogs'),
    ('admin.blogs.delete', 'Delete Blogs', 'admin.blogs', 'delete', 'Delete blogs'),
    ('admin.contacts.view', 'View Contacts', 'admin.contacts', 'view', 'View contact submissions'),
    ('admin.contacts.edit', 'Edit Contacts', 'admin.contacts', 'edit', 'Edit contact submissions'),
    ('admin.contacts.delete', 'Delete Contacts', 'admin.contacts', 'delete', 'Delete contacts'),
    ('admin.help.view', 'View Help', 'admin.help', 'view', 'View help articles'),
    ('admin.help.create', 'Create Help', 'admin.help', 'create', 'Create help articles'),
    ('admin.help.edit', 'Edit Help', 'admin.help', 'edit', 'Edit help articles'),
    ('admin.help.delete', 'Delete Help', 'admin.help', 'delete', 'Delete help articles'),
    ('admin.community.view', 'View Community', 'admin.community', 'view', 'View community posts'),
    ('admin.community.manage', 'Manage Community', 'admin.community', 'manage', 'Manage community content'),
    ('admin.webinars.view', 'View Webinars', 'admin.webinars', 'view', 'View webinar list'),
    ('admin.webinars.create', 'Create Webinars', 'admin.webinars', 'create', 'Create webinars'),
    ('admin.webinars.edit', 'Edit Webinars', 'admin.webinars', 'edit', 'Edit webinars'),
    ('admin.webinars.delete', 'Delete Webinars', 'admin.webinars', 'delete', 'Delete webinars')
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- 3. CREATE ROLE_PERMISSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Assign all permissions to admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT '11111111-1111-1111-1111-111111111102', id FROM permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================
-- 4. MIGRATE USERS TABLE (role -> role_id)
-- ============================================
-- Add role_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'role_id'
    ) THEN
        ALTER TABLE users ADD COLUMN role_id UUID REFERENCES roles(id);
    END IF;
END $$;

-- Migrate existing role data to role_id
UPDATE users u
SET role_id = r.id
FROM roles r
WHERE u.role_id IS NULL
  AND r.slug = u.role::text;

-- Set default for any remaining nulls (e.g. invalid role values)
UPDATE users
SET role_id = '11111111-1111-1111-1111-111111111101'
WHERE role_id IS NULL;

-- Drop old role column and index
ALTER TABLE users DROP COLUMN IF EXISTS role;
DROP INDEX IF EXISTS idx_users_role;

-- Make role_id NOT NULL
ALTER TABLE users ALTER COLUMN role_id SET NOT NULL;

-- Add index for role_id
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);

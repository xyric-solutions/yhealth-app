-- ============================================
-- PERMISSIONS TABLE
-- ============================================
-- Page/resource-level permissions for RBAC

DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(150) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_permissions_resource ON permissions(resource);
CREATE INDEX idx_permissions_slug ON permissions(slug);

-- Seed default permissions
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

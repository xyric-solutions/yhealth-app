-- Migration: Add is_active and is_archived fields to roles table
-- Allows roles to be activated/deactivated and archived

-- Add is_active field (default true for existing roles)
ALTER TABLE roles 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add is_archived field (default false)
ALTER TABLE roles 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_roles_is_active ON roles(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_roles_is_archived ON roles(is_archived) WHERE is_archived = false;

-- Update existing roles to be active and not archived
UPDATE roles SET is_active = true, is_archived = false WHERE is_active IS NULL OR is_archived IS NULL;

-- System roles should always be active
UPDATE roles SET is_active = true WHERE is_system = true;


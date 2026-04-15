-- Add joint_targets JSONB column to yoga_poses for AI pose coaching
-- Structure: { "left_knee": { "angle": 90, "tolerance": 15 }, ... }

ALTER TABLE yoga_poses ADD COLUMN IF NOT EXISTS joint_targets JSONB DEFAULT NULL;
COMMENT ON COLUMN yoga_poses.joint_targets IS 'Target joint angles for AI pose coaching. Each key is a joint name, value has angle (degrees) and tolerance (acceptable deviation).';

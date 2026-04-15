-- ============================================
-- YOGA JOINT TARGETS SEED
-- ============================================
-- Updates 5 initial poses with anatomically accurate joint angle targets
-- for the AI Pose Coach feature.
--
-- Joint names correspond to MediaPipe landmark triplets:
--   left_elbow:  LEFT_SHOULDER → LEFT_ELBOW → LEFT_WRIST
--   right_elbow: RIGHT_SHOULDER → RIGHT_ELBOW → RIGHT_WRIST
--   left_knee:   LEFT_HIP → LEFT_KNEE → LEFT_ANKLE
--   right_knee:  RIGHT_HIP → RIGHT_KNEE → RIGHT_ANKLE
--   left_hip:    LEFT_SHOULDER → LEFT_HIP → LEFT_KNEE
--   right_hip:   RIGHT_SHOULDER → RIGHT_HIP → RIGHT_KNEE
--
-- "angle" = target degrees (0-180), "tolerance" = acceptable deviation

BEGIN;

-- Mountain Pose (Tadasana) — Stand tall, all joints nearly straight
UPDATE yoga_poses SET joint_targets = '{
  "left_elbow":  { "angle": 170, "tolerance": 15 },
  "right_elbow": { "angle": 170, "tolerance": 15 },
  "left_knee":   { "angle": 175, "tolerance": 10 },
  "right_knee":  { "angle": 175, "tolerance": 10 },
  "left_hip":    { "angle": 175, "tolerance": 10 },
  "right_hip":   { "angle": 175, "tolerance": 10 }
}'::jsonb WHERE slug = 'mountain-pose';

-- Warrior I (Virabhadrasana I) — Front knee bent ~90, back leg straight, arms overhead
UPDATE yoga_poses SET joint_targets = '{
  "left_elbow":  { "angle": 170, "tolerance": 15 },
  "right_elbow": { "angle": 170, "tolerance": 15 },
  "left_knee":   { "angle": 90,  "tolerance": 15 },
  "right_knee":  { "angle": 170, "tolerance": 15 },
  "left_hip":    { "angle": 95,  "tolerance": 15 },
  "right_hip":   { "angle": 165, "tolerance": 15 }
}'::jsonb WHERE slug = 'warrior-i';

-- Downward-Facing Dog (Adho Mukha Svanasana) — Inverted V, arms & legs straight
UPDATE yoga_poses SET joint_targets = '{
  "left_elbow":  { "angle": 175, "tolerance": 10 },
  "right_elbow": { "angle": 175, "tolerance": 10 },
  "left_knee":   { "angle": 170, "tolerance": 15 },
  "right_knee":  { "angle": 170, "tolerance": 15 },
  "left_hip":    { "angle": 75,  "tolerance": 15 },
  "right_hip":   { "angle": 75,  "tolerance": 15 }
}'::jsonb WHERE slug = 'downward-facing-dog';

-- Tree Pose (Vrksasana) — Standing leg straight, bent leg externally rotated
UPDATE yoga_poses SET joint_targets = '{
  "left_elbow":  { "angle": 170, "tolerance": 20 },
  "right_elbow": { "angle": 170, "tolerance": 20 },
  "left_knee":   { "angle": 175, "tolerance": 10 },
  "right_knee":  { "angle": 50,  "tolerance": 20 },
  "left_hip":    { "angle": 175, "tolerance": 10 },
  "right_hip":   { "angle": 120, "tolerance": 20 }
}'::jsonb WHERE slug = 'tree-pose';

-- Child's Pose (Balasana) — Knees deeply bent, hips folded, arms extended
UPDATE yoga_poses SET joint_targets = '{
  "left_elbow":  { "angle": 170, "tolerance": 20 },
  "right_elbow": { "angle": 170, "tolerance": 20 },
  "left_knee":   { "angle": 35,  "tolerance": 15 },
  "right_knee":  { "angle": 35,  "tolerance": 15 },
  "left_hip":    { "angle": 40,  "tolerance": 15 },
  "right_hip":   { "angle": 40,  "tolerance": 15 }
}'::jsonb WHERE slug = 'childs-pose';

COMMIT;

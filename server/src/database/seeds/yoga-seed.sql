-- ============================================
-- YOGA SEED DATA
-- ============================================
-- Seeds yoga_poses (42 poses) and yoga_sessions (6 templates)
-- Run after table creation (92-yoga-poses.sql, 93-yoga-sessions.sql)
--
-- Usage: psql -d yhealth -f yoga-seed.sql

BEGIN;

-- ============================================
-- 1. YOGA POSES (42 poses)
-- ============================================

INSERT INTO yoga_poses (english_name, sanskrit_name, slug, category, difficulty, description, benefits, muscle_groups, contraindications, cues, breathing_cue, hold_seconds_default, svg_key, is_recovery_pose, recovery_targets)
VALUES

-- ── STANDING ──────────────────────────────────────────────

('Mountain Pose', 'Tadasana', 'mountain-pose', 'standing', 'beginner',
 'The foundation of all standing poses. Stand tall with feet together, grounding evenly through all four corners of the feet.',
 ARRAY['improves posture', 'strengthens thighs and ankles', 'increases body awareness', 'reduces flat feet'],
 ARRAY['quadriceps', 'core', 'ankles'],
 ARRAY['low blood pressure — do not hold too long'],
 '[{"step":1,"instruction":"Stand with feet together or hip-width apart, arms at sides.","breathDirection":"natural"},{"step":2,"instruction":"Spread your toes and press evenly through all four corners of each foot.","breathDirection":"inhale"},{"step":3,"instruction":"Engage your thighs, tuck your tailbone slightly, and lengthen your spine.","breathDirection":"inhale"},{"step":4,"instruction":"Roll your shoulders back and down, palms facing forward.","breathDirection":"exhale"},{"step":5,"instruction":"Gaze straight ahead, crown of the head reaching toward the ceiling.","breathDirection":"natural"}]'::jsonb,
 'Breathe deeply through the nose, expanding the ribcage on each inhale.',
 30, 'pose-mountain-pose', false, NULL),

('Warrior I', 'Virabhadrasana I', 'warrior-i', 'standing', 'beginner',
 'A powerful standing lunge that builds strength in the legs and opens the chest and shoulders.',
 ARRAY['strengthens legs and core', 'opens hips and chest', 'improves balance', 'builds stamina'],
 ARRAY['quadriceps', 'glutes', 'hip flexors', 'shoulders'],
 ARRAY['high blood pressure', 'heart problems', 'knee injuries'],
 '[{"step":1,"instruction":"From Mountain Pose, step your left foot back 3-4 feet.","breathDirection":"exhale"},{"step":2,"instruction":"Bend your right knee to 90 degrees, knee directly over ankle.","breathDirection":"inhale"},{"step":3,"instruction":"Angle your back foot at 45 degrees, pressing the outer edge down.","breathDirection":"natural"},{"step":4,"instruction":"Raise both arms overhead, palms facing each other.","breathDirection":"inhale"},{"step":5,"instruction":"Draw your front ribs in and lengthen your tailbone down.","breathDirection":"exhale"}]'::jsonb,
 'Inhale as you reach up, exhale as you deepen the lunge.',
 30, 'pose-warrior-i', false, NULL),

('Warrior II', 'Virabhadrasana II', 'warrior-ii', 'standing', 'beginner',
 'A strong standing pose that opens the hips and strengthens the legs while building endurance.',
 ARRAY['strengthens legs and ankles', 'opens hips and groin', 'builds stamina', 'improves concentration'],
 ARRAY['quadriceps', 'glutes', 'hip adductors', 'shoulders'],
 ARRAY['knee injuries', 'high blood pressure'],
 '[{"step":1,"instruction":"From Mountain Pose, step feet wide apart, about 4 feet.","breathDirection":"exhale"},{"step":2,"instruction":"Turn your right foot out 90 degrees, left foot slightly in.","breathDirection":"natural"},{"step":3,"instruction":"Bend your right knee to 90 degrees, knee over ankle.","breathDirection":"inhale"},{"step":4,"instruction":"Extend arms out to the sides at shoulder height, palms down.","breathDirection":"inhale"},{"step":5,"instruction":"Gaze over your right fingertips, keep your torso centered.","breathDirection":"exhale"}]'::jsonb,
 'Steady ujjayi breath, feeling your ribs expand laterally.',
 30, 'pose-warrior-ii', false, NULL),

('Warrior III', 'Virabhadrasana III', 'warrior-iii', 'balance', 'intermediate',
 'A challenging balance pose that strengthens the standing leg and core while improving focus.',
 ARRAY['strengthens legs, core, and back', 'improves balance and coordination', 'tones the abdomen', 'builds mental focus'],
 ARRAY['hamstrings', 'glutes', 'core', 'back'],
 ARRAY['high blood pressure', 'ankle or knee injuries'],
 '[{"step":1,"instruction":"From Warrior I, shift your weight onto your front foot.","breathDirection":"inhale"},{"step":2,"instruction":"Hinge forward at the hips, lifting your back leg parallel to the floor.","breathDirection":"exhale"},{"step":3,"instruction":"Extend arms forward alongside your ears or alongside your body.","breathDirection":"inhale"},{"step":4,"instruction":"Flex your lifted foot and keep hips level.","breathDirection":"natural"},{"step":5,"instruction":"Gaze at a fixed point on the floor for balance.","breathDirection":"natural"}]'::jsonb,
 'Maintain steady, even breathing. Avoid holding your breath.',
 20, 'pose-warrior-iii', false, NULL),

('Triangle Pose', 'Trikonasana', 'triangle-pose', 'standing', 'beginner',
 'A fundamental standing pose that stretches the hamstrings and opens the chest while building leg strength.',
 ARRAY['stretches hamstrings and groin', 'opens chest and shoulders', 'strengthens thighs and core', 'relieves back pain'],
 ARRAY['hamstrings', 'obliques', 'hip adductors', 'quadriceps'],
 ARRAY['low blood pressure', 'neck injuries — look straight instead of up'],
 '[{"step":1,"instruction":"Stand with feet about 4 feet apart, right foot turned out 90 degrees.","breathDirection":"natural"},{"step":2,"instruction":"Extend arms at shoulder height, palms facing down.","breathDirection":"inhale"},{"step":3,"instruction":"Reach your right hand forward, then hinge at the hip to lower it to your shin or the floor.","breathDirection":"exhale"},{"step":4,"instruction":"Extend your left arm straight up, stacking shoulders.","breathDirection":"inhale"},{"step":5,"instruction":"Turn your gaze up toward your left hand.","breathDirection":"natural"}]'::jsonb,
 'Breathe into the open side of the ribcage.',
 30, 'pose-triangle-pose', false, NULL),

('Chair Pose', 'Utkatasana', 'chair-pose', 'standing', 'beginner',
 'A powerful standing pose that builds heat and strength in the legs and core.',
 ARRAY['strengthens thighs, calves, and spine', 'tones core muscles', 'builds endurance', 'stimulates the heart'],
 ARRAY['quadriceps', 'glutes', 'core', 'calves'],
 ARRAY['knee injuries', 'low blood pressure', 'insomnia'],
 '[{"step":1,"instruction":"Stand in Mountain Pose with feet together or hip-width apart.","breathDirection":"natural"},{"step":2,"instruction":"Bend your knees deeply as if sitting in a chair, keeping weight in the heels.","breathDirection":"exhale"},{"step":3,"instruction":"Raise your arms overhead, biceps alongside the ears.","breathDirection":"inhale"},{"step":4,"instruction":"Draw your tailbone down and your belly in.","breathDirection":"exhale"},{"step":5,"instruction":"Keep your knees from extending past your toes.","breathDirection":"natural"}]'::jsonb,
 'Inhale to lengthen, exhale to sit a little deeper.',
 20, 'pose-chair-pose', false, NULL),

('Extended Side Angle', 'Utthita Parsvakonasana', 'extended-side-angle', 'standing', 'beginner',
 'A standing pose that strengthens the legs and stretches the entire side body from ankle to fingertips.',
 ARRAY['stretches groin, spine, and waist', 'strengthens legs and knees', 'opens chest and shoulders', 'improves stamina'],
 ARRAY['quadriceps', 'obliques', 'hip adductors', 'shoulders'],
 ARRAY['high or low blood pressure', 'neck problems', 'insomnia'],
 '[{"step":1,"instruction":"From Warrior II, lower your right forearm to your right thigh or place your right hand on the floor.","breathDirection":"exhale"},{"step":2,"instruction":"Extend your left arm over your ear, creating a long line from left foot to fingertips.","breathDirection":"inhale"},{"step":3,"instruction":"Stack your shoulders and open your chest toward the ceiling.","breathDirection":"natural"},{"step":4,"instruction":"Press firmly through the outer edge of your back foot.","breathDirection":"exhale"}]'::jsonb,
 'Breathe into the stretched side of the body.',
 30, 'pose-extended-side-angle', false, NULL),

('Half Moon', 'Ardha Chandrasana', 'half-moon', 'balance', 'intermediate',
 'A standing balance pose that strengthens the legs and core while opening the hips and chest.',
 ARRAY['strengthens ankles, legs, and core', 'improves balance and coordination', 'opens hips and chest', 'relieves stress'],
 ARRAY['glutes', 'hamstrings', 'core', 'ankles'],
 ARRAY['low blood pressure', 'headache', 'insomnia', 'diarrhea'],
 '[{"step":1,"instruction":"From Triangle Pose, bend your front knee and step your back foot in.","breathDirection":"exhale"},{"step":2,"instruction":"Place your bottom hand about 12 inches in front of your front foot.","breathDirection":"natural"},{"step":3,"instruction":"Lift your back leg parallel to the floor, flexing the foot.","breathDirection":"inhale"},{"step":4,"instruction":"Open your top hip and extend your top arm toward the ceiling.","breathDirection":"inhale"},{"step":5,"instruction":"Gaze up at your top hand for an extra balance challenge.","breathDirection":"natural"}]'::jsonb,
 'Keep your breath steady and even to maintain balance.',
 20, 'pose-half-moon', false, NULL),

('Eagle Pose', 'Garudasana', 'eagle-pose', 'balance', 'intermediate',
 'A balancing pose that deeply stretches the shoulders and hips while building leg strength and focus.',
 ARRAY['stretches shoulders and upper back', 'strengthens legs and core', 'improves balance and focus', 'opens the space between shoulder blades'],
 ARRAY['shoulders', 'glutes', 'quadriceps', 'calves'],
 ARRAY['knee injuries', 'shoulder injuries'],
 '[{"step":1,"instruction":"Stand in Mountain Pose, bend your knees slightly.","breathDirection":"natural"},{"step":2,"instruction":"Cross your right thigh over your left, hooking your right foot behind your left calf if possible.","breathDirection":"exhale"},{"step":3,"instruction":"Extend arms forward, cross your left arm over the right, bend elbows and wrap forearms.","breathDirection":"inhale"},{"step":4,"instruction":"Lift your elbows to shoulder height, drawing your hands away from your face.","breathDirection":"inhale"},{"step":5,"instruction":"Sit deeper into the standing leg, keeping your spine tall.","breathDirection":"exhale"}]'::jsonb,
 'Breathe into the space between your shoulder blades.',
 20, 'pose-eagle-pose', false, NULL),

('Standing Forward Fold', 'Uttanasana', 'standing-forward-fold', 'forward_fold', 'beginner',
 'A calming forward bend that stretches the entire back of the body and relieves tension.',
 ARRAY['stretches hamstrings, calves, and hips', 'calms the brain and relieves stress', 'reduces fatigue and anxiety', 'improves digestion'],
 ARRAY['hamstrings', 'calves', 'lower back'],
 ARRAY['back injuries — bend with a flat back', 'hamstring tears'],
 '[{"step":1,"instruction":"Stand with feet hip-width apart.","breathDirection":"natural"},{"step":2,"instruction":"Hinge at the hips, folding your torso over your legs.","breathDirection":"exhale"},{"step":3,"instruction":"Let your head hang heavy, releasing the neck.","breathDirection":"exhale"},{"step":4,"instruction":"Place fingertips or palms on the floor, or grab opposite elbows.","breathDirection":"natural"},{"step":5,"instruction":"Shift weight slightly toward the balls of the feet, keeping hips over ankles.","breathDirection":"natural"}]'::jsonb,
 'Exhale to fold deeper, inhale to lengthen the spine.',
 30, 'pose-standing-forward-fold', true, ARRAY['back', 'legs']),

('Wide-Legged Forward Fold', 'Prasarita Padottanasana', 'wide-legged-forward-fold', 'forward_fold', 'beginner',
 'A wide-stance forward fold that stretches the inner legs and spine while calming the mind.',
 ARRAY['stretches inner legs and hamstrings', 'lengthens the spine', 'calms the mind', 'relieves mild backache'],
 ARRAY['hamstrings', 'hip adductors', 'lower back'],
 ARRAY['lower back injuries'],
 '[{"step":1,"instruction":"Step feet wide apart, about 4-5 feet, toes pointing forward.","breathDirection":"natural"},{"step":2,"instruction":"Place hands on hips, inhale and lengthen your spine.","breathDirection":"inhale"},{"step":3,"instruction":"Exhale and fold forward from the hips, placing hands on the floor.","breathDirection":"exhale"},{"step":4,"instruction":"Walk your hands back between your legs, crown of head toward the floor.","breathDirection":"exhale"},{"step":5,"instruction":"Press into the outer edges of your feet, engage your quadriceps.","breathDirection":"natural"}]'::jsonb,
 'Exhale as you fold, inhale to lengthen.',
 30, 'pose-wide-legged-forward-fold', true, ARRAY['legs', 'back']),

('High Lunge', 'Utthita Ashwa Sanchalanasana', 'high-lunge', 'standing', 'beginner',
 'A dynamic standing lunge that builds leg strength and opens the hip flexors.',
 ARRAY['strengthens legs and glutes', 'opens hip flexors', 'improves balance', 'builds core stability'],
 ARRAY['quadriceps', 'glutes', 'hip flexors', 'core'],
 ARRAY['knee injuries', 'high blood pressure'],
 '[{"step":1,"instruction":"From Standing Forward Fold, step your left foot back into a lunge.","breathDirection":"exhale"},{"step":2,"instruction":"Bend your right knee to 90 degrees over the ankle.","breathDirection":"natural"},{"step":3,"instruction":"Stay on the ball of your back foot, heel lifted.","breathDirection":"natural"},{"step":4,"instruction":"Sweep your arms overhead, reaching through the fingertips.","breathDirection":"inhale"},{"step":5,"instruction":"Draw your front ribs in and lengthen your tailbone down.","breathDirection":"exhale"}]'::jsonb,
 'Inhale to lift and lengthen, exhale to stabilize.',
 20, 'pose-high-lunge', false, NULL),

('Low Lunge', 'Anjaneyasana', 'low-lunge', 'standing', 'beginner',
 'A deep hip-opening lunge with the back knee down, stretching the hip flexors and quadriceps.',
 ARRAY['stretches hip flexors and quadriceps', 'opens the chest', 'improves hip flexibility', 'relieves sciatica'],
 ARRAY['hip flexors', 'quadriceps', 'glutes'],
 ARRAY['knee injuries — pad the back knee'],
 '[{"step":1,"instruction":"From Downward Dog, step your right foot forward between your hands.","breathDirection":"exhale"},{"step":2,"instruction":"Lower your left knee to the floor, untuck the toes.","breathDirection":"natural"},{"step":3,"instruction":"Walk your right foot forward so the knee is directly over the ankle.","breathDirection":"natural"},{"step":4,"instruction":"Sweep your arms overhead, sinking your hips forward and down.","breathDirection":"inhale"},{"step":5,"instruction":"Gently arch your upper back, lifting your chest.","breathDirection":"inhale"}]'::jsonb,
 'Inhale to lift the chest, exhale to sink the hips deeper.',
 30, 'pose-low-lunge', true, ARRAY['hips', 'legs']),

('Gate Pose', 'Parighasana', 'gate-pose', 'standing', 'beginner',
 'A kneeling side stretch that opens the intercostal muscles and stretches the side body.',
 ARRAY['stretches the side body', 'opens intercostal muscles', 'improves breathing capacity', 'stretches hamstrings'],
 ARRAY['obliques', 'intercostals', 'hamstrings'],
 ARRAY['knee injuries — use padding'],
 '[{"step":1,"instruction":"Kneel on the floor with knees hip-width apart.","breathDirection":"natural"},{"step":2,"instruction":"Extend your right leg out to the side, foot flat on the floor.","breathDirection":"inhale"},{"step":3,"instruction":"Inhale and raise your left arm overhead.","breathDirection":"inhale"},{"step":4,"instruction":"Exhale and lean to the right, sliding your right hand down your right leg.","breathDirection":"exhale"},{"step":5,"instruction":"Open your chest toward the ceiling, reaching through your left fingertips.","breathDirection":"natural"}]'::jsonb,
 'Inhale to lengthen the side body, exhale to deepen the stretch.',
 30, 'pose-gate-pose', false, NULL),

-- ── BALANCE ──────────────────────────────────────────────

('Tree Pose', 'Vrksasana', 'tree-pose', 'balance', 'beginner',
 'A foundational balance pose that strengthens the legs and improves focus and stability.',
 ARRAY['improves balance and stability', 'strengthens thighs, calves, and ankles', 'opens hips', 'improves focus and concentration'],
 ARRAY['quadriceps', 'glutes', 'core', 'ankles'],
 ARRAY['headache', 'insomnia', 'low blood pressure'],
 '[{"step":1,"instruction":"Stand in Mountain Pose, shift your weight onto your left foot.","breathDirection":"natural"},{"step":2,"instruction":"Place your right foot on your inner left thigh or calf — never on the knee.","breathDirection":"inhale"},{"step":3,"instruction":"Press your foot and thigh into each other for stability.","breathDirection":"natural"},{"step":4,"instruction":"Bring hands to heart center or extend arms overhead.","breathDirection":"inhale"},{"step":5,"instruction":"Fix your gaze on a single point for balance.","breathDirection":"natural"}]'::jsonb,
 'Breathe naturally and steadily, keeping your focus soft.',
 30, 'pose-tree-pose', false, NULL),

('Side Plank', 'Vasisthasana', 'side-plank', 'balance', 'intermediate',
 'A challenging arm balance that builds core and shoulder strength while improving balance.',
 ARRAY['strengthens arms, shoulders, and core', 'improves balance', 'tones obliques', 'builds wrist strength'],
 ARRAY['obliques', 'shoulders', 'core', 'wrists'],
 ARRAY['wrist injuries', 'shoulder injuries', 'carpal tunnel syndrome'],
 '[{"step":1,"instruction":"From Plank Pose, shift your weight onto your right hand and outer right foot.","breathDirection":"exhale"},{"step":2,"instruction":"Stack your left foot on top of the right, or stagger for more stability.","breathDirection":"natural"},{"step":3,"instruction":"Extend your left arm toward the ceiling, stacking shoulders.","breathDirection":"inhale"},{"step":4,"instruction":"Lift your hips high, creating a straight line from head to feet.","breathDirection":"natural"},{"step":5,"instruction":"Gaze up at your top hand.","breathDirection":"natural"}]'::jsonb,
 'Maintain steady breathing — do not hold your breath.',
 15, 'pose-side-plank', false, NULL),

('Crow Pose', 'Bakasana', 'crow-pose', 'balance', 'advanced',
 'An arm balance that builds significant upper body and core strength while developing courage and focus.',
 ARRAY['strengthens arms, wrists, and core', 'improves balance and coordination', 'builds confidence', 'tones abdominal organs'],
 ARRAY['core', 'shoulders', 'wrists', 'hip flexors'],
 ARRAY['wrist injuries', 'carpal tunnel syndrome', 'pregnancy'],
 '[{"step":1,"instruction":"Squat with feet together, knees wide, hands on the floor shoulder-width apart.","breathDirection":"natural"},{"step":2,"instruction":"Come onto the balls of your feet, pressing knees into the backs of your upper arms.","breathDirection":"exhale"},{"step":3,"instruction":"Lean forward, shifting weight into your hands.","breathDirection":"inhale"},{"step":4,"instruction":"Lift one foot at a time, then both feet off the floor.","breathDirection":"exhale"},{"step":5,"instruction":"Round your upper back, gaze slightly forward, and squeeze your core.","breathDirection":"natural"}]'::jsonb,
 'Keep breathing! The tendency is to hold the breath — stay relaxed.',
 10, 'pose-crow-pose', false, NULL),

-- ── SEATED ──────────────────────────────────────────────

('Seated Forward Fold', 'Paschimottanasana', 'seated-forward-fold', 'seated', 'beginner',
 'A calming seated forward bend that stretches the entire posterior chain and soothes the nervous system.',
 ARRAY['stretches spine, hamstrings, and shoulders', 'calms the mind', 'relieves stress and mild depression', 'improves digestion'],
 ARRAY['hamstrings', 'lower back', 'calves'],
 ARRAY['back injuries', 'diarrhea', 'asthma'],
 '[{"step":1,"instruction":"Sit with legs extended straight in front of you, feet flexed.","breathDirection":"natural"},{"step":2,"instruction":"Inhale and raise your arms overhead, lengthening the spine.","breathDirection":"inhale"},{"step":3,"instruction":"Exhale and hinge forward from the hips, reaching for your feet.","breathDirection":"exhale"},{"step":4,"instruction":"Hold your shins, ankles, or feet — wherever you can reach.","breathDirection":"natural"},{"step":5,"instruction":"With each inhale lengthen, with each exhale fold a little deeper.","breathDirection":"exhale"}]'::jsonb,
 'Exhale to deepen the fold, inhale to lengthen the spine.',
 45, 'pose-seated-forward-fold', true, ARRAY['back', 'legs']),

('Butterfly Pose', 'Baddha Konasana', 'butterfly-pose', 'seated', 'beginner',
 'A hip-opening seated pose that stretches the inner thighs and groins.',
 ARRAY['opens hips and groin', 'stretches inner thighs', 'improves flexibility', 'stimulates abdominal organs'],
 ARRAY['hip adductors', 'hip flexors'],
 ARRAY['groin or knee injuries'],
 '[{"step":1,"instruction":"Sit tall, bring the soles of your feet together, letting knees fall open.","breathDirection":"natural"},{"step":2,"instruction":"Hold your feet with your hands, drawing heels toward your pelvis.","breathDirection":"inhale"},{"step":3,"instruction":"Lengthen your spine, sitting up tall on your sit bones.","breathDirection":"inhale"},{"step":4,"instruction":"Gently press your knees toward the floor with your elbows or let gravity work.","breathDirection":"exhale"},{"step":5,"instruction":"Optional: fold forward from the hips for a deeper stretch.","breathDirection":"exhale"}]'::jsonb,
 'Breathe into your hips, softening with each exhale.',
 45, 'pose-butterfly-pose', true, ARRAY['hips', 'legs']),

('Boat Pose', 'Navasana', 'boat-pose', 'seated', 'intermediate',
 'A core-strengthening pose that builds abdominal strength and improves balance.',
 ARRAY['strengthens core and hip flexors', 'tones abdominal muscles', 'improves balance', 'stimulates digestion'],
 ARRAY['core', 'hip flexors', 'quadriceps'],
 ARRAY['pregnancy', 'low blood pressure', 'neck injuries', 'menstruation'],
 '[{"step":1,"instruction":"Sit with knees bent, feet flat on the floor, hands behind your thighs.","breathDirection":"natural"},{"step":2,"instruction":"Lean back slightly, lifting your feet off the floor, shins parallel to the ground.","breathDirection":"exhale"},{"step":3,"instruction":"Extend your arms alongside your legs, palms facing in.","breathDirection":"inhale"},{"step":4,"instruction":"For full expression, straighten your legs to create a V shape.","breathDirection":"inhale"},{"step":5,"instruction":"Keep your chest lifted and spine long — avoid rounding the back.","breathDirection":"natural"}]'::jsonb,
 'Breathe steadily — do not hold the breath even when the core shakes.',
 20, 'pose-boat-pose', false, NULL),

('Garland Pose', 'Malasana', 'garland-pose', 'seated', 'beginner',
 'A deep squat that opens the hips and groin while strengthening the lower body.',
 ARRAY['opens hips and groin', 'stretches ankles and lower back', 'tones the belly', 'improves digestion'],
 ARRAY['hip adductors', 'glutes', 'ankles', 'lower back'],
 ARRAY['knee injuries', 'lower back injuries'],
 '[{"step":1,"instruction":"Stand with feet slightly wider than hip-width, toes turned out.","breathDirection":"natural"},{"step":2,"instruction":"Bend your knees and lower your hips into a deep squat.","breathDirection":"exhale"},{"step":3,"instruction":"Bring your palms together at heart center, pressing elbows against inner knees.","breathDirection":"inhale"},{"step":4,"instruction":"Use your elbows to gently press the knees wider.","breathDirection":"exhale"},{"step":5,"instruction":"Lengthen your spine, keeping chest lifted.","breathDirection":"inhale"}]'::jsonb,
 'Breathe naturally, softening the hips with each exhale.',
 30, 'pose-garland-pose', true, ARRAY['hips', 'legs']),

-- ── SUPINE ──────────────────────────────────────────────

('Bridge Pose', 'Setu Bandhasana', 'bridge-pose', 'supine', 'beginner',
 'A gentle backbend that opens the chest and strengthens the legs and glutes.',
 ARRAY['strengthens legs and glutes', 'opens chest and shoulders', 'calms the mind', 'improves digestion'],
 ARRAY['glutes', 'hamstrings', 'core', 'chest'],
 ARRAY['neck injuries', 'shoulder injuries'],
 '[{"step":1,"instruction":"Lie on your back, bend your knees, feet flat on the floor hip-width apart.","breathDirection":"natural"},{"step":2,"instruction":"Place arms alongside your body, palms down.","breathDirection":"natural"},{"step":3,"instruction":"Press into your feet and lift your hips toward the ceiling.","breathDirection":"inhale"},{"step":4,"instruction":"Roll your shoulders underneath you, clasping hands if possible.","breathDirection":"exhale"},{"step":5,"instruction":"Keep your thighs parallel and your chin slightly tucked.","breathDirection":"natural"}]'::jsonb,
 'Inhale to lift, exhale to maintain. Breathe into the chest.',
 30, 'pose-bridge-pose', true, ARRAY['back', 'chest']),

('Happy Baby', 'Ananda Balasana', 'happy-baby', 'supine', 'beginner',
 'A playful supine pose that opens the hips and inner groin while releasing lower back tension.',
 ARRAY['opens hips and inner groin', 'releases lower back tension', 'calms the mind', 'gently stretches the spine'],
 ARRAY['hip adductors', 'lower back', 'hamstrings'],
 ARRAY['pregnancy', 'neck injuries', 'knee injuries'],
 '[{"step":1,"instruction":"Lie on your back, draw your knees toward your chest.","breathDirection":"exhale"},{"step":2,"instruction":"Open your knees wider than your torso.","breathDirection":"natural"},{"step":3,"instruction":"Grab the outer edges of your feet with your hands.","breathDirection":"inhale"},{"step":4,"instruction":"Gently pull your knees toward the floor beside your ribcage.","breathDirection":"exhale"},{"step":5,"instruction":"Rock gently side to side to massage the lower back.","breathDirection":"natural"}]'::jsonb,
 'Breathe deeply and relax into the stretch.',
 45, 'pose-happy-baby', true, ARRAY['hips', 'back']),

('Reclined Twist', 'Supta Matsyendrasana', 'reclined-twist', 'twist', 'beginner',
 'A gentle supine twist that releases tension in the spine and massages the internal organs.',
 ARRAY['releases spinal tension', 'massages abdominal organs', 'stretches the chest and shoulders', 'calms the nervous system'],
 ARRAY['obliques', 'lower back', 'chest'],
 ARRAY['spinal disc injuries', 'sacroiliac joint issues'],
 '[{"step":1,"instruction":"Lie on your back, draw your right knee into your chest.","breathDirection":"exhale"},{"step":2,"instruction":"Guide your right knee across your body to the left with your left hand.","breathDirection":"exhale"},{"step":3,"instruction":"Extend your right arm out to the side at shoulder height.","breathDirection":"inhale"},{"step":4,"instruction":"Turn your gaze to the right.","breathDirection":"natural"},{"step":5,"instruction":"Let gravity do the work — relax into the twist with each exhale.","breathDirection":"exhale"}]'::jsonb,
 'Exhale to deepen the twist, inhale to create space in the spine.',
 45, 'pose-reclined-twist', true, ARRAY['back', 'hips']),

('Legs Up the Wall', 'Viparita Karani', 'legs-up-wall', 'supine', 'beginner',
 'A deeply restorative inversion that promotes relaxation and reduces swelling in the legs.',
 ARRAY['relieves tired legs', 'calms the nervous system', 'reduces swelling', 'promotes deep relaxation'],
 ARRAY['hamstrings', 'lower back'],
 ARRAY['eye conditions like glaucoma', 'serious neck or back problems', 'menstruation — some traditions'],
 '[{"step":1,"instruction":"Sit sideways next to a wall, then swing your legs up as you lower your back to the floor.","breathDirection":"natural"},{"step":2,"instruction":"Scoot your sitting bones as close to the wall as comfortable.","breathDirection":"natural"},{"step":3,"instruction":"Rest your arms by your sides, palms up.","breathDirection":"exhale"},{"step":4,"instruction":"Close your eyes and relax completely.","breathDirection":"exhale"},{"step":5,"instruction":"Stay here for 5-15 minutes, breathing naturally.","breathDirection":"natural"}]'::jsonb,
 'Slow, deep belly breathing. Let the breath become effortless.',
 120, 'pose-legs-up-wall', true, ARRAY['legs', 'back']),

('Fish Pose', 'Matsyasana', 'fish-pose', 'supine', 'intermediate',
 'A chest-opening backbend done on the back that stretches the front body and throat.',
 ARRAY['opens the chest and throat', 'stretches hip flexors and intercostals', 'strengthens the upper back', 'relieves tension in neck and shoulders'],
 ARRAY['chest', 'neck', 'upper back', 'hip flexors'],
 ARRAY['serious neck injuries', 'high or low blood pressure', 'migraine', 'insomnia'],
 '[{"step":1,"instruction":"Lie on your back, legs extended, arms alongside the body, palms down.","breathDirection":"natural"},{"step":2,"instruction":"Press your forearms and elbows into the floor, lifting your chest.","breathDirection":"inhale"},{"step":3,"instruction":"Tilt your head back, placing the crown of the head lightly on the floor.","breathDirection":"inhale"},{"step":4,"instruction":"Keep most of the weight in your forearms, not your head.","breathDirection":"natural"},{"step":5,"instruction":"Breathe deeply into the expanded chest.","breathDirection":"inhale"}]'::jsonb,
 'Breathe deeply into the open chest. Feel the ribcage expand fully.',
 20, 'pose-fish-pose', false, NULL),

('Corpse Pose', 'Savasana', 'corpse-pose', 'restorative', 'beginner',
 'The ultimate relaxation pose. Complete stillness and surrender — the most important pose in yoga.',
 ARRAY['deeply relaxes the entire body', 'calms the nervous system', 'reduces blood pressure', 'promotes mental clarity and peace'],
 ARRAY[]::TEXT[],
 ARRAY['pregnancy — lie on your side instead', 'severe back pain — bend the knees'],
 '[{"step":1,"instruction":"Lie on your back with legs extended, feet falling open naturally.","breathDirection":"natural"},{"step":2,"instruction":"Place arms alongside the body, palms facing up.","breathDirection":"natural"},{"step":3,"instruction":"Close your eyes and relax every muscle in your body.","breathDirection":"exhale"},{"step":4,"instruction":"Release control of the breath, letting it flow naturally.","breathDirection":"natural"},{"step":5,"instruction":"Remain still for 5-10 minutes, allowing complete relaxation.","breathDirection":"natural"}]'::jsonb,
 'Let the breath become completely natural and effortless.',
 300, 'pose-corpse-pose', true, ARRAY['back', 'shoulders', 'legs', 'hips', 'neck']),

-- ── PRONE ──────────────────────────────────────────────

('Cobra Pose', 'Bhujangasana', 'cobra-pose', 'prone', 'beginner',
 'A gentle backbend that strengthens the spine and opens the chest.',
 ARRAY['strengthens the spine', 'opens chest and shoulders', 'increases flexibility', 'firms the buttocks'],
 ARRAY['lower back', 'chest', 'shoulders', 'glutes'],
 ARRAY['back injuries', 'carpal tunnel syndrome', 'pregnancy'],
 '[{"step":1,"instruction":"Lie face down, legs extended, tops of feet on the floor.","breathDirection":"natural"},{"step":2,"instruction":"Place hands under your shoulders, elbows tucked close to the body.","breathDirection":"natural"},{"step":3,"instruction":"Press into your hands, lifting your chest off the floor.","breathDirection":"inhale"},{"step":4,"instruction":"Keep your elbows slightly bent, shoulders away from ears.","breathDirection":"exhale"},{"step":5,"instruction":"Engage your back muscles, using minimal hand pressure.","breathDirection":"natural"}]'::jsonb,
 'Inhale as you lift, exhale to maintain. Avoid compressing the lower back.',
 20, 'pose-cobra-pose', false, NULL),

('Upward-Facing Dog', 'Urdhva Mukha Svanasana', 'upward-facing-dog', 'prone', 'intermediate',
 'A deep backbend that strengthens the arms and opens the entire front body.',
 ARRAY['strengthens arms and wrists', 'opens chest, shoulders, and abdomen', 'improves posture', 'firms the buttocks'],
 ARRAY['chest', 'shoulders', 'quadriceps', 'wrists'],
 ARRAY['back injuries', 'carpal tunnel syndrome', 'pregnancy', 'headache'],
 '[{"step":1,"instruction":"Lie face down, legs extended back, tops of feet on the floor.","breathDirection":"natural"},{"step":2,"instruction":"Place hands beside your lower ribs, fingers pointing forward.","breathDirection":"natural"},{"step":3,"instruction":"Press into your hands, straightening your arms and lifting your torso and legs off the floor.","breathDirection":"inhale"},{"step":4,"instruction":"Only your hands and tops of feet touch the floor.","breathDirection":"natural"},{"step":5,"instruction":"Lift your chest, gaze slightly upward, and roll shoulders back.","breathDirection":"inhale"}]'::jsonb,
 'Inhale deeply as you lift, breathing into the open chest.',
 15, 'pose-upward-facing-dog', false, NULL),

('Sphinx Pose', 'Salamba Bhujangasana', 'sphinx-pose', 'prone', 'beginner',
 'A gentle backbend on the forearms that opens the chest and strengthens the spine.',
 ARRAY['strengthens the spine', 'opens chest and lungs', 'stretches shoulders and abdomen', 'calms the nervous system'],
 ARRAY['lower back', 'chest', 'shoulders'],
 ARRAY['back injuries', 'pregnancy', 'headache'],
 '[{"step":1,"instruction":"Lie on your stomach, legs together and extended.","breathDirection":"natural"},{"step":2,"instruction":"Place your forearms on the floor, elbows directly under your shoulders.","breathDirection":"natural"},{"step":3,"instruction":"Press your forearms down and lift your chest.","breathDirection":"inhale"},{"step":4,"instruction":"Draw your shoulder blades together and down your back.","breathDirection":"exhale"},{"step":5,"instruction":"Lengthen through the crown of the head, gaze forward.","breathDirection":"natural"}]'::jsonb,
 'Breathe deeply, letting the belly press into the floor on each inhale.',
 30, 'pose-sphinx-pose', true, ARRAY['back', 'chest']),

('Lizard Pose', 'Utthan Pristhasana', 'lizard-pose', 'prone', 'intermediate',
 'A deep hip-opening pose that stretches the hip flexors, hamstrings, and inner thighs.',
 ARRAY['deeply opens hips and groin', 'stretches hip flexors and hamstrings', 'strengthens inner thighs', 'prepares for advanced poses'],
 ARRAY['hip flexors', 'hamstrings', 'hip adductors', 'glutes'],
 ARRAY['knee injuries', 'lower back injuries'],
 '[{"step":1,"instruction":"From Downward Dog, step your right foot to the outside of your right hand.","breathDirection":"exhale"},{"step":2,"instruction":"Lower your back knee to the floor.","breathDirection":"natural"},{"step":3,"instruction":"Walk your right foot a few inches to the right, opening the hip.","breathDirection":"exhale"},{"step":4,"instruction":"Lower to your forearms if available, or stay on your hands.","breathDirection":"exhale"},{"step":5,"instruction":"Keep your chest open and spine long.","breathDirection":"inhale"}]'::jsonb,
 'Breathe deeply into the hip, softening with each exhale.',
 30, 'pose-lizard-pose', true, ARRAY['hips', 'legs']),

-- ── INVERSION ──────────────────────────────────────────────

('Downward-Facing Dog', 'Adho Mukha Svanasana', 'downward-facing-dog', 'inversion', 'beginner',
 'One of the most recognized yoga poses. An inverted V-shape that stretches and strengthens the entire body.',
 ARRAY['strengthens arms and legs', 'stretches hamstrings, calves, and shoulders', 'energizes the body', 'calms the brain and relieves stress'],
 ARRAY['hamstrings', 'calves', 'shoulders', 'core'],
 ARRAY['carpal tunnel syndrome', 'high blood pressure', 'late-term pregnancy', 'eye or ear infections'],
 '[{"step":1,"instruction":"Start on hands and knees, hands shoulder-width apart, knees under hips.","breathDirection":"natural"},{"step":2,"instruction":"Tuck your toes and lift your knees off the floor.","breathDirection":"exhale"},{"step":3,"instruction":"Straighten your legs and lift your hips toward the ceiling, forming an inverted V.","breathDirection":"inhale"},{"step":4,"instruction":"Press your hands firmly into the mat, spreading your fingers wide.","breathDirection":"exhale"},{"step":5,"instruction":"Relax your head between your arms, gazing toward your navel.","breathDirection":"natural"}]'::jsonb,
 'Breathe deeply, pressing your heels toward the floor on each exhale.',
 30, 'pose-downward-facing-dog', false, NULL),

('Headstand', 'Sirsasana', 'headstand', 'inversion', 'advanced',
 'The king of yoga poses. A full inversion that builds tremendous core strength, focus, and confidence.',
 ARRAY['strengthens arms, shoulders, and core', 'improves balance and focus', 'calms the brain', 'stimulates the pituitary gland'],
 ARRAY['core', 'shoulders', 'forearms', 'neck'],
 ARRAY['neck injuries', 'high blood pressure', 'heart conditions', 'pregnancy', 'menstruation', 'glaucoma'],
 '[{"step":1,"instruction":"Kneel and interlace your fingers, placing forearms on the floor shoulder-width apart.","breathDirection":"natural"},{"step":2,"instruction":"Place the crown of your head on the floor, cradled by your interlaced fingers.","breathDirection":"exhale"},{"step":3,"instruction":"Tuck your toes, lift your knees, and walk your feet toward your elbows.","breathDirection":"inhale"},{"step":4,"instruction":"Lift one leg at a time or both legs together toward the ceiling.","breathDirection":"exhale"},{"step":5,"instruction":"Engage your core, press into your forearms, and find your balance.","breathDirection":"natural"}]'::jsonb,
 'Maintain steady ujjayi breathing. Come down immediately if breathing becomes strained.',
 30, 'pose-headstand', false, NULL),

('Shoulder Stand', 'Sarvangasana', 'shoulder-stand', 'inversion', 'intermediate',
 'The queen of poses. A supported inversion that calms the nervous system and stimulates the thyroid.',
 ARRAY['stimulates thyroid and parathyroid', 'calms the nervous system', 'reduces fatigue and insomnia', 'strengthens shoulders and core'],
 ARRAY['shoulders', 'core', 'neck', 'upper back'],
 ARRAY['neck injuries', 'high blood pressure', 'pregnancy', 'menstruation', 'glaucoma'],
 '[{"step":1,"instruction":"Lie on your back with arms alongside your body.","breathDirection":"natural"},{"step":2,"instruction":"Lift your legs overhead, supporting your lower back with your hands.","breathDirection":"exhale"},{"step":3,"instruction":"Walk your hands up your back toward your shoulder blades.","breathDirection":"natural"},{"step":4,"instruction":"Straighten your legs toward the ceiling, stacking hips over shoulders.","breathDirection":"inhale"},{"step":5,"instruction":"Keep weight on your shoulders and upper arms, not your neck.","breathDirection":"natural"}]'::jsonb,
 'Breathe into the belly. Keep the throat soft and relaxed.',
 60, 'pose-shoulder-stand', false, NULL),

-- ── BACKBEND ──────────────────────────────────────────────

('Camel Pose', 'Ustrasana', 'camel-pose', 'backbend', 'intermediate',
 'A deep kneeling backbend that opens the entire front body — chest, abdomen, and hip flexors.',
 ARRAY['opens chest, abdomen, and hip flexors', 'strengthens the back', 'improves posture', 'stimulates the nervous system'],
 ARRAY['chest', 'hip flexors', 'quadriceps', 'back'],
 ARRAY['low or high blood pressure', 'migraine', 'serious low back or neck injuries', 'insomnia'],
 '[{"step":1,"instruction":"Kneel with knees hip-width apart, thighs perpendicular to the floor.","breathDirection":"natural"},{"step":2,"instruction":"Place your hands on your lower back, fingers pointing down.","breathDirection":"inhale"},{"step":3,"instruction":"Lift your chest, squeeze your shoulder blades together, and begin arching back.","breathDirection":"inhale"},{"step":4,"instruction":"Reach for your heels one hand at a time, if available.","breathDirection":"exhale"},{"step":5,"instruction":"Let your head drop back if your neck is comfortable, or keep chin tucked.","breathDirection":"natural"}]'::jsonb,
 'Breathe deeply into the expanded chest. Come out slowly.',
 20, 'pose-camel-pose', false, NULL),

('Wheel Pose', 'Urdhva Dhanurasana', 'wheel-pose', 'backbend', 'advanced',
 'A deep, full backbend that opens the entire front body and builds total body strength.',
 ARRAY['strengthens arms, legs, and spine', 'opens chest and shoulders deeply', 'increases energy', 'improves spinal flexibility'],
 ARRAY['quadriceps', 'glutes', 'shoulders', 'chest', 'wrists'],
 ARRAY['back injuries', 'carpal tunnel syndrome', 'headache', 'heart conditions', 'high or low blood pressure'],
 '[{"step":1,"instruction":"Lie on your back, bend your knees, feet flat on the floor hip-width apart.","breathDirection":"natural"},{"step":2,"instruction":"Place your hands by your ears, fingers pointing toward your shoulders.","breathDirection":"natural"},{"step":3,"instruction":"Press into hands and feet, lifting your hips and then your head off the floor.","breathDirection":"inhale"},{"step":4,"instruction":"Straighten your arms as much as possible, lifting your chest toward the ceiling.","breathDirection":"inhale"},{"step":5,"instruction":"Keep your feet parallel and press evenly through all four limbs.","breathDirection":"natural"}]'::jsonb,
 'Breathe deeply despite the intense stretch. Keep the throat open.',
 15, 'pose-wheel-pose', false, NULL),

-- ── TWIST ──────────────────────────────────────────────

('Thread the Needle', NULL, 'thread-the-needle', 'twist', 'beginner',
 'A gentle twist done on all fours that releases tension in the shoulders and upper back.',
 ARRAY['releases shoulder and upper back tension', 'stretches the chest', 'calms the mind', 'gentle spinal twist'],
 ARRAY['shoulders', 'upper back', 'chest'],
 ARRAY['serious shoulder injuries'],
 '[{"step":1,"instruction":"Start on all fours in tabletop position.","breathDirection":"natural"},{"step":2,"instruction":"Inhale and reach your right arm toward the ceiling, opening your chest.","breathDirection":"inhale"},{"step":3,"instruction":"Exhale and thread your right arm under your left arm, lowering your right shoulder and temple to the floor.","breathDirection":"exhale"},{"step":4,"instruction":"Keep your hips over your knees.","breathDirection":"natural"},{"step":5,"instruction":"Walk your left hand forward for a deeper stretch if desired.","breathDirection":"exhale"}]'::jsonb,
 'Exhale as you twist, letting the shoulder melt toward the floor.',
 30, 'pose-thread-the-needle', true, ARRAY['shoulders', 'back']),

-- ── HIP OPENER ──────────────────────────────────────────────

('Pigeon Pose', 'Eka Pada Rajakapotasana', 'pigeon-pose', 'hip_opener', 'intermediate',
 'A deep hip opener that targets the piriformis and hip rotators — one of the most effective hip stretches.',
 ARRAY['deeply opens hips and hip rotators', 'stretches hip flexors and quadriceps', 'releases stored tension and emotion', 'relieves sciatica'],
 ARRAY['hip rotators', 'hip flexors', 'glutes', 'quadriceps'],
 ARRAY['knee injuries', 'sacroiliac issues', 'ankle injuries'],
 '[{"step":1,"instruction":"From Downward Dog, bring your right knee forward behind your right wrist.","breathDirection":"exhale"},{"step":2,"instruction":"Angle your right shin under your body — the more parallel to the front edge of the mat, the deeper the stretch.","breathDirection":"natural"},{"step":3,"instruction":"Extend your left leg straight back, top of the foot on the floor.","breathDirection":"natural"},{"step":4,"instruction":"Square your hips toward the front of the mat.","breathDirection":"exhale"},{"step":5,"instruction":"Walk your hands forward and lower your chest toward the floor.","breathDirection":"exhale"}]'::jsonb,
 'Breathe deeply into the hip. Emotions may surface — breathe through them.',
 45, 'pose-pigeon-pose', true, ARRAY['hips', 'legs']),

-- ── FORWARD FOLD ──────────────────────────────────────────────

('Puppy Pose', 'Uttana Shishosana', 'puppy-pose', 'forward_fold', 'beginner',
 'A heart-melting pose between Child''s Pose and Downward Dog that stretches the spine and shoulders.',
 ARRAY['stretches the spine and shoulders', 'opens the chest', 'relieves tension and insomnia', 'calms the mind'],
 ARRAY['shoulders', 'upper back', 'chest'],
 ARRAY['knee injuries'],
 '[{"step":1,"instruction":"Start on all fours, hips directly over knees.","breathDirection":"natural"},{"step":2,"instruction":"Walk your hands forward, keeping hips over knees.","breathDirection":"exhale"},{"step":3,"instruction":"Lower your chest and forehead toward the floor.","breathDirection":"exhale"},{"step":4,"instruction":"Melt your heart toward the ground, keeping a gentle curve in the lower back.","breathDirection":"exhale"},{"step":5,"instruction":"Keep your arms active, pressing into the palms.","breathDirection":"natural"}]'::jsonb,
 'Breathe deeply, letting the chest open with each exhale.',
 30, 'pose-puppy-pose', true, ARRAY['shoulders', 'back']),

-- ── RESTORATIVE ──────────────────────────────────────────────

('Child''s Pose', 'Balasana', 'childs-pose', 'restorative', 'beginner',
 'A resting pose that gently stretches the back and provides a sense of safety and calm.',
 ARRAY['gently stretches the back', 'relieves stress and fatigue', 'calms the mind', 'releases back and neck tension'],
 ARRAY['lower back', 'hips', 'ankles'],
 ARRAY['knee injuries', 'pregnancy — use wide-kneed variation', 'diarrhea'],
 '[{"step":1,"instruction":"Kneel on the floor, big toes touching, knees together or wide apart.","breathDirection":"natural"},{"step":2,"instruction":"Sit back on your heels.","breathDirection":"exhale"},{"step":3,"instruction":"Fold forward, resting your forehead on the floor.","breathDirection":"exhale"},{"step":4,"instruction":"Extend arms forward or alongside the body, palms up.","breathDirection":"natural"},{"step":5,"instruction":"Surrender your weight into the floor and breathe into your back body.","breathDirection":"exhale"}]'::jsonb,
 'Breathe into the back body, feeling the ribs expand with each inhale.',
 60, 'pose-childs-pose', true, ARRAY['back', 'hips', 'neck']),

-- ── MISC / ADDITIONAL ──────────────────────────────────────

('Plank Pose', 'Phalakasana', 'plank-pose', 'prone', 'beginner',
 'A foundational strength-building pose that works the entire body, especially the core.',
 ARRAY['strengthens core, arms, and shoulders', 'tones the abdomen', 'builds endurance', 'prepares for arm balances'],
 ARRAY['core', 'shoulders', 'chest', 'quadriceps'],
 ARRAY['carpal tunnel syndrome', 'wrist injuries'],
 '[{"step":1,"instruction":"Start on all fours, then step your feet back one at a time to full extension.","breathDirection":"exhale"},{"step":2,"instruction":"Align wrists under shoulders, body in one straight line from head to heels.","breathDirection":"natural"},{"step":3,"instruction":"Engage your core and quadriceps, pressing back through your heels.","breathDirection":"exhale"},{"step":4,"instruction":"Keep your gaze slightly ahead of your hands on the floor.","breathDirection":"natural"},{"step":5,"instruction":"Do not let your hips sag or pike up — maintain the straight line.","breathDirection":"natural"}]'::jsonb,
 'Breathe steadily — do not hold your breath.',
 30, 'pose-plank-pose', false, NULL),

('Cat Pose', 'Marjaryasana', 'cat-pose', 'prone', 'beginner',
 'Part of the Cat-Cow sequence, this pose rounds the spine and releases tension in the back.',
 ARRAY['stretches the back and neck', 'massages the spine', 'relieves stress', 'improves spinal flexibility'],
 ARRAY['core', 'upper back', 'neck'],
 ARRAY['neck injuries — keep the head in line with the torso'],
 '[{"step":1,"instruction":"Start on all fours, wrists under shoulders, knees under hips.","breathDirection":"natural"},{"step":2,"instruction":"Exhale and round your spine toward the ceiling.","breathDirection":"exhale"},{"step":3,"instruction":"Drop your head and tailbone, drawing your belly in.","breathDirection":"exhale"},{"step":4,"instruction":"Press your hands into the floor, broadening across the shoulder blades.","breathDirection":"exhale"},{"step":5,"instruction":"Hold for a breath, then flow into Cow Pose on the inhale.","breathDirection":"exhale"}]'::jsonb,
 'Exhale fully as you round the spine.',
 5, 'pose-cat-pose', true, ARRAY['back', 'neck']),

('Cow Pose', 'Bitilasana', 'cow-pose', 'prone', 'beginner',
 'Part of the Cat-Cow sequence, this pose arches the spine and opens the chest.',
 ARRAY['stretches the front torso and neck', 'massages the spine', 'calms the mind', 'warms up the spine'],
 ARRAY['core', 'chest', 'neck'],
 ARRAY['neck injuries — keep the head in line with the torso'],
 '[{"step":1,"instruction":"Start on all fours, wrists under shoulders, knees under hips.","breathDirection":"natural"},{"step":2,"instruction":"Inhale and drop your belly toward the floor.","breathDirection":"inhale"},{"step":3,"instruction":"Lift your chest and sitting bones toward the ceiling.","breathDirection":"inhale"},{"step":4,"instruction":"Gaze gently upward, without crunching the back of your neck.","breathDirection":"inhale"},{"step":5,"instruction":"Hold for a breath, then flow into Cat Pose on the exhale.","breathDirection":"inhale"}]'::jsonb,
 'Inhale fully as you arch the spine.',
 5, 'pose-cow-pose', true, ARRAY['back', 'chest', 'neck']);


-- ============================================
-- 2. YOGA SESSION TEMPLATES (6 templates)
-- ============================================

-- ── Morning Flow (20 min) ──────────────────────────────────

INSERT INTO yoga_sessions (user_id, title, description, session_type, difficulty, duration_minutes, is_template, is_ai_generated, phases, ambient_theme, tags)
VALUES (
  NULL,
  'Morning Energizer Flow',
  'A 20-minute morning practice to wake up the body, build heat, and set a positive intention for the day.',
  'morning_flow',
  'beginner',
  20,
  true,
  false,
  '[
    {
      "phaseType": "warmup",
      "name": "Gentle Awakening",
      "durationSeconds": 180,
      "poses": [
        {"poseSlug": "childs-pose", "holdSeconds": 30, "side": "both"},
        {"poseSlug": "cat-pose", "holdSeconds": 5, "side": "both"},
        {"poseSlug": "cow-pose", "holdSeconds": 5, "side": "both"},
        {"poseSlug": "cat-pose", "holdSeconds": 5, "side": "both"},
        {"poseSlug": "cow-pose", "holdSeconds": 5, "side": "both"},
        {"poseSlug": "cat-pose", "holdSeconds": 5, "side": "both"},
        {"poseSlug": "cow-pose", "holdSeconds": 5, "side": "both"},
        {"poseSlug": "puppy-pose", "holdSeconds": 30, "side": "both"}
      ],
      "breathingPattern": "natural",
      "narrationScript": "Good morning. Begin in Child''s Pose, taking a moment to set an intention for your day. When you are ready, rise to all fours and flow gently through Cat-Cow to awaken your spine."
    },
    {
      "phaseType": "flow",
      "name": "Sun Salutation Warm-Up",
      "durationSeconds": 360,
      "poses": [
        {"poseSlug": "mountain-pose", "holdSeconds": 15, "side": "both"},
        {"poseSlug": "standing-forward-fold", "holdSeconds": 15, "side": "both"},
        {"poseSlug": "high-lunge", "holdSeconds": 20, "side": "right"},
        {"poseSlug": "downward-facing-dog", "holdSeconds": 30, "side": "both"},
        {"poseSlug": "high-lunge", "holdSeconds": 20, "side": "left"},
        {"poseSlug": "standing-forward-fold", "holdSeconds": 15, "side": "both"},
        {"poseSlug": "mountain-pose", "holdSeconds": 15, "side": "both"},
        {"poseSlug": "chair-pose", "holdSeconds": 20, "side": "both"}
      ],
      "breathingPattern": "ujjayi",
      "narrationScript": "Rise to Mountain Pose and feel your feet rooted into the earth. Let each movement flow with your breath as we move through a modified Sun Salutation."
    },
    {
      "phaseType": "peak",
      "name": "Standing Strength",
      "durationSeconds": 360,
      "poses": [
        {"poseSlug": "warrior-i", "holdSeconds": 30, "side": "right"},
        {"poseSlug": "warrior-ii", "holdSeconds": 30, "side": "right"},
        {"poseSlug": "triangle-pose", "holdSeconds": 30, "side": "right"},
        {"poseSlug": "warrior-i", "holdSeconds": 30, "side": "left"},
        {"poseSlug": "warrior-ii", "holdSeconds": 30, "side": "left"},
        {"poseSlug": "triangle-pose", "holdSeconds": 30, "side": "left"},
        {"poseSlug": "tree-pose", "holdSeconds": 30, "side": "right"},
        {"poseSlug": "tree-pose", "holdSeconds": 30, "side": "left"}
      ],
      "breathingPattern": "ujjayi",
      "narrationScript": "Now we build strength and focus. Move through the Warrior sequence on each side, feeling your power and stability grow."
    },
    {
      "phaseType": "cooldown",
      "name": "Gentle Cool Down",
      "durationSeconds": 180,
      "poses": [
        {"poseSlug": "standing-forward-fold", "holdSeconds": 30, "side": "both"},
        {"poseSlug": "seated-forward-fold", "holdSeconds": 45, "side": "both"},
        {"poseSlug": "reclined-twist", "holdSeconds": 30, "side": "right"},
        {"poseSlug": "reclined-twist", "holdSeconds": 30, "side": "left"}
      ],
      "breathingPattern": "natural",
      "narrationScript": "Beautiful work. Now we slow down and let the body absorb the benefits of your practice."
    },
    {
      "phaseType": "savasana",
      "name": "Final Rest",
      "durationSeconds": 120,
      "poses": [
        {"poseSlug": "corpse-pose", "holdSeconds": 120, "side": "both"}
      ],
      "breathingPattern": "natural",
      "narrationScript": "Come to stillness in Savasana. Let your body be heavy on the earth. Carry this calm energy into your day."
    }
  ]'::jsonb,
  'sunrise',
  ARRAY['morning', 'energizing', 'beginner-friendly', 'sun-salutation']
);

-- ── Evening Flow (25 min) ──────────────────────────────────

INSERT INTO yoga_sessions (user_id, title, description, session_type, difficulty, duration_minutes, is_template, is_ai_generated, phases, ambient_theme, tags)
VALUES (
  NULL,
  'Evening Wind-Down Flow',
  'A 25-minute calming evening practice to release the tension of the day and prepare the body and mind for restful sleep.',
  'evening_flow',
  'beginner',
  25,
  true,
  false,
  '[
    {
      "phaseType": "warmup",
      "name": "Settling In",
      "durationSeconds": 180,
      "poses": [
        {"poseSlug": "childs-pose", "holdSeconds": 45, "side": "both"},
        {"poseSlug": "cat-pose", "holdSeconds": 5, "side": "both"},
        {"poseSlug": "cow-pose", "holdSeconds": 5, "side": "both"},
        {"poseSlug": "cat-pose", "holdSeconds": 5, "side": "both"},
        {"poseSlug": "cow-pose", "holdSeconds": 5, "side": "both"},
        {"poseSlug": "thread-the-needle", "holdSeconds": 30, "side": "right"},
        {"poseSlug": "thread-the-needle", "holdSeconds": 30, "side": "left"}
      ],
      "breathingPattern": "natural",
      "narrationScript": "Welcome to your evening practice. Let go of whatever happened today. Begin in Child''s Pose and simply breathe."
    },
    {
      "phaseType": "flow",
      "name": "Gentle Stretch",
      "durationSeconds": 360,
      "poses": [
        {"poseSlug": "downward-facing-dog", "holdSeconds": 30, "side": "both"},
        {"poseSlug": "low-lunge", "holdSeconds": 30, "side": "right"},
        {"poseSlug": "pigeon-pose", "holdSeconds": 45, "side": "right"},
        {"poseSlug": "downward-facing-dog", "holdSeconds": 20, "side": "both"},
        {"poseSlug": "low-lunge", "holdSeconds": 30, "side": "left"},
        {"poseSlug": "pigeon-pose", "holdSeconds": 45, "side": "left"}
      ],
      "breathingPattern": "natural",
      "narrationScript": "Move gently and slowly. There is no rush. Let each pose be an opportunity to release stored tension."
    },
    {
      "phaseType": "cooldown",
      "name": "Floor Stretches",
      "durationSeconds": 420,
      "poses": [
        {"poseSlug": "seated-forward-fold", "holdSeconds": 60, "side": "both"},
        {"poseSlug": "butterfly-pose", "holdSeconds": 45, "side": "both"},
        {"poseSlug": "happy-baby", "holdSeconds": 45, "side": "both"},
        {"poseSlug": "reclined-twist", "holdSeconds": 45, "side": "right"},
        {"poseSlug": "reclined-twist", "holdSeconds": 45, "side": "left"}
      ],
      "breathingPattern": "4-7-8",
      "narrationScript": "Come down to the floor. These long holds allow your muscles to fully release. Breathe deeply and surrender to gravity."
    },
    {
      "phaseType": "savasana",
      "name": "Deep Relaxation",
      "durationSeconds": 300,
      "poses": [
        {"poseSlug": "legs-up-wall", "holdSeconds": 180, "side": "both"},
        {"poseSlug": "corpse-pose", "holdSeconds": 120, "side": "both"}
      ],
      "breathingPattern": "4-7-8",
      "narrationScript": "If a wall is available, bring your legs up for deep restoration. Otherwise, rest in Savasana. Let sleep find you gently."
    }
  ]'::jsonb,
  'night',
  ARRAY['evening', 'calming', 'sleep-prep', 'beginner-friendly']
);

-- ── Gentle Stretch (15 min) ──────────────────────────────────

INSERT INTO yoga_sessions (user_id, title, description, session_type, difficulty, duration_minutes, is_template, is_ai_generated, phases, ambient_theme, tags)
VALUES (
  NULL,
  'Gentle Stretch & Restore',
  'A 15-minute gentle practice for rest days or whenever your body needs tender care. All poses are accessible and calming.',
  'gentle_stretch',
  'beginner',
  15,
  true,
  false,
  '[
    {
      "phaseType": "warmup",
      "name": "Grounding",
      "durationSeconds": 120,
      "poses": [
        {"poseSlug": "childs-pose", "holdSeconds": 45, "side": "both"},
        {"poseSlug": "cat-pose", "holdSeconds": 5, "side": "both"},
        {"poseSlug": "cow-pose", "holdSeconds": 5, "side": "both"},
        {"poseSlug": "cat-pose", "holdSeconds": 5, "side": "both"},
        {"poseSlug": "cow-pose", "holdSeconds": 5, "side": "both"}
      ],
      "breathingPattern": "natural",
      "narrationScript": "This is your time for gentle self-care. Begin in Child''s Pose, breathing slowly. Move through Cat-Cow at your own pace."
    },
    {
      "phaseType": "flow",
      "name": "Soft Opening",
      "durationSeconds": 300,
      "poses": [
        {"poseSlug": "sphinx-pose", "holdSeconds": 30, "side": "both"},
        {"poseSlug": "puppy-pose", "holdSeconds": 30, "side": "both"},
        {"poseSlug": "thread-the-needle", "holdSeconds": 30, "side": "right"},
        {"poseSlug": "thread-the-needle", "holdSeconds": 30, "side": "left"},
        {"poseSlug": "downward-facing-dog", "holdSeconds": 20, "side": "both"},
        {"poseSlug": "standing-forward-fold", "holdSeconds": 30, "side": "both"}
      ],
      "breathingPattern": "natural",
      "narrationScript": "We keep everything close to the ground today. Sphinx Pose gently wakes the spine. Thread the Needle melts away shoulder tension."
    },
    {
      "phaseType": "cooldown",
      "name": "Floor Rest",
      "durationSeconds": 300,
      "poses": [
        {"poseSlug": "butterfly-pose", "holdSeconds": 45, "side": "both"},
        {"poseSlug": "happy-baby", "holdSeconds": 45, "side": "both"},
        {"poseSlug": "reclined-twist", "holdSeconds": 30, "side": "right"},
        {"poseSlug": "reclined-twist", "holdSeconds": 30, "side": "left"}
      ],
      "breathingPattern": "natural",
      "narrationScript": "Come to the floor for some gentle hip and spine release. Let gravity be your teacher."
    },
    {
      "phaseType": "savasana",
      "name": "Rest",
      "durationSeconds": 180,
      "poses": [
        {"poseSlug": "corpse-pose", "holdSeconds": 180, "side": "both"}
      ],
      "breathingPattern": "natural",
      "narrationScript": "Rest in Savasana. You have given your body exactly what it needed. Be still and receive."
    }
  ]'::jsonb,
  'forest',
  ARRAY['gentle', 'restorative', 'rest-day', 'beginner-friendly']
);

-- ── Hip Opener Flow (20 min) ──────────────────────────────────

INSERT INTO yoga_sessions (user_id, title, description, session_type, difficulty, duration_minutes, is_template, is_ai_generated, phases, ambient_theme, tags)
VALUES (
  NULL,
  'Deep Hip Opener Flow',
  'A 20-minute practice focused on opening the hips, releasing stored tension, and improving lower body mobility.',
  'hip_opener_flow',
  'intermediate',
  20,
  true,
  false,
  '[
    {
      "phaseType": "warmup",
      "name": "Hip Prep",
      "durationSeconds": 180,
      "poses": [
        {"poseSlug": "childs-pose", "holdSeconds": 30, "side": "both"},
        {"poseSlug": "cat-pose", "holdSeconds": 5, "side": "both"},
        {"poseSlug": "cow-pose", "holdSeconds": 5, "side": "both"},
        {"poseSlug": "cat-pose", "holdSeconds": 5, "side": "both"},
        {"poseSlug": "cow-pose", "holdSeconds": 5, "side": "both"},
        {"poseSlug": "downward-facing-dog", "holdSeconds": 30, "side": "both"},
        {"poseSlug": "garland-pose", "holdSeconds": 30, "side": "both"}
      ],
      "breathingPattern": "ujjayi",
      "narrationScript": "We begin gently, warming the spine before we ask the hips to open. The deep squat of Garland Pose starts to awaken the hip joints."
    },
    {
      "phaseType": "flow",
      "name": "Standing Hip Openers",
      "durationSeconds": 300,
      "poses": [
        {"poseSlug": "low-lunge", "holdSeconds": 30, "side": "right"},
        {"poseSlug": "lizard-pose", "holdSeconds": 30, "side": "right"},
        {"poseSlug": "warrior-ii", "holdSeconds": 25, "side": "right"},
        {"poseSlug": "extended-side-angle", "holdSeconds": 25, "side": "right"},
        {"poseSlug": "low-lunge", "holdSeconds": 30, "side": "left"},
        {"poseSlug": "lizard-pose", "holdSeconds": 30, "side": "left"},
        {"poseSlug": "warrior-ii", "holdSeconds": 25, "side": "left"},
        {"poseSlug": "extended-side-angle", "holdSeconds": 25, "side": "left"}
      ],
      "breathingPattern": "ujjayi",
      "narrationScript": "Now we move through standing poses that target the hips from every angle. Breathe into the stretch and let each exhale bring you deeper."
    },
    {
      "phaseType": "peak",
      "name": "Deep Floor Openers",
      "durationSeconds": 300,
      "poses": [
        {"poseSlug": "pigeon-pose", "holdSeconds": 60, "side": "right"},
        {"poseSlug": "pigeon-pose", "holdSeconds": 60, "side": "left"},
        {"poseSlug": "butterfly-pose", "holdSeconds": 45, "side": "both"},
        {"poseSlug": "wide-legged-forward-fold", "holdSeconds": 45, "side": "both"}
      ],
      "breathingPattern": "natural",
      "narrationScript": "Pigeon Pose is the crown jewel of hip openers. Stay with the sensation. Emotions may surface — that is completely normal. Breathe through whatever arises."
    },
    {
      "phaseType": "cooldown",
      "name": "Release",
      "durationSeconds": 240,
      "poses": [
        {"poseSlug": "happy-baby", "holdSeconds": 45, "side": "both"},
        {"poseSlug": "reclined-twist", "holdSeconds": 30, "side": "right"},
        {"poseSlug": "reclined-twist", "holdSeconds": 30, "side": "left"}
      ],
      "breathingPattern": "natural",
      "narrationScript": "Release everything now. Happy Baby massages the lower back while keeping those hips open. Let the twists wring out any remaining tension."
    },
    {
      "phaseType": "savasana",
      "name": "Integration",
      "durationSeconds": 180,
      "poses": [
        {"poseSlug": "corpse-pose", "holdSeconds": 180, "side": "both"}
      ],
      "breathingPattern": "natural",
      "narrationScript": "Rest in Savasana and let your body integrate this deep hip work. Notice how open and free your hips feel."
    }
  ]'::jsonb,
  'forest',
  ARRAY['hip-opener', 'flexibility', 'intermediate', 'deep-stretch']
);

-- ── Power Yoga (30 min) ──────────────────────────────────

INSERT INTO yoga_sessions (user_id, title, description, session_type, difficulty, duration_minutes, is_template, is_ai_generated, phases, ambient_theme, tags)
VALUES (
  NULL,
  'Power Yoga Burn',
  'A 30-minute challenging power yoga session that builds strength, endurance, and heat. Expect to sweat.',
  'power_yoga',
  'intermediate',
  30,
  true,
  false,
  '[
    {
      "phaseType": "warmup",
      "name": "Dynamic Warm-Up",
      "durationSeconds": 240,
      "poses": [
        {"poseSlug": "mountain-pose", "holdSeconds": 15, "side": "both"},
        {"poseSlug": "chair-pose", "holdSeconds": 20, "side": "both"},
        {"poseSlug": "standing-forward-fold", "holdSeconds": 10, "side": "both"},
        {"poseSlug": "plank-pose", "holdSeconds": 20, "side": "both"},
        {"poseSlug": "cobra-pose", "holdSeconds": 10, "side": "both"},
        {"poseSlug": "downward-facing-dog", "holdSeconds": 30, "side": "both"},
        {"poseSlug": "standing-forward-fold", "holdSeconds": 10, "side": "both"},
        {"poseSlug": "chair-pose", "holdSeconds": 20, "side": "both"},
        {"poseSlug": "mountain-pose", "holdSeconds": 10, "side": "both"}
      ],
      "breathingPattern": "ujjayi",
      "narrationScript": "We start building heat right away. Move with your breath — one movement, one breath. This is your warm-up but keep the intensity."
    },
    {
      "phaseType": "flow",
      "name": "Warrior Flow",
      "durationSeconds": 480,
      "poses": [
        {"poseSlug": "warrior-i", "holdSeconds": 25, "side": "right"},
        {"poseSlug": "warrior-ii", "holdSeconds": 25, "side": "right"},
        {"poseSlug": "extended-side-angle", "holdSeconds": 20, "side": "right"},
        {"poseSlug": "triangle-pose", "holdSeconds": 20, "side": "right"},
        {"poseSlug": "half-moon", "holdSeconds": 15, "side": "right"},
        {"poseSlug": "plank-pose", "holdSeconds": 20, "side": "both"},
        {"poseSlug": "upward-facing-dog", "holdSeconds": 10, "side": "both"},
        {"poseSlug": "downward-facing-dog", "holdSeconds": 20, "side": "both"},
        {"poseSlug": "warrior-i", "holdSeconds": 25, "side": "left"},
        {"poseSlug": "warrior-ii", "holdSeconds": 25, "side": "left"},
        {"poseSlug": "extended-side-angle", "holdSeconds": 20, "side": "left"},
        {"poseSlug": "triangle-pose", "holdSeconds": 20, "side": "left"},
        {"poseSlug": "half-moon", "holdSeconds": 15, "side": "left"},
        {"poseSlug": "plank-pose", "holdSeconds": 20, "side": "both"},
        {"poseSlug": "upward-facing-dog", "holdSeconds": 10, "side": "both"},
        {"poseSlug": "downward-facing-dog", "holdSeconds": 20, "side": "both"}
      ],
      "breathingPattern": "ujjayi",
      "narrationScript": "This is the heart of the practice. Flow through the Warrior sequence with power and grace. Each side is a full expression of your strength."
    },
    {
      "phaseType": "peak",
      "name": "Peak Challenges",
      "durationSeconds": 420,
      "poses": [
        {"poseSlug": "chair-pose", "holdSeconds": 30, "side": "both"},
        {"poseSlug": "eagle-pose", "holdSeconds": 20, "side": "right"},
        {"poseSlug": "eagle-pose", "holdSeconds": 20, "side": "left"},
        {"poseSlug": "warrior-iii", "holdSeconds": 20, "side": "right"},
        {"poseSlug": "warrior-iii", "holdSeconds": 20, "side": "left"},
        {"poseSlug": "side-plank", "holdSeconds": 15, "side": "right"},
        {"poseSlug": "plank-pose", "holdSeconds": 20, "side": "both"},
        {"poseSlug": "side-plank", "holdSeconds": 15, "side": "left"},
        {"poseSlug": "boat-pose", "holdSeconds": 25, "side": "both"},
        {"poseSlug": "camel-pose", "holdSeconds": 20, "side": "both"}
      ],
      "breathingPattern": "ujjayi",
      "narrationScript": "This is where we test our edge. Balance, core strength, and courage. Stay with the breath even when it gets intense."
    },
    {
      "phaseType": "cooldown",
      "name": "Cool Down",
      "durationSeconds": 360,
      "poses": [
        {"poseSlug": "pigeon-pose", "holdSeconds": 40, "side": "right"},
        {"poseSlug": "pigeon-pose", "holdSeconds": 40, "side": "left"},
        {"poseSlug": "seated-forward-fold", "holdSeconds": 40, "side": "both"},
        {"poseSlug": "bridge-pose", "holdSeconds": 25, "side": "both"},
        {"poseSlug": "reclined-twist", "holdSeconds": 30, "side": "right"},
        {"poseSlug": "reclined-twist", "holdSeconds": 30, "side": "left"}
      ],
      "breathingPattern": "natural",
      "narrationScript": "You earned this cool down. Let the intensity melt away as you stretch deeply. Your body is absorbing all that hard work."
    },
    {
      "phaseType": "savasana",
      "name": "Final Rest",
      "durationSeconds": 180,
      "poses": [
        {"poseSlug": "corpse-pose", "holdSeconds": 180, "side": "both"}
      ],
      "breathingPattern": "natural",
      "narrationScript": "Lie still. Feel the heat radiating through your body. This stillness after effort is where transformation happens."
    }
  ]'::jsonb,
  'mountain',
  ARRAY['power', 'strength', 'intermediate', 'challenging', 'full-body']
);

-- ── Recovery Flow (20 min) ──────────────────────────────────

INSERT INTO yoga_sessions (user_id, title, description, session_type, difficulty, duration_minutes, is_template, is_ai_generated, phases, ambient_theme, tags)
VALUES (
  NULL,
  'Post-Workout Recovery Flow',
  'A 20-minute gentle recovery practice designed to stretch sore muscles, reduce inflammation, and speed up recovery after intense training.',
  'recovery_flow',
  'beginner',
  20,
  true,
  false,
  '[
    {
      "phaseType": "warmup",
      "name": "Gentle Mobilization",
      "durationSeconds": 180,
      "poses": [
        {"poseSlug": "childs-pose", "holdSeconds": 45, "side": "both"},
        {"poseSlug": "cat-pose", "holdSeconds": 5, "side": "both"},
        {"poseSlug": "cow-pose", "holdSeconds": 5, "side": "both"},
        {"poseSlug": "cat-pose", "holdSeconds": 5, "side": "both"},
        {"poseSlug": "cow-pose", "holdSeconds": 5, "side": "both"},
        {"poseSlug": "cat-pose", "holdSeconds": 5, "side": "both"},
        {"poseSlug": "cow-pose", "holdSeconds": 5, "side": "both"},
        {"poseSlug": "sphinx-pose", "holdSeconds": 30, "side": "both"}
      ],
      "breathingPattern": "natural",
      "narrationScript": "Your body worked hard. Now we give it what it needs to heal. Start slowly in Child''s Pose. The Cat-Cow movements gently flush fresh blood through the spine."
    },
    {
      "phaseType": "flow",
      "name": "Lower Body Recovery",
      "durationSeconds": 360,
      "poses": [
        {"poseSlug": "downward-facing-dog", "holdSeconds": 30, "side": "both"},
        {"poseSlug": "low-lunge", "holdSeconds": 30, "side": "right"},
        {"poseSlug": "lizard-pose", "holdSeconds": 30, "side": "right"},
        {"poseSlug": "pigeon-pose", "holdSeconds": 45, "side": "right"},
        {"poseSlug": "downward-facing-dog", "holdSeconds": 20, "side": "both"},
        {"poseSlug": "low-lunge", "holdSeconds": 30, "side": "left"},
        {"poseSlug": "lizard-pose", "holdSeconds": 30, "side": "left"},
        {"poseSlug": "pigeon-pose", "holdSeconds": 45, "side": "left"}
      ],
      "breathingPattern": "natural",
      "narrationScript": "We focus on the areas that take the most strain during workouts — hips, quads, and hip flexors. Move slowly and hold longer to let the fascia release."
    },
    {
      "phaseType": "cooldown",
      "name": "Full Body Release",
      "durationSeconds": 360,
      "poses": [
        {"poseSlug": "seated-forward-fold", "holdSeconds": 45, "side": "both"},
        {"poseSlug": "butterfly-pose", "holdSeconds": 40, "side": "both"},
        {"poseSlug": "bridge-pose", "holdSeconds": 25, "side": "both"},
        {"poseSlug": "happy-baby", "holdSeconds": 40, "side": "both"},
        {"poseSlug": "thread-the-needle", "holdSeconds": 30, "side": "right"},
        {"poseSlug": "thread-the-needle", "holdSeconds": 30, "side": "left"},
        {"poseSlug": "reclined-twist", "holdSeconds": 30, "side": "right"},
        {"poseSlug": "reclined-twist", "holdSeconds": 30, "side": "left"}
      ],
      "breathingPattern": "natural",
      "narrationScript": "Now we address the entire body. Forward folds for the hamstrings and back. Thread the Needle for the shoulders. Twists to wring out tension from head to toe."
    },
    {
      "phaseType": "savasana",
      "name": "Deep Recovery Rest",
      "durationSeconds": 300,
      "poses": [
        {"poseSlug": "legs-up-wall", "holdSeconds": 180, "side": "both"},
        {"poseSlug": "corpse-pose", "holdSeconds": 120, "side": "both"}
      ],
      "breathingPattern": "4-7-8",
      "narrationScript": "Legs Up the Wall is one of the most restorative positions for recovery. Let gravity drain the lactic acid from your legs. Then rest completely in Savasana."
    }
  ]'::jsonb,
  'ocean',
  ARRAY['recovery', 'post-workout', 'gentle', 'restorative', 'beginner-friendly']
);

COMMIT;

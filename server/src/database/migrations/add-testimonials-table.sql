-- ============================================
-- Migration: Add testimonials table
-- ============================================

-- Create table
CREATE TABLE IF NOT EXISTS testimonials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    role VARCHAR(100) NOT NULL,
    avatar_url VARCHAR(2000),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    content TEXT NOT NULL,
    verified BOOLEAN DEFAULT false,
    pillar VARCHAR(20) CHECK (pillar IN ('fitness', 'nutrition', 'wellbeing')),
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_testimonials_is_active ON testimonials(is_active);
CREATE INDEX IF NOT EXISTS idx_testimonials_pillar ON testimonials(pillar);
CREATE INDEX IF NOT EXISTS idx_testimonials_display_order ON testimonials(display_order);
CREATE INDEX IF NOT EXISTS idx_testimonials_rating ON testimonials(rating);
CREATE INDEX IF NOT EXISTS idx_testimonials_featured ON testimonials(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_testimonials_search ON testimonials USING gin(
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(role, '') || ' ' || coalesce(content, ''))
);

-- Seed with existing hardcoded testimonials
INSERT INTO testimonials (name, role, avatar_url, rating, content, verified, pillar, is_active, is_featured, display_order)
VALUES
  ('Sarah Johnson', 'Fitness Enthusiast', '/avatars/sarah.jpg', 5, 'YHealth completely transformed my approach to wellness. The AI insights helped me understand my body better than any other app. I''ve lost 20 pounds and feel more energetic than ever!', true, 'fitness', true, true, 1),
  ('Michael Chen', 'Software Engineer', '/avatars/michael.jpg', 5, 'As someone who spends long hours at the desk, YHealth''s reminders and personalized exercise recommendations have been a game-changer. My back pain is gone and I sleep so much better now.', true, 'wellbeing', true, false, 2),
  ('Emily Rodriguez', 'Working Mom', '/avatars/emily.jpg', 5, 'Balancing work and family left no time for my health. YHealth made it easy with quick workouts and meal planning. The whole family is eating healthier now!', true, 'nutrition', true, false, 3),
  ('David Thompson', 'Marathon Runner', '/avatars/david.jpg', 5, 'The training insights and recovery tracking helped me shave 15 minutes off my marathon time. The integration with my fitness devices is seamless.', true, 'fitness', true, true, 4),
  ('Lisa Park', 'Yoga Instructor', '/avatars/lisa.jpg', 5, 'I recommend YHealth to all my students. The mindfulness features and stress tracking complement yoga practice beautifully. It''s holistic wellness at its best.', true, 'wellbeing', true, false, 5),
  ('James Wilson', 'Personal Trainer', '/avatars/james.jpg', 5, 'As a fitness professional, I''ve tried countless apps. YHealth stands out with its comprehensive approach. I use it with all my clients now.', true, 'fitness', true, false, 6),
  ('Amanda Foster', 'Nutritionist', '/avatars/amanda.jpg', 4, 'The meal tracking and nutritional insights are spot-on. My clients love how easy it is to log their meals and see their progress over time.', true, 'nutrition', true, false, 7),
  ('Robert Kim', 'Business Executive', '/avatars/robert.jpg', 5, 'With my busy schedule, I needed something that works around my life. YHealth''s smart scheduling and quick check-ins fit perfectly into my routine.', true, 'wellbeing', true, false, 8),
  ('Jennifer Adams', 'Healthcare Worker', '/avatars/jennifer.jpg', 5, 'Working night shifts made maintaining health difficult. The personalized recommendations adapted to my schedule beautifully. Highly recommended!', true, 'nutrition', true, false, 9),
  ('Chris Martinez', 'College Student', '/avatars/chris.jpg', 5, 'Affordable and effective! As a student on a budget, YHealth gives me premium features without breaking the bank. My energy levels have never been better.', true, 'fitness', true, false, 10),
  ('Sophia Lee', 'Wellness Coach', '/avatars/sophia.jpg', 5, 'The holistic approach to health tracking is exactly what I recommend to my clients. Sleep, nutrition, exercise, and mental wellness all in one place.', true, 'wellbeing', true, true, 11),
  ('Daniel Brown', 'Retired Teacher', '/avatars/daniel.jpg', 4, 'At 65, I was skeptical about health apps. YHealth proved me wrong with its easy interface and gentle reminders. My doctor is impressed with my progress!', true, 'nutrition', true, false, 12)
ON CONFLICT DO NOTHING;

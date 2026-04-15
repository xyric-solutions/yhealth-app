-- ============================================
-- ASSESSMENT QUESTIONS TABLE
-- ============================================
-- Question bank for quick/deep assessments

DROP TABLE IF EXISTS assessment_questions CASCADE;
CREATE TABLE assessment_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id VARCHAR(100) UNIQUE NOT NULL,
    text TEXT NOT NULL,
    type question_type NOT NULL,
    category VARCHAR(50) NOT NULL,
    pillar health_pillar,
    order_num INTEGER NOT NULL,
    is_required BOOLEAN DEFAULT true,

    -- Options
    options JSONB,
    slider_config JSONB,
    validation JSONB,
    show_if JSONB,

    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_assessment_questions_category_order ON assessment_questions(category, order_num);
CREATE INDEX idx_assessment_questions_active ON assessment_questions(is_active);

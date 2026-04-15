-- ============================================
-- DAILY SCHEDULES TABLES
-- ============================================
-- Daily scheduling system with drag-drop items and workflow-style linking

-- Schedule Templates Table (created first as it's referenced by daily_schedules)
DROP TABLE IF EXISTS schedule_templates CASCADE;
CREATE TABLE schedule_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Daily Schedules Table
DROP TABLE IF EXISTS daily_schedules CASCADE;
CREATE TABLE daily_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    schedule_date DATE NOT NULL,
    template_id UUID REFERENCES schedule_templates(id) ON DELETE SET NULL,
    name VARCHAR(200),
    notes TEXT,
    is_template BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Schedule Items Table
DROP TABLE IF EXISTS schedule_items CASCADE;
CREATE TABLE schedule_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id UUID NOT NULL REFERENCES daily_schedules(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    start_time TIME NOT NULL,
    end_time TIME,
    duration_minutes INTEGER,
    color VARCHAR(20),
    icon VARCHAR(50),
    category VARCHAR(50),
    shape VARCHAR(20) DEFAULT 'square', -- 'square', 'circle', 'rounded', 'diamond', 'hexagon'
    position INTEGER NOT NULL DEFAULT 0, -- For drag-drop ordering
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Schedule Links Table (for workflow-style connections)
DROP TABLE IF EXISTS schedule_links CASCADE;
CREATE TABLE schedule_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id UUID NOT NULL REFERENCES daily_schedules(id) ON DELETE CASCADE,
    source_item_id UUID NOT NULL REFERENCES schedule_items(id) ON DELETE CASCADE,
    target_item_id UUID NOT NULL REFERENCES schedule_items(id) ON DELETE CASCADE,
    link_type VARCHAR(20) DEFAULT 'sequential', -- 'sequential', 'conditional', 'parallel'
    delay_minutes INTEGER DEFAULT 0, -- Delay between source and target
    conditions JSONB DEFAULT '{}', -- For conditional linking
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(schedule_id, source_item_id, target_item_id),
    CHECK (source_item_id != target_item_id) 
    
);

-- Indexes for schedule_templates
CREATE INDEX idx_schedule_templates_user ON schedule_templates(user_id);
CREATE INDEX idx_schedule_templates_default ON schedule_templates(user_id, is_default) WHERE is_default = true;

-- Indexes for daily_schedules
CREATE INDEX idx_daily_schedules_user_date ON daily_schedules(user_id, schedule_date DESC);
CREATE INDEX idx_daily_schedules_user ON daily_schedules(user_id);
CREATE INDEX idx_daily_schedules_template ON daily_schedules(template_id) WHERE template_id IS NOT NULL;
-- Partial unique index to ensure one schedule per user per date (non-template only)
CREATE UNIQUE INDEX idx_daily_schedules_user_date_unique ON daily_schedules(user_id, schedule_date) WHERE is_template = false;

-- Indexes for schedule_items
CREATE INDEX idx_schedule_items_schedule ON schedule_items(schedule_id);
CREATE INDEX idx_schedule_items_position ON schedule_items(schedule_id, position);
CREATE INDEX idx_schedule_items_time ON schedule_items(schedule_id, start_time);

-- Indexes for schedule_links
CREATE INDEX idx_schedule_links_schedule ON schedule_links(schedule_id);
CREATE INDEX idx_schedule_links_source ON schedule_links(source_item_id);
CREATE INDEX idx_schedule_links_target ON schedule_links(target_item_id);



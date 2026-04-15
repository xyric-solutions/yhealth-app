-- ============================================
-- WHATSAPP ENROLLMENTS TABLE
-- ============================================
-- WhatsApp coaching enrollment and verification

DROP TABLE IF EXISTS whatsapp_enrollments CASCADE;
CREATE TABLE whatsapp_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,
    country_code VARCHAR(5) NOT NULL,
    is_verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMP,
    consented_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_whatsapp_enrollments_phone ON whatsapp_enrollments(phone_number);

-- ==============================================================================
-- Migration: 20261030000001_exam_customization_config.sql
-- Description: Add flexible config JSONB to exams and exam_sections for 100% customizability
-- Target: Supabase PostgreSQL
-- ==============================================================================

-- 1. Add config JSONB column to exams table
ALTER TABLE exams ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2. Add config JSONB column to exam_sections table
ALTER TABLE exam_sections ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3. Add instructions and timing columns if not present
ALTER TABLE exams ADD COLUMN IF NOT EXISTS instructions TEXT;

-- 4. Create GIN index on config columns for high-performance query filtering
CREATE INDEX IF NOT EXISTS idx_exams_config ON exams USING GIN (config);
CREATE INDEX IF NOT EXISTS idx_exam_sections_config ON exam_sections USING GIN (config);


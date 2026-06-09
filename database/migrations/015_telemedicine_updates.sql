-- Migration 015: Telemedicine Schema Updates
-- Adds columns for consultation notes, recording metadata, and ensures proper session states.

ALTER TABLE telemedicine_sessions ADD COLUMN IF NOT EXISTS consultation_notes TEXT;
ALTER TABLE telemedicine_sessions ADD COLUMN IF NOT EXISTS recording_metadata JSONB DEFAULT '{}'::jsonb;

-- Explicitly ensure statuses are standard: 'ready', 'waiting', 'active', 'ended'
ALTER TABLE telemedicine_sessions DROP CONSTRAINT IF EXISTS telemedicine_sessions_status_check;
ALTER TABLE telemedicine_sessions ADD CONSTRAINT telemedicine_sessions_status_check
  CHECK (status IN ('ready', 'waiting', 'active', 'ended'));

-- Create indexing for performance
CREATE INDEX IF NOT EXISTS idx_telemedicine_sessions_ended_at ON telemedicine_sessions(hospital_id, ended_at);

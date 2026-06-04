-- Migration: 006_medical_records_notes.sql
-- Adds notes column to medical_records table for Phase 2 EMR requirements.

ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS notes TEXT;

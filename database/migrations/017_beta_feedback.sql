-- Migration: 017_beta_feedback.sql
-- Creates the beta_feedback table for in-app bug reporting during the beta phase.
-- Run this before starting the beta: node backend/src/scripts/runMigration.js 017_beta_feedback.sql

CREATE TABLE IF NOT EXISTS beta_feedback (
  id           SERIAL       PRIMARY KEY,
  tenant_id    INTEGER      REFERENCES hospitals(id) ON DELETE SET NULL,
  user_id      INTEGER      REFERENCES users(id)     ON DELETE SET NULL,
  role         VARCHAR(50),
  issue_type   VARCHAR(50)  NOT NULL
    CHECK (issue_type IN ('bug', 'ui_glitch', 'data_error', 'performance', 'feature_request', 'other')),
  description  TEXT         NOT NULL,
  screen_route VARCHAR(500),
  status       VARCHAR(20)  NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'acknowledged', 'resolved', 'wont_fix')),
  notified_at  TIMESTAMPTZ,                           -- when Slack/Discord webhook was fired
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beta_feedback_tenant    ON beta_feedback(tenant_id);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_status    ON beta_feedback(status);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_created   ON beta_feedback(created_at DESC);

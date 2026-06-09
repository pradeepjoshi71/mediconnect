'use strict';

/**
 * betaFeedback.js — In-app bug reporting route for beta clinic users.
 *
 * POST /api/beta-feedback
 *   Body: { tenantId, userId, role, issueType, description, screenRoute }
 *
 * Actions (both always attempted — webhook failure never blocks DB save):
 *   1. Persist the report to `beta_feedback` table
 *   2. Fire a Slack or Discord webhook so devs are notified instantly
 *
 * Auth: Required (any authenticated role can submit feedback).
 *
 * Mount in app.js:
 *   app.use('/api/beta-feedback', require('./routes/betaFeedback'));
 *
 * Required env var (at least one):
 *   SLACK_WEBHOOK_URL    — Slack Incoming Webhook URL
 *   DISCORD_WEBHOOK_URL  — Discord channel webhook URL
 */

const express = require('express');
const db      = require('../config/db');
const authMiddleware = require('../middlewares/authMiddleware');
const logger  = require('../utils/logger');

const router = express.Router();

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_ISSUE_TYPES = new Set([
  'bug', 'ui_glitch', 'data_error', 'performance', 'feature_request', 'other',
]);

// Emoji map — makes Slack/Discord cards instantly scannable
const ISSUE_EMOJI = {
  bug:             '🐛',
  ui_glitch:       '🖥️',
  data_error:      '📊',
  performance:     '⚡',
  feature_request: '💡',
  other:           '📝',
};

// ─── Webhook dispatcher ───────────────────────────────────────────────────────

/**
 * Sends a notification to Slack and/or Discord.
 * Uses native `fetch` (Node 18+) — zero extra dependencies.
 * Errors are swallowed and logged — webhook failure must never block the user.
 *
 * @param {object} report — the saved DB row fields
 * @returns {Promise<void>}
 */
async function notifyWebhooks(report) {
  const emoji       = ISSUE_EMOJI[report.issue_type] || '📝';
  const timestamp   = new Date().toISOString();
  const routeLabel  = report.screen_route || '—';
  const roleLabel   = report.role         || 'unknown';

  // ── Slack payload (Block Kit) ─────────────────────────────────────────
  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  if (slackUrl) {
    const slackBody = {
      text: `${emoji} *Beta Bug Report* — ${report.issue_type.toUpperCase()}`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: `${emoji} Beta Feedback — ${report.issue_type.replace('_', ' ')}` },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Tenant ID:*\n${report.tenant_id || '—'}` },
            { type: 'mrkdwn', text: `*User ID:*\n${report.user_id || '—'}` },
            { type: 'mrkdwn', text: `*Role:*\n${roleLabel}` },
            { type: 'mrkdwn', text: `*Screen:*\n\`${routeLabel}\`` },
          ],
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*Description:*\n${report.description}` },
        },
        {
          type: 'context',
          elements: [{ type: 'mrkdwn', text: `Feedback ID: \`${report.id}\` · ${timestamp}` }],
        },
      ],
    };

    try {
      const slackRes = await fetch(slackUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(slackBody),
        signal:  AbortSignal.timeout(5000),  // 5-second hard deadline
      });
      if (!slackRes.ok) {
        logger.warn('[betaFeedback] Slack webhook returned non-OK', { status: slackRes.status });
      }
    } catch (err) {
      logger.warn('[betaFeedback] Slack webhook failed', { error: err.message });
    }
  }

  // ── Discord payload (Embed) ───────────────────────────────────────────
  const discordUrl = process.env.DISCORD_WEBHOOK_URL;
  if (discordUrl) {
    const discordBody = {
      username:   'MediConnect Beta Bot',
      avatar_url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/1f3e5.png',
      embeds: [
        {
          title:       `${emoji} Beta Feedback — ${report.issue_type.replace('_', ' ')}`,
          color:       report.issue_type === 'bug' ? 0xFF4444 : 0x5865F2,
          description: report.description,
          fields: [
            { name: 'Tenant ID',  value: String(report.tenant_id || '—'), inline: true },
            { name: 'User ID',    value: String(report.user_id   || '—'), inline: true },
            { name: 'Role',       value: roleLabel,                        inline: true },
            { name: 'Screen',     value: `\`${routeLabel}\``,              inline: false },
          ],
          footer: { text: `Feedback ID: ${report.id}` },
          timestamp,
        },
      ],
    };

    try {
      const discordRes = await fetch(discordUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(discordBody),
        signal:  AbortSignal.timeout(5000),
      });
      if (!discordRes.ok) {
        logger.warn('[betaFeedback] Discord webhook returned non-OK', { status: discordRes.status });
      }
    } catch (err) {
      logger.warn('[betaFeedback] Discord webhook failed', { error: err.message });
    }
  }

  // Mark the DB row as notified
  try {
    await db.query(
      `UPDATE beta_feedback SET notified_at = now() WHERE id = $1`,
      [report.id]
    );
  } catch (err) {
    logger.warn('[betaFeedback] Could not update notified_at', { error: err.message });
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

/**
 * POST /api/beta-feedback
 *
 * Body (all from the React frontend via apiClient):
 *   tenantId    {number}  — hospitalId of the reporting clinic
 *   userId      {number}  — authenticated user's ID
 *   role        {string}  — user's role (doctor, patient, receptionist, etc.)
 *   issueType   {string}  — one of VALID_ISSUE_TYPES
 *   description {string}  — free-text description of the issue
 *   screenRoute {string}  — React Router path where the issue occurred (e.g. "/patients/42")
 */
router.post('/', authMiddleware, async (req, res) => {
  const { tenantId, userId, role, issueType, description, screenRoute } = req.body;

  // ── Input validation ──────────────────────────────────────────────────
  if (!description || String(description).trim().length < 10) {
    return res.status(400).json({
      success: false,
      message: 'description must be at least 10 characters.',
    });
  }

  if (!VALID_ISSUE_TYPES.has(issueType)) {
    return res.status(400).json({
      success: false,
      message: `issueType must be one of: ${[...VALID_ISSUE_TYPES].join(', ')}.`,
    });
  }

  // Cross-tenant guard: tenantId in body must match the authenticated user's hospital
  const effectiveTenantId = req.user.hospitalId;
  if (tenantId && Number(tenantId) !== Number(effectiveTenantId)) {
    return res.status(403).json({
      success: false,
      message: 'Tenant mismatch — report must belong to your clinic.',
    });
  }

  // Truncate fields to avoid DB overflow from malicious payloads
  const safeDescription = String(description).trim().slice(0, 5000);
  const safeRoute       = screenRoute ? String(screenRoute).slice(0, 500) : null;
  const safeRole        = role        ? String(role).slice(0, 50)         : req.user.role;

  try {
    // ── 1. Persist to DB ───────────────────────────────────────────────
    const insertRes = await db.query(
      `INSERT INTO beta_feedback
         (tenant_id, user_id, role, issue_type, description, screen_route)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, tenant_id, user_id, role, issue_type, description, screen_route, created_at`,
      [
        effectiveTenantId,
        userId || req.user.id,
        safeRole,
        issueType,
        safeDescription,
        safeRoute,
      ]
    );

    const saved = insertRes.rows[0];
    logger.info('[betaFeedback] Report saved', { id: saved.id, issueType, tenantId: effectiveTenantId });

    // ── 2. Fire webhooks asynchronously — do not await ─────────────────
    // The response goes back to the user immediately; webhook delivery happens
    // in the background. Failure never blocks or fails the API call.
    notifyWebhooks(saved).catch((err) =>
      logger.error('[betaFeedback] Unexpected webhook error', { error: err.message })
    );

    return res.status(201).json({
      success: true,
      message: 'Thank you for your feedback! Our team has been notified.',
      data: {
        id:          saved.id,
        issueType:   saved.issue_type,
        status:      'open',
        createdAt:   saved.created_at,
      },
    });

  } catch (err) {
    logger.error('[betaFeedback] Failed to save report', { error: err.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to submit feedback. Please try again.',
    });
  }
});

// ─── GET /api/beta-feedback (super_admin dashboard view) ─────────────────────

router.get('/', authMiddleware, async (req, res) => {
  if (!['super_admin', 'hospital_admin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const { status = 'open', limit = 50, offset = 0 } = req.query;

  try {
    const result = await db.query(
      `SELECT
         bf.id,
         bf.tenant_id    AS "tenantId",
         h.name          AS "clinicName",
         bf.user_id      AS "userId",
         bf.role,
         bf.issue_type   AS "issueType",
         bf.description,
         bf.screen_route AS "screenRoute",
         bf.status,
         bf.notified_at  AS "notifiedAt",
         bf.created_at   AS "createdAt"
       FROM beta_feedback bf
       LEFT JOIN hospitals h ON h.id = bf.tenant_id
       WHERE ($1 = 'all' OR bf.status = $1)
       ORDER BY bf.created_at DESC
       LIMIT $2 OFFSET $3`,
      [status, Math.min(Number(limit), 100), Number(offset)]
    );

    return res.json({ success: true, data: result.rows, count: result.rowCount });
  } catch (err) {
    logger.error('[betaFeedback] List query failed', { error: err.message });
    return res.status(500).json({ success: false, message: 'Failed to fetch feedback.' });
  }
});

module.exports = router;

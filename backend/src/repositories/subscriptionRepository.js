const db = require('../config/db');

// ─── Plans ──────────────────────────────────────────────────────────────────

async function listPlans({ includeInactive = false } = {}) {
  const rows = await db.query(
    `SELECT id, name, code, price_cents AS "priceCents", doctor_limit AS "doctorLimit",
            patient_limit AS "patientLimit", storage_gb AS "storageGb",
            duration_days AS "durationDays", is_active AS "isActive", features, created_at AS "createdAt"
     FROM subscription_plans
     ${includeInactive ? '' : 'WHERE is_active = TRUE'}
     ORDER BY price_cents ASC`
  );
  return rows.rows;
}

async function getPlanByCode(code) {
  const r = await db.query(
    `SELECT id, name, code, price_cents AS "priceCents", doctor_limit AS "doctorLimit",
            patient_limit AS "patientLimit", storage_gb AS "storageGb",
            duration_days AS "durationDays", is_active AS "isActive", features
     FROM subscription_plans WHERE code = $1 LIMIT 1`,
    [code]
  );
  return r.rows[0] || null;
}

async function getPlanById(id) {
  const r = await db.query(
    `SELECT id, name, code, price_cents AS "priceCents", doctor_limit AS "doctorLimit",
            patient_limit AS "patientLimit", storage_gb AS "storageGb",
            duration_days AS "durationDays", is_active AS "isActive", features
     FROM subscription_plans WHERE id = $1 LIMIT 1`,
    [id]
  );
  return r.rows[0] || null;
}

async function createPlan({ name, code, priceCents, doctorLimit, patientLimit, storageGb, durationDays, features }) {
  const r = await db.query(
    `INSERT INTO subscription_plans (name, code, price_cents, doctor_limit, patient_limit, storage_gb, duration_days, features)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
     RETURNING id, name, code`,
    [name, code, priceCents, doctorLimit || null, patientLimit || null, storageGb || 5, durationDays || 30, JSON.stringify(features || {})]
  );
  return r.rows[0];
}

async function updatePlan(id, { name, priceCents, doctorLimit, patientLimit, storageGb, durationDays, features }) {
  const r = await db.query(
    `UPDATE subscription_plans
     SET name=$2, price_cents=$3, doctor_limit=$4, patient_limit=$5,
         storage_gb=$6, duration_days=$7, features=$8::jsonb
     WHERE id=$1
     RETURNING id, name, code`,
    [id, name, priceCents, doctorLimit || null, patientLimit || null, storageGb, durationDays, JSON.stringify(features || {})]
  );
  return r.rows[0] || null;
}

async function setPlanActive(id, isActive) {
  const r = await db.query(
    `UPDATE subscription_plans SET is_active=$2 WHERE id=$1 RETURNING id, name, is_active AS "isActive"`,
    [id, isActive]
  );
  return r.rows[0] || null;
}

// ─── Subscriptions ───────────────────────────────────────────────────────────

async function listSubscriptions({ status } = {}) {
  const params = [];
  let where = '';
  if (status) { params.push(status); where = `WHERE hs.status = $${params.length}`; }
  const r = await db.query(
    `SELECT hs.id, hs.hospital_id AS "hospitalId", h.name AS "hospitalName", h.code AS "hospitalCode",
            hs.plan_id AS "planId", sp.name AS "planName", sp.code AS "planCode",
            hs.status, hs.started_at AS "startedAt", hs.expires_at AS "expiresAt",
            hs.notes, hs.upgrade_request AS "upgradeRequest",
            hs.upgrade_requested_at AS "upgradeRequestedAt",
            hs.created_at AS "createdAt"
     FROM hospital_subscriptions hs
     JOIN hospitals h ON h.id = hs.hospital_id
     JOIN subscription_plans sp ON sp.id = hs.plan_id
     ${where}
     ORDER BY hs.expires_at ASC`,
    params
  );
  return r.rows;
}

async function getSubscriptionByHospital(hospitalId) {
  const r = await db.query(
    `SELECT hs.id, hs.hospital_id AS "hospitalId", h.name AS "hospitalName", h.code AS "hospitalCode",
            hs.plan_id AS "planId", sp.name AS "planName", sp.code AS "planCode",
            sp.price_cents AS "priceCents", sp.doctor_limit AS "doctorLimit",
            sp.patient_limit AS "patientLimit", sp.storage_gb AS "storageGb",
            sp.features,
            hs.status, hs.started_at AS "startedAt", hs.expires_at AS "expiresAt",
            hs.upgrade_request AS "upgradeRequest",
            hs.upgrade_requested_at AS "upgradeRequestedAt"
     FROM hospital_subscriptions hs
     JOIN hospitals h ON h.id = hs.hospital_id
     JOIN subscription_plans sp ON sp.id = hs.plan_id
     WHERE hs.hospital_id = $1
     ORDER BY hs.created_at DESC
     LIMIT 1`,
    [hospitalId]
  );
  return r.rows[0] || null;
}

async function getSubscriptionHistory(hospitalId) {
  const r = await db.query(
    `SELECT hs.id, sp.name AS "planName", sp.code AS "planCode",
            hs.status, hs.started_at AS "startedAt", hs.expires_at AS "expiresAt",
            hs.notes, hs.created_at AS "createdAt"
     FROM hospital_subscriptions hs
     JOIN subscription_plans sp ON sp.id = hs.plan_id
     WHERE hs.hospital_id = $1
     ORDER BY hs.created_at DESC`,
    [hospitalId]
  );
  return r.rows;
}

async function getExpiringSubscriptions(withinDays = 7) {
  const r = await db.query(
    `SELECT hs.id, h.name AS "hospitalName", h.code AS "hospitalCode",
            sp.name AS "planName", hs.status, hs.expires_at AS "expiresAt",
            EXTRACT(DAY FROM hs.expires_at - now())::int AS "daysLeft"
     FROM hospital_subscriptions hs
     JOIN hospitals h ON h.id = hs.hospital_id
     JOIN subscription_plans sp ON sp.id = hs.plan_id
     WHERE hs.status IN ('active','trialing')
       AND hs.expires_at <= now() + ($1 || ' days')::interval
       AND hs.expires_at >= now()
     ORDER BY hs.expires_at ASC`,
    [withinDays]
  );
  return r.rows;
}

async function assignPlan({ hospitalId, planId, assignedBy, notes, status, expiresAt }) {
  // Cancel any existing active/trialing subscription for this hospital
  await db.query(
    `UPDATE hospital_subscriptions SET status = 'cancelled'
     WHERE hospital_id = $1 AND status IN ('active','trialing')`,
    [hospitalId]
  );
  const r = await db.query(
    `INSERT INTO hospital_subscriptions (hospital_id, plan_id, status, expires_at, assigned_by, notes)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id`,
    [hospitalId, planId, status || 'active', expiresAt, assignedBy || null, notes || null]
  );
  return r.rows[0];
}

async function saveUpgradeRequest(hospitalId, upgradeRequest) {
  const r = await db.query(
    `UPDATE hospital_subscriptions
     SET upgrade_request = $2, upgrade_requested_at = now()
     WHERE hospital_id = $1 AND status IN ('active','trialing')
     RETURNING id`,
    [hospitalId, upgradeRequest]
  );
  return r.rows[0] || null;
}

async function getUsageSummary(hospitalId) {
  const [docs, pats] = await Promise.all([
    db.query(`SELECT COUNT(*) AS count FROM doctors WHERE hospital_id = $1 AND status = 'active'`, [hospitalId]),
    db.query(`SELECT COUNT(*) AS count FROM patients WHERE hospital_id = $1`, [hospitalId]),
  ]);
  return {
    doctorCount: parseInt(docs.rows[0].count, 10),
    patientCount: parseInt(pats.rows[0].count, 10),
  };
}

module.exports = {
  listPlans, getPlanByCode, getPlanById, createPlan, updatePlan, setPlanActive,
  listSubscriptions, getSubscriptionByHospital, getSubscriptionHistory,
  getExpiringSubscriptions, assignPlan, saveUpgradeRequest, getUsageSummary,
};

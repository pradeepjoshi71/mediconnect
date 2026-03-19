const db = require("../config/db");

const HOSPITAL_SELECT = `
  SELECT
    h.id,
    h.code,
    h.slug,
    h.name,
    h.timezone,
    h.country_code AS "countryCode",
    h.support_phone AS "supportPhone",
    h.billing_email AS "billingEmail",
    h.status,
    h.settings,
    h.created_at AS "createdAt",
    h.updated_at AS "updatedAt"
  FROM hospitals h
`;

async function findHospitalByCode(code) {
  const result = await db.query(
    `${HOSPITAL_SELECT}
     WHERE upper(h.code) = upper($1)
     LIMIT 1`,
    [code]
  );
  return result.rows[0] || null;
}

async function findHospitalById(id) {
  const result = await db.query(
    `${HOSPITAL_SELECT}
     WHERE h.id = $1
     LIMIT 1`,
    [id]
  );
  return result.rows[0] || null;
}

async function findDefaultHospital() {
  const result = await db.query(
    `${HOSPITAL_SELECT}
     WHERE h.status IN ('active', 'trial')
     ORDER BY h.id ASC
     LIMIT 1`
  );
  return result.rows[0] || null;
}

async function getHospitalSummary(hospitalId) {
  const result = await db.query(
    `
      SELECT
        h.id,
        h.code,
        h.slug,
        h.name,
        h.timezone,
        h.country_code AS "countryCode",
        h.support_phone AS "supportPhone",
        h.billing_email AS "billingEmail",
        h.status,
        h.settings,
        (
          SELECT COUNT(*)
          FROM users u
          WHERE u.hospital_id = h.id
        )::int AS "totalUsers",
        (
          SELECT COUNT(*)
          FROM patients p
          WHERE p.hospital_id = h.id
        )::int AS "totalPatients",
        (
          SELECT COUNT(*)
          FROM doctors d
          WHERE d.hospital_id = h.id
        )::int AS "totalDoctors",
        (
          SELECT COUNT(*)
          FROM audit_logs al
          WHERE al.hospital_id = h.id
            AND al.created_at >= now() - interval '1 day'
        )::int AS "auditEventsLast24h"
      FROM hospitals h
      WHERE h.id = $1
      LIMIT 1
    `,
    [hospitalId]
  );
  return result.rows[0] || null;
}

module.exports = {
  findHospitalByCode,
  findHospitalById,
  findDefaultHospital,
  getHospitalSummary,
};

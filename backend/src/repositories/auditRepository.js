const db = require("../config/db");

async function createAuditLog({
  hospitalId,
  userId,
  actorRole,
  action,
  entityType,
  entityId,
  requestId,
  ipAddress,
  userAgent,
  metadata,
}) {
  const result = await db.query(
    `
      INSERT INTO audit_logs (
        hospital_id,
        user_id,
        actor_role,
        action,
        entity_type,
        entity_id,
        request_id,
        ip_address,
        user_agent,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING
        id,
        hospital_id AS "hospitalId",
        user_id AS "userId",
        actor_role AS "actorRole",
        action,
        entity_type AS "entityType",
        entity_id AS "entityId",
        request_id AS "requestId",
        ip_address AS "ipAddress",
        user_agent AS "userAgent",
        metadata,
        created_at AS "createdAt"
    `,
    [
      hospitalId,
      userId || null,
      actorRole || null,
      action,
      entityType,
      entityId ? String(entityId) : null,
      requestId || null,
      ipAddress || null,
      userAgent || null,
      metadata || {},
    ]
  );
  return result.rows[0];
}

async function listAuditLogs({ hospitalId, limit = 50, action, userId }) {
  const params = [hospitalId];
  const where = [`al.hospital_id = $1`];

  if (action) {
    params.push(action);
    where.push(`al.action = $${params.length}`);
  }
  if (userId) {
    params.push(userId);
    where.push(`al.user_id = $${params.length}`);
  }

  params.push(limit);

  const result = await db.query(
    `
      SELECT
        al.id,
        al.hospital_id AS "hospitalId",
        al.user_id AS "userId",
        al.actor_role AS "actorRole",
        al.action,
        al.entity_type AS "entityType",
        al.entity_id AS "entityId",
        al.request_id AS "requestId",
        al.ip_address AS "ipAddress",
        al.user_agent AS "userAgent",
        al.metadata,
        al.created_at AS "createdAt",
        u.full_name AS "userName"
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE ${where.join(" AND ")}
      ORDER BY al.created_at DESC
      LIMIT $${params.length}
    `,
    params
  );
  return result.rows;
}

module.exports = {
  createAuditLog,
  listAuditLogs,
};

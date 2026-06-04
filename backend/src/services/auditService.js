const auditRepository = require("../repositories/auditRepository");
const logger = require("../utils/logger");

/**
 * recordAuditEvent — write a single audit entry.
 *
 * Parameters:
 *   user        — req.user (provides id, role, hospitalId)
 *   hospitalId  — override if user object unavailable (e.g. pre-auth)
 *   action      — dot-separated string, e.g. "auth.login.success"
 *   entityType  — table name or domain object, e.g. "doctor", "invoice"
 *   entityId    — PK of the affected row
 *   oldValue    — POJO snapshot of state BEFORE the change (for updates/deletes)
 *   newValue    — POJO snapshot of state AFTER the change (for creates/updates)
 *   metadata    — additional free-form JSONB (legacy; prefer old/newValue)
 *   context     — { requestId, ipAddress, userAgent } from req.auditContext
 *
 * Never throws — audit failures are non-fatal.
 */
async function recordAuditEvent({
  user,
  hospitalId,
  action,
  entityType,
  entityId,
  oldValue = null,
  newValue = null,
  metadata,
  context,
}) {
  const resolvedHospitalId = hospitalId || user?.hospitalId;
  if (!resolvedHospitalId) return null;

  try {
    return await auditRepository.createAuditLog({
      hospitalId: resolvedHospitalId,
      userId: user?.id || null,
      actorRole: user?.role || null,
      action,
      entityType,
      entityId,
      requestId: context?.requestId,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      metadata: metadata || {},
      oldValue,
      newValue,
    });
  } catch (error) {
    logger.warn("Audit log write failed", {
      action,
      entityType,
      entityId,
      error: error.message,
    });
    return null;
  }
}

async function listAuditLogs(user, filters = {}) {
  return auditRepository.listAuditLogs({
    hospitalId: user.hospitalId,
    limit: filters.limit || 50,
    action: filters.action,
    userId: filters.userId,
  });
}

module.exports = {
  recordAuditEvent,
  listAuditLogs,
};

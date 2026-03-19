const auditRepository = require("../repositories/auditRepository");
const logger = require("../utils/logger");

async function recordAuditEvent({
  user,
  hospitalId,
  action,
  entityType,
  entityId,
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
      metadata,
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

const crypto = require("crypto");

function requestContext(req, res, next) {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  req.requestId = requestId;
  req.auditContext = {
    requestId,
    ipAddress:
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      null,
    userAgent: req.headers["user-agent"] || null,
  };
  req.tenantCode = req.headers["x-hospital-code"] || req.headers["x-tenant-code"] || null;
  res.setHeader("x-request-id", requestId);
  next();
}

module.exports = { requestContext };

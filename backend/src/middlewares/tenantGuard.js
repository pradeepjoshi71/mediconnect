/**
 * tenantGuard — enforces hospital_id tenant isolation.
 *
 * Usage:
 *   router.get('/:hospitalId/foo', authMiddleware, tenantGuard, handler);
 *
 * Rules:
 *   - super_admin: bypasses all tenant checks (can access any hospital).
 *   - All others: the :hospitalId route param (or query param) must exactly
 *     match the caller's own req.user.hospitalId. Returns 403 if not.
 *   - If no hospitalId param/query is present the middleware is a no-op
 *     (the controller is responsible for scoping with req.user.hospitalId).
 */
function tenantGuard(req, res, next) {
  // Must run after authMiddleware
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized', requestId: req.requestId });
  }

  // super_admin has cross-tenant visibility
  if (req.user.role === 'super_admin') {
    return next();
  }

  // Resolve the target hospital from route param or query string
  const targetId =
    req.params.hospitalId ||
    req.params.id ||
    req.query.hospitalId ||
    null;

  if (targetId !== null && targetId !== undefined) {
    const targetIdNum = parseInt(targetId, 10);
    const callerIdNum = parseInt(req.user.hospitalId, 10);

    if (Number.isNaN(targetIdNum) || targetIdNum !== callerIdNum) {
      return res.status(403).json({
        message: 'Forbidden: cross-tenant access denied',
        requestId: req.requestId,
      });
    }
  }

  return next();
}

module.exports = tenantGuard;

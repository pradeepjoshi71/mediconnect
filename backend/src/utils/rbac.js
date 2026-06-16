/**
 * RBAC Permission Utility
 * Provides a unified hasPermission() check for use in service-layer guards.
 * Works with both:
 *   1. The pre-fetched req.user.permissions[] array (populated by authMiddleware)
 *   2. The legacy admin role bypass (super_admin, hospital_admin, admin)
 *
 * Usage:
 *   const { hasPermission, isAdminRole } = require('../utils/rbac');
 *   if (!hasPermission(user, 'view_patients')) throw new AppError(403, 'Forbidden');
 */

const ADMIN_BYPASS_ROLES = ["super_admin", "hospital_admin", "admin"];

/**
 * Returns true if the user has at least one of the required permission codes,
 * OR if the user has an admin-bypass role (super_admin, hospital_admin, admin).
 * @param {object} user - req.user object from authMiddleware
 * @param {...string} permissionCodes - one or more permission codes to check (OR logic)
 */
function hasPermission(user, ...permissionCodes) {
  if (!user) return false;
  if (ADMIN_BYPASS_ROLES.includes(user.role)) return true;
  const perms = user.permissions || [];
  return permissionCodes.some(code => perms.includes(code));
}

/**
 * Returns true if the user has an admin-bypass role.
 * @param {object} user - req.user
 */
function isAdminRole(user) {
  return user && ADMIN_BYPASS_ROLES.includes(user.role);
}

module.exports = { hasPermission, isAdminRole, ADMIN_BYPASS_ROLES };

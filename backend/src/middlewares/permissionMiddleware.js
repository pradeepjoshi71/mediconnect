const authRepository = require("../repositories/authRepository");

function permissionMiddleware(...requiredPermissions) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized", requestId: req.requestId });
    }

    try {
      // Fetch user permissions dynamically from the database
      const permissions = await authRepository.getUserPermissions(req.user.id);
      
      // Check if user has all of the required permissions
      const hasPermission = requiredPermissions.every((perm) => permissions.includes(perm));

      // Also allow direct bypass if user is Super Admin or Hospital Admin (by role code check)
      const isAuthorized = hasPermission || ["super_admin", "hospital_admin", "admin"].includes(req.user.role);

      if (!isAuthorized) {
        return res.status(403).json({
          message: "Forbidden: insufficient permissions",
          requestId: req.requestId,
        });
      }

      req.user.permissions = permissions;
      return next();
    } catch (error) {
      return res.status(500).json({
        message: "Internal server error during authorization check",
        error: error.message,
        requestId: req.requestId,
      });
    }
  };
}

module.exports = permissionMiddleware;

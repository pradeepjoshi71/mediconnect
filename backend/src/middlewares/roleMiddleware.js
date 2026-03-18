function roleMiddleware(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized", requestId: req.requestId });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Forbidden: insufficient role",
        requestId: req.requestId,
      });
    }

    return next();
  };
}

module.exports = roleMiddleware;

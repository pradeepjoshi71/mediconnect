const authRepository = require("../repositories/authRepository");
const { verifyAccessToken } = require("../utils/tokens");

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized", requestId: req.requestId });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyAccessToken(token);
    const user = await authRepository.findUserById(Number(decoded.sub));

    if (!user || Number(decoded.hospitalId) !== Number(user.hospitalId)) {
      return res.status(401).json({ message: "Unauthorized", requestId: req.requestId });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      hospitalId: user.hospitalId,
      hospitalCode: user.hospitalCode,
      hospitalSlug: user.hospitalSlug,
      hospitalName: user.hospitalName,
      hospitalTimezone: user.hospitalTimezone,
      patientProfileId: user.patientProfileId,
      doctorProfileId: user.doctorProfileId,
    };

    return next();
  } catch (_error) {
    return res.status(401).json({ message: "Invalid token", requestId: req.requestId });
  }
}

module.exports = authMiddleware;

const bcrypt = require("bcrypt");
const authRepository = require("../repositories/authRepository");
const hospitalService = require("./hospitalService");
const auditService = require("./auditService");
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashRefreshToken,
} = require("../utils/tokens");
const { AppError } = require("../utils/http");

function generateMedicalRecordNumber(hospitalCode) {
  return `MRN-${hospitalCode}-${Math.floor(100000 + Math.random() * 900000)}`;
}

function sanitizeUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    avatarUrl: user.avatarUrl,
    hospitalId: user.hospitalId,
    hospitalCode: user.hospitalCode,
    hospitalSlug: user.hospitalSlug,
    hospitalName: user.hospitalName,
    hospitalTimezone: user.hospitalTimezone,
    patientProfileId: user.patientProfileId,
    doctorProfileId: user.doctorProfileId,
    medicalRecordNumber: user.medicalRecordNumber,
    specialization: user.specialization,
    department: user.department,
    consultationFeeCents: user.consultationFeeCents,
  };
}

async function registerPatient({
  hospitalCode,
  fullName,
  email,
  password,
  phone,
  dateOfBirth,
  gender,
  auditContext,
}) {
  const hospital = await hospitalService.resolveHospital(hospitalCode);
  const existing = await authRepository.findUserByEmail(email, hospital.id);
  if (existing) {
    throw new AppError(409, "An account with that email already exists");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await authRepository.createPatientUser({
    hospitalId: hospital.id,
    fullName,
    email,
    passwordHash,
    phone,
    medicalRecordNumber: generateMedicalRecordNumber(hospital.code),
    dateOfBirth,
    gender,
  });

  await auditService.recordAuditEvent({
    user,
    action: "auth.register.patient",
    entityType: "user",
    entityId: user.id,
    metadata: {
      email: user.email,
      hospitalCode: user.hospitalCode,
    },
    context: auditContext,
  });

  return sanitizeUser(user);
}

async function login(email, password, { hospitalCode, auditContext } = {}) {
  const hospital = await hospitalService.resolveHospital(hospitalCode);
  const user = await authRepository.findUserByEmail(email, hospital.id);
  if (!user) {
    await auditService.recordAuditEvent({
      hospitalId: hospital.id,
      action: "auth.login.failure",
      entityType: "user",
      entityId: null,
      metadata: { email, reason: "invalid_email" },
      context: auditContext,
    });
    throw new AppError(401, "Invalid credentials");
  }

  // Check if account is locked out
  if (user.lockedUntilAt && new Date(user.lockedUntilAt) > new Date()) {
    const remainingMs = new Date(user.lockedUntilAt) - new Date();
    const remainingMins = Math.ceil(remainingMs / (1000 * 60));
    await auditService.recordAuditEvent({
      user,
      hospitalId: hospital.id,
      action: "auth.login.failure",
      entityType: "user",
      entityId: user.id,
      metadata: { email, reason: "account_locked", remainingMins },
      context: auditContext,
    });
    throw new AppError(423, `Account is temporarily locked. Try again in ${remainingMins} minutes.`);
  }

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    const lockoutInfo = await authRepository.incrementFailedLogin(user.id);
    const isLocked = lockoutInfo.lockedUntilAt && new Date(lockoutInfo.lockedUntilAt) > new Date();

    await auditService.recordAuditEvent({
      user,
      hospitalId: hospital.id,
      action: "auth.login.failure",
      entityType: "user",
      entityId: user.id,
      metadata: { 
        email, 
        reason: isLocked ? "account_locked" : "invalid_password",
        failedAttempts: lockoutInfo.failedLoginAttempts
      },
      context: auditContext,
    });

    if (isLocked) {
      throw new AppError(423, "Account is temporarily locked due to too many failed attempts. Try again in 15 minutes.");
    }
    throw new AppError(401, "Invalid credentials");
  }

  if (user.status !== "active") {
    await auditService.recordAuditEvent({
      user,
      hospitalId: hospital.id,
      action: "auth.login.failure",
      entityType: "user",
      entityId: user.id,
      metadata: { email, reason: "account_inactive" },
      context: auditContext,
    });
    throw new AppError(403, "Account is disabled or inactive");
  }

  const accessToken = signAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    hospitalId: user.hospitalId,
    hospitalCode: user.hospitalCode,
  });
  const refreshToken = signRefreshToken({
    userId: user.id,
    hospitalId: user.hospitalId,
    hospitalCode: user.hospitalCode,
  });

  await Promise.all([
    authRepository.resetFailedLogin(user.id),
    authRepository.insertRefreshToken({
      hospitalId: user.hospitalId,
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    }),
    authRepository.touchLastLogin(user.id),
    auditService.recordAuditEvent({
      user,
      action: "auth.login.success",
      entityType: "user",
      entityId: user.id,
      metadata: {
        email: user.email,
        hospitalCode: user.hospitalCode,
      },
      context: auditContext,
    }),
  ]);

  const sanitized = sanitizeUser(user);
  sanitized.permissions = await authRepository.getUserPermissions(user.id);

  return {
    accessToken,
    refreshToken,
    user: sanitized,
  };
}

async function refresh(refreshToken) {
  if (!refreshToken) {
    throw new AppError(401, "Missing refresh token");
  }

  const decoded = verifyRefreshToken(refreshToken);
  const tokenRow = await authRepository.findActiveRefreshTokenByHash(
    hashRefreshToken(refreshToken)
  );

  if (!tokenRow) {
    throw new AppError(401, "Refresh token is invalid");
  }

  const user = await authRepository.findUserById(Number(decoded.sub));
  if (!user) {
    throw new AppError(404, "User not found");
  }

  if (Number(decoded.hospitalId) !== Number(user.hospitalId)) {
    throw new AppError(401, "Unauthorized");
  }

  if (user.status !== "active") {
    throw new AppError(403, "Account is disabled or inactive");
  }

  const newRefreshToken = signRefreshToken({
    userId: user.id,
    hospitalId: user.hospitalId,
    hospitalCode: user.hospitalCode,
  });

  await Promise.all([
    authRepository.revokeRefreshTokenByHash(hashRefreshToken(refreshToken)),
    authRepository.insertRefreshToken({
      hospitalId: user.hospitalId,
      userId: user.id,
      tokenHash: hashRefreshToken(newRefreshToken),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    }),
  ]);

  const sanitized = sanitizeUser(user);
  sanitized.permissions = await authRepository.getUserPermissions(user.id);

  return {
    accessToken: signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      hospitalId: user.hospitalId,
      hospitalCode: user.hospitalCode,
    }),
    refreshToken: newRefreshToken,
    user: sanitized,
  };
}

async function logout(refreshToken, { user, auditContext } = {}) {
  if (!refreshToken) return;

  let auditUser = user;
  if (!auditUser) {
    try {
      const decoded = verifyRefreshToken(refreshToken);
      if (decoded && decoded.sub) {
        const dbUser = await authRepository.findUserById(Number(decoded.sub));
        if (dbUser) {
          auditUser = dbUser;
        }
      }
    } catch (error) {
      // Ignore token verification errors to ensure logout completes
    }
  }

  await authRepository.revokeRefreshTokenByHash(hashRefreshToken(refreshToken));

  if (auditUser?.id && auditUser?.hospitalId) {
    await auditService.recordAuditEvent({
      user: auditUser,
      action: "auth.logout",
      entityType: "user",
      entityId: auditUser.id,
      metadata: { email: auditUser.email },
      context: auditContext,
    });
  }
}
async function getCurrentUser(userId) {
  const user = await authRepository.findUserById(userId);
  if (!user) {
    throw new AppError(404, "User not found");
  }
  const sanitized = sanitizeUser(user);
  sanitized.permissions = await authRepository.getUserPermissions(userId);
  return sanitized;
}

const crypto = require("crypto");

async function forgotPassword(email, hospitalCode, auditContext) {
  const hospital = await hospitalService.resolveHospital(hospitalCode);
  const user = await authRepository.findUserByEmail(email, hospital.id);
  if (!user) {
    // Return standard message to prevent user enumeration
    return { message: "If an account exists, a password reset token has been generated." };
  }

  // Generate 32-byte secure random token
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes

  await authRepository.createPasswordReset({
    hospitalId: hospital.id,
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  await auditService.recordAuditEvent({
    user,
    action: "auth.password.reset_request",
    entityType: "user",
    entityId: user.id,
    metadata: { email: user.email },
    context: auditContext,
  });

  // Dispatch password reset email via SES
  const emailService = require("./emailService");
  const logger = require("../utils/logger");
  emailService.sendPasswordResetEmail(user.email, rawToken, hospital.code)
    .catch((err) => {
      logger.error("Failed to send password reset email via SES", { email: user.email, error: err.message });
    });

  return {
    message: "If an account exists, a password reset token has been generated.",
  };
}

async function resetPassword(token, newPassword, hospitalCode, auditContext) {
  const hospital = await hospitalService.resolveHospital(hospitalCode);
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const resetRecord = await authRepository.findActivePasswordResetByHash(tokenHash);
  if (!resetRecord) {
    throw new AppError(400, "Password reset token is invalid or expired");
  }

  if (Number(resetRecord.hospital_id) !== Number(hospital.id)) {
    throw new AppError(400, "Invalid tenant context for password reset");
  }

  const user = await authRepository.findUserById(resetRecord.user_id);
  if (!user || user.status !== "active") {
    throw new AppError(400, "User account is inactive or not found");
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await Promise.all([
    authRepository.updatePasswordHash(user.id, passwordHash),
    authRepository.revokeAllUserRefreshTokens(user.id),
    authRepository.markPasswordResetAsUsed(resetRecord.id),
    auditService.recordAuditEvent({
      user,
      action: "auth.password.reset_success",
      entityType: "user",
      entityId: user.id,
      metadata: { email: user.email },
      context: auditContext,
    }),
  ]);

  return { message: "Password reset successfully. All active sessions have been logged out." };
}

module.exports = {
  registerPatient,
  login,
  refresh,
  logout,
  getCurrentUser,
  forgotPassword,
  resetPassword,
};

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
    throw new AppError(401, "Invalid credentials");
  }

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    throw new AppError(401, "Invalid credentials");
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

  return {
    accessToken,
    refreshToken,
    user: sanitizeUser(user),
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

  return {
    accessToken: signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      hospitalId: user.hospitalId,
      hospitalCode: user.hospitalCode,
    }),
    user: sanitizeUser(user),
  };
}

async function logout(refreshToken) {
  if (!refreshToken) return;
  await authRepository.revokeRefreshTokenByHash(hashRefreshToken(refreshToken));
}

async function getCurrentUser(userId) {
  const user = await authRepository.findUserById(userId);
  if (!user) {
    throw new AppError(404, "User not found");
  }
  return sanitizeUser(user);
}

module.exports = {
  registerPatient,
  login,
  refresh,
  logout,
  getCurrentUser,
};

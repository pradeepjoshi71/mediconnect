const bcrypt = require("bcrypt");
const adminRepository = require("../repositories/adminRepository");
const auditService = require("./auditService");
const hospitalService = require("./hospitalService");
const { AppError } = require("../utils/http");

function nextId(prefix) {
  return `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
}

async function listUsers(user) {
  return adminRepository.listUsers(user.hospitalId);
}

async function createStaffUser(user, payload, context) {
  if (!["doctor", "receptionist"].includes(payload.role)) {
    throw new AppError(400, "Role must be doctor or receptionist");
  }

  const passwordHash = await bcrypt.hash(payload.password, 12);

  const created = await adminRepository.createStaffUser({
    hospitalId: user.hospitalId,
    fullName: payload.fullName,
    email: payload.email,
    passwordHash,
    phone: payload.phone,
    role: payload.role,
    specialization: payload.specialization || null,
    department: payload.department || "General",
    employeeCode: payload.employeeCode || nextId("EMP"),
    licenseNumber: payload.licenseNumber || nextId("LIC"),
    experienceYears: payload.experienceYears || 0,
    consultationFeeCents: payload.consultationFeeCents || 5000,
  });

  await auditService.recordAuditEvent({
    user,
    action: "admin.staff.create",
    entityType: "user",
    entityId: created.id,
    metadata: {
      role: created.role,
      email: created.email,
    },
    context,
  });

  return created;
}

async function getHospitalSummary(user) {
  return hospitalService.getHospitalSummary(user);
}

async function listAuditLogs(user, filters) {
  return auditService.listAuditLogs(user, filters);
}

module.exports = {
  listUsers,
  createStaffUser,
  getHospitalSummary,
  listAuditLogs,
};

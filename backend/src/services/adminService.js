const bcrypt = require("bcrypt");
const adminRepository = require("../repositories/adminRepository");
const { AppError } = require("../utils/http");

function nextId(prefix) {
  return `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
}

async function listUsers() {
  return adminRepository.listUsers();
}

async function createStaffUser(payload) {
  if (!["doctor", "receptionist"].includes(payload.role)) {
    throw new AppError(400, "Role must be doctor or receptionist");
  }

  const passwordHash = await bcrypt.hash(payload.password, 12);

  return adminRepository.createStaffUser({
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
}

module.exports = {
  listUsers,
  createStaffUser,
};

const hospitalRepository = require("../repositories/hospitalRepository");
const { AppError } = require("../utils/http");

async function resolveHospital(code) {
  if (!code || !code.trim()) {
    throw new AppError(400, "Hospital tenant code is required");
  }

  const hospital = await hospitalRepository.findHospitalByCode(code.trim());
  if (!hospital) {
    throw new AppError(404, "Hospital tenant not found");
  }
  return hospital;
}

async function getHospitalSummary(user) {
  const hospital = await hospitalRepository.getHospitalSummary(user.hospitalId);
  if (!hospital) {
    throw new AppError(404, "Hospital not found");
  }
  return hospital;
}

module.exports = {
  resolveHospital,
  getHospitalSummary,
};

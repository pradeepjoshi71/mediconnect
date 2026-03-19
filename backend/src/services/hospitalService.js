const hospitalRepository = require("../repositories/hospitalRepository");
const { AppError } = require("../utils/http");

async function resolveHospital(code) {
  if (code) {
    const hospital = await hospitalRepository.findHospitalByCode(code);
    if (!hospital) {
      throw new AppError(404, "Hospital tenant not found");
    }
    return hospital;
  }

  const defaultCode = process.env.DEFAULT_HOSPITAL_CODE;
  if (defaultCode) {
    const hospital = await hospitalRepository.findHospitalByCode(defaultCode);
    if (hospital) return hospital;
  }

  const defaultHospital = await hospitalRepository.findDefaultHospital();
  if (!defaultHospital) {
    throw new AppError(500, "No hospital tenant is configured");
  }
  return defaultHospital;
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

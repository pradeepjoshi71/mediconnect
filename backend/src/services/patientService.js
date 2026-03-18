const patientRepository = require("../repositories/patientRepository");
const clinicalRepository = require("../repositories/clinicalRepository");
const fileRepository = require("../repositories/fileRepository");
const { AppError } = require("../utils/http");

async function listPatients(user, search) {
  if (!["doctor", "admin", "receptionist"].includes(user.role)) {
    throw new AppError(403, "You do not have access to patient search");
  }
  return patientRepository.listPatients(search);
}

async function getPatientSummary(user, patientId) {
  if (user.role === "patient" && Number(user.patientProfileId) !== Number(patientId)) {
    throw new AppError(403, "You can only access your own record");
  }

  const profile = await clinicalRepository.getPatientOverview(patientId);
  if (!profile) {
    throw new AppError(404, "Patient not found");
  }

  const [records, files, timeline] = await Promise.all([
    clinicalRepository.listMedicalRecordsByPatient(patientId),
    fileRepository.listFiles({ patientId }),
    clinicalRepository.listPatientTimeline(patientId),
  ]);

  return {
    profile,
    records,
    files,
    timeline,
  };
}

module.exports = {
  listPatients,
  getPatientSummary,
};

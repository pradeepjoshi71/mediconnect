const patientRepository = require("../repositories/patientRepository");
const clinicalRepository = require("../repositories/clinicalRepository");
const fileService = require("./fileService");
const auditService = require("./auditService");
const { AppError } = require("../utils/http");

async function listPatients(user, search) {
  if (!["doctor", "admin", "receptionist"].includes(user.role)) {
    throw new AppError(403, "You do not have access to patient search");
  }
  return patientRepository.listPatients(user.hospitalId, search);
}

async function getPatientSummary(user, patientId, context) {
  if (user.role === "patient" && Number(user.patientProfileId) !== Number(patientId)) {
    throw new AppError(403, "You can only access your own record");
  }

  const profile = await clinicalRepository.getPatientOverview(user.hospitalId, patientId);
  if (!profile) {
    throw new AppError(404, "Patient not found");
  }

  const [records, files, timeline] = await Promise.all([
    clinicalRepository.listMedicalRecordsByPatient(user.hospitalId, patientId),
    fileService.listFiles(user, { patientId }),
    clinicalRepository.listPatientTimeline(user.hospitalId, patientId),
  ]);

  await auditService.recordAuditEvent({
    user,
    action: "patients.summary.view",
    entityType: "patient",
    entityId: patientId,
    metadata: {
      recordCount: records.length,
      fileCount: files.length,
    },
    context,
  });

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

const patientRepository = require("../repositories/patientRepository");
const clinicalRepository = require("../repositories/clinicalRepository");
const fileService = require("./fileService");
const auditService = require("./auditService");
const { AppError } = require("../utils/http");
const { hasPermission } = require("../utils/rbac");

async function listPatients(user, search) {
  // Allow any user with view_patients permission (doctor, patient_manager, lab_admin, report_admin, receptionist, etc.)
  if (!hasPermission(user, "view_patients")) {
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

async function createPatient(user, data, context) {
  // Allow any user with register_patients permission (patient_manager, receptionist, etc.)
  if (!hasPermission(user, "register_patients")) {
    throw new AppError(403, "You do not have access to create patients");
  }

  const patientId = await patientRepository.createPatient(user.hospitalId, data);
  const patient = await patientRepository.findPatientById(patientId, user.hospitalId);

  await auditService.recordAuditEvent({
    user,
    action: "admin.patient.create",
    entityType: "patient",
    entityId: patientId,
    metadata: { email: data.email },
    context,
  });

  return patient;
}

async function updatePatient(user, id, data, context) {
  const isSelf = user.role === "patient" && Number(user.patientProfileId) === Number(id);
  const canUpdate = hasPermission(user, "register_patients", "manage_records");

  if (!isSelf && !canUpdate) {
    throw new AppError(403, "You do not have access to update this patient");
  }

  const updated = await patientRepository.updatePatient(user.hospitalId, id, data);
  if (!updated) {
    throw new AppError(404, "Patient not found");
  }

  const patient = await patientRepository.findPatientById(id, user.hospitalId);

  await auditService.recordAuditEvent({
    user,
    action: "admin.patient.update",
    entityType: "patient",
    entityId: id,
    metadata: { email: data.email },
    context,
  });

  return patient;
}

module.exports = {
  listPatients,
  getPatientSummary,
  createPatient,
  updatePatient,
};

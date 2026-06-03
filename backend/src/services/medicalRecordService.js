const clinicalRepository = require("../repositories/clinicalRepository");
const appointmentRepository = require("../repositories/appointmentRepository");
const patientRepository = require("../repositories/patientRepository");
const auditService = require("./auditService");
const { buildPdfBuffer } = require("../utils/pdf");
const { AppError } = require("../utils/http");

function groupPrescriptionsByRecord(records, prescriptions) {
  return records.map((record) => ({
    ...record,
    prescriptions: prescriptions.filter(
      (item) => Number(item.medicalRecordId) === Number(record.id)
    ),
  }));
}

async function listOwnMedicalRecords(user, context) {
  const patient = await patientRepository.findPatientByUserId(user.id, user.hospitalId);
  if (!patient) {
    throw new AppError(404, "Patient profile not found");
  }

  const records = await clinicalRepository.listMedicalRecordsByPatient(user.hospitalId, patient.id);
  const prescriptions = await clinicalRepository.listPrescriptionsByRecordIds(
    user.hospitalId,
    records.map((item) => item.id)
  );

  await auditService.recordAuditEvent({
    user,
    action: "ehr.records.view.mine",
    entityType: "patient",
    entityId: patient.id,
    metadata: { recordCount: records.length },
    context,
  });

  return {
    patient,
    records: groupPrescriptionsByRecord(records, prescriptions),
  };
}

async function getPatientMedicalHistory(user, patientId, context) {
  if (user.role === "patient" && Number(user.patientProfileId) !== Number(patientId)) {
    throw new AppError(403, "Forbidden");
  }

  const records = await clinicalRepository.listMedicalRecordsByPatient(user.hospitalId, patientId);
  const prescriptions = await clinicalRepository.listPrescriptionsByRecordIds(
    user.hospitalId,
    records.map((item) => item.id)
  );

  await auditService.recordAuditEvent({
    user,
    action: "ehr.records.view.patient",
    entityType: "patient",
    entityId: patientId,
    metadata: { recordCount: records.length },
    context,
  });

  return groupPrescriptionsByRecord(records, prescriptions);
}

async function createConsultation(user, payload, context) {
  if (!["doctor", "admin"].includes(user.role)) {
    throw new AppError(403, "Only clinicians can create consultations");
  }

  const appointment = await appointmentRepository.findAppointmentById(
    payload.appointmentId,
    user.hospitalId
  );
  if (!appointment) {
    throw new AppError(404, "Appointment not found");
  }

  if (
    user.role === "doctor" &&
    Number(user.doctorProfileId) !== Number(appointment.doctorId)
  ) {
    throw new AppError(403, "You can only document your own consultations");
  }

  const recordId = await clinicalRepository.createMedicalRecordWithPrescriptions({
    hospitalId: user.hospitalId,
    patientId: appointment.patientId,
    appointmentId: appointment.id,
    doctorId: appointment.doctorId,
    encounterType: payload.encounterType,
    chiefComplaint: payload.chiefComplaint,
    diagnosis: payload.diagnosis,
    clinicalNotes: payload.clinicalNotes,
    doctorNotes: payload.doctorNotes,
    vitals: payload.vitals,
    labSummary: payload.labSummary,
    followUpInDays: payload.followUpInDays,
    prescriptions: payload.prescriptions,
  });

  const record = await clinicalRepository.findMedicalRecordById(recordId, user.hospitalId);

  await auditService.recordAuditEvent({
    user,
    action: "ehr.consultation.create",
    entityType: "medical_record",
    entityId: recordId,
    metadata: {
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      prescriptions: payload.prescriptions.length,
    },
    context,
  });

  return record;
}

async function buildPrescriptionPdf(user, medicalRecordId, context) {
  const record = await clinicalRepository.findMedicalRecordById(medicalRecordId, user.hospitalId);
  if (!record) {
    throw new AppError(404, "Medical record not found");
  }

  if (user.role === "patient" && Number(user.patientProfileId) !== Number(record.patientId)) {
    throw new AppError(403, "Forbidden");
  }

  if (user.role === "doctor" && Number(user.doctorProfileId) !== Number(record.doctorId)) {
    throw new AppError(403, "Forbidden");
  }

  const prescriptions = await clinicalRepository.listPrescriptionsByRecordIds(user.hospitalId, [
    medicalRecordId,
  ]);

  await auditService.recordAuditEvent({
    user,
    action: "ehr.prescription.download",
    entityType: "medical_record",
    entityId: medicalRecordId,
    metadata: { patientId: record.patientId },
    context,
  });

  return {
    fileName: `prescription-${medicalRecordId}.pdf`,
    buffer: buildPdfBuffer({
      title: "Prescription",
      subtitle: `Patient ${record.patientName} | MRN ${record.medicalRecordNumber}`,
      sections: [
        {
          heading: "Clinical Summary",
          lines: [
            `Doctor: ${record.doctorName} (${record.specialization})`,
            `Diagnosis: ${record.diagnosis}`,
            `Chief complaint: ${record.chiefComplaint || "N/A"}`,
            `Doctor notes: ${record.doctorNotes || "N/A"}`,
          ],
        },
        {
          heading: "Medications",
          lines: prescriptions.map(
            (item) =>
              `${item.medicationName} | ${item.dosage} | ${item.frequency} | ${item.durationDays} days | ${item.instructions || "No extra instructions"}`
          ),
        },
      ],
    }),
  };
}

async function listDiagnoses(user, patientId, context) {
  if (user.role === "patient" && Number(user.patientProfileId) !== Number(patientId)) {
    throw new AppError(403, "Forbidden");
  }
  const diagnoses = await clinicalRepository.listDiagnosesByPatient(user.hospitalId, patientId);
  await auditService.recordAuditEvent({
    user, action: "ehr.diagnoses.list", entityType: "patient", entityId: patientId,
    metadata: { count: diagnoses.length }, context,
  });
  return diagnoses;
}

async function addDiagnosis(user, patientId, payload, context) {
  if (!["doctor", "admin"].includes(user.role)) {
    throw new AppError(403, "Only clinicians can add diagnoses");
  }
  const id = await clinicalRepository.createDiagnosis({
    hospitalId: user.hospitalId,
    medicalRecordId: payload.medicalRecordId || null,
    patientId,
    doctorId: user.doctorProfileId,
    icdCode: payload.icdCode,
    description: payload.description,
    severity: payload.severity,
    status: payload.status,
    notes: payload.notes,
    onsetDate: payload.onsetDate,
  });
  await auditService.recordAuditEvent({
    user, action: "ehr.diagnoses.create", entityType: "diagnosis", entityId: id,
    metadata: { patientId }, context,
  });
  return { id };
}

async function editDiagnosis(user, diagnosisId, payload, context) {
  if (!["doctor", "admin"].includes(user.role)) {
    throw new AppError(403, "Only clinicians can edit diagnoses");
  }
  const updated = await clinicalRepository.updateDiagnosis(diagnosisId, user.hospitalId, payload);
  if (!updated) throw new AppError(404, "Diagnosis not found");
  await auditService.recordAuditEvent({
    user, action: "ehr.diagnoses.update", entityType: "diagnosis", entityId: diagnosisId,
    metadata: {}, context,
  });
  return updated;
}

async function removeDiagnosis(user, diagnosisId, context) {
  if (!["doctor", "admin"].includes(user.role)) {
    throw new AppError(403, "Only clinicians can delete diagnoses");
  }
  await clinicalRepository.deleteDiagnosis(diagnosisId, user.hospitalId);
  await auditService.recordAuditEvent({
    user, action: "ehr.diagnoses.delete", entityType: "diagnosis", entityId: diagnosisId,
    metadata: {}, context,
  });
}

async function listAllergies(user, patientId, context) {
  if (user.role === "patient" && Number(user.patientProfileId) !== Number(patientId)) {
    throw new AppError(403, "Forbidden");
  }
  const allergies = await clinicalRepository.listAllergiesByPatient(user.hospitalId, patientId);
  await auditService.recordAuditEvent({
    user, action: "ehr.allergies.list", entityType: "patient", entityId: patientId,
    metadata: { count: allergies.length }, context,
  });
  return allergies;
}

async function addAllergy(user, patientId, payload, context) {
  if (!["doctor", "admin", "nurse", "receptionist"].includes(user.role)) {
    throw new AppError(403, "Insufficient role");
  }
  const id = await clinicalRepository.createAllergy({
    hospitalId: user.hospitalId,
    patientId,
    allergen: payload.allergen,
    allergyType: payload.allergyType,
    reaction: payload.reaction,
    severity: payload.severity,
    status: payload.status,
    onsetDate: payload.onsetDate,
    notes: payload.notes,
    createdByUserId: user.id,
  });
  await auditService.recordAuditEvent({
    user, action: "ehr.allergies.create", entityType: "allergy", entityId: id,
    metadata: { patientId }, context,
  });
  return { id };
}

async function editAllergy(user, allergyId, payload, context) {
  if (!["doctor", "admin", "nurse", "receptionist"].includes(user.role)) {
    throw new AppError(403, "Insufficient role");
  }
  const updated = await clinicalRepository.updateAllergy(allergyId, user.hospitalId, payload);
  if (!updated) throw new AppError(404, "Allergy not found");
  await auditService.recordAuditEvent({
    user, action: "ehr.allergies.update", entityType: "allergy", entityId: allergyId,
    metadata: {}, context,
  });
  return updated;
}

async function removeAllergy(user, allergyId, context) {
  if (!["doctor", "admin"].includes(user.role)) {
    throw new AppError(403, "Only clinicians can delete allergies");
  }
  await clinicalRepository.deleteAllergy(allergyId, user.hospitalId);
  await auditService.recordAuditEvent({
    user, action: "ehr.allergies.delete", entityType: "allergy", entityId: allergyId,
    metadata: {}, context,
  });
}

module.exports = {
  listOwnMedicalRecords,
  getPatientMedicalHistory,
  createConsultation,
  buildPrescriptionPdf,
  listDiagnoses,
  addDiagnosis,
  editDiagnosis,
  removeDiagnosis,
  listAllergies,
  addAllergy,
  editAllergy,
  removeAllergy,
};


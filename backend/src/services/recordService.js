const recordRepository = require("../repositories/recordRepository");
const patientRepository = require("../repositories/patientRepository");
const auditService = require("./auditService");
const { AppError } = require("../utils/http");

async function checkAccess(user, patientId) {
  const isSelf = user.role === "patient" && Number(user.patientProfileId) === Number(patientId);
  const isStaff = ["admin", "super_admin", "hospital_admin", "doctor", "receptionist"].includes(user.role);

  if (!isSelf && !isStaff) {
    throw new AppError(403, "You do not have access to this patient's medical records");
  }
}

async function getMedicalHistory(user, patientId, context) {
  await checkAccess(user, patientId);

  const [records, allergies, medications] = await Promise.all([
    recordRepository.listMedicalRecords(user.hospitalId, patientId),
    recordRepository.listAllergies(patientId),
    recordRepository.listMedications(patientId),
  ]);

  await auditService.recordAuditEvent({
    user,
    action: "emr.history.view",
    entityType: "patient",
    entityId: patientId,
    metadata: { recordCount: records.length },
    context,
  });

  return {
    records,
    allergies,
    medications,
  };
}

async function createMedicalRecord(user, data, context) {
  if (user.role !== "doctor" && !["admin", "super_admin", "hospital_admin"].includes(user.role)) {
    throw new AppError(403, "Only clinicians can create medical records");
  }

  // Set doctor_id from current user profile if user is a doctor
  const doctorId = user.role === "doctor" ? user.doctorProfileId : data.doctor_id || data.doctorId;
  if (!doctorId) {
    throw new AppError(400, "Doctor profile ID is required");
  }

  const recordId = await recordRepository.createMedicalRecord(user.hospitalId, {
    ...data,
    doctor_id: doctorId,
  });

  // If request contains allergy or medication data, insert them
  if (data.allergy) {
    await recordRepository.createAllergy({
      patient_id: data.patient_id || data.patientId,
      allergy_name: data.allergy.allergy_name || data.allergy.allergyName,
      severity: data.allergy.severity || "moderate",
      notes: data.allergy.notes || null,
    });
  }

  if (data.medication) {
    await recordRepository.createMedication({
      patient_id: data.patient_id || data.patientId,
      medication_name: data.medication.medication_name || data.medication.medicationName,
      dosage: data.medication.dosage,
      frequency: data.medication.frequency,
      start_date: data.medication.start_date || data.medication.startDate,
      end_date: data.medication.end_date || data.medication.endDate,
    });
  }

  const record = await recordRepository.findMedicalRecordById(user.hospitalId, recordId);

  await auditService.recordAuditEvent({
    user,
    action: "emr.record.create",
    entityType: "medical_record",
    entityId: recordId,
    metadata: { patientId: data.patient_id || data.patientId },
    context,
  });

  return record;
}

async function updateMedicalRecord(user, id, data, context) {
  if (user.role !== "doctor" && !["admin", "super_admin", "hospital_admin"].includes(user.role)) {
    throw new AppError(403, "Only clinicians can update medical records");
  }

  const existing = await recordRepository.findMedicalRecordById(user.hospitalId, id);
  if (!existing) {
    throw new AppError(404, "Medical record not found");
  }

  await recordRepository.updateMedicalRecord(user.hospitalId, id, data);
  const record = await recordRepository.findMedicalRecordById(user.hospitalId, id);

  await auditService.recordAuditEvent({
    user,
    action: "emr.record.update",
    entityType: "medical_record",
    entityId: id,
    metadata: { patientId: record.patient_id },
    context,
  });

  return record;
}

module.exports = {
  getMedicalHistory,
  createMedicalRecord,
  updateMedicalRecord,
};

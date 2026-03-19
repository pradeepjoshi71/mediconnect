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

module.exports = {
  listOwnMedicalRecords,
  getPatientMedicalHistory,
  createConsultation,
  buildPrescriptionPdf,
};

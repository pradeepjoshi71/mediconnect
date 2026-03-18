const clinicalRepository = require("../repositories/clinicalRepository");
const appointmentRepository = require("../repositories/appointmentRepository");
const patientRepository = require("../repositories/patientRepository");
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

async function listOwnMedicalRecords(user) {
  const patient = await patientRepository.findPatientByUserId(user.id);
  if (!patient) {
    throw new AppError(404, "Patient profile not found");
  }

  const records = await clinicalRepository.listMedicalRecordsByPatient(patient.id);
  const prescriptions = await clinicalRepository.listPrescriptionsByRecordIds(
    records.map((item) => item.id)
  );

  return {
    patient,
    records: groupPrescriptionsByRecord(records, prescriptions),
  };
}

async function getPatientMedicalHistory(user, patientId) {
  if (user.role === "patient" && Number(user.patientProfileId) !== Number(patientId)) {
    throw new AppError(403, "Forbidden");
  }

  const records = await clinicalRepository.listMedicalRecordsByPatient(patientId);
  const prescriptions = await clinicalRepository.listPrescriptionsByRecordIds(
    records.map((item) => item.id)
  );
  return groupPrescriptionsByRecord(records, prescriptions);
}

async function createConsultation(user, payload) {
  if (!["doctor", "admin"].includes(user.role)) {
    throw new AppError(403, "Only clinicians can create consultations");
  }

  const appointment = await appointmentRepository.findAppointmentById(payload.appointmentId);
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

  return clinicalRepository.findMedicalRecordById(recordId);
}

async function buildPrescriptionPdf(user, medicalRecordId) {
  const record = await clinicalRepository.findMedicalRecordById(medicalRecordId);
  if (!record) {
    throw new AppError(404, "Medical record not found");
  }

  if (user.role === "patient" && Number(user.patientProfileId) !== Number(record.patientId)) {
    throw new AppError(403, "Forbidden");
  }

  if (user.role === "doctor" && Number(user.doctorProfileId) !== Number(record.doctorId)) {
    throw new AppError(403, "Forbidden");
  }

  const prescriptions = await clinicalRepository.listPrescriptionsByRecordIds([medicalRecordId]);

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

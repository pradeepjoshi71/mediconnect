const { z } = require("zod");
const medicalRecordService = require("../services/medicalRecordService");
const { asyncHandler } = require("../middlewares/asyncHandler");

const consultationSchema = z.object({
  appointmentId: z.number().int().positive(),
  encounterType: z.string().min(2).max(40).default("outpatient"),
  chiefComplaint: z.string().max(500).optional(),
  diagnosis: z.string().min(2).max(1000),
  clinicalNotes: z.string().max(4000).optional(),
  doctorNotes: z.string().max(4000).optional(),
  labSummary: z.string().max(2000).optional(),
  followUpInDays: z.number().int().min(0).max(365).optional(),
  vitals: z.record(z.string(), z.string()).optional().default({}),
  prescriptions: z
    .array(
      z.object({
        medicationName: z.string().min(2).max(160),
        dosage: z.string().min(1).max(120),
        frequency: z.string().min(1).max(120),
        durationDays: z.number().int().positive().max(365),
        instructions: z.string().max(500).optional(),
      })
    )
    .min(1),
});

const listMine = asyncHandler(async (req, res) => {
  res.json(await medicalRecordService.listOwnMedicalRecords(req.user, req.auditContext));
});

const listByPatient = asyncHandler(async (req, res) => {
  const params = z.object({ patientId: z.coerce.number().int().positive() }).parse(req.params);
  res.json(
    await medicalRecordService.getPatientMedicalHistory(
      req.user,
      params.patientId,
      req.auditContext
    )
  );
});

const createConsultation = asyncHandler(async (req, res) => {
  const payload = consultationSchema.parse(req.body);
  const result = await medicalRecordService.createConsultation(req.user, payload, req.auditContext);
  res.status(201).json(result);
});

const downloadPrescriptionPdf = asyncHandler(async (req, res) => {
  const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const pdf = await medicalRecordService.buildPrescriptionPdf(
    req.user,
    params.id,
    req.auditContext
  );
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${pdf.fileName}"`);
  res.send(pdf.buffer);
});

module.exports = {
  listMine,
  listByPatient,
  createConsultation,
  downloadPrescriptionPdf,
};

const { z } = require("zod");
const recordService = require("../services/recordService");
const { asyncHandler } = require("../middlewares/asyncHandler");

const createRecordSchema = z.object({
  patient_id: z.coerce.number().int().positive(),
  doctor_id: z.coerce.number().int().positive().optional(),
  appointment_id: z.coerce.number().int().positive().optional().nullable(),
  symptoms: z.string().min(1),
  chief_complaint: z.string().optional(),
  diagnosis: z.string().min(1),
  treatment_plan: z.string().min(1),
  prescription: z.string().optional().default(""),
  doctor_notes: z.string().optional().default(""),
  follow_up_date: z.string().date().optional().nullable(),
  
  // Optional inline allergy / medication addition
  allergy: z.object({
    allergy_name: z.string().min(1),
    severity: z.enum(["mild", "moderate", "severe", "anaphylactic"]).default("moderate"),
    notes: z.string().optional()
  }).optional(),
  medication: z.object({
    medication_name: z.string().min(1),
    dosage: z.string().min(1),
    frequency: z.string().min(1),
    start_date: z.string().date().optional(),
    end_date: z.string().date().optional()
  }).optional(),
});

const updateRecordSchema = z.object({
  symptoms: z.string().min(1),
  diagnosis: z.string().min(1),
  treatment_plan: z.string().min(1),
  prescription: z.string().optional().default(""),
  doctor_notes: z.string().optional().default(""),
  follow_up_date: z.string().date().optional().nullable(),
});

const getMedicalHistory = asyncHandler(async (req, res) => {
  const params = z.object({ patientId: z.coerce.number().int().positive() }).parse(req.params);
  const result = await recordService.getMedicalHistory(req.user, params.patientId, req.auditContext);
  res.json(result);
});

const createMedicalRecord = asyncHandler(async (req, res) => {
  const payload = createRecordSchema.parse(req.body);
  const record = await recordService.createMedicalRecord(req.user, payload, req.auditContext);
  res.status(201).json(record);
});

const updateMedicalRecord = asyncHandler(async (req, res) => {
  const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const payload = updateRecordSchema.parse(req.body);
  const record = await recordService.updateMedicalRecord(req.user, params.id, payload, req.auditContext);
  res.json(record);
});

module.exports = {
  getMedicalHistory,
  createMedicalRecord,
  updateMedicalRecord,
};

const path = require("path");
const { z } = require("zod");
const fileService = require("../services/fileService");
const { asyncHandler } = require("../middlewares/asyncHandler");

const querySchema = z.object({
  patientId: z.coerce.number().int().positive().optional(),
  appointmentId: z.coerce.number().int().positive().optional(),
  medicalRecordId: z.coerce.number().int().positive().optional(),
});

const uploadSchema = z.object({
  patientId: z.coerce.number().int().positive().optional(),
  appointmentId: z.coerce.number().int().positive().optional(),
  medicalRecordId: z.coerce.number().int().positive().optional(),
  fileCategory: z
    .enum([
      "lab_report",
      "radiology",
      "prescription_pdf",
      "invoice_pdf",
      "clinical_attachment",
      "other",
    ])
    .optional()
    .default("clinical_attachment"),
  accessScope: z.enum(["patient_only", "care_team", "admin_only"]).optional().default("care_team"),
});

const listFiles = asyncHandler(async (req, res) => {
  const query = querySchema.parse(req.query);
  res.json(await fileService.listFiles(req.user, query, req.auditContext));
});

const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "File is required" });
  }
  const payload = uploadSchema.parse(req.body || {});
  const result = await fileService.uploadFile(req.user, req.file, payload, req.auditContext);
  return res.status(201).json(result);
});

const downloadFile = asyncHandler(async (req, res) => {
  const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const { file, filePath } = await fileService.downloadFile(req.user, params.id, req.auditContext);
  res.setHeader("Content-Type", file.mime_type);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(file.original_name)}"`
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.sendFile(path.resolve(filePath));
});

module.exports = {
  listFiles,
  uploadFile,
  downloadFile,
};

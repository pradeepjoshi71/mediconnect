const { z } = require("zod");
const documentService = require("../services/documentService");
const { asyncHandler } = require("../middlewares/asyncHandler");

const listDocuments = asyncHandler(async (req, res) => {
  const params = z.object({ patientId: z.coerce.number().int().positive() }).parse(req.params);
  const docs = await documentService.listDocuments(req.user, params.patientId, req.auditContext);
  res.json(docs);
});

const uploadDocument = asyncHandler(async (req, res) => {
  const body = z.object({
    patient_id: z.coerce.number().int().positive(),
    document_type: z.string().optional().default("report"),
  }).parse(req.body);

  const file = req.file;
  const doc = await documentService.uploadDocument(
    req.user,
    body.patient_id,
    file,
    body.document_type,
    req.auditContext
  );

  res.status(201).json(doc);
});

const downloadDocument = asyncHandler(async (req, res) => {
  const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const doc = await documentService.getDocumentFile(req.user, params.id);
  res.download(doc.file_path, doc.file_name);
});

module.exports = {
  listDocuments,
  uploadDocument,
  downloadDocument,
};

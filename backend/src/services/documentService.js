const documentRepository = require("../repositories/documentRepository");
const patientRepository = require("../repositories/patientRepository");
const auditService = require("./auditService");
const { AppError } = require("../utils/http");

async function checkAccess(user, patientId) {
  const isSelf = user.role === "patient" && Number(user.patientProfileId) === Number(patientId);
  const isStaff = ["admin", "super_admin", "hospital_admin", "doctor", "receptionist"].includes(user.role);

  if (!isSelf && !isStaff) {
    throw new AppError(403, "You do not have access to this patient's medical documents");
  }

  // Cross-tenant validation: non-super-admins must only access patients within their own hospital
  if (user.role !== "super_admin") {
    const patient = await patientRepository.findPatientById(patientId, user.hospitalId);
    if (!patient) {
      throw new AppError(404, "Patient not found");
    }
  }
}

async function listDocuments(user, patientId, context) {
  await checkAccess(user, patientId);

  const docs = await documentRepository.listDocuments(patientId);

  await auditService.recordAuditEvent({
    user,
    action: "emr.documents.view",
    entityType: "patient",
    entityId: patientId,
    metadata: { documentCount: docs.length },
    context,
  });

  return docs;
}

async function uploadDocument(user, patientId, file, documentType, context) {
  if (user.role === "patient" && Number(user.patientProfileId) !== Number(patientId)) {
    throw new AppError(403, "You cannot upload documents for other patients");
  }

  if (!file) {
    throw new AppError(400, "No file provided");
  }

  const doc = await documentRepository.createDocument({
    patient_id: patientId,
    uploaded_by: user.id,
    file_name: file.originalname,
    file_path: file.path,
    document_type: documentType || file.mimetype.split("/")[1] || "document",
  });

  await auditService.recordAuditEvent({
    user,
    action: "emr.document.upload",
    entityType: "medical_document",
    entityId: doc.id,
    metadata: { patientId, fileName: file.originalname },
    context,
  });

  return doc;
}

async function getDocumentFile(user, docId) {
  const doc = await documentRepository.findDocumentById(docId);
  if (!doc) {
    throw new AppError(404, "Document not found");
  }

  await checkAccess(user, doc.patient_id);

  return doc;
}

module.exports = {
  listDocuments,
  uploadDocument,
  getDocumentFile,
};

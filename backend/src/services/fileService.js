const fs = require("fs");
const path = require("path");
const fileRepository = require("../repositories/fileRepository");
const auditService = require("./auditService");
const { AppError } = require("../utils/http");

function uploadsDir() {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
}

function readAccessScope(file) {
  return file.accessScope || file.access_scope || "care_team";
}

function readPatientId(file) {
  return file.patientId || file.patient_id;
}

function canAccessFile(user, file) {
  const accessScope = readAccessScope(file);
  const patientId = readPatientId(file);

  if (user.role === "admin") return true;
  if (user.role === "patient") {
    return Number(patientId) === Number(user.patientProfileId);
  }
  if (user.role === "doctor") {
    return accessScope === "care_team";
  }
  if (user.role === "receptionist") {
    return ["hospital_admin", "admin_only"].includes(accessScope);
  }
  return false;
}

async function listFiles(user, filters, context) {
  const scopedFilters = { ...filters };
  scopedFilters.hospitalId = user.hospitalId;
  if (user.role === "patient") {
    scopedFilters.patientId = user.patientProfileId;
  }
  const files = (await fileRepository.listFiles(scopedFilters)).filter((file) =>
    canAccessFile(user, file)
  );

  if (context) {
    await auditService.recordAuditEvent({
      user,
      action: "files.list",
      entityType: "file",
      entityId: scopedFilters.patientId || scopedFilters.medicalRecordId || "collection",
      metadata: {
        fileCount: files.length,
        filters: {
          patientId: scopedFilters.patientId || null,
          appointmentId: scopedFilters.appointmentId || null,
          medicalRecordId: scopedFilters.medicalRecordId || null,
        },
      },
      context,
    });
  }

  return files;
}

async function uploadFile(user, file, metadata, context) {
  let patientId = metadata.patientId || null;
  if (user.role === "patient") {
    patientId = user.patientProfileId;
  }

  if (!patientId && metadata.appointmentId == null && metadata.medicalRecordId == null) {
    throw new AppError(400, "At least one clinical association is required");
  }

  const record = await fileRepository.createFileRecord({
    hospitalId: user.hospitalId,
    patientId,
    appointmentId: metadata.appointmentId,
    medicalRecordId: metadata.medicalRecordId,
    uploadedByUserId: user.id,
    fileCategory: metadata.fileCategory,
    originalName: file.originalname,
    storageName: file.filename,
    mimeType: file.mimetype,
    byteSize: file.size,
    accessScope: metadata.accessScope,
  });

  if (context) {
    await auditService.recordAuditEvent({
      user,
      action: "files.upload",
      entityType: "file",
      entityId: record.id,
      metadata: {
        patientId,
        fileCategory: metadata.fileCategory,
        originalName: file.originalname,
      },
      context,
    });
  }

  return record;
}

async function downloadFile(user, fileId, context) {
  const file = await fileRepository.findFileById(fileId, user.hospitalId);
  if (!file) {
    throw new AppError(404, "File not found");
  }

  if (!canAccessFile(user, file)) {
    throw new AppError(403, "Forbidden");
  }

  const filePath = path.join(uploadsDir(), file.storage_name);
  if (!fs.existsSync(filePath)) {
    throw new AppError(404, "Stored file could not be found");
  }

  if (context) {
    await auditService.recordAuditEvent({
      user,
      action: "files.download",
      entityType: "file",
      entityId: fileId,
      metadata: {
        originalName: file.original_name,
        accessScope: file.access_scope,
      },
      context,
    });
  }

  return {
    file,
    filePath,
  };
}

module.exports = {
  listFiles,
  uploadFile,
  downloadFile,
};

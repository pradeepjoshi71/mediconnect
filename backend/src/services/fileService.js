const fs = require("fs");
const path = require("path");
const fileRepository = require("../repositories/fileRepository");
const { AppError } = require("../utils/http");

function uploadsDir() {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
}

async function listFiles(user, filters) {
  const scopedFilters = { ...filters };
  if (user.role === "patient") {
    scopedFilters.patientId = user.patientProfileId;
  }
  return fileRepository.listFiles(scopedFilters);
}

async function uploadFile(user, file, metadata) {
  let patientId = metadata.patientId || null;
  if (user.role === "patient") {
    patientId = user.patientProfileId;
  }

  if (!patientId && metadata.appointmentId == null && metadata.medicalRecordId == null) {
    throw new AppError(400, "At least one clinical association is required");
  }

  return fileRepository.createFileRecord({
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
}

async function downloadFile(user, fileId) {
  const file = await fileRepository.findFileById(fileId);
  if (!file) {
    throw new AppError(404, "File not found");
  }

  if (
    user.role === "patient" &&
    Number(file.patient_id) !== Number(user.patientProfileId)
  ) {
    throw new AppError(403, "Forbidden");
  }

  const filePath = path.join(uploadsDir(), file.storage_name);
  if (!fs.existsSync(filePath)) {
    throw new AppError(404, "Stored file could not be found");
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

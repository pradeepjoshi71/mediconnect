'use strict';

const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const ctrl = require('../controllers/storageController');

const router = express.Router();

const adminRoles = ['admin', 'hospital_admin', 'super_admin'];

/**
 * canAccessFiles — inline OR-logic guard for read operations.
 * Allows: admin bypass | view_records permission | patient role (controller enforces ownership)
 */
const canAccessFiles = (req, res, next) => {
  const u = req.user;
  if (!u) return res.status(401).json({ message: 'Unauthorized' });
  const isAdminBypass = adminRoles.includes(u.role);
  const hasViewRecords = (u.permissions || []).includes('view_records');
  const isPatient = u.role === 'patient';
  if (isAdminBypass || hasViewRecords || isPatient) return next();
  return res.status(403).json({ message: 'Forbidden: insufficient permissions to access files' });
};

/**
 * canUploadFiles — inline OR-logic guard for upload.
 * Allows: admin bypass | manage_records | register_patients | manage_lab_results | patient role
 * Patients are further restricted to patient_document/profile_image inside the controller.
 */
const canUploadFiles = (req, res, next) => {
  const u = req.user;
  if (!u) return res.status(401).json({ message: 'Unauthorized' });
  const isAdminBypass = adminRoles.includes(u.role);
  const perms = u.permissions || [];
  const hasPerm =
    perms.includes('manage_records') ||
    perms.includes('register_patients') ||
    perms.includes('manage_lab_results');
  const isPatient = u.role === 'patient';
  if (isAdminBypass || hasPerm || isPatient) return next();
  return res.status(403).json({ message: 'Forbidden: insufficient permissions to upload files' });
};

/**
 * POST /api/v1/storage/upload
 * Requires manage_records, register_patients, or manage_lab_results permission.
 * Patients may upload patient_document/profile_image only (enforced in controller).
 */
router.post('/upload', authMiddleware, canUploadFiles, ctrl.upload.single('file'), ctrl.uploadFile);

/**
 * GET /api/v1/storage/files
 * Requires view_records permission or patient role.
 * Controller scopes by req.user.hospitalId (tenant isolation enforced).
 */
router.get('/files', authMiddleware, canAccessFiles, ctrl.listFiles);

/**
 * GET /api/v1/storage/files/:id/url
 * Requires view_records permission or patient role.
 * Controller validates hospital ownership and patient self-access.
 */
router.get('/files/:id/url', authMiddleware, canAccessFiles, ctrl.getDownloadUrl);

/**
 * DELETE /api/v1/storage/files/:id
 * Restricted to admin roles only.
 */
router.delete('/files/:id', authMiddleware, roleMiddleware(...adminRoles), ctrl.deleteFile);

module.exports = router;

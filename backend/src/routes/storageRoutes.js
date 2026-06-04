const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const ctrl = require('../controllers/storageController');

const router = express.Router();

const adminRoles = ['admin', 'hospital_admin', 'super_admin'];

/**
 * POST /api/v1/storage/upload
 * Upload a file to MinIO. Scoped to caller's hospital via controller
 * (uses req.user.hospitalId — no cross-tenant risk).
 */
router.post('/upload', authMiddleware, ctrl.upload.single('file'), ctrl.uploadFile);

/**
 * GET /api/v1/storage/files
 * List file metadata. Controller scopes by req.user.hospitalId.
 */
router.get('/files', authMiddleware, ctrl.listFiles);

/**
 * GET /api/v1/storage/files/:id/url
 * Get pre-signed download URL. Controller validates hospital ownership.
 */
router.get('/files/:id/url', authMiddleware, ctrl.getDownloadUrl);

/**
 * DELETE /api/v1/storage/files/:id
 * Delete a file. Controller validates hospital ownership.
 * Restricted to admin roles.
 */
router.delete('/files/:id', authMiddleware, roleMiddleware(...adminRoles), ctrl.deleteFile);

module.exports = router;

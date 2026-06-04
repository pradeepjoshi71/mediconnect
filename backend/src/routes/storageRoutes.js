const router = require('express').Router();
const { authenticate } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const ctrl = require('../controllers/storageController');

/**
 * @route  POST /api/v1/storage/upload
 * @desc   Upload file to MinIO
 * @access Authenticated
 */
router.post('/upload', authenticate, ctrl.upload.single('file'), ctrl.uploadFile);

/**
 * @route  GET /api/v1/storage/files
 * @desc   List file metadata
 * @access Authenticated
 */
router.get('/files', authenticate, ctrl.listFiles);

/**
 * @route  GET /api/v1/storage/files/:id/url
 * @desc   Get pre-signed download URL
 * @access Authenticated
 */
router.get('/files/:id/url', authenticate, ctrl.getDownloadUrl);

/**
 * @route  DELETE /api/v1/storage/files/:id
 * @desc   Delete file from MinIO and metadata
 * @access Admin
 */
router.delete('/files/:id', authenticate, requireRole(['admin', 'super_admin', 'hospital_admin']), ctrl.deleteFile);

module.exports = router;

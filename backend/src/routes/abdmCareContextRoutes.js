'use strict';

/**
 * abdmCareContextRoutes.js
 * Express router for ABDM Care Context endpoints.
 *
 * Mounted at: /api/v1/abdm/care-context
 *
 * Endpoints:
 *   GET  /api/v1/abdm/care-context/:patientId  → List care contexts
 *   POST /api/v1/abdm/care-context/link        → Link a new context
 *   POST /api/v1/abdm/care-context/unlink      → Unlink a context
 *
 * Note: /link and /unlink are declared BEFORE /:patientId to prevent
 * Express from treating "link" or "unlink" as a numeric patientId.
 */

const express                  = require('express');
const abdmCareContextController = require('../controllers/abdmCareContextController');
const authMiddleware            = require('../middlewares/authMiddleware');
const permissionMiddleware      = require('../middlewares/permissionMiddleware');

const router = express.Router();

router.post(
  '/link',
  authMiddleware,
  permissionMiddleware('abdm.carecontext.link'),
  abdmCareContextController.linkCareContext
);

router.post(
  '/unlink',
  authMiddleware,
  permissionMiddleware('abdm.carecontext.unlink'),
  abdmCareContextController.unlinkCareContext
);

router.get(
  '/:patientId',
  authMiddleware,
  permissionMiddleware('abdm.carecontext.read'),
  abdmCareContextController.getCareContexts
);

module.exports = router;

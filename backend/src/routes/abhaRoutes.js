'use strict';

/**
 * abhaRoutes.js
 * Express router for ABHA (Ayushman Bharat Health Account) endpoints.
 *
 * Mounted at: /api/v1/abha
 *
 * Endpoints:
 *   GET    /api/v1/abha/:patientId           → Get ABHA details (read)
 *   POST   /api/v1/abha/:patientId/link      → Link ABHA number  (link)
 *   PUT    /api/v1/abha/:patientId/verify    → Verify ABHA status (verify)
 *   DELETE /api/v1/abha/:patientId/unlink    → Unlink ABHA record (unlink)
 */

const express = require('express');
const abhaController = require('../controllers/abhaController');
const authMiddleware = require('../middlewares/authMiddleware');
const permissionMiddleware = require('../middlewares/permissionMiddleware');

const router = express.Router();

router.get(
  '/:patientId',
  authMiddleware,
  permissionMiddleware('abha.read'),
  abhaController.getAbha
);

router.post(
  '/:patientId/link',
  authMiddleware,
  permissionMiddleware('abha.link'),
  abhaController.linkAbha
);

router.put(
  '/:patientId/verify',
  authMiddleware,
  permissionMiddleware('abha.verify'),
  abhaController.verifyAbha
);

router.delete(
  '/:patientId/unlink',
  authMiddleware,
  permissionMiddleware('abha.unlink'),
  abhaController.unlinkAbha
);

module.exports = router;

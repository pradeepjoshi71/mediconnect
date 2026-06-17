'use strict';

/**
 * pmjayRoutes.js
 * Express router for PM-JAY Beneficiary + Claim endpoints.
 *
 * Mounted at: /api/v1/pmjay
 *
 * Beneficiary endpoints:
 *   GET    /api/v1/pmjay/:patientId  → Get PM-JAY details
 *   POST   /api/v1/pmjay/link        → Link PM-JAY enrollment
 *   POST   /api/v1/pmjay/verify      → Verify/fail PM-JAY
 *   DELETE /api/v1/pmjay/unlink      → Unlink PM-JAY
 *
 * Claim endpoints (sub-router at /claims):
 *   GET  /api/v1/pmjay/claims/patient/:patientId → List patient claims
 *   GET  /api/v1/pmjay/claims/:id               → Get single claim
 *   POST /api/v1/pmjay/claims/create            → Draft a claim
 *   POST /api/v1/pmjay/claims/submit            → Submit a claim
 *   POST /api/v1/pmjay/claims/update-status     → Admin lifecycle update
 *
 * Note: /link, /verify, /unlink, /claims declared BEFORE /:patientId.
 */

const express              = require('express');
const pmjayController      = require('../controllers/pmjayController');
const pmjayClaimRoutes     = require('./pmjayClaimRoutes');
const pmjayAnalyticsController = require('../controllers/pmjayAnalyticsController');
const authMiddleware       = require('../middlewares/authMiddleware');
const permissionMiddleware = require('../middlewares/permissionMiddleware');

const router = express.Router();

// Phase 11.3 — PM-JAY Dashboard & Analytics (mounted before /:patientId to prevent shadowing)
router.get(
  '/dashboard/summary',
  authMiddleware,
  permissionMiddleware('pmjay.analytics.read'),
  pmjayAnalyticsController.getSummary
);

router.get(
  '/dashboard/export',
  authMiddleware,
  permissionMiddleware('pmjay.analytics.read'),
  pmjayAnalyticsController.exportReport
);

// Phase 11.2 — PM-JAY Claim sub-router (mounted before /:patientId to prevent shadowing)
router.use('/claims', pmjayClaimRoutes);

router.post(
  '/link',
  authMiddleware,
  permissionMiddleware('pmjay.link'),
  pmjayController.linkPmjay
);

router.post(
  '/verify',
  authMiddleware,
  permissionMiddleware('pmjay.verify'),
  pmjayController.verifyPmjay
);

router.delete(
  '/unlink',
  authMiddleware,
  permissionMiddleware('pmjay.unlink'),
  pmjayController.unlinkPmjay
);

router.get(
  '/:patientId',
  authMiddleware,
  permissionMiddleware('pmjay.read'),
  pmjayController.getPmjayDetails
);

module.exports = router;

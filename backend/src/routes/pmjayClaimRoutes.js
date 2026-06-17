'use strict';

/**
 * pmjayClaimRoutes.js
 * Express router for PM-JAY Claim endpoints.
 *
 * Mounted at: /api/v1/pmjay/claims
 *   → When combined with app.js mount at /api/v1/pmjay,
 *     the effective base path becomes /api/v1/pmjay/claims
 *
 * Endpoints:
 *   GET  /api/v1/pmjay/claims/patient/:patientId  → List patient claims
 *   POST /api/v1/pmjay/claims/create              → Draft a new claim
 *   POST /api/v1/pmjay/claims/submit              → Submit DRAFT claim
 *   POST /api/v1/pmjay/claims/update-status       → Admin lifecycle updates
 *   GET  /api/v1/pmjay/claims/:id                 → Get single claim (last, after static routes)
 *
 * Note: static sub-paths declared BEFORE /:id to prevent shadowing.
 */

const express                = require('express');
const pmjayClaimController   = require('../controllers/pmjayClaimController');
const authMiddleware         = require('../middlewares/authMiddleware');
const permissionMiddleware   = require('../middlewares/permissionMiddleware');

const router = express.Router();

// Static POST routes first
router.post(
  '/create',
  authMiddleware,
  permissionMiddleware('pmjay.claim.create'),
  pmjayClaimController.createClaim
);

router.post(
  '/submit',
  authMiddleware,
  permissionMiddleware('pmjay.claim.submit'),
  pmjayClaimController.submitClaim
);

router.post(
  '/update-status',
  authMiddleware,
  permissionMiddleware('pmjay.claim.update'),
  pmjayClaimController.updateClaimStatus
);

// Static GET: list by patient (before dynamic /:id)
router.get(
  '/patient/:patientId',
  authMiddleware,
  permissionMiddleware('pmjay.claim.read'),
  pmjayClaimController.getClaimsByPatient
);

// Dynamic GET: single claim by ID (last)
router.get(
  '/:id',
  authMiddleware,
  permissionMiddleware('pmjay.claim.read'),
  pmjayClaimController.getClaimById
);

module.exports = router;

'use strict';

/**
 * abdmConsentRoutes.js
 * Express router for ABDM Consent Management endpoints.
 *
 * Mounted at: /api/v1/abdm/consent
 *
 * Endpoints:
 *   GET  /api/v1/abdm/consent/:patientId  → Get consent history + active summary
 *   POST /api/v1/abdm/consent/grant       → Grant a new consent
 *   POST /api/v1/abdm/consent/revoke      → Revoke an active consent
 */

const express             = require('express');
const abdmConsentController = require('../controllers/abdmConsentController');
const authMiddleware        = require('../middlewares/authMiddleware');
const permissionMiddleware  = require('../middlewares/permissionMiddleware');

const router = express.Router();

// NOTE: /grant and /revoke are declared BEFORE /:patientId so Express
// does not misinterpret "grant" or "revoke" as a patientId parameter.
router.post(
  '/grant',
  authMiddleware,
  permissionMiddleware('abdm.consent.grant'),
  abdmConsentController.grantConsent
);

router.post(
  '/revoke',
  authMiddleware,
  permissionMiddleware('abdm.consent.revoke'),
  abdmConsentController.revokeConsent
);

router.get(
  '/:patientId',
  authMiddleware,
  permissionMiddleware('abdm.consent.read'),
  abdmConsentController.getConsents
);

module.exports = router;

const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const ctrl = require('../controllers/pushController');

const router = express.Router();

const adminRoles = ['admin', 'hospital_admin', 'super_admin'];

/**
 * POST /api/v1/push/register
 * Register FCM device token for current user.
 * Token is always tied to req.user.id — no cross-tenant risk.
 */
router.post('/register', authMiddleware, ctrl.registerToken);

/**
 * POST /api/v1/push/deregister
 * Deactivate an FCM device token for current user.
 */
router.post('/deregister', authMiddleware, ctrl.deregisterToken);

/**
 * POST /api/v1/push/send
 * Send push notification to a user. Admin-only.
 * Controller must validate target user belongs to caller's hospital.
 */
router.post('/send', authMiddleware, roleMiddleware(...adminRoles), ctrl.sendPush);

module.exports = router;

const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const ctrl = require('../controllers/pushController');

const router = express.Router();

const adminRoles = ['admin', 'hospital_admin', 'super_admin'];

/**
 * POST /api/v1/push/register
 * PUT /api/v1/push/token
 * Register/Update FCM device token for current user.
 */
router.post('/register', authMiddleware, ctrl.registerToken);
router.put('/token', authMiddleware, ctrl.registerToken);

/**
 * POST /api/v1/push/deregister
 * DELETE /api/v1/push/token
 * Deactivate (remove) FCM device token for current user.
 */
router.post('/deregister', authMiddleware, ctrl.deregisterToken);
router.delete('/token', authMiddleware, ctrl.deregisterToken);

/**
 * GET /api/v1/push/tokens
 * List device tokens (admin/super_admin).
 */
router.get('/tokens', authMiddleware, roleMiddleware(...adminRoles), ctrl.listTokens);

/**
 * POST /api/v1/push/send
 * Send test push notification to a user (admin/super_admin).
 */
router.post('/send', authMiddleware, roleMiddleware(...adminRoles), ctrl.sendPush);

/**
 * POST /api/v1/push/send-batch
 * Send test push notification to multiple users (admin/super_admin).
 */
router.post('/send-batch', authMiddleware, roleMiddleware(...adminRoles), ctrl.sendPushBatch);

/**
 * POST /api/v1/push/send-hospital
 * Send test push notification to all users of a hospital (admin/super_admin).
 */
router.post('/send-hospital', authMiddleware, roleMiddleware(...adminRoles), ctrl.sendPushHospital);

module.exports = router;

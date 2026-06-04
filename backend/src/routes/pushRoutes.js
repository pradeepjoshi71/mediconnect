const router = require('express').Router();
const { authenticate } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const ctrl = require('../controllers/pushController');

/**
 * @route  POST /api/v1/push/register
 * @desc   Register FCM device token for current user
 * @access Authenticated
 */
router.post('/register', authenticate, ctrl.registerToken);

/**
 * @route  POST /api/v1/push/deregister
 * @desc   Deregister (deactivate) an FCM device token
 * @access Authenticated
 */
router.post('/deregister', authenticate, ctrl.deregisterToken);

/**
 * @route  POST /api/v1/push/send
 * @desc   Send push notification to a user (admin only)
 * @access Admin
 */
router.post('/send', authenticate, requireRole(['admin', 'hospital_admin', 'super_admin']), ctrl.sendPush);

module.exports = router;

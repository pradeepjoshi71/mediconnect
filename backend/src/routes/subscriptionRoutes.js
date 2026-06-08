const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const ctrl = require('../controllers/subscriptionController');

const router = express.Router();

// ─── Plan management (super_admin only) ──────────────────────────────────────

/** GET  /api/v1/subscriptions/plans */
router.get('/plans', authMiddleware, roleMiddleware('super_admin'), ctrl.listPlans);

/** POST /api/v1/subscriptions/plans */
router.post('/plans', authMiddleware, roleMiddleware('super_admin'), ctrl.createPlan);

/** PUT  /api/v1/subscriptions/plans/:id */
router.put('/plans/:id', authMiddleware, roleMiddleware('super_admin'), ctrl.updatePlan);

/** PATCH /api/v1/subscriptions/plans/:id/disable */
router.patch('/plans/:id/disable', authMiddleware, roleMiddleware('super_admin'), ctrl.disablePlan);

/** PATCH /api/v1/subscriptions/plans/:id/enable */
router.patch('/plans/:id/enable', authMiddleware, roleMiddleware('super_admin'), ctrl.enablePlan);

// ─── Subscription management (super_admin only) ───────────────────────────────

/** GET  /api/v1/subscriptions — list all */
router.get('/', authMiddleware, roleMiddleware('super_admin'), ctrl.listSubscriptions);

/** GET  /api/v1/subscriptions/expiring */
router.get('/expiring', authMiddleware, roleMiddleware('super_admin'), ctrl.getExpiringSubscriptions);

/** POST /api/v1/subscriptions/assign */
router.post('/assign', authMiddleware, roleMiddleware('super_admin'), ctrl.assignPlan);

// ─── Hospital admin self-service ──────────────────────────────────────────────

/** GET  /api/v1/subscriptions/my */
router.get('/my', authMiddleware, roleMiddleware('admin', 'hospital_admin', 'super_admin'), ctrl.getMySubscription);

/** GET  /api/v1/subscriptions/my/history */
router.get('/my/history', authMiddleware, roleMiddleware('admin', 'hospital_admin'), ctrl.getMyHistory);

/** POST /api/v1/subscriptions/my/upgrade-request */
router.post('/my/upgrade-request', authMiddleware, roleMiddleware('admin', 'hospital_admin'), ctrl.requestUpgrade);

module.exports = router;

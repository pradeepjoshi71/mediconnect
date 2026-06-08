const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const tenantGuard = require('../middlewares/tenantGuard');
const ctrl = require('../controllers/hospitalController');

const router = express.Router();

const adminRoles = ['admin', 'hospital_admin', 'super_admin'];
const allStaffRoles = ['admin', 'hospital_admin', 'super_admin', 'doctor', 'receptionist', 'pharmacist', 'lab_technician'];

/**
 * GET /api/v1/hospitals
 * List all hospitals — super_admin only (cross-tenant by nature).
 */
router.get(
  '/',
  authMiddleware,
  roleMiddleware('super_admin'),
  ctrl.listHospitals
);

/**
 * GET /api/v1/hospitals/audit/logs
 * Returns audit logs scoped to caller's hospital (or all for super_admin).
 * NOTE: must be registered BEFORE /:id to avoid route collision.
 */
router.get(
  '/audit/logs',
  authMiddleware,
  roleMiddleware(...adminRoles),
  ctrl.getAuditLogs
);

/**
 * GET /api/v1/hospitals/branding
 * Read current tenant branding. All staff roles.
 * NOTE: must be registered BEFORE /:id to avoid route collision.
 */
router.get(
  '/branding',
  authMiddleware,
  roleMiddleware(...allStaffRoles),
  ctrl.getBranding
);

/**
 * PUT /api/v1/hospitals/branding
 * Save tenant branding. Admin roles only.
 * NOTE: must be registered BEFORE /:id to avoid route collision.
 */
router.put(
  '/branding',
  authMiddleware,
  roleMiddleware('admin', 'hospital_admin'),
  ctrl.saveBranding
);

/**
 * GET /api/v1/hospitals/public/branding/:code
 * Public branding lookup by code.
 * NOTE: must be registered BEFORE /:id to avoid route collision.
 */
router.get('/public/branding/:code', ctrl.getPublicBranding);

/**
 * POST /api/v1/hospitals/register
 * Submit a clinic/hospital onboarding request. Public endpoint.
 * NOTE: must be registered BEFORE /:id to avoid route collision.
 */
router.post('/register', ctrl.registerHospitalApplication);

/**
 * GET /api/v1/hospitals/applications/stats
 * Get registration statistics. super_admin only.
 * NOTE: must be registered BEFORE /:id to avoid route collision.
 */
router.get(
  '/applications/stats',
  authMiddleware,
  roleMiddleware('super_admin'),
  ctrl.getApplicationStats
);

/**
 * GET /api/v1/hospitals/applications
 * List submitted onboarding applications. super_admin only.
 * NOTE: must be registered BEFORE /:id to avoid route collision.
 */
router.get(
  '/applications',
  authMiddleware,
  roleMiddleware('super_admin'),
  ctrl.listApplications
);

/**
 * POST /api/v1/hospitals/applications/:id/approve
 * Approve application and provision tenant. super_admin only.
 */
router.post(
  '/applications/:id/approve',
  authMiddleware,
  roleMiddleware('super_admin'),
  ctrl.approveApplication
);

/**
 * POST /api/v1/hospitals/applications/:id/reject
 * Reject application. super_admin only.
 */
router.post(
  '/applications/:id/reject',
  authMiddleware,
  roleMiddleware('super_admin'),
  ctrl.rejectApplication
);

/**
 * GET /api/v1/hospitals/:id
 * Get a single hospital. tenantGuard ensures non-super-admins
 * can only fetch their own hospital.
 * NOTE: this wildcard route must come AFTER all literal routes.
 */
router.get(
  '/:id',
  authMiddleware,
  roleMiddleware(...adminRoles),
  tenantGuard,
  ctrl.getHospital
);

/**
 * GET /api/v1/hospitals/:hospitalId/departments
 * List departments. tenantGuard enforces caller's hospital scope.
 */
router.get(
  '/:hospitalId/departments',
  authMiddleware,
  roleMiddleware(...allStaffRoles),
  tenantGuard,
  ctrl.listDepartments
);

/**
 * POST /api/v1/hospitals/:hospitalId/departments
 * Create/update department. tenantGuard enforces caller's hospital scope.
 */
router.post(
  '/:hospitalId/departments',
  authMiddleware,
  roleMiddleware(...adminRoles),
  tenantGuard,
  ctrl.createDepartment
);

module.exports = router;

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
 * GET /api/v1/hospitals/:id
 * Get a single hospital. tenantGuard ensures non-super-admins
 * can only fetch their own hospital.
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

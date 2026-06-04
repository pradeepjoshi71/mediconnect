const router = require('express').Router();
const { authenticate } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const ctrl = require('../controllers/hospitalController');

/**
 * @route  GET /api/v1/hospitals
 * @desc   List all hospitals
 * @access Super Admin
 */
router.get('/', authenticate, requireRole(['super_admin']), ctrl.listHospitals);

/**
 * @route  GET /api/v1/hospitals/:id
 * @desc   Get hospital by ID
 * @access Admin+
 */
router.get('/:id', authenticate, requireRole(['admin', 'hospital_admin', 'super_admin']), ctrl.getHospital);

/**
 * @route  GET /api/v1/hospitals/:hospitalId/departments
 * @desc   List departments of a hospital
 * @access Admin+
 */
router.get('/:hospitalId/departments', authenticate,
  requireRole(['admin', 'hospital_admin', 'super_admin', 'doctor', 'receptionist', 'pharmacist', 'lab_technician']),
  ctrl.listDepartments);

/**
 * @route  POST /api/v1/hospitals/:hospitalId/departments
 * @desc   Create/update department
 * @access Admin
 */
router.post('/:hospitalId/departments', authenticate,
  requireRole(['admin', 'hospital_admin', 'super_admin']),
  ctrl.createDepartment);

/**
 * @route  GET /api/v1/hospitals/audit-logs
 * @desc   List audit logs for current hospital
 * @access Admin
 */
router.get('/audit/logs', authenticate,
  requireRole(['admin', 'hospital_admin', 'super_admin']),
  ctrl.getAuditLogs);

module.exports = router;

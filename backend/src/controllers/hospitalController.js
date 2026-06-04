const adminHospitalRepo = require('../repositories/adminHospitalRepository');
const auditService = require('../services/auditService');
const { AppError } = require('../utils/http');

/**
 * GET /api/v1/hospitals
 * super_admin only — lists all hospitals.
 */
async function listHospitals(req, res, next) {
  try {
    const hospitals = await adminHospitalRepo.listHospitals();
    res.json({ success: true, hospitals });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/hospitals/:id
 * tenantGuard already ensures non-super-admins can only reach their own hospital.
 * We still re-verify ownership here as defence-in-depth.
 */
async function getHospital(req, res, next) {
  try {
    const targetId = parseInt(req.params.id, 10);

    // Defence-in-depth: non-super-admin can only read their own hospital
    if (req.user.role !== 'super_admin' && targetId !== parseInt(req.user.hospitalId, 10)) {
      return res.status(403).json({ message: 'Forbidden: cross-tenant access denied' });
    }

    const hospital = await adminHospitalRepo.getHospitalById(targetId);
    if (!hospital) throw new AppError(404, 'Hospital not found');
    res.json({ success: true, hospital });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/hospitals/:hospitalId/departments
 * tenantGuard ensures the hospitalId param matches req.user.hospitalId
 * (or passes for super_admin). Controller uses the validated param.
 */
async function listDepartments(req, res, next) {
  try {
    // For super_admin: use the param as supplied.
    // For others: tenantGuard already validated param === user's hospital,
    //             so either value is equivalent — prefer req.user.hospitalId
    //             to avoid any integer-parse edge cases.
    const hospitalId =
      req.user.role === 'super_admin'
        ? parseInt(req.params.hospitalId, 10)
        : parseInt(req.user.hospitalId, 10);

    const departments = await adminHospitalRepo.getDepartmentsByHospital(hospitalId);
    res.json({ success: true, departments });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/hospitals/:hospitalId/departments
 * tenantGuard validated the param. Always scope to req.user.hospitalId
 * (defence-in-depth for non-super-admin callers).
 */
async function createDepartment(req, res, next) {
  try {
    const { code, name, description, headDoctorId } = req.body;
    if (!code || !name) throw new AppError(400, 'code and name are required');

    const hospitalId =
      req.user.role === 'super_admin'
        ? parseInt(req.params.hospitalId, 10)
        : parseInt(req.user.hospitalId, 10);

    const dept = await adminHospitalRepo.createDepartment({
      hospitalId,
      code,
      name,
      description,
      headDoctorId,
    });

    await auditService.recordAuditEvent({
      user: { id: req.user.id, role: req.user.role, hospitalId },
      action: 'department.created',
      entityType: 'department',
      entityId: dept.id,
      metadata: { code, name },
      context: {
        requestId: req.requestId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    });

    res.status(201).json({ success: true, department: dept });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/hospitals/audit/logs
 * Scoped to caller's hospital. super_admin can optionally pass ?hospitalId=
 * to query a specific hospital's logs.
 */
async function getAuditLogs(req, res, next) {
  try {
    // super_admin can query any hospital via ?hospitalId= query param
    const hospitalId =
      req.user.role === 'super_admin' && req.query.hospitalId
        ? parseInt(req.query.hospitalId, 10)
        : parseInt(req.user.hospitalId, 10);

    const { action, userId, from, to, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const result = await adminHospitalRepo.getAuditLogs({
      hospitalId,
      action: action || null,
      userId: userId ? parseInt(userId, 10) : null,
      from: from || null,
      to: to || null,
      limit: parseInt(limit, 10),
      offset,
    });

    res.json({ success: true, ...result, page: parseInt(page, 10) });
  } catch (err) {
    next(err);
  }
}

module.exports = { listHospitals, getHospital, listDepartments, createDepartment, getAuditLogs };

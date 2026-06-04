const adminHospitalRepo = require('../repositories/adminHospitalRepository');
const auditService = require('../services/auditService');
const { AppError } = require('../utils/http');

async function listHospitals(req, res, next) {
  try {
    const hospitals = await adminHospitalRepo.listHospitals();
    res.json({ success: true, hospitals });
  } catch (err) {
    next(err);
  }
}

async function getHospital(req, res, next) {
  try {
    const hospital = await adminHospitalRepo.getHospitalById(parseInt(req.params.id, 10));
    if (!hospital) throw new AppError(404, 'Hospital not found');
    res.json({ success: true, hospital });
  } catch (err) {
    next(err);
  }
}

async function listDepartments(req, res, next) {
  try {
    const hospitalId = parseInt(req.params.hospitalId || req.user.hospitalId, 10);
    const departments = await adminHospitalRepo.getDepartmentsByHospital(hospitalId);
    res.json({ success: true, departments });
  } catch (err) {
    next(err);
  }
}

async function createDepartment(req, res, next) {
  try {
    const { code, name, description, headDoctorId } = req.body;
    if (!code || !name) throw new AppError(400, 'code and name are required');
    const hospitalId = parseInt(req.user.hospitalId, 10);
    const dept = await adminHospitalRepo.createDepartment({ hospitalId, code, name, description, headDoctorId });

    await auditService.recordAuditEvent({
      user: { id: req.user.id, role: req.user.role, hospitalId },
      action: 'department.created',
      entityType: 'department',
      entityId: dept.id,
      metadata: { code, name },
      context: { requestId: req.id, ipAddress: req.ip, userAgent: req.get('user-agent') },
    });

    res.status(201).json({ success: true, department: dept });
  } catch (err) {
    next(err);
  }
}

async function getAuditLogs(req, res, next) {
  try {
    const hospitalId = parseInt(req.user.hospitalId, 10);
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

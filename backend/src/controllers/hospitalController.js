const bcrypt = require('bcrypt');
const adminHospitalRepo = require('../repositories/adminHospitalRepository');
const subRepo = require('../repositories/subscriptionRepository');
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

async function registerHospitalApplication(req, res, next) {
  try {
    const { hospitalName, contactPerson, email, phone, address, hospitalType, numberOfDoctors } = req.body;
    if (!hospitalName || !contactPerson || !email || !phone || !address || !hospitalType || !numberOfDoctors) {
      throw new AppError(400, 'All fields are required');
    }
    const app = await adminHospitalRepo.createApplication({
      hospitalName,
      contactPerson,
      email,
      phone,
      address,
      hospitalType,
      numberOfDoctors: parseInt(numberOfDoctors, 10)
    });
    res.status(201).json({ success: true, application: app });
  } catch (err) {
    next(err);
  }
}

async function listApplications(req, res, next) {
  try {
    const { search = '' } = req.query;
    const apps = await adminHospitalRepo.listApplications({ search });
    res.json({ success: true, applications: apps });
  } catch (err) {
    next(err);
  }
}

async function approveApplication(req, res, next) {
  try {
    const appId = parseInt(req.params.id, 10);
    const app = await adminHospitalRepo.getApplicationById(appId);
    if (!app) {
      throw new AppError(404, 'Application not found');
    }
    if (app.status !== 'pending') {
      throw new AppError(400, `Application has already been ${app.status}`);
    }

    // Generate unique code and slug
    const rand = Math.floor(100 + Math.random() * 900);
    const code = "HSP-" + app.hospitalName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase() + rand;
    const slug = app.hospitalName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + rand;

    // Default configuration/settings
    const settings = {
      theme: { accent: "brand" },
      appointments: { defaultSlotMinutes: 30 }
    };

    // Create the tenant
    const tenant = await adminHospitalRepo.createHospitalTenant({
      code,
      slug,
      name: app.hospitalName,
      timezone: 'Asia/Kolkata',
      countryCode: 'IN',
      supportPhone: app.phone,
      billingEmail: app.email,
      status: 'trial', // Assign trial plan
      settings
    });

    const hospitalId = tenant.id;

    // Get Admin role id
    const adminRoleId = await adminHospitalRepo.getAdminRoleId();
    if (!adminRoleId) {
      throw new AppError(500, 'Admin role not configured in database');
    }

    // Default password Password@123
    const passwordHash = await bcrypt.hash('Password@123', 12);

    // Create default Hospital Admin user
    await adminHospitalRepo.createDefaultAdmin({
      hospitalId,
      roleId: adminRoleId,
      fullName: app.contactPerson,
      email: app.email,
      passwordHash,
      phone: app.phone
    });

    // Update application status to approved
    await adminHospitalRepo.updateApplicationStatus(appId, 'approved');

    // Auto-assign Trial subscription plan
    try {
      const trialPlan = await subRepo.getPlanByCode('trial');
      if (trialPlan) {
        const trialExpiry = new Date(Date.now() + trialPlan.durationDays * 86400000);
        await subRepo.assignPlan({
          hospitalId,
          planId: trialPlan.id,
          assignedBy: null,
          notes: 'Auto-assigned on onboarding approval',
          status: 'trialing',
          expiresAt: trialExpiry
        });
      }
    } catch (_e) {
      // Non-blocking — don't fail approval if subscription insert fails
    }

    res.json({ success: true, message: 'Hospital approved and tenant provisioned successfully', code, email: app.email });
  } catch (err) {
    next(err);
  }
}

async function rejectApplication(req, res, next) {
  try {
    const appId = parseInt(req.params.id, 10);
    const app = await adminHospitalRepo.getApplicationById(appId);
    if (!app) {
      throw new AppError(404, 'Application not found');
    }
    if (app.status !== 'pending') {
      throw new AppError(400, `Application has already been ${app.status}`);
    }

    await adminHospitalRepo.updateApplicationStatus(appId, 'rejected');
    res.json({ success: true, message: 'Application rejected successfully' });
  } catch (err) {
    next(err);
  }
}

async function getApplicationStats(req, res, next) {
  try {
    const stats = await adminHospitalRepo.getApplicationStats();
    res.json({ success: true, stats });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listHospitals,
  getHospital,
  listDepartments,
  createDepartment,
  getAuditLogs,
  registerHospitalApplication,
  listApplications,
  approveApplication,
  rejectApplication,
  getApplicationStats,
  getBranding,
  saveBranding,
  getPublicBranding
};

async function getBranding(req, res, next) {
  try {
    const hospitalId = req.user?.hospitalId;
    if (!hospitalId) throw new AppError(400, 'No hospital associated with this account');
    const result = await adminHospitalRepo.getBranding(hospitalId);
    res.json({ success: true, branding: result?.branding || {}, hospitalName: result?.name, hospitalCode: result?.code });
  } catch (err) { next(err); }
}

async function saveBranding(req, res, next) {
  try {
    const hospitalId = req.user?.hospitalId;
    if (!hospitalId) throw new AppError(400, 'No hospital associated with this account');
    const { displayName, logoUrl, faviconUrl, primaryColor, secondaryColor, footerText } = req.body;
    const branding = {};
    if (displayName  !== undefined) branding.displayName   = String(displayName).substring(0, 120);
    if (logoUrl      !== undefined) branding.logoUrl       = String(logoUrl).substring(0, 500);
    if (faviconUrl   !== undefined) branding.faviconUrl    = String(faviconUrl).substring(0, 500);
    if (primaryColor !== undefined) branding.primaryColor  = String(primaryColor).substring(0, 20);
    if (secondaryColor !== undefined) branding.secondaryColor = String(secondaryColor).substring(0, 20);
    if (footerText   !== undefined) branding.footerText    = String(footerText).substring(0, 200);
    const result = await adminHospitalRepo.saveBranding(hospitalId, branding);
    res.json({ success: true, branding: result?.branding || branding });
  } catch (err) { next(err); }
}

async function getPublicBranding(req, res, next) {
  try {
    const { code } = req.params;
    if (!code) throw new AppError(400, 'Hospital code is required');
    const hospitalRepo = require('../repositories/hospitalRepository');
    const result = await hospitalRepo.findHospitalByCode(code);
    if (!result) throw new AppError(404, 'Hospital not found');
    res.json({
      success: true,
      branding: result.settings?.branding || {},
      hospitalName: result.name,
      hospitalCode: result.code
    });
  } catch (err) { next(err); }
}

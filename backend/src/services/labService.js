const labRepository = require("../repositories/labRepository");
const patientRepository = require("../repositories/patientRepository");
const doctorRepository = require("../repositories/doctorRepository");
const auditService = require("./auditService");
const { AppError } = require("../utils/http");
const { hasPermission } = require("../utils/rbac");

async function listLabTests(user) {
  return labRepository.listLabTests(user.hospitalId);
}

async function createLabTest(user, data, context) {
  if (!hasPermission(user, "manage_settings")) {
    throw new AppError(403, "Forbidden: Only admins can manage the lab test catalog");
  }

  const testId = await labRepository.createLabTest(user.hospitalId, data);
  const test = await labRepository.findLabTestById(testId, user.hospitalId);

  if (context) {
    await auditService.recordAuditEvent({
      user,
      action: "lab.test.create",
      entityType: "lab_test",
      entityId: testId,
      metadata: { testName: data.testName, price: data.price },
      context
    });
  }

  return test;
}

async function listLabOrders(user, filters, context) {
  let patientId = filters.patientId ? Number(filters.patientId) : undefined;
  let doctorId = filters.doctorId ? Number(filters.doctorId) : undefined;

  if (user.role === "patient") {
    const patient = await patientRepository.findPatientByUserId(user.id, user.hospitalId);
    if (!patient) {
      throw new AppError(404, "Patient profile not found");
    }
    patientId = patient.id;
  } else if (user.role === "doctor") {
    const doctor = await doctorRepository.findDoctorByUserId(user.id, user.hospitalId);
    if (doctor) {
      doctorId = doctor.id;
    }
  }

  const orders = await labRepository.listLabOrders(user.hospitalId, {
    patientId,
    doctorId,
    status: filters.status
  });

  if (context) {
    await auditService.recordAuditEvent({
      user,
      action: "lab.orders.list",
      entityType: "lab_order",
      entityId: "hospital",
      metadata: { count: orders.length, role: user.role },
      context
    });
  }

  return orders;
}

async function createLabOrder(user, data, context) {
  if (!hasPermission(user, "manage_lab_orders")) {
    throw new AppError(403, "Forbidden: Only doctors or lab admins can order lab tests");
  }

  let doctorId = data.doctorId || data.doctor_id;
  if (user.role === "doctor") {
    const doctor = await doctorRepository.findDoctorByUserId(user.id, user.hospitalId);
    if (!doctor) {
      throw new AppError(404, "Doctor profile not found");
    }
    doctorId = doctor.id;
  }

  if (!doctorId) {
    throw new AppError(400, "Doctor ID is required to place a lab order");
  }

  const payload = {
    patientId: data.patientId || data.patient_id,
    doctorId,
    testId: data.testId || data.test_id,
    orderStatus: "ORDERED"
  };

  const orderId = await labRepository.createLabOrder(user.hospitalId, payload);
  const order = await labRepository.findLabOrderById(orderId, user.hospitalId);

  if (context) {
    await auditService.recordAuditEvent({
      user,
      action: "lab.order.create",
      entityType: "lab_order",
      entityId: orderId,
      metadata: { patientId: payload.patientId, testId: payload.testId },
      context
    });
  }

  return order;
}

async function updateLabOrderStatus(user, id, status, context) {
  if (!hasPermission(user, "manage_lab_results", "manage_lab_orders")) {
    throw new AppError(403, "Forbidden: Only lab staff or admins can update order status");
  }

  const existing = await labRepository.findLabOrderById(id, user.hospitalId);
  if (!existing) {
    throw new AppError(404, "Lab order not found");
  }

  await labRepository.updateLabOrderStatus(id, user.hospitalId, status);
  const updated = await labRepository.findLabOrderById(id, user.hospitalId);

  if (context) {
    await auditService.recordAuditEvent({
      user,
      action: "lab.order.status_update",
      entityType: "lab_order",
      entityId: id,
      metadata: { oldStatus: existing.orderStatus, newStatus: status },
      context
    });
  }

  return updated;
}

async function createLabReport(user, data, context) {
  if (!hasPermission(user, "manage_lab_results")) {
    throw new AppError(403, "Forbidden: Only lab staff or admins can upload reports");
  }

  const order = await labRepository.findLabOrderById(data.labOrderId || data.lab_order_id, user.hospitalId);
  if (!order) {
    throw new AppError(404, "Lab order not found");
  }

  const payload = {
    labOrderId: data.labOrderId || data.lab_order_id,
    patientId: order.patientId,
    reportFileUrl: data.reportFileUrl || data.report_file_url,
    reportNotes: data.reportNotes || data.report_notes || null,
    uploadedBy: user.id
  };

  const reportId = await labRepository.createLabReport(user.hospitalId, payload);

  // Automatically mark the lab order status as COMPLETED when report is uploaded
  await labRepository.updateLabOrderStatus(payload.labOrderId, user.hospitalId, "COMPLETED");

  if (context) {
    await auditService.recordAuditEvent({
      user,
      action: "lab.report.upload",
      entityType: "lab_report",
      entityId: reportId,
      metadata: { labOrderId: payload.labOrderId, patientId: payload.patientId },
      context
    });
  }

  return reportId;
}

async function listLabReports(user, patientId, context) {
  let filteredPatientId = patientId ? Number(patientId) : undefined;

  if (user.role === "patient") {
    const patient = await patientRepository.findPatientByUserId(user.id, user.hospitalId);
    if (!patient) {
      throw new AppError(404, "Patient profile not found");
    }
    filteredPatientId = patient.id;
  }

  const reports = await labRepository.listLabReports(user.hospitalId, {
    patientId: filteredPatientId
  });

  if (context) {
    await auditService.recordAuditEvent({
      user,
      action: "lab.reports.list",
      entityType: "lab_report",
      entityId: "hospital",
      metadata: { count: reports.length, patientIdFiltered: !!filteredPatientId },
      context
    });
  }

  return reports;
}

async function getRevenueByTestType(user, context) {
  if (!hasPermission(user, "view_analytics")) {
    throw new AppError(403, "Forbidden: Only admins can view lab revenue statistics");
  }

  const data = await labRepository.getRevenueByTestType(user.hospitalId);

  if (context) {
    await auditService.recordAuditEvent({
      user,
      action: "lab.reports.revenue",
      entityType: "lab_test",
      entityId: "hospital",
      metadata: { categories: data.length },
      context
    });
  }

  return data;
}

async function getLabReportFile(user, reportId) {
  const report = await labRepository.findLabReportById(reportId, user.hospitalId);
  if (!report) {
    throw new AppError(404, "Lab report not found");
  }

  if (user.role === "patient") {
    const patient = await patientRepository.findPatientByUserId(user.id, user.hospitalId);
    if (!patient || patient.id !== report.patientId) {
      throw new AppError(403, "Forbidden: You do not have access to this report");
    }
  }

  return report;
}

module.exports = {
  listLabTests,
  createLabTest,
  listLabOrders,
  createLabOrder,
  updateLabOrderStatus,
  createLabReport,
  listLabReports,
  getRevenueByTestType,
  getLabReportFile
};

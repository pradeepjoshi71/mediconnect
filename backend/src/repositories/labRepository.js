const db = require("../config/db");

async function listLabTests(hospitalId) {
  // hospitalId is null when caller is super_admin (cross-tenant listing)
  const result = await db.query(
    `SELECT id, test_code AS "testCode", test_name AS "testName", category, price, description, status
     FROM lab_tests
     ${hospitalId ? "WHERE hospital_id = $1" : ""}
     ORDER BY category ASC, test_name ASC`,
    hospitalId ? [hospitalId] : []
  );
  return result.rows;
}

async function findLabTestById(id, hospitalId) {
  const result = await db.query(
    `SELECT id, test_code AS "testCode", test_name AS "testName", category, price, description, status
     FROM lab_tests
     WHERE id = $1 AND hospital_id = $2`,
    [id, hospitalId]
  );
  return result.rows[0] || null;
}

async function createLabTest(hospitalId, data) {
  const result = await db.query(
    `INSERT INTO lab_tests (hospital_id, test_code, test_name, category, price, description, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      hospitalId,
      data.testCode || data.test_code,
      data.testName || data.test_name,
      data.category,
      data.price,
      data.description || null,
      data.status || 'active'
    ]
  );
  return result.rows[0].id;
}

async function listLabOrders(hospitalId, filters = {}) {
  // hospitalId is null when caller is super_admin (cross-tenant listing)
  const params = hospitalId ? [hospitalId] : [];
  const conditions = hospitalId ? ["lo.hospital_id = $1"] : [];

  if (filters.patientId) {
    params.push(filters.patientId);
    conditions.push(`lo.patient_id = $${params.length}`);
  }

  if (filters.doctorId) {
    params.push(filters.doctorId);
    conditions.push(`lo.doctor_id = $${params.length}`);
  }

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`lo.order_status = $${params.length}`);
  }

  const query = `
    SELECT 
      lo.id,
      lo.patient_id AS "patientId",
      lo.doctor_id AS "doctorId",
      lo.test_id AS "testId",
      lo.order_status AS "orderStatus",
      lo.ordered_at AS "orderedAt",
      pu.full_name AS "patientName",
      pat.medical_record_number AS "patientMRN",
      du.full_name AS "doctorName",
      lt.test_name AS "testName",
      lt.test_code AS "testCode",
      lt.category AS "testCategory",
      lt.price AS "testPrice"
    FROM lab_orders lo
    JOIN patients pat ON pat.id = lo.patient_id
    JOIN users pu ON pu.id = pat.user_id
    JOIN doctors doc ON doc.id = lo.doctor_id
    JOIN users du ON du.id = doc.user_id
    JOIN lab_tests lt ON lt.id = lo.test_id
    ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
    ORDER BY lo.ordered_at DESC
  `;

  const result = await db.query(query, params);
  return result.rows;
}

async function findLabOrderById(id, hospitalId) {
  const result = await db.query(
    `SELECT 
      lo.id,
      lo.patient_id AS "patientId",
      lo.doctor_id AS "doctorId",
      lo.test_id AS "testId",
      lo.order_status AS "orderStatus",
      lo.ordered_at AS "orderedAt",
      pu.full_name AS "patientName",
      pat.medical_record_number AS "patientMRN",
      du.full_name AS "doctorName",
      lt.test_name AS "testName",
      lt.test_code AS "testCode",
      lt.category AS "testCategory"
     FROM lab_orders lo
     JOIN patients pat ON pat.id = lo.patient_id
     JOIN users pu ON pu.id = pat.user_id
     JOIN doctors doc ON doc.id = lo.doctor_id
     JOIN users du ON du.id = doc.user_id
     JOIN lab_tests lt ON lt.id = lo.test_id
     WHERE lo.id = $1 AND lo.hospital_id = $2`,
    [id, hospitalId]
  );
  return result.rows[0] || null;
}

async function createLabOrder(hospitalId, data) {
  const result = await db.query(
    `INSERT INTO lab_orders (hospital_id, patient_id, doctor_id, test_id, order_status, ordered_at)
     VALUES ($1, $2, $3, $4, $5, now())
     RETURNING id`,
    [
      hospitalId,
      data.patientId || data.patient_id,
      data.doctorId || data.doctor_id,
      data.testId || data.test_id,
      data.orderStatus || data.order_status || 'ORDERED'
    ]
  );
  return result.rows[0].id;
}

async function updateLabOrderStatus(id, hospitalId, status) {
  const result = await db.query(
    `UPDATE lab_orders
     SET order_status = $1, updated_at = now()
     WHERE id = $2 AND hospital_id = $3
     RETURNING id`,
    [status, id, hospitalId]
  );
  return result.rows[0] ? result.rows[0].id : null;
}

async function createLabReport(hospitalId, data) {
  const result = await db.query(
    `INSERT INTO lab_reports (hospital_id, lab_order_id, patient_id, report_file_url, report_notes, uploaded_by, uploaded_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     RETURNING id`,
    [
      hospitalId,
      data.labOrderId || data.lab_order_id,
      data.patientId || data.patient_id,
      data.reportFileUrl || data.report_file_url,
      data.reportNotes || data.report_notes || null,
      data.uploadedBy || data.uploaded_by
    ]
  );
  return result.rows[0].id;
}

async function listLabReports(hospitalId, filters = {}) {
  // hospitalId is null when caller is super_admin (cross-tenant listing)
  const params = hospitalId ? [hospitalId] : [];
  const conditions = hospitalId ? ["lr.hospital_id = $1"] : [];

  if (filters.patientId) {
    params.push(filters.patientId);
    conditions.push(`lr.patient_id = $${params.length}`);
  }

  const query = `
    SELECT 
      lr.id,
      lr.lab_order_id AS "labOrderId",
      lr.patient_id AS "patientId",
      lr.report_file_url AS "reportFileUrl",
      lr.report_notes AS "reportNotes",
      lr.uploaded_by AS "uploadedBy",
      lr.uploaded_at AS "uploadedAt",
      pu.full_name AS "patientName",
      pat.medical_record_number AS "patientMRN",
      uu.full_name AS "uploaderName",
      lt.test_name AS "testName",
      lt.test_code AS "testCode",
      lt.category AS "testCategory"
    FROM lab_reports lr
    JOIN patients pat ON pat.id = lr.patient_id
    JOIN users pu ON pu.id = pat.user_id
    LEFT JOIN users uu ON uu.id = lr.uploaded_by
    JOIN lab_orders lo ON lo.id = lr.lab_order_id
    JOIN lab_tests lt ON lt.id = lo.test_id
    WHERE ${conditions.length ? conditions.join(" AND ") : "1=1"}
    ORDER BY lr.uploaded_at DESC
  `;

  const result = await db.query(query, params);
  return result.rows;
}

async function findLabReportById(id, hospitalId) {
  const result = await db.query(
    `SELECT id, lab_order_id AS "labOrderId", patient_id AS "patientId", report_file_url AS "reportFileUrl"
     FROM lab_reports
     WHERE id = $1 AND hospital_id = $2`,
    [id, hospitalId]
  );
  return result.rows[0] || null;
}

async function getRevenueByTestType(hospitalId) {
  // hospitalId is null when caller is super_admin (cross-tenant aggregate)
  const result = await db.query(
    `SELECT 
      lt.category AS "testCategory",
      COALESCE(SUM(lt.price), 0.00) AS "totalRevenue",
      COUNT(lo.id)::integer AS "ordersCount"
     FROM lab_orders lo
     JOIN lab_tests lt ON lt.id = lo.test_id
     ${hospitalId ? "WHERE lo.hospital_id = $1 AND lo.order_status = 'COMPLETED'" : "WHERE lo.order_status = 'COMPLETED'"}
     GROUP BY lt.category
     ORDER BY "totalRevenue" DESC`,
    hospitalId ? [hospitalId] : []
  );
  return result.rows;
}

module.exports = {
  listLabTests,
  findLabTestById,
  createLabTest,
  listLabOrders,
  findLabOrderById,
  createLabOrder,
  updateLabOrderStatus,
  createLabReport,
  listLabReports,
  findLabReportById,
  getRevenueByTestType
};

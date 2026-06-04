const db = require("../config/db");

async function listMedicines(hospitalId, filters = {}) {
  const params = [hospitalId];
  const conditions = ["hospital_id = $1"];

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`status = $${params.length}`);
  }

  if (filters.alert === "low_stock") {
    conditions.push("stock_quantity <= reorder_level");
  } else if (filters.alert === "expiring") {
    // Expiring within 30 days
    conditions.push("expiry_date <= now() + interval '30 days' AND expiry_date >= now() - interval '1 day'");
  }

  if (filters.search) {
    params.push(`%${filters.search}%`);
    conditions.push(
      `(medicine_name ILIKE $${params.length} OR generic_name ILIKE $${params.length} OR medicine_code ILIKE $${params.length})`
    );
  }

  const query = `
    SELECT 
      id,
      hospital_id AS "hospitalId",
      medicine_code AS "medicineCode",
      medicine_name AS "medicineName",
      generic_name AS "genericName",
      manufacturer,
      batch_number AS "batchNumber",
      expiry_date AS "expiryDate",
      unit_price AS "unitPrice",
      stock_quantity AS "stockQuantity",
      reorder_level AS "reorderLevel",
      status,
      created_at AS "createdAt"
    FROM medicines
    WHERE ${conditions.join(" AND ")}
    ORDER BY medicine_name ASC
  `;

  const result = await db.query(query, params);
  return result.rows;
}

async function findMedicineById(id, hospitalId) {
  const result = await db.query(
    `SELECT 
      id,
      hospital_id AS "hospitalId",
      medicine_code AS "medicineCode",
      medicine_name AS "medicineName",
      generic_name AS "genericName",
      manufacturer,
      batch_number AS "batchNumber",
      expiry_date AS "expiryDate",
      unit_price AS "unitPrice",
      stock_quantity AS "stockQuantity",
      reorder_level AS "reorderLevel",
      status,
      created_at AS "createdAt"
     FROM medicines
     WHERE id = $1 AND hospital_id = $2`,
    [id, hospitalId]
  );
  return result.rows[0] || null;
}

async function findMedicineByCode(code, hospitalId) {
  const result = await db.query(
    `SELECT id, medicine_code AS "medicineCode" FROM medicines WHERE medicine_code = $1 AND hospital_id = $2`,
    [code, hospitalId]
  );
  return result.rows[0] || null;
}

async function createMedicine(hospitalId, data) {
  const result = await db.query(
    `INSERT INTO medicines (
      hospital_id, medicine_code, medicine_name, generic_name, manufacturer, 
      batch_number, expiry_date, unit_price, stock_quantity, reorder_level, status
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      hospitalId,
      data.medicineCode || data.medicine_code,
      data.medicineName || data.medicine_name,
      data.genericName || data.generic_name || null,
      data.manufacturer || null,
      data.batchNumber || data.batch_number || null,
      data.expiryDate || data.expiry_date,
      data.unitPrice || data.unit_price || 0.00,
      data.stockQuantity || data.stock_quantity || 0,
      data.reorderLevel || data.reorder_level || 0,
      data.status || 'ACTIVE'
    ]
  );
  return result.rows[0].id;
}

async function updateMedicine(id, hospitalId, data) {
  const result = await db.query(
    `UPDATE medicines
     SET 
       medicine_code = COALESCE($1, medicine_code),
       medicine_name = COALESCE($2, medicine_name),
       generic_name = COALESCE($3, generic_name),
       manufacturer = COALESCE($4, manufacturer),
       batch_number = COALESCE($5, batch_number),
       expiry_date = COALESCE($6, expiry_date),
       unit_price = COALESCE($7, unit_price),
       stock_quantity = COALESCE($8, stock_quantity),
       reorder_level = COALESCE($9, reorder_level),
       status = COALESCE($10, status),
       updated_at = now()
     WHERE id = $11 AND hospital_id = $12
     RETURNING id`,
    [
      data.medicineCode || data.medicine_code || null,
      data.medicineName || data.medicine_name || null,
      data.genericName || data.generic_name || null,
      data.manufacturer || null,
      data.batchNumber || data.batch_number || null,
      data.expiryDate || data.expiry_date || null,
      data.unitPrice || data.unit_price || null,
      data.stockQuantity !== undefined ? data.stockQuantity : (data.stock_quantity !== undefined ? data.stock_quantity : null),
      data.reorderLevel !== undefined ? data.reorderLevel : (data.reorder_level !== undefined ? data.reorder_level : null),
      data.status || null,
      id,
      hospitalId
    ]
  );
  return result.rows[0] ? result.rows[0].id : null;
}

async function updateStock(id, hospitalId, quantity) {
  const result = await db.query(
    `UPDATE medicines
     SET stock_quantity = $1, updated_at = now()
     WHERE id = $2 AND hospital_id = $3
     RETURNING id`,
    [quantity, id, hospitalId]
  );
  return result.rows[0] ? result.rows[0].id : null;
}

async function listDispensedMedications(hospitalId, filters = {}) {
  const params = [hospitalId];
  const conditions = ["dm.hospital_id = $1"];

  if (filters.patientId) {
    params.push(filters.patientId);
    conditions.push(`dm.patient_id = $${params.length}`);
  }

  if (filters.pharmacistId) {
    params.push(filters.pharmacistId);
    conditions.push(`dm.pharmacist_id = $${params.length}`);
  }

  const query = `
    SELECT 
      dm.id,
      dm.prescription_id AS "prescriptionId",
      dm.patient_id AS "patientId",
      dm.pharmacist_id AS "pharmacistId",
      dm.medicine_id AS "medicineId",
      dm.quantity,
      dm.dispensed_at AS "dispensedAt",
      pu.full_name AS "patientName",
      pat.medical_record_number AS "patientMRN",
      phu.full_name AS "pharmacistName",
      m.medicine_name AS "medicineName",
      m.medicine_code AS "medicineCode",
      m.generic_name AS "genericName",
      m.unit_price AS "unitPrice"
    FROM dispensed_medications dm
    JOIN patients pat ON pat.id = dm.patient_id
    JOIN users pu ON pu.id = pat.user_id
    JOIN users phu ON phu.id = dm.pharmacist_id
    JOIN medicines m ON m.id = dm.medicine_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY dm.dispensed_at DESC
  `;

  const result = await db.query(query, params);
  return result.rows;
}

async function listPrescriptions(hospitalId, filters = {}) {
  const params = [hospitalId];
  const conditions = ["p.hospital_id = $1"];

  if (filters.patientId) {
    params.push(filters.patientId);
    conditions.push(`p.patient_id = $${params.length}`);
  }

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`p.status = $${params.length}`);
  }

  const query = `
    SELECT 
      p.id,
      p.medical_record_id AS "medicalRecordId",
      p.appointment_id AS "appointmentId",
      p.patient_id AS "patientId",
      p.doctor_id AS "doctorId",
      p.medication_name AS "medicationName",
      p.dosage,
      p.frequency,
      p.duration_days AS "durationDays",
      p.instructions,
      p.status,
      p.created_at AS "createdAt",
      pu.full_name AS "patientName",
      pat.medical_record_number AS "patientMRN",
      du.full_name AS "doctorName",
      d.specialization AS "doctorSpecialization"
    FROM prescriptions p
    JOIN patients pat ON pat.id = p.patient_id
    JOIN users pu ON pu.id = pat.user_id
    JOIN doctors d ON d.id = p.doctor_id
    JOIN users du ON du.id = d.user_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY p.created_at DESC
  `;

  const result = await db.query(query, params);
  return result.rows;
}

async function findPrescriptionById(id, hospitalId) {
  const result = await db.query(
    `SELECT 
      id,
      medical_record_id AS "medicalRecordId",
      appointment_id AS "appointmentId",
      patient_id AS "patientId",
      doctor_id AS "doctorId",
      medication_name AS "medicationName",
      dosage,
      frequency,
      duration_days AS "durationDays",
      instructions,
      status,
      created_at AS "createdAt"
     FROM prescriptions 
     WHERE id = $1 AND hospital_id = $2`,
    [id, hospitalId]
  );
  return result.rows[0] || null;
}

module.exports = {
  listMedicines,
  findMedicineById,
  findMedicineByCode,
  createMedicine,
  updateMedicine,
  updateStock,
  listDispensedMedications,
  listPrescriptions,
  findPrescriptionById
};

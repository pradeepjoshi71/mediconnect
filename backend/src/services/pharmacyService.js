const db = require("../config/db");
const medicineRepository = require("../repositories/medicineRepository");
const patientRepository = require("../repositories/patientRepository");
const auditService = require("./auditService");
const { AppError } = require("../utils/http");

async function listPrescriptions(user, filters) {
  let patientId = filters.patientId ? Number(filters.patientId) : undefined;

  if (user.role === "patient") {
    const patient = await patientRepository.findPatientByUserId(user.id, user.hospitalId);
    if (!patient) {
      throw new AppError(404, "Patient profile not found");
    }
    patientId = patient.id;
  }

  return medicineRepository.listPrescriptions(user.hospitalId, {
    patientId,
    status: filters.status
  });
}

async function listDispensed(user, filters) {
  let patientId = filters.patientId ? Number(filters.patientId) : undefined;

  if (user.role === "patient") {
    const patient = await patientRepository.findPatientByUserId(user.id, user.hospitalId);
    if (!patient) {
      throw new AppError(404, "Patient profile not found");
    }
    patientId = patient.id;
  }

  return medicineRepository.listDispensedMedications(user.hospitalId, {
    patientId,
    pharmacistId: filters.pharmacistId
  });
}

async function dispenseMedicine(user, data, context) {
  if (user.role !== "pharmacist" && !["super_admin", "hospital_admin", "admin"].includes(user.role)) {
    throw new AppError(403, "Forbidden: Only pharmacists and admins can dispense medicines");
  }

  const { prescriptionId, medicineId, quantity } = data;
  if (!prescriptionId || !medicineId || !quantity || Number(quantity) <= 0) {
    throw new AppError(400, "Prescription ID, Medicine ID, and positive quantity are required");
  }

  return db.withTransaction(async (client) => {
    // 1. Check prescription status
    const prescriptionResult = await client.query(
      `SELECT id, patient_id, status FROM prescriptions WHERE id = $1 AND hospital_id = $2`,
      [prescriptionId, user.hospitalId]
    );
    const prescription = prescriptionResult.rows[0];
    if (!prescription) {
      throw new AppError(404, "Prescription not found");
    }
    if (prescription.status !== "active") {
      throw new AppError(400, `Prescription is already ${prescription.status}`);
    }

    // 2. Check medicine stock and status
    const medicineResult = await client.query(
      `SELECT id, medicine_name, medicine_code, stock_quantity, status FROM medicines WHERE id = $1 AND hospital_id = $2 FOR UPDATE`,
      [medicineId, user.hospitalId]
    );
    const medicine = medicineResult.rows[0];
    if (!medicine) {
      throw new AppError(404, "Medicine not found in inventory");
    }
    if (medicine.status !== "ACTIVE") {
      throw new AppError(400, "Medicine is inactive");
    }
    if (Number(medicine.stock_quantity) < Number(quantity)) {
      throw new AppError(400, `Insufficient stock. Available: ${medicine.stock_quantity}, Requested: ${quantity}`);
    }

    // 3. Deduct stock quantity
    await client.query(
      `UPDATE medicines SET stock_quantity = stock_quantity - $1, updated_at = now() WHERE id = $2`,
      [quantity, medicineId]
    );

    // 4. Update prescription status
    await client.query(
      `UPDATE prescriptions SET status = 'completed' WHERE id = $1`,
      [prescriptionId]
    );

    // 5. Create dispensed record
    const dispensedResult = await client.query(
      `INSERT INTO dispensed_medications (hospital_id, prescription_id, patient_id, pharmacist_id, medicine_id, quantity, dispensed_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       RETURNING id, quantity, dispensed_at AS "dispensedAt"`,
      [user.hospitalId, prescriptionId, prescription.patient_id, user.id, medicineId, quantity]
    );

    const record = dispensedResult.rows[0];

    // 6. Audit logging
    if (context) {
      await auditService.recordAuditEvent({
        user,
        action: "pharmacy.dispense",
        entityType: "dispensed_medication",
        entityId: record.id,
        metadata: {
          prescriptionId,
          patientId: prescription.patient_id,
          medicineCode: medicine.medicine_code,
          medicineName: medicine.medicine_name,
          quantity
        },
        context
      });
    }

    return record;
  });
}

async function downloadMedicationHistoryCsv(user, patientIdFilter) {
  let patientId = patientIdFilter ? Number(patientIdFilter) : undefined;

  if (user.role === "patient") {
    const patient = await patientRepository.findPatientByUserId(user.id, user.hospitalId);
    if (!patient) {
      throw new AppError(404, "Patient profile not found");
    }
    patientId = patient.id;
  }

  const list = await medicineRepository.listDispensedMedications(user.hospitalId, {
    patientId
  });

  const csvRows = [];
  // Headers
  csvRows.push("Dispensed At,Medicine Code,Medicine Name,Generic Name,Quantity,Unit Price ($),Total Price ($),Pharmacist,Patient Name,Patient MRN");

  for (const item of list) {
    const total = (Number(item.quantity) * Number(item.unitPrice)).toFixed(2);
    const row = [
      `"${new Date(item.dispensedAt).toISOString()}"`,
      `"${item.medicineCode}"`,
      `"${item.medicineName.replace(/"/g, '""')}"`,
      `"${(item.genericName || '').replace(/"/g, '""')}"`,
      item.quantity,
      item.unitPrice,
      total,
      `"${item.pharmacistName.replace(/"/g, '""')}"`,
      `"${item.patientName.replace(/"/g, '""')}"`,
      `"${item.patientMRN}"`
    ];
    csvRows.push(row.join(","));
  }

  return csvRows.join("\n");
}

module.exports = {
  listPrescriptions,
  listDispensed,
  dispenseMedicine,
  downloadMedicationHistoryCsv
};

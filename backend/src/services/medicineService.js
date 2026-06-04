const medicineRepository = require("../repositories/medicineRepository");
const auditService = require("./auditService");
const { AppError } = require("../utils/http");

async function listMedicines(user, filters) {
  // Patients can only view active medicines
  if (user.role === "patient") {
    filters.status = "ACTIVE";
  }
  return medicineRepository.listMedicines(user.hospitalId, filters);
}

async function createMedicine(user, data, context) {
  if (user.role !== "pharmacist" && !["super_admin", "hospital_admin", "admin"].includes(user.role)) {
    throw new AppError(403, "Forbidden: Only pharmacists and admins can manage medicines");
  }

  // Check if medicine code is already in use
  const existing = await medicineRepository.findMedicineByCode(data.medicineCode || data.medicine_code, user.hospitalId);
  if (existing) {
    throw new AppError(400, "Medicine code is already in use");
  }

  const medicineId = await medicineRepository.createMedicine(user.hospitalId, data);
  const medicine = await medicineRepository.findMedicineById(medicineId, user.hospitalId);

  if (context) {
    await auditService.recordAuditEvent({
      user,
      action: "pharmacy.medicine.create",
      entityType: "medicine",
      entityId: medicineId,
      metadata: { medicineName: medicine.medicineName, medicineCode: medicine.medicineCode },
      context
    });
  }

  return medicine;
}

async function updateMedicine(user, id, data, context) {
  if (user.role !== "pharmacist" && !["super_admin", "hospital_admin", "admin"].includes(user.role)) {
    throw new AppError(403, "Forbidden: Only pharmacists and admins can manage medicines");
  }

  const existing = await medicineRepository.findMedicineById(id, user.hospitalId);
  if (!existing) {
    throw new AppError(404, "Medicine not found");
  }

  // If changing code, check for conflicts
  const newCode = data.medicineCode || data.medicine_code;
  if (newCode && newCode !== existing.medicineCode) {
    const conflict = await medicineRepository.findMedicineByCode(newCode, user.hospitalId);
    if (conflict) {
      throw new AppError(400, "Medicine code is already in use");
    }
  }

  await medicineRepository.updateMedicine(id, user.hospitalId, data);
  const updated = await medicineRepository.findMedicineById(id, user.hospitalId);

  if (context) {
    await auditService.recordAuditEvent({
      user,
      action: "pharmacy.medicine.update",
      entityType: "medicine",
      entityId: id,
      metadata: { medicineName: updated.medicineName },
      context
    });
  }

  return updated;
}

async function updateStock(user, id, stockQuantity, context) {
  if (user.role !== "pharmacist" && !["super_admin", "hospital_admin", "admin"].includes(user.role)) {
    throw new AppError(403, "Forbidden: Only pharmacists and admins can update stock");
  }

  const existing = await medicineRepository.findMedicineById(id, user.hospitalId);
  if (!existing) {
    throw new AppError(404, "Medicine not found");
  }

  await medicineRepository.updateStock(id, user.hospitalId, stockQuantity);
  const updated = await medicineRepository.findMedicineById(id, user.hospitalId);

  if (context) {
    await auditService.recordAuditEvent({
      user,
      action: "pharmacy.medicine.stock_update",
      entityType: "medicine",
      entityId: id,
      metadata: { oldStock: existing.stockQuantity, newStock: updated.stockQuantity },
      context
    });
  }

  return updated;
}

module.exports = {
  listMedicines,
  createMedicine,
  updateMedicine,
  updateStock
};

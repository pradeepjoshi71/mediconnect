const { z } = require("zod");
const pharmacyService = require("../services/pharmacyService");
const { asyncHandler } = require("../middlewares/asyncHandler");

const dispenseSchema = z.object({
  prescriptionId: z.coerce.number().int().positive(),
  medicineId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive()
});

const listPrescriptions = asyncHandler(async (req, res) => {
  const filters = {
    status: req.query.status,
    patientId: req.query.patientId
  };
  const list = await pharmacyService.listPrescriptions(req.user, filters);
  res.json(list);
});

const listDispensed = asyncHandler(async (req, res) => {
  const filters = {
    patientId: req.query.patientId,
    pharmacistId: req.query.pharmacistId
  };
  const list = await pharmacyService.listDispensed(req.user, filters);
  res.json(list);
});

const dispenseMedicine = asyncHandler(async (req, res) => {
  const payload = dispenseSchema.parse(req.body);
  const result = await pharmacyService.dispenseMedicine(req.user, payload, req.auditContext);
  res.status(201).json(result);
});

const downloadMedicationHistory = asyncHandler(async (req, res) => {
  const csvData = await pharmacyService.downloadMedicationHistoryCsv(req.user, req.query.patientId);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="medication-history.csv"');
  res.send(csvData);
});

module.exports = {
  listPrescriptions,
  listDispensed,
  dispenseMedicine,
  downloadMedicationHistory
};

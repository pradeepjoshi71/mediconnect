const express = require("express");
const medicineController = require("../controllers/medicineController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

const allRoles = ["patient", "doctor", "pharmacist", "admin", "super_admin", "hospital_admin", "receptionist"];
const manageRoles = ["pharmacist", "admin", "super_admin", "hospital_admin"];

router.get(
  "/",
  authMiddleware,
  roleMiddleware(...allRoles),
  medicineController.listMedicines
);

router.post(
  "/",
  authMiddleware,
  roleMiddleware(...manageRoles),
  medicineController.createMedicine
);

router.put(
  "/:id",
  authMiddleware,
  roleMiddleware(...manageRoles),
  medicineController.updateMedicine
);

router.patch(
  "/:id/stock",
  authMiddleware,
  roleMiddleware(...manageRoles),
  medicineController.updateStock
);

module.exports = router;

const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");
const inventoryController = require("../controllers/inventoryController");

// Restrict all inventory operational routes to admin roles
router.use(authMiddleware);
router.use(roleMiddleware("admin", "hospital_admin", "super_admin"));

router.get("/items", inventoryController.listItems);
router.post("/items", inventoryController.createItem);
router.get("/items/:id", inventoryController.getItem);
router.put("/items/:id", inventoryController.updateItem);
router.delete("/items/:id", inventoryController.deleteItem);
router.post("/transactions", inventoryController.createTransaction);
router.get("/reports", inventoryController.getReports);

module.exports = router;

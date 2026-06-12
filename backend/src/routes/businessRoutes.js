const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");
const businessController = require("../controllers/businessController");

// Restrict all business management routes to admin roles
router.use(authMiddleware);
router.use(roleMiddleware("admin", "hospital_admin", "super_admin"));

router.get("/revenue", businessController.getRevenueDashboard);
router.get("/expenses", businessController.listExpenses);
router.get("/expenses/:id", businessController.getExpense);
router.post("/expenses", businessController.createExpense);
router.put("/expenses/:id", businessController.updateExpense);
router.delete("/expenses/:id", businessController.deleteExpense);
router.get("/profit-loss", businessController.getProfitLoss);

module.exports = router;

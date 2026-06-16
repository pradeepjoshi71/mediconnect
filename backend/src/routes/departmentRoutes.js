const express = require("express");
const ctrl = require("../controllers/departmentController");
const authMiddleware = require("../middlewares/authMiddleware");
const permissionMiddleware = require("../middlewares/permissionMiddleware");

const router = express.Router();

// GET /departments/analytics — MUST be registered before /:id to avoid collisions
router.get(
  "/analytics",
  authMiddleware,
  permissionMiddleware("department.read"),
  ctrl.getDepartmentAnalytics
);

// GET /departments
router.get(
  "/",
  authMiddleware,
  permissionMiddleware("department.read"),
  ctrl.listDepartments
);

// GET /departments/:id
router.get(
  "/:id",
  authMiddleware,
  permissionMiddleware("department.read"),
  ctrl.getDepartmentById
);

// POST /departments
router.post(
  "/",
  authMiddleware,
  permissionMiddleware("department.create"),
  ctrl.createDepartment
);

// PUT /departments/:id
router.put(
  "/:id",
  authMiddleware,
  permissionMiddleware("department.update"),
  ctrl.updateDepartment
);

// DELETE /departments/:id
router.delete(
  "/:id",
  authMiddleware,
  permissionMiddleware("department.update"),
  ctrl.deleteDepartment
);

// GET /departments/:id/members
router.get(
  "/:id/members",
  authMiddleware,
  permissionMiddleware("department.read"),
  ctrl.listDepartmentMembers
);

// POST /departments/:id/members
router.post(
  "/:id/members",
  authMiddleware,
  permissionMiddleware("department.assign"),
  ctrl.addDepartmentMember
);

// DELETE /departments/:id/members/:userId
router.delete(
  "/:id/members/:userId",
  authMiddleware,
  permissionMiddleware("department.assign"),
  ctrl.removeDepartmentMember
);

module.exports = router;

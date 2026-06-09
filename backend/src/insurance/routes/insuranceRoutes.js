const express = require("express");
const multer = require("multer");
const ctrl = require("../controller/insuranceController");
const authMiddleware = require("../../middlewares/authMiddleware");
const roleMiddleware = require("../../middlewares/roleMiddleware");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: parseInt(process.env.MAX_UPLOAD_BYTES || "12582912", 10) }
});

const ALL_ROLES = ["super_admin", "hospital_admin", "admin", "billing_executive", "receptionist", "doctor", "patient", "insurance_coordinator"];
const ADMIN_COORDINATOR = ["super_admin", "hospital_admin", "admin", "insurance_coordinator"];
const POLICY_WRITERS = ["super_admin", "hospital_admin", "admin", "receptionist"];
const CLAIM_SUBMITTERS = ["super_admin", "hospital_admin", "admin", "receptionist", "billing_executive"];
const SETTLE_ROLES = ["super_admin", "hospital_admin", "admin", "billing_executive"];
const DOC_UPLOADERS = ["super_admin", "hospital_admin", "admin", "receptionist", "billing_executive", "doctor"];

/**
 * @swagger
 * tags:
 *   - name: Insurance Claims
 *     description: Insurance Providers, Policies, and Claims Management
 */

// --- Providers ---

/**
 * @swagger
 * /api/v1/insurance/providers:
 *   get:
 *     tags: [Insurance Claims]
 *     summary: List insurance providers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *         description: Filter by active status
 *     responses:
 *       200: { description: List of providers }
 *   post:
 *     tags: [Insurance Claims]
 *     summary: Create insurance provider
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, code]
 *             properties:
 *               name: { type: string, example: "Star Health Insurance" }
 *               code: { type: string, example: "STAR-HEALTH" }
 *               contactEmail: { type: string, example: "claims@starhealth.in" }
 *               contactPhone: { type: string, example: "+91-80-12345678" }
 *               portalUrl: { type: string, example: "https://portal.starhealth.in" }
 *               thaRate: { type: number, example: 90.00 }
 *               isActive: { type: boolean, default: true }
 *     responses:
 *       211: { description: Created }
 */
router.get("/providers", authMiddleware, roleMiddleware(...ALL_ROLES), ctrl.listProvidersHandler);
router.post("/providers", authMiddleware, roleMiddleware("super_admin", "hospital_admin"), ctrl.createProviderHandler);

/**
 * @swagger
 * /api/v1/insurance/providers/{id}:
 *   get:
 *     tags: [Insurance Claims]
 *     summary: Get insurance provider details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Provider details }
 *   put:
 *     tags: [Insurance Claims]
 *     summary: Update insurance provider
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200: { description: Updated }
 *   delete:
 *     tags: [Insurance Claims]
 *     summary: Deactivate (soft-delete) insurance provider
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Deactivated }
 */
router.get("/providers/:id", authMiddleware, roleMiddleware(...ALL_ROLES), ctrl.getProviderHandler);
router.put("/providers/:id", authMiddleware, roleMiddleware("super_admin", "hospital_admin"), ctrl.updateProviderHandler);
router.delete("/providers/:id", authMiddleware, roleMiddleware("super_admin", "hospital_admin"), ctrl.deleteProviderHandler);

// --- Policies ---

/**
 * @swagger
 * /api/v1/insurance/policies:
 *   get:
 *     tags: [Insurance Claims]
 *     summary: List insurance policies
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: patientId
 *         schema: { type: integer }
 *     responses:
 *       200: { description: List of policies }
 *   post:
 *     tags: [Insurance Claims]
 *     summary: Create patient insurance policy
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [patientId, providerId, policyNumber, effectiveDate, expiryDate]
 *     responses:
 *       201: { description: Created }
 */
router.get("/policies", authMiddleware, roleMiddleware(...ALL_ROLES), ctrl.listPoliciesHandler);
router.post("/policies", authMiddleware, roleMiddleware(...POLICY_WRITERS), ctrl.createPolicyHandler);

/**
 * @swagger
 * /api/v1/insurance/policies/{id}:
 *   get:
 *     tags: [Insurance Claims]
 *     summary: Get policy details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Policy details }
 *   put:
 *     tags: [Insurance Claims]
 *     summary: Update insurance policy
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200: { description: Updated }
 */
router.get("/policies/:id", authMiddleware, roleMiddleware(...ALL_ROLES), ctrl.getPolicyHandler);
router.put("/policies/:id", authMiddleware, roleMiddleware(...POLICY_WRITERS), ctrl.updatePolicyHandler);

// --- Claims ---

/**
 * @swagger
 * /api/v1/insurance/claims:
 *   get:
 *     tags: [Insurance Claims]
 *     summary: List insurance claims
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: patientId
 *         schema: { type: integer }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of claims }
 *   post:
 *     tags: [Insurance Claims]
 *     summary: Submit a new insurance claim
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [policyId, patientId, claimedAmountCents]
 *     responses:
 *       201: { description: Claim submitted }
 */
router.get("/claims", authMiddleware, roleMiddleware(...ALL_ROLES), ctrl.listClaimsHandler);
router.post("/claims", authMiddleware, roleMiddleware(...CLAIM_SUBMITTERS), ctrl.submitClaimHandler);

/**
 * @swagger
 * /api/v1/insurance/claims/{id}:
 *   get:
 *     tags: [Insurance Claims]
 *     summary: Get claim details with documents
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Claim details }
 */
router.get("/claims/:id", authMiddleware, roleMiddleware(...ALL_ROLES), ctrl.getClaimHandler);

/**
 * @swagger
 * /api/v1/insurance/claims/{id}/status:
 *   put:
 *     tags: [Insurance Claims]
 *     summary: Update claim status (under_review, approved, rejected, cancelled)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *     responses:
 *       200: { description: Status updated }
 */
router.put("/claims/:id/status", authMiddleware, roleMiddleware(...ALL_ROLES), ctrl.updateClaimStatusHandler);

/**
 * @swagger
 * /api/v1/insurance/claims/{id}/settle:
 *   put:
 *     tags: [Insurance Claims]
 *     summary: Settle an approved insurance claim
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [settlementAmountCents, settlementReference]
 *     responses:
 *       200: { description: Claim settled }
 */
router.put("/claims/:id/settle", authMiddleware, roleMiddleware(...SETTLE_ROLES), ctrl.settleClaimHandler);

// --- Claim Documents ---

/**
 * @swagger
 * /api/v1/insurance/claims/{id}/documents:
 *   get:
 *     tags: [Insurance Claims]
 *     summary: List claim documents
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: List of documents }
 *   post:
 *     tags: [Insurance Claims]
 *     summary: Upload document for a claim
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file: { type: string, format: binary }
 *               documentType: { type: string, enum: [bill, discharge_summary, prescription, lab_report, id_proof, other], default: other }
 *     responses:
 *       201: { description: Document uploaded }
 */
router.get("/claims/:id/documents", authMiddleware, roleMiddleware(...ALL_ROLES), ctrl.listClaimDocumentsHandler);
router.post("/claims/:id/documents", authMiddleware, roleMiddleware(...DOC_UPLOADERS), upload.single("file"), ctrl.uploadClaimDocumentHandler);

/**
 * @swagger
 * /api/v1/insurance/claims/{id}/documents/{docId}/url:
 *   get:
 *     tags: [Insurance Claims]
 *     summary: Get presigned download URL for a claim document
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: docId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Presigned download URL }
 */
router.get("/claims/:id/documents/:docId/url", authMiddleware, roleMiddleware(...ALL_ROLES), ctrl.getDocumentPresignedUrlHandler);

/**
 * @swagger
 * /api/v1/insurance/claims/{id}/documents/{docId}:
 *   delete:
 *     tags: [Insurance Claims]
 *     summary: Delete a claim document
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: docId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Document deleted }
 */
router.delete("/claims/:id/documents/:docId", authMiddleware, roleMiddleware(...CLAIM_SUBMITTERS), ctrl.deleteClaimDocumentHandler);

module.exports = router;

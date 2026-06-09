const { z } = require("zod");
const insuranceService = require("../service/insuranceService");
const { asyncHandler } = require("../../middlewares/asyncHandler");

// --- Zod Validation Schemas ---

const createProviderSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required").toUpperCase(),
  contactEmail: z.string().email("Invalid email format").optional().nullable().or(z.literal("")),
  contactPhone: z.string().optional().nullable(),
  portalUrl: z.string().url("Invalid URL format").optional().nullable().or(z.literal("")),
  thaRate: z.number().min(0).max(100).optional().default(100.00),
  isActive: z.boolean().optional().default(true)
});

const updateProviderSchema = createProviderSchema.partial();

const createPolicySchema = z.object({
  patientId: z.number().int().positive("Patient ID must be positive"),
  providerId: z.number().int().positive("Provider ID must be positive"),
  policyNumber: z.string().min(1, "Policy number is required"),
  memberId: z.string().optional().nullable(),
  groupNumber: z.string().optional().nullable(),
  planName: z.string().optional().nullable(),
  coverageType: z.enum(["individual", "family", "group", "corporate"]).optional().default("individual"),
  coverageAmountCents: z.number().int().nonnegative("Coverage amount must be non-negative"),
  deductibleCents: z.number().int().nonnegative("Deductible must be non-negative").optional().default(0),
  coPayPercent: z.number().min(0).max(100).optional().default(0),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Effective date must be YYYY-MM-DD"),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expiry date must be YYYY-MM-DD"),
  status: z.enum(["active", "expired", "cancelled"]).optional().default("active")
});

const updatePolicySchema = createPolicySchema.partial();

const submitClaimSchema = z.object({
  policyId: z.number().int().positive("Policy ID must be positive"),
  patientId: z.number().int().positive("Patient ID must be positive"),
  invoiceId: z.number().int().positive("Invoice ID must be positive").optional().nullable(),
  claimedAmountCents: z.number().int().positive("Claimed amount must be positive"),
  notes: z.string().optional().nullable()
});

const updateClaimStatusSchema = z.object({
  status: z.enum(["submitted", "under_review", "approved", "rejected", "cancelled"]),
  approvedAmountCents: z.number().int().positive().optional(),
  rejectionReason: z.string().optional()
});

const settleClaimSchema = z.object({
  settlementAmountCents: z.number().int().positive("Settlement amount must be positive"),
  settlementReference: z.string().min(1, "Settlement reference is required"),
  paymentMethod: z.enum([
    "UPI", "Credit Card", "Debit Card", "Net Banking",
    "Wallet", "Cash", "Card Machine", "Bank Transfer"
  ]).optional().default("Bank Transfer"),
  notes: z.string().optional().nullable()
});

// --- Provider Handlers ---

const createProviderHandler = asyncHandler(async (req, res) => {
  const payload = createProviderSchema.parse(req.body);
  const provider = await insuranceService.createProvider(req.user, payload, req.auditContext);
  res.status(201).json(provider);
});

const updateProviderHandler = asyncHandler(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const payload = updateProviderSchema.parse(req.body);
  const provider = await insuranceService.updateProvider(req.user, id, payload, req.auditContext);
  res.json(provider);
});

const getProviderHandler = asyncHandler(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const provider = await insuranceService.getProvider(req.user, id);
  res.json(provider);
});

const listProvidersHandler = asyncHandler(async (req, res) => {
  const filters = z.object({
    isActive: z.coerce.boolean().optional()
  }).parse(req.query);
  const providers = await insuranceService.listProviders(req.user, filters);
  res.json(providers);
});

const deleteProviderHandler = asyncHandler(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const result = await insuranceService.deleteProvider(req.user, id, req.auditContext);
  res.json(result);
});

// --- Policy Handlers ---

const createPolicyHandler = asyncHandler(async (req, res) => {
  const payload = createPolicySchema.parse(req.body);
  const policy = await insuranceService.createPolicy(req.user, payload, req.auditContext);
  res.status(201).json(policy);
});

const updatePolicyHandler = asyncHandler(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const payload = updatePolicySchema.parse(req.body);
  const policy = await insuranceService.updatePolicy(req.user, id, payload, req.auditContext);
  res.json(policy);
});

const getPolicyHandler = asyncHandler(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const policy = await insuranceService.getPolicy(req.user, id);
  res.json(policy);
});

const listPoliciesHandler = asyncHandler(async (req, res) => {
  const filters = z.object({
    patientId: z.coerce.number().int().positive().optional()
  }).parse(req.query);
  const policies = await insuranceService.listPolicies(req.user, filters);
  res.json(policies);
});

// --- Claim Handlers ---

const submitClaimHandler = asyncHandler(async (req, res) => {
  const payload = submitClaimSchema.parse(req.body);
  const claim = await insuranceService.submitClaim(req.user, payload, req.auditContext);
  res.status(201).json(claim);
});

const updateClaimStatusHandler = asyncHandler(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const payload = updateClaimStatusSchema.parse(req.body);
  const claim = await insuranceService.updateClaimStatus(req.user, id, payload, req.auditContext);
  res.json(claim);
});

const settleClaimHandler = asyncHandler(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const payload = settleClaimSchema.parse(req.body);
  const claim = await insuranceService.settleClaim(req.user, id, payload, req.auditContext);
  res.json(claim);
});

const getClaimHandler = asyncHandler(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const claim = await insuranceService.getClaim(req.user, id);
  res.json(claim);
});

const listClaimsHandler = asyncHandler(async (req, res) => {
  const filters = z.object({
    patientId: z.coerce.number().int().positive().optional(),
    status: z.string().optional()
  }).parse(req.query);
  const claims = await insuranceService.listClaims(req.user, filters);
  res.json(claims);
});

// --- Claim Document Handlers ---

const uploadClaimDocumentHandler = asyncHandler(async (req, res) => {
  const claimId = z.coerce.number().int().positive().parse(req.params.id);
  const documentType = z.enum(["bill", "discharge_summary", "prescription", "lab_report", "id_proof", "other"])
    .optional()
    .default("other")
    .parse(req.body.documentType);
  const doc = await insuranceService.uploadClaimDocument(req.user, claimId, req.file, documentType, req.auditContext);
  res.status(201).json(doc);
});

const getDocumentPresignedUrlHandler = asyncHandler(async (req, res) => {
  const claimId = z.coerce.number().int().positive().parse(req.params.id);
  const docId = z.coerce.number().int().positive().parse(req.params.docId);
  const result = await insuranceService.getDocumentPresignedUrl(req.user, claimId, docId);
  res.json(result);
});

const listClaimDocumentsHandler = asyncHandler(async (req, res) => {
  const claimId = z.coerce.number().int().positive().parse(req.params.id);
  const docs = await insuranceService.listClaimDocuments(req.user, claimId);
  res.json(docs);
});

const deleteClaimDocumentHandler = asyncHandler(async (req, res) => {
  const claimId = z.coerce.number().int().positive().parse(req.params.id);
  const docId = z.coerce.number().int().positive().parse(req.params.docId);
  const result = await insuranceService.deleteClaimDocument(req.user, claimId, docId, req.auditContext);
  res.json(result);
});

module.exports = {
  createProviderHandler,
  updateProviderHandler,
  getProviderHandler,
  listProvidersHandler,
  deleteProviderHandler,
  createPolicyHandler,
  updatePolicyHandler,
  getPolicyHandler,
  listPoliciesHandler,
  submitClaimHandler,
  updateClaimStatusHandler,
  settleClaimHandler,
  getClaimHandler,
  listClaimsHandler,
  uploadClaimDocumentHandler,
  getDocumentPresignedUrlHandler,
  listClaimDocumentsHandler,
  deleteClaimDocumentHandler
};

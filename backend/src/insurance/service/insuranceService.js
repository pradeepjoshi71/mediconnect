const db = require("../../config/db");
const insuranceRepository = require("../repository/insuranceRepository");
const patientRepository = require("../../repositories/patientRepository");
const invoiceRepository = require("../../repositories/invoiceRepository");
const notificationService = require("../../services/notificationService");
const auditService = require("../../services/auditService");
const { AppError } = require("../../utils/http");

// Lazy load paymentService to avoid any potential circular dependency issues
let paymentService;
function getPaymentService() {
  if (!paymentService) {
    paymentService = require("../../services/paymentService");
  }
  return paymentService;
}

// State transition map
const VALID_TRANSITIONS = {
  submitted: ["under_review", "cancelled"],
  under_review: ["approved", "rejected"],
  approved: ["settled"],
  rejected: [],
  settled: [],
  cancelled: []
};

function isValidTransition(from, to) {
  return (VALID_TRANSITIONS[from] || []).includes(to);
}

// --- Providers ---

async function createProvider(user, payload, context) {
  if (user.role !== "super_admin" && user.role !== "hospital_admin") {
    throw new AppError(403, "Forbidden: Only admins can manage insurance providers");
  }

  const hospitalId = user.role === "super_admin" ? (payload.hospitalId || user.hospitalId) : user.hospitalId;

  // Check if provider code already exists
  const existing = await insuranceRepository.getProviderByCode(payload.code, hospitalId);
  if (existing) {
    throw new AppError(409, `Insurance provider with code "${payload.code}" already exists`);
  }

  const provider = await insuranceRepository.createProvider({
    hospitalId,
    name: payload.name,
    code: payload.code,
    contactEmail: payload.contactEmail,
    contactPhone: payload.contactPhone,
    portalUrl: payload.portalUrl,
    thaRate: payload.thaRate,
    isActive: payload.isActive !== undefined ? payload.isActive : true
  });

  await auditService.recordAuditEvent({
    user,
    action: "insurance.provider.create",
    entityType: "insurance_provider",
    entityId: provider.id,
    newValue: provider,
    context
  });

  return provider;
}

async function updateProvider(user, id, payload, context) {
  if (user.role !== "super_admin" && user.role !== "hospital_admin") {
    throw new AppError(403, "Forbidden: Only admins can manage insurance providers");
  }

  const hospitalId = user.hospitalId;
  const existing = await insuranceRepository.getProviderById(id, hospitalId);
  if (!existing) {
    throw new AppError(404, "Insurance provider not found");
  }

  const updated = await insuranceRepository.updateProvider(id, hospitalId, {
    name: payload.name,
    contactEmail: payload.contactEmail,
    contactPhone: payload.contactPhone,
    portalUrl: payload.portalUrl,
    thaRate: payload.thaRate,
    isActive: payload.isActive
  });

  await auditService.recordAuditEvent({
    user,
    action: "insurance.provider.update",
    entityType: "insurance_provider",
    entityId: id,
    oldValue: existing,
    newValue: updated,
    context
  });

  return updated;
}

async function getProvider(user, id) {
  const hospitalId = user.hospitalId;
  const provider = await insuranceRepository.getProviderById(id, hospitalId);
  if (!provider) {
    throw new AppError(404, "Insurance provider not found");
  }
  return provider;
}

async function listProviders(user, filters = {}) {
  const hospitalId = user.hospitalId;
  return insuranceRepository.listProviders(hospitalId, { isActive: filters.isActive });
}

async function deleteProvider(user, id, context) {
  if (user.role !== "super_admin" && user.role !== "hospital_admin") {
    throw new AppError(403, "Forbidden: Only admins can manage insurance providers");
  }

  const hospitalId = user.hospitalId;
  const existing = await insuranceRepository.getProviderById(id, hospitalId);
  if (!existing) {
    throw new AppError(404, "Insurance provider not found");
  }

  // Soft delete
  const updated = await insuranceRepository.updateProvider(id, hospitalId, { isActive: false });

  await auditService.recordAuditEvent({
    user,
    action: "insurance.provider.delete",
    entityType: "insurance_provider",
    entityId: id,
    oldValue: existing,
    newValue: updated,
    context
  });

  return { success: true, message: "Provider deactivated successfully" };
}

// --- Policies ---

async function createPolicy(user, payload, context) {
  const allowed = ["super_admin", "hospital_admin", "admin", "receptionist"];
  if (!allowed.includes(user.role)) {
    throw new AppError(403, "Forbidden: Insufficient role to manage policies");
  }

  const hospitalId = user.hospitalId;

  // Verify patient exists and belongs to the hospital
  const patient = await patientRepository.findPatientById(payload.patientId, hospitalId);
  if (!patient) {
    throw new AppError(404, "Patient not found in this hospital");
  }

  // Verify provider exists and belongs to the hospital
  const provider = await insuranceRepository.getProviderById(payload.providerId, hospitalId);
  if (!provider) {
    throw new AppError(404, "Insurance provider not found");
  }

  // Verify policy number is unique for the hospital
  const existing = await insuranceRepository.getPolicyByNumber(payload.policyNumber, hospitalId);
  if (existing) {
    throw new AppError(409, `Insurance policy with number "${payload.policyNumber}" already exists`);
  }

  const policy = await insuranceRepository.createPolicy({
    hospitalId,
    patientId: payload.patientId,
    providerId: payload.providerId,
    policyNumber: payload.policyNumber,
    memberId: payload.memberId,
    groupNumber: payload.groupNumber,
    planName: payload.planName,
    coverageType: payload.coverageType,
    coverageAmountCents: payload.coverageAmountCents,
    deductibleCents: payload.deductibleCents || 0,
    coPayPercent: payload.coPayPercent || 0,
    effectiveDate: payload.effectiveDate,
    expiryDate: payload.expiryDate,
    status: payload.status || "active"
  });

  await auditService.recordAuditEvent({
    user,
    action: "insurance.policy.create",
    entityType: "insurance_policy",
    entityId: policy.id,
    newValue: policy,
    context
  });

  return policy;
}

async function updatePolicy(user, id, payload, context) {
  const allowed = ["super_admin", "hospital_admin", "admin", "receptionist"];
  if (!allowed.includes(user.role)) {
    throw new AppError(403, "Forbidden: Insufficient role to manage policies");
  }

  const hospitalId = user.hospitalId;
  const existing = await insuranceRepository.getPolicyById(id, hospitalId);
  if (!existing) {
    throw new AppError(404, "Insurance policy not found");
  }

  const updated = await insuranceRepository.updatePolicy(id, hospitalId, {
    policyNumber: payload.policyNumber,
    memberId: payload.memberId,
    groupNumber: payload.groupNumber,
    planName: payload.planName,
    coverageType: payload.coverageType,
    coverageAmountCents: payload.coverageAmountCents,
    deductibleCents: payload.deductibleCents,
    coPayPercent: payload.coPayPercent,
    effectiveDate: payload.effectiveDate,
    expiryDate: payload.expiryDate,
    status: payload.status
  });

  await auditService.recordAuditEvent({
    user,
    action: "insurance.policy.update",
    entityType: "insurance_policy",
    entityId: id,
    oldValue: existing,
    newValue: updated,
    context
  });

  return updated;
}

async function getPolicy(user, id) {
  const hospitalId = user.hospitalId;
  const policy = await insuranceRepository.getPolicyById(id, hospitalId);
  if (!policy) {
    throw new AppError(404, "Insurance policy not found");
  }

  // If patient, restrict to their own policy
  if (user.role === "patient") {
    const patient = await patientRepository.findPatientByUserId(user.id, hospitalId);
    if (!patient || patient.id !== policy.patientId) {
      throw new AppError(403, "Forbidden: You cannot view other patients' policies");
    }
  }

  return policy;
}

async function listPolicies(user, filters = {}) {
  const hospitalId = user.hospitalId;

  if (user.role === "patient") {
    const patient = await patientRepository.findPatientByUserId(user.id, hospitalId);
    if (!patient) return [];
    return insuranceRepository.listPolicies(hospitalId, { patientId: patient.id });
  }

  return insuranceRepository.listPolicies(hospitalId, { patientId: filters.patientId });
}

// --- Claims ---

async function submitClaim(user, payload, context) {
  const allowed = ["super_admin", "hospital_admin", "admin", "receptionist", "billing_executive"];
  if (!allowed.includes(user.role)) {
    throw new AppError(403, "Forbidden: Insufficient role to submit claims");
  }

  const hospitalId = user.hospitalId;

  // Validate policy
  const policy = await insuranceRepository.getPolicyById(payload.policyId, hospitalId);
  if (!policy) {
    throw new AppError(404, "Insurance policy not found");
  }

  // Validate patient
  const patient = await patientRepository.findPatientById(payload.patientId, hospitalId);
  if (!patient) {
    throw new AppError(404, "Patient not found");
  }
  if (policy.patientId !== patient.id) {
    throw new AppError(400, "Patient does not match the policy owner");
  }

  // Validate invoice if supplied
  if (payload.invoiceId) {
    const invoice = await invoiceRepository.findInvoiceById(payload.invoiceId, hospitalId);
    if (!invoice) {
      throw new AppError(404, "Invoice not found");
    }
    if (invoice.patientId !== patient.id) {
      throw new AppError(400, "Invoice patient does not match claim patient");
    }

    // Check if an active claim already exists for this invoice
    const claims = await insuranceRepository.listClaims(hospitalId, { patientId: patient.id });
    const activeClaim = claims.find(c => c.invoiceId === payload.invoiceId && c.status !== "cancelled" && c.status !== "rejected");
    if (activeClaim) {
      throw new AppError(409, `An active claim (#${activeClaim.claimNumber}) already exists for this invoice`);
    }
  }

  // Generate unique claim number
  const claimNumber = `CLM-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

  const claim = await insuranceRepository.createClaim({
    hospitalId,
    claimNumber,
    policyId: payload.policyId,
    patientId: payload.patientId,
    invoiceId: payload.invoiceId || null,
    claimedAmountCents: payload.claimedAmountCents,
    status: "submitted",
    notes: payload.notes
  });

  await auditService.recordAuditEvent({
    user,
    action: "insurance.claim.submitted",
    entityType: "insurance_claim",
    entityId: claim.id,
    newValue: claim,
    context
  });

  // Notify patient (patient profile belongs to a user)
  if (patient.userId) {
    try {
      await notificationService.sendToUser({
        userId: patient.userId,
        hospitalId,
        title: "Insurance Claim Submitted",
        body: `Your claim #${claimNumber} for ${claim.providerName || "your policy"} has been submitted successfully.`,
        eventType: "INVOICE_GENERATED", // existing type mapping or custom string
        data: { claimId: claim.id.toString(), claimNumber }
      });
    } catch (err) {
      // Notification failures should be non-blocking
    }
  }

  return claim;
}

async function updateClaimStatus(user, id, payload, context) {
  const hospitalId = user.hospitalId;
  const existing = await insuranceRepository.getClaimById(id, hospitalId);
  if (!existing) {
    throw new AppError(404, "Claim not found");
  }

  const { status, approvedAmountCents, rejectionReason } = payload;

  // Validate state machine transition
  if (!isValidTransition(existing.status, status)) {
    throw new AppError(409, `Invalid status transition from "${existing.status}" to "${status}"`);
  }

  // Role authorization
  if (status === "cancelled") {
    if (user.role === "patient") {
      const patient = await patientRepository.findPatientByUserId(user.id, hospitalId);
      if (!patient || patient.id !== existing.patientId) {
        throw new AppError(403, "Forbidden: You can only cancel your own claims");
      }
    } else {
      const allowedCancel = ["super_admin", "hospital_admin", "admin", "receptionist"];
      if (!allowedCancel.includes(user.role)) {
        throw new AppError(403, "Forbidden: Insufficient role to cancel this claim");
      }
    }
  } else {
    // under_review, approved, rejected
    const allowedReview = ["super_admin", "hospital_admin", "admin", "insurance_coordinator"];
    if (!allowedReview.includes(user.role)) {
      throw new AppError(403, `Forbidden: Only insurance coordinators/admins can set status to "${status}"`);
    }
  }

  // Setup fields based on status
  const updatePayload = {
    reviewerUserId: user.id
  };

  if (status === "under_review") {
    // No extra fields required
  } else if (status === "approved") {
    if (approvedAmountCents === undefined || approvedAmountCents <= 0) {
      throw new AppError(400, "Approved amount is required and must be greater than zero");
    }
    if (approvedAmountCents > existing.claimedAmountCents) {
      throw new AppError(400, "Approved amount cannot exceed the claimed amount");
    }
    updatePayload.approvedAmountCents = approvedAmountCents;
    updatePayload.reviewedAt = new Date();
  } else if (status === "rejected") {
    if (!rejectionReason || !rejectionReason.trim()) {
      throw new AppError(400, "Rejection reason is required");
    }
    updatePayload.rejectionReason = rejectionReason;
    updatePayload.reviewedAt = new Date();
  }

  const updated = await insuranceRepository.updateClaimStatus(id, hospitalId, status, updatePayload);

  await auditService.recordAuditEvent({
    user,
    action: `insurance.claim.${status}`,
    entityType: "insurance_claim",
    entityId: id,
    oldValue: existing,
    newValue: updated,
    context
  });

  // Fetch patient user id for notification
  const patient = await patientRepository.findPatientById(existing.patientId, hospitalId);
  if (patient && patient.userId) {
    try {
      let title = "Insurance Claim Update";
      let body = `Your claim #${existing.claimNumber} status has changed to "${status}".`;
      if (status === "approved") {
        body = `Your claim #${existing.claimNumber} has been approved for INR ${(approvedAmountCents / 100).toFixed(2)}.`;
      } else if (status === "rejected") {
        body = `Your claim #${existing.claimNumber} has been rejected. Reason: ${rejectionReason}`;
      }

      await notificationService.sendToUser({
        userId: patient.userId,
        hospitalId,
        title,
        body,
        eventType: "INVOICE_GENERATED",
        data: { claimId: id.toString(), status }
      });
    } catch (err) {
      // non-blocking
    }
  }

  return updated;
}

async function settleClaim(user, id, payload, context) {
  // Enforce role
  const allowed = ["super_admin", "hospital_admin", "admin", "billing_executive"];
  if (!allowed.includes(user.role)) {
    throw new AppError(403, "Forbidden: Only billing executives and admins can settle claims");
  }

  const hospitalId = user.hospitalId;
  const existing = await insuranceRepository.getClaimById(id, hospitalId);
  if (!existing) {
    throw new AppError(404, "Claim not found");
  }

  // Validate state machine transition (must be approved to go to settled)
  if (existing.status !== "approved") {
    throw new AppError(409, `Cannot settle claim in status "${existing.status}". Must be approved first.`);
  }

  const { settlementAmountCents, settlementReference, paymentMethod, notes } = payload;
  if (!settlementAmountCents || settlementAmountCents <= 0) {
    throw new AppError(400, "Settlement amount must be greater than zero");
  }
  if (settlementAmountCents > existing.approvedAmountCents) {
    throw new AppError(400, "Settlement amount cannot exceed approved amount");
  }
  if (!settlementReference || !settlementReference.trim()) {
    throw new AppError(400, "Settlement reference is required");
  }

  // Transaction block
  await db.withTransaction(async (client) => {
    // 1. Update claim status to settled in DB
    const res = await client.query(
      `UPDATE insurance_claims
       SET status = 'settled',
           settlement_amount_cents = $3,
           settlement_reference = $4,
           settled_at = now(),
           updated_at = now()
       WHERE id = $1 AND hospital_id = $2
       RETURNING id`,
      [id, hospitalId, settlementAmountCents, settlementReference]
    );

    if (res.rows.length === 0) {
      throw new AppError(500, "Failed to update claim status");
    }

    // 2. If claim has an associated invoice, process the payment using existing modules
    if (existing.invoiceId) {
      const pService = getPaymentService();
      // Record offline payment through the payment service
      // We pass the invoiceId, amount in decimal (cents / 100), paymentMethod, and referenceNumber
      await pService.recordOfflinePayment(
        user,
        {
          invoiceId: existing.invoiceId,
          amount: settlementAmountCents / 100,
          paymentMethod: paymentMethod || "Bank Transfer",
          referenceNumber: settlementReference,
          notes: notes || `Insurance Settlement for Claim #${existing.claimNumber}`,
          receivedBy: user.id
        },
        context
      );
    }
  });

  const updated = await insuranceRepository.getClaimById(id, hospitalId);

  await auditService.recordAuditEvent({
    user,
    action: "insurance.claim.settle",
    entityType: "insurance_claim",
    entityId: id,
    oldValue: existing,
    newValue: updated,
    context
  });

  // Notify patient
  const patient = await patientRepository.findPatientById(existing.patientId, hospitalId);
  if (patient && patient.userId) {
    try {
      await notificationService.sendToUser({
        userId: patient.userId,
        hospitalId,
        title: "Insurance Claim Settled",
        body: `Your claim #${existing.claimNumber} has been settled for INR ${(settlementAmountCents / 100).toFixed(2)}.`,
        eventType: "INVOICE_GENERATED",
        data: { claimId: id.toString(), settlementReference }
      });
    } catch (err) {
      // non-blocking
    }
  }

  return updated;
}

async function getClaim(user, id) {
  const hospitalId = user.hospitalId;
  const claim = await insuranceRepository.getClaimById(id, hospitalId);
  if (!claim) {
    throw new AppError(404, "Claim not found");
  }

  // If patient, restrict to their own claim
  if (user.role === "patient") {
    const patient = await patientRepository.findPatientByUserId(user.id, hospitalId);
    if (!patient || patient.id !== claim.patientId) {
      throw new AppError(403, "Forbidden: You cannot view other patients' claims");
    }
  }

  // Include documents
  const docs = await insuranceRepository.listDocuments(id, hospitalId);
  claim.documents = docs;

  return claim;
}

async function listClaims(user, filters = {}) {
  const hospitalId = user.hospitalId;

  if (user.role === "patient") {
    const patient = await patientRepository.findPatientByUserId(user.id, hospitalId);
    if (!patient) return [];
    return insuranceRepository.listClaims(hospitalId, { patientId: patient.id });
  }

  return insuranceRepository.listClaims(hospitalId, {
    patientId: filters.patientId,
    status: filters.status
  });
}

// --- Claim Documents (MinIO Storage) ---

async function uploadClaimDocument(user, claimId, file, documentType, context) {
  const allowed = ["super_admin", "hospital_admin", "admin", "receptionist", "billing_executive", "doctor"];
  if (!allowed.includes(user.role)) {
    throw new AppError(403, "Forbidden: Insufficient role to upload claim documents");
  }

  if (!file) {
    throw new AppError(400, "No file uploaded");
  }

  const hospitalId = user.hospitalId;

  // Verify claim exists and belongs to hospital
  const claim = await insuranceRepository.getClaimById(claimId, hospitalId);
  if (!claim) {
    throw new AppError(404, "Claim not found");
  }

  // Generate unique object key in MinIO
  // Pattern: {hospitalId}/{claimId}/{timestamp}-{originalName}
  const minioService = require("../../services/minioService");
  const cleanOriginalName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectKey = `${hospitalId}/${claimId}/${Date.now()}-${cleanOriginalName}`;

  const { Readable } = require("stream");
  const stream = Readable.from(file.buffer);

  // Upload to MinIO
  await minioService.uploadObject({
    bucket: "insurance-claims",
    objectKey,
    stream,
    size: file.size,
    mimeType: file.mimetype
  });

  // Save to Database
  const doc = await insuranceRepository.createDocument({
    hospitalId,
    claimId,
    uploadedBy: user.id,
    documentType: documentType || "other",
    originalName: file.originalname,
    objectKey,
    mimeType: file.mimetype,
    byteSize: file.size
  });

  await auditService.recordAuditEvent({
    user,
    action: "insurance.document.upload",
    entityType: "claim_document",
    entityId: doc.id,
    newValue: doc,
    context
  });

  return doc;
}

async function getDocumentPresignedUrl(user, claimId, docId) {
  const hospitalId = user.hospitalId;

  // Validate claim exists
  const claim = await insuranceRepository.getClaimById(claimId, hospitalId);
  if (!claim) {
    throw new AppError(404, "Claim not found");
  }

  // If patient, restrict to their own claim
  if (user.role === "patient") {
    const patient = await patientRepository.findPatientByUserId(user.id, hospitalId);
    if (!patient || patient.id !== claim.patientId) {
      throw new AppError(403, "Forbidden: You cannot access other patients' claim documents");
    }
  }

  // Get document
  const doc = await insuranceRepository.getDocumentById(docId, hospitalId);
  if (!doc || doc.claimId !== claim.id) {
    throw new AppError(404, "Document not found for this claim");
  }

  const minioService = require("../../services/minioService");
  const url = await minioService.getPresignedUrl("insurance-claims", doc.objectKey, 3600); // 1 hour

  return {
    document: doc,
    url,
    expiresIn: 3600
  };
}

async function listClaimDocuments(user, claimId) {
  const hospitalId = user.hospitalId;

  const claim = await insuranceRepository.getClaimById(claimId, hospitalId);
  if (!claim) {
    throw new AppError(404, "Claim not found");
  }

  // If patient, restrict to their own claim
  if (user.role === "patient") {
    const patient = await patientRepository.findPatientByUserId(user.id, hospitalId);
    if (!patient || patient.id !== claim.patientId) {
      throw new AppError(403, "Forbidden: You cannot view other patients' claim documents");
    }
  }

  return insuranceRepository.listDocuments(claimId, hospitalId);
}

async function deleteClaimDocument(user, claimId, docId, context) {
  const allowed = ["super_admin", "hospital_admin", "admin", "receptionist", "billing_executive"];
  if (!allowed.includes(user.role)) {
    throw new AppError(403, "Forbidden: Insufficient role to delete claim documents");
  }

  const hospitalId = user.hospitalId;

  const claim = await insuranceRepository.getClaimById(claimId, hospitalId);
  if (!claim) {
    throw new AppError(404, "Claim not found");
  }

  const doc = await insuranceRepository.getDocumentById(docId, hospitalId);
  if (!doc || doc.claimId !== claim.id) {
    throw new AppError(404, "Document not found for this claim");
  }

  // Delete from MinIO
  const minioService = require("../../services/minioService");
  try {
    await minioService.deleteObject("insurance-claims", doc.objectKey);
  } catch (err) {
    // Log error but proceed to clean DB metadata
  }

  // Delete from DB
  await insuranceRepository.deleteDocument(docId, hospitalId);

  await auditService.recordAuditEvent({
    user,
    action: "insurance.document.delete",
    entityType: "claim_document",
    entityId: docId,
    oldValue: doc,
    context
  });

  return { success: true, message: "Document deleted successfully" };
}

module.exports = {
  createProvider,
  updateProvider,
  getProvider,
  listProviders,
  deleteProvider,
  createPolicy,
  updatePolicy,
  getPolicy,
  listPolicies,
  submitClaim,
  updateClaimStatus,
  settleClaim,
  getClaim,
  listClaims,
  uploadClaimDocument,
  getDocumentPresignedUrl,
  listClaimDocuments,
  deleteClaimDocument
};

const db = require("../../config/db");

// --- Map helper utilities ---

function mapProvider(row) {
  if (!row) return null;
  return {
    id: row.id,
    hospitalId: row.hospitalId,
    name: row.name,
    code: row.code,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    portalUrl: row.portalUrl,
    thaRate: row.thaRate ? parseFloat(row.thaRate) : 100.00,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapPolicy(row) {
  if (!row) return null;
  return {
    id: row.id,
    hospitalId: row.hospitalId,
    patientId: row.patientId,
    patientName: row.patientName,
    providerId: row.providerId,
    providerName: row.providerName,
    providerCode: row.providerCode,
    policyNumber: row.policyNumber,
    memberId: row.memberId,
    groupNumber: row.groupNumber,
    planName: row.planName,
    coverageType: row.coverageType,
    coverageAmountCents: row.coverageAmountCents,
    deductibleCents: row.deductibleCents,
    coPayPercent: row.coPayPercent ? parseFloat(row.coPayPercent) : 0,
    effectiveDate: row.effectiveDate,
    expiryDate: row.expiryDate,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapClaim(row) {
  if (!row) return null;
  return {
    id: row.id,
    hospitalId: row.hospitalId,
    claimNumber: row.claimNumber,
    policyId: row.policyId,
    policyNumber: row.policyNumber,
    patientId: row.patientId,
    patientName: row.patientName,
    invoiceId: row.invoiceId,
    invoiceNumber: row.invoiceNumber,
    claimedAmountCents: row.claimedAmountCents,
    approvedAmountCents: row.approvedAmountCents,
    settlementAmountCents: row.settlementAmountCents,
    status: row.status,
    submittedAt: row.submittedAt,
    reviewedAt: row.reviewedAt,
    settledAt: row.settledAt,
    rejectionReason: row.rejectionReason,
    reviewerUserId: row.reviewerUserId,
    reviewerName: row.reviewerName,
    settlementReference: row.settlementReference,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    providerName: row.providerName,
  };
}

function mapDocument(row) {
  if (!row) return null;
  return {
    id: row.id,
    hospitalId: row.hospitalId,
    claimId: row.claimId,
    uploadedBy: row.uploadedBy,
    uploadedByName: row.uploadedByName,
    documentType: row.documentType,
    originalName: row.originalName,
    objectKey: row.objectKey,
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    createdAt: row.createdAt,
  };
}

// --- Provider Queries ---

async function createProvider({ hospitalId, name, code, contactEmail, contactPhone, portalUrl, thaRate, isActive }) {
  const result = await db.query(
    `INSERT INTO insurance_providers 
      (hospital_id, name, code, contact_email, contact_phone, portal_url, tha_rate, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, hospital_id AS "hospitalId", name, code, contact_email AS "contactEmail",
               contact_phone AS "contactPhone", portal_url AS "portalUrl", 
               tha_rate AS "thaRate", is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"`,
    [hospitalId, name, code, contactEmail, contactPhone, portalUrl, thaRate, isActive]
  );
  return mapProvider(result.rows[0]);
}

async function updateProvider(id, hospitalId, { name, contactEmail, contactPhone, portalUrl, thaRate, isActive }) {
  const result = await db.query(
    `UPDATE insurance_providers 
     SET name = COALESCE($3, name),
         contact_email = COALESCE($4, contact_email),
         contact_phone = COALESCE($5, contact_phone),
         portal_url = COALESCE($6, portal_url),
         tha_rate = COALESCE($7, tha_rate),
         is_active = COALESCE($8, is_active),
         updated_at = now()
     WHERE id = $1 AND hospital_id = $2
     RETURNING id, hospital_id AS "hospitalId", name, code, contact_email AS "contactEmail",
               contact_phone AS "contactPhone", portal_url AS "portalUrl", 
               tha_rate AS "thaRate", is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"`,
    [id, hospitalId, name, contactEmail, contactPhone, portalUrl, thaRate, isActive]
  );
  return mapProvider(result.rows[0]);
}

async function getProviderById(id, hospitalId) {
  const result = await db.query(
    `SELECT id, hospital_id AS "hospitalId", name, code, contact_email AS "contactEmail",
            contact_phone AS "contactPhone", portal_url AS "portalUrl", 
            tha_rate AS "thaRate", is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
     FROM insurance_providers 
     WHERE id = $1 AND hospital_id = $2`,
    [id, hospitalId]
  );
  return mapProvider(result.rows[0]);
}

async function getProviderByCode(code, hospitalId) {
  const result = await db.query(
    `SELECT id, hospital_id AS "hospitalId", name, code, contact_email AS "contactEmail",
            contact_phone AS "contactPhone", portal_url AS "portalUrl", 
            tha_rate AS "thaRate", is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
     FROM insurance_providers 
     WHERE code = $1 AND hospital_id = $2`,
    [code, hospitalId]
  );
  return mapProvider(result.rows[0]);
}

async function listProviders(hospitalId, { isActive } = {}) {
  const params = [hospitalId];
  let query = `
    SELECT id, hospital_id AS "hospitalId", name, code, contact_email AS "contactEmail",
           contact_phone AS "contactPhone", portal_url AS "portalUrl", 
           tha_rate AS "thaRate", is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
    FROM insurance_providers 
    WHERE hospital_id = $1
  `;

  if (isActive !== undefined) {
    params.push(isActive);
    query += ` AND is_active = $2`;
  }

  query += ` ORDER BY name ASC`;

  const result = await db.query(query, params);
  return result.rows.map(mapProvider);
}

// --- Policy Queries ---

async function createPolicy({
  hospitalId, patientId, providerId, policyNumber, memberId, groupNumber,
  planName, coverageType, coverageAmountCents, deductibleCents, coPayPercent,
  effectiveDate, expiryDate, status
}) {
  const result = await db.query(
    `INSERT INTO insurance_policies 
      (hospital_id, patient_id, provider_id, policy_number, member_id, group_number,
       plan_name, coverage_type, coverage_amount_cents, deductible_cents, co_pay_percent,
       effective_date, expiry_date, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING id, hospital_id AS "hospitalId", patient_id AS "patientId", provider_id AS "providerId",
               policy_number AS "policyNumber", member_id AS "memberId", group_number AS "groupNumber",
               plan_name AS "planName", coverage_type AS "coverageType", coverage_amount_cents AS "coverageAmountCents",
               deductible_cents AS "deductibleCents", co_pay_percent AS "coPayPercent",
               effective_date AS "effectiveDate", expiry_date AS "expiryDate", status,
               created_at AS "createdAt", updated_at AS "updatedAt"`,
    [
      hospitalId, patientId, providerId, policyNumber, memberId, groupNumber,
      planName, coverageType, coverageAmountCents, deductibleCents, coPayPercent,
      effectiveDate, expiryDate, status || 'active'
    ]
  );
  return getPolicyById(result.rows[0].id, hospitalId);
}

async function updatePolicy(id, hospitalId, {
  policyNumber, memberId, groupNumber, planName, coverageType, coverageAmountCents,
  deductibleCents, coPayPercent, effectiveDate, expiryDate, status
}) {
  const result = await db.query(
    `UPDATE insurance_policies
     SET policy_number = COALESCE($3, policy_number),
         member_id = COALESCE($4, member_id),
         group_number = COALESCE($5, group_number),
         plan_name = COALESCE($6, plan_name),
         coverage_type = COALESCE($7, coverage_type),
         coverage_amount_cents = COALESCE($8, coverage_amount_cents),
         deductible_cents = COALESCE($9, deductible_cents),
         co_pay_percent = COALESCE($10, co_pay_percent),
         effective_date = COALESCE($11, effective_date),
         expiry_date = COALESCE($12, expiry_date),
         status = COALESCE($13, status),
         updated_at = now()
     WHERE id = $1 AND hospital_id = $2
     RETURNING id`,
    [
      id, hospitalId, policyNumber, memberId, groupNumber, planName, coverageType,
      coverageAmountCents, deductibleCents, coPayPercent, effectiveDate, expiryDate, status
    ]
  );
  if (result.rows.length === 0) return null;
  return getPolicyById(id, hospitalId);
}

async function getPolicyById(id, hospitalId) {
  const result = await db.query(
    `SELECT pol.id, pol.hospital_id AS "hospitalId", pol.patient_id AS "patientId", 
            pol.provider_id AS "providerId", pol.policy_number AS "policyNumber", 
            pol.member_id AS "memberId", pol.group_number AS "groupNumber",
            pol.plan_name AS "planName", pol.coverage_type AS "coverageType", 
            pol.coverage_amount_cents AS "coverageAmountCents", pol.deductible_cents AS "deductibleCents", 
            pol.co_pay_percent AS "coPayPercent", pol.effective_date AS "effectiveDate", 
            pol.expiry_date AS "expiryDate", pol.status,
            pol.created_at AS "createdAt", pol.updated_at AS "updatedAt",
            prov.name AS "providerName", prov.code AS "providerCode",
            u.full_name AS "patientName"
     FROM insurance_policies pol
     JOIN insurance_providers prov ON prov.id = pol.provider_id
     JOIN patients p ON p.id = pol.patient_id
     JOIN users u ON u.id = p.user_id
     WHERE pol.id = $1 AND pol.hospital_id = $2`,
    [id, hospitalId]
  );
  return mapPolicy(result.rows[0]);
}

async function getPolicyByNumber(policyNumber, hospitalId) {
  const result = await db.query(
    `SELECT pol.id, pol.hospital_id AS "hospitalId", pol.patient_id AS "patientId", 
            pol.provider_id AS "providerId", pol.policy_number AS "policyNumber", 
            pol.member_id AS "memberId", pol.group_number AS "groupNumber",
            pol.plan_name AS "planName", pol.coverage_type AS "coverageType", 
            pol.coverage_amount_cents AS "coverageAmountCents", pol.deductible_cents AS "deductibleCents", 
            pol.co_pay_percent AS "coPayPercent", pol.effective_date AS "effectiveDate", 
            pol.expiry_date AS "expiryDate", pol.status,
            pol.created_at AS "createdAt", pol.updated_at AS "updatedAt",
            prov.name AS "providerName", prov.code AS "providerCode",
            u.full_name AS "patientName"
     FROM insurance_policies pol
     JOIN insurance_providers prov ON prov.id = pol.provider_id
     JOIN patients p ON p.id = pol.patient_id
     JOIN users u ON u.id = p.user_id
     WHERE pol.policy_number = $1 AND pol.hospital_id = $2`,
    [policyNumber, hospitalId]
  );
  return mapPolicy(result.rows[0]);
}

async function listPolicies(hospitalId, { patientId } = {}) {
  const params = [hospitalId];
  let query = `
    SELECT pol.id, pol.hospital_id AS "hospitalId", pol.patient_id AS "patientId", 
            pol.provider_id AS "providerId", pol.policy_number AS "policyNumber", 
            pol.member_id AS "memberId", pol.group_number AS "groupNumber",
            pol.plan_name AS "planName", pol.coverage_type AS "coverageType", 
            pol.coverage_amount_cents AS "coverageAmountCents", pol.deductible_cents AS "deductibleCents", 
            pol.co_pay_percent AS "coPayPercent", pol.effective_date AS "effectiveDate", 
            pol.expiry_date AS "expiryDate", pol.status,
            pol.created_at AS "createdAt", pol.updated_at AS "updatedAt",
            prov.name AS "providerName", prov.code AS "providerCode",
            u.full_name AS "patientName"
     FROM insurance_policies pol
     JOIN insurance_providers prov ON prov.id = pol.provider_id
     JOIN patients p ON p.id = pol.patient_id
     JOIN users u ON u.id = p.user_id
     WHERE pol.hospital_id = $1
  `;

  if (patientId !== undefined) {
    params.push(patientId);
    query += ` AND pol.patient_id = $2`;
  }

  query += ` ORDER BY pol.created_at DESC`;

  const result = await db.query(query, params);
  return result.rows.map(mapPolicy);
}

// --- Claim Queries ---

async function createClaim({
  hospitalId, claimNumber, policyId, patientId, invoiceId, claimedAmountCents, status, notes
}) {
  const result = await db.query(
    `INSERT INTO insurance_claims 
      (hospital_id, claim_number, policy_id, patient_id, invoice_id, claimed_amount_cents, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [hospitalId, claimNumber, policyId, patientId, invoiceId, claimedAmountCents, status || 'submitted', notes]
  );
  return getClaimById(result.rows[0].id, hospitalId);
}

async function updateClaimStatus(id, hospitalId, status, {
  approvedAmountCents = null,
  settlementAmountCents = null,
  rejectionReason = null,
  reviewerUserId = null,
  settlementReference = null,
  reviewedAt = null,
  settledAt = null,
} = {}) {
  const result = await db.query(
    `UPDATE insurance_claims
     SET status = $3,
         approved_amount_cents = COALESCE($4, approved_amount_cents),
         settlement_amount_cents = COALESCE($5, settlement_amount_cents),
         rejection_reason = COALESCE($6, rejection_reason),
         reviewer_user_id = COALESCE($7, reviewer_user_id),
         settlement_reference = COALESCE($8, settlement_reference),
         reviewed_at = COALESCE($9, reviewed_at),
         settled_at = COALESCE($10, settled_at),
         updated_at = now()
     WHERE id = $1 AND hospital_id = $2
     RETURNING id`,
    [
      id, hospitalId, status, approvedAmountCents, settlementAmountCents,
      rejectionReason, reviewerUserId, settlementReference, reviewedAt, settledAt
    ]
  );
  if (result.rows.length === 0) return null;
  return getClaimById(id, hospitalId);
}

async function getClaimById(id, hospitalId) {
  const result = await db.query(
    `SELECT clm.id, clm.hospital_id AS "hospitalId", clm.claim_number AS "claimNumber", 
            clm.policy_id AS "policyId", clm.patient_id AS "patientId", 
            clm.invoice_id AS "invoiceId", clm.claimed_amount_cents AS "claimedAmountCents", 
            clm.approved_amount_cents AS "approvedAmountCents", clm.settlement_amount_cents AS "settlementAmountCents", 
            clm.status, clm.submitted_at AS "submittedAt", clm.reviewed_at AS "reviewedAt", clm.settled_at AS "settledAt", 
            clm.rejection_reason AS "rejectionReason", clm.reviewer_user_id AS "reviewerUserId", 
            clm.settlement_reference AS "settlementReference", clm.notes,
            clm.created_at AS "createdAt", clm.updated_at AS "updatedAt",
            u.full_name AS "patientName", pol.policy_number AS "policyNumber",
            prov.name AS "providerName", inv.invoice_number AS "invoiceNumber",
            rev.full_name AS "reviewerName"
     FROM insurance_claims clm
     JOIN insurance_policies pol ON pol.id = clm.policy_id
     JOIN insurance_providers prov ON prov.id = pol.provider_id
     JOIN patients p ON p.id = clm.patient_id
     JOIN users u ON u.id = p.user_id
     LEFT JOIN invoices inv ON inv.id = clm.invoice_id
     LEFT JOIN users rev ON rev.id = clm.reviewer_user_id
     WHERE clm.id = $1 AND clm.hospital_id = $2`,
    [id, hospitalId]
  );
  return mapClaim(result.rows[0]);
}

async function getClaimByNumber(claimNumber, hospitalId) {
  const result = await db.query(
    `SELECT clm.id, clm.hospital_id AS "hospitalId", clm.claim_number AS "claimNumber", 
            clm.policy_id AS "policyId", clm.patient_id AS "patientId", 
            clm.invoice_id AS "invoiceId", clm.claimed_amount_cents AS "claimedAmountCents", 
            clm.approved_amount_cents AS "approvedAmountCents", clm.settlement_amount_cents AS "settlementAmountCents", 
            clm.status, clm.submitted_at AS "submittedAt", clm.reviewed_at AS "reviewedAt", clm.settled_at AS "settledAt", 
            clm.rejection_reason AS "rejectionReason", clm.reviewer_user_id AS "reviewerUserId", 
            clm.settlement_reference AS "settlementReference", clm.notes,
            clm.created_at AS "createdAt", clm.updated_at AS "updatedAt",
            u.full_name AS "patientName", pol.policy_number AS "policyNumber",
            prov.name AS "providerName", inv.invoice_number AS "invoiceNumber",
            rev.full_name AS "reviewerName"
     FROM insurance_claims clm
     JOIN insurance_policies pol ON pol.id = clm.policy_id
     JOIN insurance_providers prov ON prov.id = pol.provider_id
     JOIN patients p ON p.id = clm.patient_id
     JOIN users u ON u.id = p.user_id
     LEFT JOIN invoices inv ON inv.id = clm.invoice_id
     LEFT JOIN users rev ON rev.id = clm.reviewer_user_id
     WHERE clm.claim_number = $1 AND clm.hospital_id = $2`,
    [claimNumber, hospitalId]
  );
  return mapClaim(result.rows[0]);
}

async function listClaims(hospitalId, { patientId, status } = {}) {
  const params = [hospitalId];
  let query = `
    SELECT clm.id, clm.hospital_id AS "hospitalId", clm.claim_number AS "claimNumber", 
            clm.policy_id AS "policyId", clm.patient_id AS "patientId", 
            clm.invoice_id AS "invoiceId", clm.claimed_amount_cents AS "claimedAmountCents", 
            clm.approved_amount_cents AS "approvedAmountCents", clm.settlement_amount_cents AS "settlementAmountCents", 
            clm.status, clm.submitted_at AS "submittedAt", clm.reviewed_at AS "reviewedAt", clm.settled_at AS "settledAt", 
            clm.rejection_reason AS "rejectionReason", clm.reviewer_user_id AS "reviewerUserId", 
            clm.settlement_reference AS "settlementReference", clm.notes,
            clm.created_at AS "createdAt", clm.updated_at AS "updatedAt",
            u.full_name AS "patientName", pol.policy_number AS "policyNumber",
            prov.name AS "providerName", inv.invoice_number AS "invoiceNumber",
            rev.full_name AS "reviewerName"
     FROM insurance_claims clm
     JOIN insurance_policies pol ON pol.id = clm.policy_id
     JOIN insurance_providers prov ON prov.id = pol.provider_id
     JOIN patients p ON p.id = clm.patient_id
     JOIN users u ON u.id = p.user_id
     LEFT JOIN invoices inv ON inv.id = clm.invoice_id
     LEFT JOIN users rev ON rev.id = clm.reviewer_user_id
     WHERE clm.hospital_id = $1
  `;

  if (patientId !== undefined) {
    params.push(patientId);
    query += ` AND clm.patient_id = $${params.length}`;
  }

  if (status !== undefined) {
    params.push(status);
    query += ` AND clm.status = $${params.length}`;
  }

  query += ` ORDER BY clm.created_at DESC`;

  const result = await db.query(query, params);
  return result.rows.map(mapClaim);
}

// --- Claim Document Queries ---

async function createDocument({
  hospitalId, claimId, uploadedBy, documentType, originalName, objectKey, mimeType, byteSize
}) {
  const result = await db.query(
    `INSERT INTO claim_documents 
      (hospital_id, claim_id, uploaded_by, document_type, original_name, object_key, mime_type, byte_size)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [hospitalId, claimId, uploadedBy, documentType, originalName, objectKey, mimeType, byteSize]
  );
  return getDocumentById(result.rows[0].id, hospitalId);
}

async function getDocumentById(id, hospitalId) {
  const result = await db.query(
    `SELECT cd.id, cd.hospital_id AS "hospitalId", cd.claim_id AS "claimId", 
            cd.uploaded_by AS "uploadedBy", u.full_name AS "uploadedByName", 
            cd.document_type AS "documentType", cd.original_name AS "originalName", 
            cd.object_key AS "objectKey", cd.mime_type AS "mimeType", cd.byte_size AS "byteSize",
            cd.created_at AS "createdAt"
     FROM claim_documents cd
     JOIN users u ON u.id = cd.uploaded_by
     WHERE cd.id = $1 AND cd.hospital_id = $2`,
    [id, hospitalId]
  );
  return mapDocument(result.rows[0]);
}

async function listDocuments(claimId, hospitalId) {
  const result = await db.query(
    `SELECT cd.id, cd.hospital_id AS "hospitalId", cd.claim_id AS "claimId", 
            cd.uploaded_by AS "uploadedBy", u.full_name AS "uploadedByName", 
            cd.document_type AS "documentType", cd.original_name AS "originalName", 
            cd.object_key AS "objectKey", cd.mime_type AS "mimeType", cd.byte_size AS "byteSize",
            cd.created_at AS "createdAt"
     FROM claim_documents cd
     JOIN users u ON u.id = cd.uploaded_by
     WHERE cd.claim_id = $1 AND cd.hospital_id = $2
     ORDER BY cd.created_at DESC`,
    [claimId, hospitalId]
  );
  return result.rows.map(mapDocument);
}

async function deleteDocument(id, hospitalId) {
  const result = await db.query(
    `DELETE FROM claim_documents 
     WHERE id = $1 AND hospital_id = $2
     RETURNING id, object_key AS "objectKey"`,
    [id, hospitalId]
  );
  return result.rows[0] || null;
}

module.exports = {
  createProvider,
  updateProvider,
  getProviderById,
  getProviderByCode,
  listProviders,
  createPolicy,
  updatePolicy,
  getPolicyById,
  getPolicyByNumber,
  listPolicies,
  createClaim,
  updateClaimStatus,
  getClaimById,
  getClaimByNumber,
  listClaims,
  createDocument,
  getDocumentById,
  listDocuments,
  deleteDocument,
};

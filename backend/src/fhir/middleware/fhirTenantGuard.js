/**
 * fhirTenantGuard.js
 *
 * Middleware for FHIR routes that enforces multi-tenant isolation
 * using the FHIR logical ID scheme: "<hospitalId>-<internalId>".
 *
 * Parses the :id parameter, validates that the hospitalId segment matches
 * the authenticated user's hospitalId, and attaches the resolved IDs to req:
 *   req.fhir.hospitalId  — numeric hospital ID from the FHIR ID
 *   req.fhir.internalId  — numeric internal DB primary key
 *
 * super_admin bypasses the tenant check (can access any hospital's resources).
 *
 * For POST requests (no :id param), the hospitalId is taken from req.user.hospitalId.
 */

function parseFhirId(rawId) {
  if (!rawId || typeof rawId !== 'string') return null;
  const parts = rawId.split('-');
  if (parts.length < 2) return null;
  const hospitalId  = parseInt(parts[0], 10);
  const internalId  = parseInt(parts[1], 10);
  if (Number.isNaN(hospitalId) || Number.isNaN(internalId)) return null;
  return { hospitalId, internalId };
}

function buildFhirId(hospitalId, internalId) {
  return `${hospitalId}-${internalId}`;
}

function fhirTenantGuard(req, res, next) {
  if (!req.user) {
    return res.status(401).json(fhirOperationOutcome(401, 'Unauthorized', 'security'));
  }

  const rawId = req.params.id;

  // POST — no resource ID yet; attach hospitalId from user context
  if (!rawId) {
    req.fhir = { hospitalId: req.user.hospitalId };
    return next();
  }

  const parsed = parseFhirId(rawId);
  if (!parsed) {
    return res.status(400).json(
      fhirOperationOutcome(400, `Invalid FHIR ID format: "${rawId}". Expected "<hospitalId>-<internalId>".`, 'value')
    );
  }

  // super_admin can read across tenants
  if (req.user.role !== 'super_admin') {
    if (parsed.hospitalId !== Number(req.user.hospitalId)) {
      return res.status(403).json(
        fhirOperationOutcome(403, 'Forbidden: cross-tenant access denied', 'security')
      );
    }
  }

  req.fhir = { hospitalId: parsed.hospitalId, internalId: parsed.internalId };
  return next();
}

/**
 * Build a minimal FHIR R4 OperationOutcome for error responses.
 * @param {number} httpStatus
 * @param {string} diagnostics
 * @param {string} code  — FHIR issue code (e.g. 'not-found', 'security', 'value')
 */
function fhirOperationOutcome(httpStatus, diagnostics, code = 'processing') {
  const severityMap = {
    400: 'error', 401: 'error', 403: 'error', 404: 'error', 422: 'error', 500: 'fatal',
  };
  return {
    resourceType: 'OperationOutcome',
    issue: [{
      severity: severityMap[httpStatus] || 'error',
      code,
      diagnostics,
    }],
  };
}

module.exports = { fhirTenantGuard, parseFhirId, buildFhirId, fhirOperationOutcome };

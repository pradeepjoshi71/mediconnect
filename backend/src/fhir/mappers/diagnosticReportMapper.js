'use strict';

/**
 * diagnosticReportMapper.js
 *
 * Maps MediConnect lab_orders + lab_reports rows to a FHIR R4 DiagnosticReport resource.
 * Spec: https://hl7.org/fhir/R4/diagnosticreport.html
 *
 * Phase 10.3 — read-only; does not modify any existing tables.
 */

const { buildFhirId } = require('../middleware/fhirTenantGuard');

// ── Lab order status → FHIR status ───────────────────────────────────────────
const STATUS_MAP = {
  ORDERED:     'registered',
  PROCESSING:  'partial',
  COMPLETED:   'final',
  CANCELLED:   'cancelled',
};

function mapStatus(orderStatus) {
  return STATUS_MAP[String(orderStatus).toUpperCase()] || 'unknown';
}

/**
 * toFhirDiagnosticReport — convert a lab order (+ optional report) to FHIR R4 DiagnosticReport.
 *
 * @param {object} labOrder  — labRepository.findLabOrderById row
 * @param {object} [labReport] — labRepository.findLabReportById row (may be null if no report yet)
 * @returns {object} FHIR R4 DiagnosticReport resource
 */
function toFhirDiagnosticReport(labOrder, labReport) {
  if (!labOrder) return null;

  const fhirId        = buildFhirId(labOrder.hospitalId || 0, labOrder.id);
  const patientFhirId = buildFhirId(labOrder.hospitalId || 0, labOrder.patientId);
  const doctorFhirId  = labOrder.doctorId ? buildFhirId(labOrder.hospitalId || 0, labOrder.doctorId) : null;

  const resource = {
    resourceType: 'DiagnosticReport',
    id:     fhirId,
    status: mapStatus(labOrder.orderStatus),

    meta: {
      versionId:   '1',
      lastUpdated: labReport?.uploadedAt
        ? new Date(labReport.uploadedAt).toISOString()
        : labOrder.orderedAt ? new Date(labOrder.orderedAt).toISOString()
        : new Date().toISOString(),
      tag: [{
        system:  'https://mediconnect.io/tenant',
        code:    String(labOrder.hospitalId || 0),
        display: `Hospital ${labOrder.hospitalId}`,
      }],
    },

    // ── Category ──────────────────────────────────────────────────────────────
    category: [{
      coding: [{
        system:  'http://terminology.hl7.org/CodeSystem/v2-0074',
        code:    _categoryCode(labOrder.testCategory),
        display: labOrder.testCategory || 'Laboratory',
      }],
    }],

    // ── Code (Test name + code) ───────────────────────────────────────────────
    code: {
      coding: [{
        system:  'https://mediconnect.io/fhir/CodeSystem/lab-test',
        code:    labOrder.testCode || String(labOrder.testId),
        display: labOrder.testName,
      }],
      text: labOrder.testName,
    },

    // ── Subject ───────────────────────────────────────────────────────────────
    subject: {
      reference: `Patient/${patientFhirId}`,
      display:   labOrder.patientName || undefined,
    },

    // ── Performer ─────────────────────────────────────────────────────────────
    performer: doctorFhirId ? [{
      reference: `Practitioner/${doctorFhirId}`,
      display:   labOrder.doctorName || undefined,
    }] : undefined,

    // ── Effective ─────────────────────────────────────────────────────────────
    effectiveDateTime: labOrder.orderedAt
      ? new Date(labOrder.orderedAt).toISOString()
      : undefined,

    // ── Issued ────────────────────────────────────────────────────────────────
    issued: labReport?.uploadedAt
      ? new Date(labReport.uploadedAt).toISOString()
      : undefined,

    // ── Conclusion / Notes ────────────────────────────────────────────────────
    conclusion: labReport?.reportNotes || undefined,

    // ── PresentedForm (file reference if available) ───────────────────────────
    presentedForm: labReport?.reportFileUrl ? [{
      url:         labReport.reportFileUrl,
      contentType: 'application/pdf',
      title:       `${labOrder.testName} Report`,
    }] : undefined,
  };

  return _clean(resource);
}

// Map lab category to HL7 v2-0074 code
function _categoryCode(category) {
  const cat = String(category || '').toLowerCase();
  if (cat.includes('haematol') || cat.includes('hematol')) return 'HM';
  if (cat.includes('biochem') || cat.includes('chem'))     return 'CH';
  if (cat.includes('micro'))                               return 'MB';
  if (cat.includes('pathol'))                              return 'CP';
  if (cat.includes('immun'))                               return 'IM';
  if (cat.includes('radi') || cat.includes('imag'))        return 'RAD';
  return 'LAB';
}

function _clean(obj) {
  return JSON.parse(JSON.stringify(obj, (_, v) => (v === undefined ? undefined : v)));
}

module.exports = { toFhirDiagnosticReport };

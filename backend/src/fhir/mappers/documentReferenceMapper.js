'use strict';

/**
 * documentReferenceMapper.js
 *
 * Maps a MediConnect files/documents row to a FHIR R4 DocumentReference resource.
 * Spec: https://hl7.org/fhir/R4/documentreference.html
 *
 * Phase 10.3 — read-only; does not modify any existing tables.
 */

const { buildFhirId } = require('../middleware/fhirTenantGuard');

// ── Document category → FHIR type coding ─────────────────────────────────────
const DOC_TYPE_MAP = {
  report:       { code: '11502-2', display: 'Laboratory report' },
  prescription: { code: '57833-6', display: 'Prescription for medication' },
  imaging:      { code: '18748-4', display: 'Diagnostic imaging study' },
  insurance:    { code: '64290-0', display: 'Health insurance card' },
  discharge:    { code: '18842-5', display: 'Discharge summary' },
  referral:     { code: '57133-1', display: 'Referral note' },
  other:        { code: '34133-9', display: 'Summary of episode note' },
};

const LOINC_SYSTEM = 'http://loinc.org';

function mapDocType(category) {
  return DOC_TYPE_MAP[String(category).toLowerCase()] || DOC_TYPE_MAP.other;
}

/**
 * toFhirDocumentReference — convert a file_metadata / files row to FHIR R4 DocumentReference.
 *
 * @param {object} fileRow — file/document row with hospitalId, patientId, originalName, fileCategory, mimeType, etc.
 * @returns {object} FHIR R4 DocumentReference resource
 */
function toFhirDocumentReference(fileRow) {
  if (!fileRow) return null;

  const fhirId        = buildFhirId(fileRow.hospitalId, fileRow.id);
  const patientFhirId = buildFhirId(fileRow.hospitalId, fileRow.patientId);
  const docType       = mapDocType(fileRow.fileCategory || fileRow.file_category || 'other');

  const resource = {
    resourceType: 'DocumentReference',
    id:     fhirId,
    status: 'current',

    meta: {
      versionId:   '1',
      lastUpdated: fileRow.createdAt ? new Date(fileRow.createdAt).toISOString() : new Date().toISOString(),
      tag: [{
        system:  'https://mediconnect.io/tenant',
        code:    String(fileRow.hospitalId),
        display: `Hospital ${fileRow.hospitalId}`,
      }],
    },

    // ── Type ─────────────────────────────────────────────────────────────────
    type: {
      coding: [{
        system:  LOINC_SYSTEM,
        code:    docType.code,
        display: docType.display,
      }],
      text: fileRow.fileCategory || 'Document',
    },

    // ── Category ──────────────────────────────────────────────────────────────
    category: [{
      coding: [{
        system:  'http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category',
        code:    'clinical-note',
        display: 'Clinical Note',
      }],
    }],

    // ── Subject ───────────────────────────────────────────────────────────────
    subject: {
      reference: `Patient/${patientFhirId}`,
    },

    // ── Date ─────────────────────────────────────────────────────────────────
    date: fileRow.createdAt ? new Date(fileRow.createdAt).toISOString() : undefined,

    // ── Description ──────────────────────────────────────────────────────────
    description: fileRow.originalName || fileRow.file_name || undefined,

    // ── Content ──────────────────────────────────────────────────────────────
    content: [{
      attachment: {
        contentType: fileRow.mimeType || fileRow.mime_type || 'application/octet-stream',
        url:         fileRow.fileUrl  || fileRow.file_url  || undefined,
        title:       fileRow.originalName || fileRow.file_name || undefined,
        creation:    fileRow.createdAt ? new Date(fileRow.createdAt).toISOString() : undefined,
      },
    }],
  };

  return _clean(resource);
}

function _clean(obj) {
  return JSON.parse(JSON.stringify(obj, (_, v) => (v === undefined ? undefined : v)));
}

module.exports = { toFhirDocumentReference };

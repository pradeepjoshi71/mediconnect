/**
 * patientMapper.js
 *
 * Maps a MediConnect patient DB row to a FHIR R4 Patient resource.
 * Spec: https://hl7.org/fhir/R4/patient.html
 */
'use strict';

const { buildFhirId } = require('../middleware/fhirTenantGuard');

// ── Gender code mapping ──────────────────────────────────────────────────────
const GENDER_MAP = {
  male:   'male',
  female: 'female',
  other:  'other',
  M:      'male',
  F:      'female',
  O:      'other',
  m:      'male',
  f:      'female',
};

function mapGender(raw) {
  return GENDER_MAP[raw] || 'unknown';
}

/**
 * toFhirPatient — convert a patientRepository row to FHIR R4 Patient.
 *
 * @param {object} row  — result of findPatientById / createPatient read-back
 * @returns {object}    FHIR R4 Patient resource
 */
function toFhirPatient(row) {
  if (!row) return null;
  const fhirId   = buildFhirId(row.hospitalId, row.id);
  const nameParts = (row.fullName || '').trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName  = nameParts.slice(1).join(' ') || '';

  const resource = {
    resourceType: 'Patient',
    id: fhirId,
    meta: {
      versionId: '1',
      lastUpdated: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      tag: [{
        system: 'https://mediconnect.io/tenant',
        code:   String(row.hospitalId),
        display: `Hospital ${row.hospitalId}`,
      }],
    },

    // ── Identifiers ───────────────────────────────────────────────────────────
    identifier: [
      {
        use:    'official',
        system: `https://mediconnect.io/fhir/hospital/${row.hospitalId}/mrn`,
        value:  row.medicalRecordNumber || fhirId,
      },
      {
        use:    'secondary',
        system: 'https://mediconnect.io/fhir/internal-id',
        value:  String(row.id),
      },
    ],

    active: (row.status || 'active') === 'active',

    // ── Name ─────────────────────────────────────────────────────────────────
    name: [{
      use:    'official',
      text:   row.fullName || '',
      family: lastName  || undefined,
      given:  firstName  ? [firstName] : undefined,
    }],

    // ── Telecom ──────────────────────────────────────────────────────────────
    telecom: [
      row.phone ? { system: 'phone', value: row.phone, use: 'mobile' } : null,
      row.email ? { system: 'email', value: row.email, use: 'home'   } : null,
    ].filter(Boolean),

    gender: mapGender(row.gender),

    birthDate: row.dateOfBirth
      ? new Date(row.dateOfBirth).toISOString().slice(0, 10)
      : undefined,

    // ── Address ───────────────────────────────────────────────────────────────
    address: row.address ? [{
      use:  'home',
      text: typeof row.address === 'object'
        ? [row.address.line, row.address.city, row.address.state, row.address.country].filter(Boolean).join(', ')
        : String(row.address),
    }] : undefined,

    // ── Emergency Contact ─────────────────────────────────────────────────────
    contact: (row.emergencyContactName || row.emergencyContactPhone) ? [{
      relationship: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0131', code: 'C' }] }],
      name: row.emergencyContactName ? { text: row.emergencyContactName } : undefined,
      telecom: row.emergencyContactPhone ? [{ system: 'phone', value: row.emergencyContactPhone }] : undefined,
    }] : undefined,

    // ── Extensions (non-standard fields) ─────────────────────────────────────
    extension: _buildPatientExtensions(row),
  };

  return _clean(resource);
}

function _buildPatientExtensions(row) {
  const extensions = [];

  if (row.bloodGroup) {
    extensions.push({
      url:         'https://mediconnect.io/fhir/StructureDefinition/blood-group',
      valueString: row.bloodGroup,
    });
  }

  if (row.insuranceProvider) {
    extensions.push({
      url: 'https://mediconnect.io/fhir/StructureDefinition/insurance',
      extension: [
        { url: 'provider',     valueString: row.insuranceProvider },
        { url: 'memberId',     valueString: row.insuranceMemberId     || undefined },
        { url: 'policyNumber', valueString: row.insurancePolicyNumber || undefined },
      ].filter(e => e.valueString),
    });
  }

  if (Array.isArray(row.allergies) && row.allergies.length) {
    extensions.push({
      url:         'https://mediconnect.io/fhir/StructureDefinition/allergies-summary',
      valueString: row.allergies.join(', '),
    });
  }

  if (Array.isArray(row.chronicConditions) && row.chronicConditions.length) {
    extensions.push({
      url:         'https://mediconnect.io/fhir/StructureDefinition/chronic-conditions',
      valueString: row.chronicConditions.join(', '),
    });
  }

  return extensions.length ? extensions : undefined;
}

/** fromFhirPatient — extract DB-compatible fields from a FHIR Patient POST body. */
function fromFhirPatient(body, hospitalId) {
  const name     = body.name?.[0] || {};
  const telecom  = body.telecom   || [];
  const address  = body.address?.[0];
  const contact  = body.contact?.[0];
  const ext      = body.extension || [];

  const firstName = (name.given || []).join(' ');
  const lastName  = name.family || '';
  const fullName  = name.text || `${firstName} ${lastName}`.trim();

  const phone = telecom.find(t => t.system === 'phone')?.value || null;
  const email = telecom.find(t => t.system === 'email')?.value;

  if (!email) throw Object.assign(new Error('Patient.telecom must include an email entry'), { statusCode: 422 });
  if (!fullName) throw Object.assign(new Error('Patient.name is required'), { statusCode: 422 });

  const bloodGroupExt  = ext.find(e => e.url?.includes('blood-group'));
  const insuranceExt   = ext.find(e => e.url?.includes('insurance'));

  const insProvider    = insuranceExt?.extension?.find(e => e.url === 'provider')?.valueString;
  const insMemberId    = insuranceExt?.extension?.find(e => e.url === 'memberId')?.valueString;
  const insPolicyNum   = insuranceExt?.extension?.find(e => e.url === 'policyNumber')?.valueString;

  return {
    hospitalId,
    first_name:             firstName,
    last_name:              lastName,
    fullName,
    email,
    phone,
    gender:                 body.gender || null,
    dateOfBirth:            body.birthDate || null,
    address:                address?.text || null,
    bloodGroup:             bloodGroupExt?.valueString || null,
    emergencyContactName:   contact?.name?.text || null,
    emergencyContactPhone:  contact?.telecom?.[0]?.value || null,
    insuranceProvider:      insProvider || null,
    insuranceMemberId:      insMemberId || null,
    insurancePolicyNumber:  insPolicyNum || null,
    // POST via FHIR creates with a default password; user must reset via portal
    password:               null,
  };
}

/** Remove keys whose value is undefined (keeps JSON clean). */
function _clean(obj) {
  return JSON.parse(JSON.stringify(obj, (_, v) => (v === undefined ? undefined : v)));
}

module.exports = { toFhirPatient, fromFhirPatient };

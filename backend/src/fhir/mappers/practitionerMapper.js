/**
 * practitionerMapper.js
 *
 * Maps a MediConnect doctor DB row to a FHIR R4 Practitioner resource.
 * Spec: https://hl7.org/fhir/R4/practitioner.html
 */
'use strict';

const { buildFhirId } = require('../middleware/fhirTenantGuard');

/**
 * toFhirPractitioner — convert a doctorRepository row to FHIR R4 Practitioner.
 * Works with both findDoctorById and findDoctorByIdWithinHospital rows.
 */
function toFhirPractitioner(row) {
  if (!row) return null;
  const fhirId   = buildFhirId(row.hospitalId, row.id);
  const nameParts = (row.fullName || row.full_name || '').trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName  = nameParts.slice(1).join(' ') || '';

  const resource = {
    resourceType: 'Practitioner',
    id: fhirId,
    meta: {
      versionId:   '1',
      lastUpdated: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      tag: [{
        system:  'https://mediconnect.io/tenant',
        code:    String(row.hospitalId),
        display: `Hospital ${row.hospitalId}`,
      }],
    },

    // ── Identifiers ───────────────────────────────────────────────────────────
    identifier: [
      row.employeeCode || row.employee_code ? {
        use:    'official',
        system: `https://mediconnect.io/fhir/hospital/${row.hospitalId}/employee`,
        value:  row.employeeCode || row.employee_code,
      } : null,
      row.licenseNumber ? {
        use:    'official',
        type:   { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'MD' }] },
        system: 'https://mediconnect.io/fhir/license',
        value:  row.licenseNumber,
      } : null,
    ].filter(Boolean),

    active: (row.status || 'active') === 'active',

    // ── Name ─────────────────────────────────────────────────────────────────
    name: [{
      use:    'official',
      text:   row.fullName || row.full_name || '',
      family: lastName  || undefined,
      given:  firstName ? [firstName] : undefined,
      prefix: ['Dr.'],
    }],

    // ── Telecom ──────────────────────────────────────────────────────────────
    telecom: [
      row.phone ? { system: 'phone', value: row.phone, use: 'work' } : null,
      row.email ? { system: 'email', value: row.email, use: 'work' } : null,
    ].filter(Boolean),

    // ── Qualification ─────────────────────────────────────────────────────────
    qualification: _buildQualifications(row),

    // ── Extension (department, rating, experience) ────────────────────────────
    extension: _buildPractitionerExtensions(row),
  };

  return _clean(resource);
}

function _buildQualifications(row) {
  const quals = [];

  if (row.qualification) {
    quals.push({
      identifier: [{
        system: 'https://mediconnect.io/fhir/qualification',
        value:  row.qualification,
      }],
      code: {
        coding: [{
          system:  'http://terminology.hl7.org/CodeSystem/v2-0360',
          code:    'MD',
          display: row.qualification,
        }],
        text: row.qualification,
      },
    });
  }

  if (row.specialization) {
    quals.push({
      code: {
        coding: [{
          system:  'https://mediconnect.io/fhir/CodeSystem/specialization',
          code:    row.specialization.toLowerCase().replace(/\s+/g, '-'),
          display: row.specialization,
        }],
        text: row.specialization,
      },
    });
  }

  return quals.length ? quals : undefined;
}

function _buildPractitionerExtensions(row) {
  const extensions = [];

  if (row.department) {
    extensions.push({ url: 'https://mediconnect.io/fhir/StructureDefinition/department', valueString: row.department });
  }
  if (row.experienceYears != null || row.years_experience != null) {
    const yrs = row.experienceYears ?? row.years_experience;
    extensions.push({ url: 'https://mediconnect.io/fhir/StructureDefinition/experience-years', valueInteger: yrs });
  }
  if (row.rating != null) {
    extensions.push({ url: 'https://mediconnect.io/fhir/StructureDefinition/rating', valueDecimal: parseFloat(row.rating) });
  }
  if (row.biography) {
    extensions.push({ url: 'https://mediconnect.io/fhir/StructureDefinition/biography', valueString: row.biography });
  }

  return extensions.length ? extensions : undefined;
}

/** fromFhirPractitioner — extract DB-compatible fields from a FHIR Practitioner POST body. */
function fromFhirPractitioner(body, hospitalId) {
  const name    = body.name?.[0] || {};
  const telecom = body.telecom   || [];
  const quals   = body.qualification || [];
  const exts    = body.extension || [];

  const firstName = (name.given || []).join(' ');
  const lastName  = name.family || '';
  const fullName  = name.text || `${firstName} ${lastName}`.trim();

  const email = telecom.find(t => t.system === 'email')?.value;
  const phone = telecom.find(t => t.system === 'phone')?.value || null;

  if (!email)    throw Object.assign(new Error('Practitioner.telecom must include an email entry'), { statusCode: 422 });
  if (!fullName) throw Object.assign(new Error('Practitioner.name is required'), { statusCode: 422 });

  const qualification   = quals.find(q => q.code?.text)?.code?.text || null;
  const specialization  = quals.filter(q => q.code?.coding?.[0]?.system?.includes('specialization'))[0]?.code?.text || null;
  const department      = exts.find(e => e.url?.includes('department'))?.valueString || null;
  const experienceYears = exts.find(e => e.url?.includes('experience-years'))?.valueInteger ?? 0;
  const consultationFee = exts.find(e => e.url?.includes('consultation-fee'))?.valueDecimal ?? 0;

  if (!specialization) throw Object.assign(new Error('Practitioner.qualification must include a specialization entry'), { statusCode: 422 });

  return {
    hospitalId,
    fullName,
    email,
    phone,
    specialization,
    qualification,
    department,
    experienceYears,
    consultationFeeCents: Math.round(consultationFee * 100),
    // Created via FHIR; password reset required through portal
    password: null,
  };
}

function _clean(obj) {
  return JSON.parse(JSON.stringify(obj, (_, v) => (v === undefined ? undefined : v)));
}

module.exports = { toFhirPractitioner, fromFhirPractitioner };

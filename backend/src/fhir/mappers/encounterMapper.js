/**
 * encounterMapper.js
 *
 * Maps a MediConnect medical_record DB row to a FHIR R4 Encounter resource.
 * Spec: https://hl7.org/fhir/R4/encounter.html
 *
 * MediConnect medical_records represent clinical encounters (doctor visit + notes).
 * They map to FHIR Encounter with status=finished, class=AMB (ambulatory).
 */
'use strict';

const { buildFhirId } = require('../middleware/fhirTenantGuard');

// ── Encounter type mapping ────────────────────────────────────────────────────
const ENCOUNTER_CLASS_MAP = {
  outpatient:  { code: 'AMB',  display: 'Ambulatory' },
  inpatient:   { code: 'IMP',  display: 'Inpatient encounter' },
  emergency:   { code: 'EMER', display: 'Emergency' },
  telemedicine:{ code: 'VR',   display: 'Virtual' },
  follow_up:   { code: 'AMB',  display: 'Ambulatory' },
  routine:     { code: 'AMB',  display: 'Ambulatory' },
};

const ACT_CODE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v3-ActCode';

function mapEncounterClass(encounterType) {
  const mapped = ENCOUNTER_CLASS_MAP[encounterType?.toLowerCase()] || ENCOUNTER_CLASS_MAP.outpatient;
  return { system: ACT_CODE_SYSTEM, code: mapped.code, display: mapped.display };
}

/**
 * toFhirEncounter — convert a clinicalRepository medical_record row to FHIR R4 Encounter.
 */
function toFhirEncounter(row) {
  if (!row) return null;
  const fhirId        = buildFhirId(row.hospitalId, row.id);
  const patientFhirId = buildFhirId(row.hospitalId, row.patientId);
  const doctorFhirId  = buildFhirId(row.hospitalId, row.doctorId);

  const resource = {
    resourceType: 'Encounter',
    id: fhirId,
    meta: {
      versionId:   '1',
      lastUpdated: row.updatedAt  ? new Date(row.updatedAt).toISOString()
                 : row.createdAt ? new Date(row.createdAt).toISOString()
                 : new Date().toISOString(),
      tag: [{
        system:  'https://mediconnect.io/tenant',
        code:    String(row.hospitalId),
        display: `Hospital ${row.hospitalId}`,
      }],
    },

    // Medical records are always completed encounters
    status: 'finished',

    class: mapEncounterClass(row.encounterType),

    // ── Type ─────────────────────────────────────────────────────────────────
    type: row.encounterType ? [{
      coding: [{
        system:  'https://mediconnect.io/fhir/CodeSystem/encounter-type',
        code:    row.encounterType,
        display: _titleCase(row.encounterType),
      }],
      text: _titleCase(row.encounterType),
    }] : undefined,

    // ── Subject (Patient) ─────────────────────────────────────────────────────
    subject: {
      reference: `Patient/${patientFhirId}`,
      display:   row.patientName || undefined,
    },

    // ── Participant (Practitioner) ────────────────────────────────────────────
    participant: [{
      type: [{
        coding: [{
          system:  'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
          code:    'PPRF',
          display: 'Primary performer',
        }],
      }],
      individual: {
        reference: `Practitioner/${doctorFhirId}`,
        display:   row.doctorName || undefined,
      },
    }],

    // ── Period ───────────────────────────────────────────────────────────────
    period: {
      start: row.createdAt ? new Date(row.createdAt).toISOString() : undefined,
      end:   row.updatedAt ? new Date(row.updatedAt).toISOString() : undefined,
    },

    // ── Reason ───────────────────────────────────────────────────────────────
    reasonCode: _buildReasonCodes(row),

    // ── Appointment reference ─────────────────────────────────────────────────
    appointment: row.appointmentId ? [{
      reference: `Appointment/${buildFhirId(row.hospitalId, row.appointmentId)}`,
    }] : undefined,

    // ── Hospitalization / Diagnosis Summary ───────────────────────────────────
    diagnosis: _buildDiagnosis(row),

    // ── Extension (clinical notes, vitals, follow-up) ─────────────────────────
    extension: _buildEncounterExtensions(row),
  };

  return _clean(resource);
}

function _buildReasonCodes(row) {
  const codes = [];
  if (row.chiefComplaint) {
    codes.push({ text: row.chiefComplaint });
  }
  if (row.diagnosis) {
    codes.push({
      coding: [{
        system:  'http://hl7.org/fhir/sid/icd-10',
        display: row.diagnosis,
      }],
      text: row.diagnosis,
    });
  }
  return codes.length ? codes : undefined;
}

function _buildDiagnosis(row) {
  if (!row.diagnosis) return undefined;
  return [{
    condition: {
      display: row.diagnosis,
    },
    use: {
      coding: [{
        system:  'http://terminology.hl7.org/CodeSystem/diagnosis-role',
        code:    'AD',
        display: 'Admission diagnosis',
      }],
    },
    rank: 1,
  }];
}

function _buildEncounterExtensions(row) {
  const ext = [];

  if (row.clinicalNotes || row.doctorNotes) {
    ext.push({
      url: 'https://mediconnect.io/fhir/StructureDefinition/clinical-notes',
      valueString: [row.clinicalNotes, row.doctorNotes].filter(Boolean).join('\n---\n'),
    });
  }

  if (row.vitals && typeof row.vitals === 'object' && Object.keys(row.vitals).length) {
    ext.push({
      url:         'https://mediconnect.io/fhir/StructureDefinition/vitals',
      valueString: JSON.stringify(row.vitals),
    });
  }

  if (row.followUpInDays != null) {
    ext.push({
      url:          'https://mediconnect.io/fhir/StructureDefinition/follow-up-days',
      valueInteger: row.followUpInDays,
    });
  }

  if (row.specialization) {
    ext.push({
      url:         'https://mediconnect.io/fhir/StructureDefinition/specialization',
      valueString: row.specialization,
    });
  }

  return ext.length ? ext : undefined;
}

/** fromFhirEncounter — extract createMedicalRecord-compatible fields from FHIR Encounter POST. */
function fromFhirEncounter(body, hospitalId) {
  const subjectRef     = body.subject?.reference;
  const participantRef = body.participant?.[0]?.individual?.reference;

  if (!subjectRef)     throw Object.assign(new Error('Encounter.subject (Patient reference) is required'), { statusCode: 422 });
  if (!participantRef) throw Object.assign(new Error('Encounter.participant[0].individual (Practitioner reference) is required'), { statusCode: 422 });

  const { parseFhirId } = require('../middleware/fhirTenantGuard');
  const patientFhirId   = subjectRef.split('/')[1];
  const doctorFhirId    = participantRef.split('/')[1];
  const parsedPatient   = parseFhirId(patientFhirId);
  const parsedDoctor    = parseFhirId(doctorFhirId);

  if (!parsedPatient) throw Object.assign(new Error(`Invalid Patient FHIR ID: ${patientFhirId}`), { statusCode: 422 });
  if (!parsedDoctor)  throw Object.assign(new Error(`Invalid Practitioner FHIR ID: ${doctorFhirId}`), { statusCode: 422 });

  const exts     = body.extension || [];
  const vitalsExt = exts.find(e => e.url?.includes('vitals'));
  const notesExt  = exts.find(e => e.url?.includes('clinical-notes'));
  const followExt = exts.find(e => e.url?.includes('follow-up-days'));

  const reasonText   = body.reasonCode?.[0]?.text  || null;
  const diagnosisText = body.reasonCode?.[1]?.text || body.diagnosis?.[0]?.condition?.display || null;
  const encounterType = body.type?.[0]?.coding?.[0]?.code || 'outpatient';

  const appointmentRef = body.appointment?.[0]?.reference;
  const apptParsed     = appointmentRef ? parseFhirId(appointmentRef.split('/')[1]) : null;

  let vitals = null;
  if (vitalsExt?.valueString) {
    try { vitals = JSON.parse(vitalsExt.valueString); } catch { vitals = null; }
  }

  return {
    hospitalId,
    patientId:    parsedPatient.internalId,
    doctorId:     parsedDoctor.internalId,
    appointmentId: apptParsed?.internalId || null,
    encounterType,
    chiefComplaint: reasonText,
    diagnosis:      diagnosisText || 'Unspecified',
    clinicalNotes:  notesExt?.valueString || null,
    doctorNotes:    null,
    vitals,
    labSummary:     null,
    followUpInDays: followExt?.valueInteger ?? null,
    prescriptions:  [],
  };
}

function _titleCase(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ') : str;
}

function _clean(obj) {
  return JSON.parse(JSON.stringify(obj, (_, v) => (v === undefined ? undefined : v)));
}

module.exports = { toFhirEncounter, fromFhirEncounter };

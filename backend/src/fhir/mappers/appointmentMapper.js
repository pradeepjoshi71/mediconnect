/**
 * appointmentMapper.js
 *
 * Maps a MediConnect appointment DB row to a FHIR R4 Appointment resource.
 * Spec: https://hl7.org/fhir/R4/appointment.html
 */
'use strict';

const { buildFhirId } = require('../middleware/fhirTenantGuard');

// ── Status mapping ────────────────────────────────────────────────────────────
// MediConnect statuses → FHIR Appointment status codes
const STATUS_MAP = {
  scheduled:   'booked',
  confirmed:   'booked',
  checked_in:  'arrived',
  in_progress: 'arrived',
  completed:   'fulfilled',
  cancelled:   'cancelled',
  no_show:     'noshow',
  pending:     'pending',
  waitlisted:  'waitlist',
};

function mapAppointmentStatus(raw) {
  return STATUS_MAP[raw] || 'proposed';
}

// ── Priority mapping ──────────────────────────────────────────────────────────
const PRIORITY_MAP = {
  routine:  4,
  urgent:   2,
  emergency: 1,
  asap:     2,
};

function mapPriority(raw) {
  return PRIORITY_MAP[raw?.toLowerCase()] ?? 4;
}

/**
 * toFhirAppointment — convert an appointmentRepository row to FHIR R4 Appointment.
 */
function toFhirAppointment(row) {
  if (!row) return null;
  const fhirId        = buildFhirId(row.hospitalId, row.id);
  const patientFhirId = buildFhirId(row.hospitalId, row.patientId);
  const doctorFhirId  = buildFhirId(row.hospitalId, row.doctorId);

  const resource = {
    resourceType: 'Appointment',
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

    status:   mapAppointmentStatus(row.status),
    priority: mapPriority(row.priority),

    // ── Service Type ──────────────────────────────────────────────────────────
    serviceType: row.appointmentType ? [{
      coding: [{
        system:  'https://mediconnect.io/fhir/CodeSystem/appointment-type',
        code:    row.appointmentType,
        display: _titleCase(row.appointmentType),
      }],
      text: _titleCase(row.appointmentType),
    }] : undefined,

    // ── Specialty ─────────────────────────────────────────────────────────────
    specialty: row.specialization ? [{
      coding: [{
        system:  'http://snomed.info/sct',
        display: row.specialization,
      }],
      text: row.specialization,
    }] : undefined,

    appointmentType: row.consultationMode ? {
      coding: [{
        system:  'http://terminology.hl7.org/CodeSystem/v2-0276',
        code:    row.consultationMode === 'telemedicine' ? 'TELEMEDICINE' : 'ROUTINE',
        display: _titleCase(row.consultationMode),
      }],
    } : undefined,

    // ── Reason ───────────────────────────────────────────────────────────────
    reasonCode: row.reason ? [{
      text: row.reason,
    }] : undefined,

    description: row.reason || undefined,

    // ── Timing ───────────────────────────────────────────────────────────────
    start: row.scheduledStart ? new Date(row.scheduledStart).toISOString() : undefined,
    end:   row.scheduledEnd   ? new Date(row.scheduledEnd).toISOString()   : undefined,

    // ── Participants ──────────────────────────────────────────────────────────
    participant: [
      {
        actor: {
          reference: `Patient/${patientFhirId}`,
          display:   row.patientName || undefined,
        },
        required: 'required',
        status:   'accepted',
      },
      {
        actor: {
          reference: `Practitioner/${doctorFhirId}`,
          display:   row.doctorName  || undefined,
        },
        required: 'required',
        status:   'accepted',
      },
    ],

    // ── Extension ─────────────────────────────────────────────────────────────
    extension: _buildAppointmentExtensions(row),
  };

  return _clean(resource);
}

function _buildAppointmentExtensions(row) {
  const ext = [];
  if (row.queueNumber != null) {
    ext.push({ url: 'https://mediconnect.io/fhir/StructureDefinition/queue-number', valueInteger: row.queueNumber });
  }
  if (row.cancellationReason) {
    ext.push({ url: 'https://mediconnect.io/fhir/StructureDefinition/cancellation-reason', valueString: row.cancellationReason });
  }
  return ext.length ? ext : undefined;
}

/** fromFhirAppointment — extract createAppointment-compatible fields. */
function fromFhirAppointment(body, hospitalId) {
  const participants = body.participant || [];

  const patientRef     = participants.find(p => p.actor?.reference?.startsWith('Patient/'));
  const practitionerRef = participants.find(p => p.actor?.reference?.startsWith('Practitioner/'));

  if (!patientRef)     throw Object.assign(new Error('Appointment.participant must include a Patient reference'), { statusCode: 422 });
  if (!practitionerRef) throw Object.assign(new Error('Appointment.participant must include a Practitioner reference'), { statusCode: 422 });
  if (!body.start)     throw Object.assign(new Error('Appointment.start is required'), { statusCode: 422 });

  // Parse FHIR IDs: "Patient/2-17" → internalId=17
  const { parseFhirId } = require('../middleware/fhirTenantGuard');
  const patientFhirId  = patientRef.actor.reference.split('/')[1];
  const doctorFhirId   = practitionerRef.actor.reference.split('/')[1];
  const parsedPatient  = parseFhirId(patientFhirId);
  const parsedDoctor   = parseFhirId(doctorFhirId);

  if (!parsedPatient) throw Object.assign(new Error(`Invalid Patient FHIR ID: ${patientFhirId}`), { statusCode: 422 });
  if (!parsedDoctor)  throw Object.assign(new Error(`Invalid Practitioner FHIR ID: ${doctorFhirId}`), { statusCode: 422 });

  const start = new Date(body.start);
  const end   = body.end ? new Date(body.end) : new Date(start.getTime() + 30 * 60 * 1000); // default 30 min

  // Reverse-map FHIR status to MediConnect status
  const REVERSE_STATUS = { booked: 'scheduled', arrived: 'checked_in', fulfilled: 'completed', cancelled: 'cancelled', noshow: 'no_show', pending: 'pending', waitlist: 'waitlisted' };
  const mcStatus = REVERSE_STATUS[body.status] || 'scheduled';

  return {
    hospitalId,
    patientId:       parsedPatient.internalId,
    doctorId:        parsedDoctor.internalId,
    scheduledStart:  start.toISOString(),
    scheduledEnd:    end.toISOString(),
    appointmentType: body.serviceType?.[0]?.coding?.[0]?.code || 'outpatient',
    consultationMode: body.appointmentType?.coding?.[0]?.code === 'TELEMEDICINE' ? 'telemedicine' : 'in-person',
    reason:          body.description || body.reasonCode?.[0]?.text || null,
    status:          mcStatus,
    priority:        body.priority === 1 ? 'emergency' : body.priority === 2 ? 'urgent' : 'routine',
    queueNumber:     null,
    waitingListRequested: body.status === 'waitlist',
  };
}

function _titleCase(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ') : str;
}

function _clean(obj) {
  return JSON.parse(JSON.stringify(obj, (_, v) => (v === undefined ? undefined : v)));
}

module.exports = { toFhirAppointment, fromFhirAppointment };

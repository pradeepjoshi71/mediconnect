/**
 * fhirController.js
 *
 * FHIR R4 resource controllers for:
 *   Patient, Practitioner, Appointment, Encounter
 *
 * Each GET handler:
 *   1. Reads req.fhir.{hospitalId, internalId} (set by fhirTenantGuard)
 *   2. Fetches from the existing repository
 *   3. Maps to FHIR R4 JSON
 *   4. Logs audit event
 *   5. Returns 200 or 404
 *
 * Each POST handler:
 *   1. Validates body against Zod schema
 *   2. Converts FHIR body to DB params
 *   3. Creates via existing repository
 *   4. Maps result to FHIR R4 JSON
 *   5. Logs audit event
 *   6. Returns 201 with Location header
 */
'use strict';

const patientRepo     = require('../../repositories/patientRepository');
const doctorRepo      = require('../../repositories/doctorRepository');
const appointmentRepo = require('../../repositories/appointmentRepository');
const clinicalRepo    = require('../../repositories/clinicalRepository');
const auditService    = require('../../services/auditService');
const logger          = require('../../utils/logger');

const { toFhirPatient,      fromFhirPatient }      = require('../mappers/patientMapper');
const { toFhirPractitioner, fromFhirPractitioner }  = require('../mappers/practitionerMapper');
const { toFhirAppointment,  fromFhirAppointment }   = require('../mappers/appointmentMapper');
const { toFhirEncounter,    fromFhirEncounter }     = require('../mappers/encounterMapper');

const {
  FhirPatientSchema, FhirPractitionerSchema,
  FhirAppointmentSchema, FhirEncounterSchema,
  validateFhir,
} = require('../validators/fhirValidators');

const { buildCapabilityStatement } = require('../capabilityStatement');
const { fhirOperationOutcome }     = require('../middleware/fhirTenantGuard');

// ── Helpers ───────────────────────────────────────────────────────────────────

function fhirNotFound(resourceType, id) {
  return fhirOperationOutcome(404, `${resourceType}/${id} not found`, 'not-found');
}

function fhirValidationError(err) {
  return {
    resourceType: 'OperationOutcome',
    issue: (err.issues || [err.message]).map(msg => ({
      severity:    'error',
      code:        'invalid',
      diagnostics: msg,
    })),
  };
}

async function _audit(action, entityType, entityId, req, newValue = null) {
  try {
    await auditService.recordAuditEvent({
      user:       req.user,
      action:     `fhir.${action}`,
      entityType: `fhir_${entityType.toLowerCase()}`,
      entityId:   String(entityId),
      newValue,
      context:    req.auditContext,
    });
  } catch (err) {
    logger.warn('fhirController: audit write failed', { error: err.message });
  }
}

// ── CapabilityStatement ───────────────────────────────────────────────────────

function getCapabilityStatement(req, res) {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.set('Content-Type', 'application/fhir+json');
  res.json(buildCapabilityStatement(baseUrl));
}

// ── Patient ───────────────────────────────────────────────────────────────────

async function getPatient(req, res, next) {
  try {
    const { hospitalId, internalId } = req.fhir;
    const row = await patientRepo.findPatientById(internalId, hospitalId);

    if (!row) {
      return res.status(404).set('Content-Type', 'application/fhir+json')
        .json(fhirNotFound('Patient', req.params.id));
    }

    await _audit('read', 'Patient', req.params.id, req);
    res.set('Content-Type', 'application/fhir+json').json(toFhirPatient(row));
  } catch (err) { next(err); }
}

async function createPatient(req, res, next) {
  try {
    const { error } = validateFhir(FhirPatientSchema, req.body);
    if (error) {
      return res.status(422).set('Content-Type', 'application/fhir+json')
        .json(fhirValidationError(error));
    }

    const { hospitalId } = req.fhir;
    let dbData;
    try {
      dbData = fromFhirPatient(req.body, hospitalId);
    } catch (convErr) {
      return res.status(convErr.statusCode || 422).set('Content-Type', 'application/fhir+json')
        .json(fhirOperationOutcome(convErr.statusCode || 422, convErr.message, 'invalid'));
    }

    const newId = await patientRepo.createPatient(hospitalId, dbData);
    const row   = await patientRepo.findPatientById(newId, hospitalId);
    const fhirResource = toFhirPatient(row);

    await _audit('create', 'Patient', req.params.id || newId, req, fhirResource);

    const location = `/api/fhir/Patient/${fhirResource.id}`;
    res.status(201)
      .set('Content-Type', 'application/fhir+json')
      .set('Location', location)
      .json(fhirResource);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).set('Content-Type', 'application/fhir+json')
        .json(fhirOperationOutcome(409, 'A patient with this email already exists in this hospital', 'duplicate'));
    }
    next(err);
  }
}

// ── Practitioner ──────────────────────────────────────────────────────────────

async function getPractitioner(req, res, next) {
  try {
    const { hospitalId, internalId } = req.fhir;
    const row = await doctorRepo.findDoctorByIdWithinHospital(internalId, hospitalId);

    if (!row) {
      return res.status(404).set('Content-Type', 'application/fhir+json')
        .json(fhirNotFound('Practitioner', req.params.id));
    }

    await _audit('read', 'Practitioner', req.params.id, req);
    res.set('Content-Type', 'application/fhir+json').json(toFhirPractitioner(row));
  } catch (err) { next(err); }
}

async function createPractitioner(req, res, next) {
  try {
    const { error } = validateFhir(FhirPractitionerSchema, req.body);
    if (error) {
      return res.status(422).set('Content-Type', 'application/fhir+json')
        .json(fhirValidationError(error));
    }

    const { hospitalId } = req.fhir;
    let dbData;
    try {
      dbData = fromFhirPractitioner(req.body, hospitalId);
    } catch (convErr) {
      return res.status(convErr.statusCode || 422).set('Content-Type', 'application/fhir+json')
        .json(fhirOperationOutcome(convErr.statusCode || 422, convErr.message, 'invalid'));
    }

    const newId = await doctorRepo.createDoctor(hospitalId, dbData);
    const row   = await doctorRepo.findDoctorByIdWithinHospital(newId, hospitalId);
    const fhirResource = toFhirPractitioner(row);

    await _audit('create', 'Practitioner', newId, req, fhirResource);

    const location = `/api/fhir/Practitioner/${fhirResource.id}`;
    res.status(201)
      .set('Content-Type', 'application/fhir+json')
      .set('Location', location)
      .json(fhirResource);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).set('Content-Type', 'application/fhir+json')
        .json(fhirOperationOutcome(409, 'A practitioner with this email already exists in this hospital', 'duplicate'));
    }
    next(err);
  }
}

// ── Appointment ───────────────────────────────────────────────────────────────

async function getAppointment(req, res, next) {
  try {
    const { hospitalId, internalId } = req.fhir;
    const row = await appointmentRepo.findAppointmentById(internalId, hospitalId);

    if (!row) {
      return res.status(404).set('Content-Type', 'application/fhir+json')
        .json(fhirNotFound('Appointment', req.params.id));
    }

    await _audit('read', 'Appointment', req.params.id, req);
    res.set('Content-Type', 'application/fhir+json').json(toFhirAppointment(row));
  } catch (err) { next(err); }
}

async function createAppointment(req, res, next) {
  try {
    const { error } = validateFhir(FhirAppointmentSchema, req.body);
    if (error) {
      return res.status(422).set('Content-Type', 'application/fhir+json')
        .json(fhirValidationError(error));
    }

    const { hospitalId } = req.fhir;
    let dbData;
    try {
      dbData = fromFhirAppointment(req.body, hospitalId);
    } catch (convErr) {
      return res.status(convErr.statusCode || 422).set('Content-Type', 'application/fhir+json')
        .json(fhirOperationOutcome(convErr.statusCode || 422, convErr.message, 'invalid'));
    }

    const newAppt = await appointmentRepo.createAppointment({ ...dbData, bookedByUserId: req.user.id });
    const fhirResource = toFhirAppointment(newAppt);

    await _audit('create', 'Appointment', newAppt.id, req, fhirResource);

    const location = `/api/fhir/Appointment/${fhirResource.id}`;
    res.status(201)
      .set('Content-Type', 'application/fhir+json')
      .set('Location', location)
      .json(fhirResource);
  } catch (err) { next(err); }
}

// ── Encounter ─────────────────────────────────────────────────────────────────

async function getEncounter(req, res, next) {
  try {
    const { hospitalId, internalId } = req.fhir;
    const row = await clinicalRepo.findMedicalRecordById(internalId, hospitalId);

    if (!row) {
      return res.status(404).set('Content-Type', 'application/fhir+json')
        .json(fhirNotFound('Encounter', req.params.id));
    }

    await _audit('read', 'Encounter', req.params.id, req);
    res.set('Content-Type', 'application/fhir+json').json(toFhirEncounter(row));
  } catch (err) { next(err); }
}

async function createEncounter(req, res, next) {
  try {
    const { error } = validateFhir(FhirEncounterSchema, req.body);
    if (error) {
      return res.status(422).set('Content-Type', 'application/fhir+json')
        .json(fhirValidationError(error));
    }

    const { hospitalId } = req.fhir;
    let dbData;
    try {
      dbData = fromFhirEncounter(req.body, hospitalId);
    } catch (convErr) {
      return res.status(convErr.statusCode || 422).set('Content-Type', 'application/fhir+json')
        .json(fhirOperationOutcome(convErr.statusCode || 422, convErr.message, 'invalid'));
    }

    const newId = await clinicalRepo.createMedicalRecordWithPrescriptions(dbData);
    const row   = await clinicalRepo.findMedicalRecordById(newId, hospitalId);
    const fhirResource = toFhirEncounter(row);

    await _audit('create', 'Encounter', newId, req, fhirResource);

    const location = `/api/fhir/Encounter/${fhirResource.id}`;
    res.status(201)
      .set('Content-Type', 'application/fhir+json')
      .set('Location', location)
      .json(fhirResource);
  } catch (err) { next(err); }
}

module.exports = {
  getCapabilityStatement,
  getPatient,      createPatient,
  getPractitioner, createPractitioner,
  getAppointment,  createAppointment,
  getEncounter,    createEncounter,
};

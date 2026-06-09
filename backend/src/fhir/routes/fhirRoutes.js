/**
 * fhirRoutes.js
 *
 * Express router for FHIR R4 endpoints.
 * Mounted at /api/fhir in app.js.
 *
 * Middleware stack per route:
 *   authMiddleware     — validates JWT, attaches req.user
 *   roleMiddleware     — enforces RBAC (allowed roles per resource)
 *   fhirTenantGuard   — parses FHIR ID, validates tenant ownership
 *
 * All endpoints return Content-Type: application/fhir+json.
 *
 * @swagger
 * tags:
 *   - name: FHIR R4
 *     description: |
 *       FHIR R4 compliant endpoints for interoperability.
 *       All resource IDs use the format: <hospitalId>-<internalId>
 *       Authentication: Bearer JWT (same token as /api/v1 endpoints)
 */

'use strict';

const { Router } = require('express');
const authMiddleware  = require('../../middlewares/authMiddleware');
const roleMiddleware  = require('../../middlewares/roleMiddleware');
const { fhirTenantGuard } = require('../middleware/fhirTenantGuard');
const ctrl = require('../controllers/fhirController');

const router = Router();

// Content-Type: application/fhir+json for all FHIR routes
router.use((req, res, next) => {
  res.set('X-FHIR-Version', '4.0.1');
  next();
});

// ─── Capability Statement (public — no auth required) ─────────────────────────
/**
 * @swagger
 * /api/fhir/metadata:
 *   get:
 *     tags: [FHIR R4]
 *     summary: FHIR R4 CapabilityStatement
 *     description: Returns the server's FHIR R4 CapabilityStatement. No authentication required.
 *     responses:
 *       200:
 *         description: CapabilityStatement resource
 *         content:
 *           application/fhir+json:
 *             schema:
 *               type: object
 *               properties:
 *                 resourceType: { type: string, example: CapabilityStatement }
 *                 fhirVersion:  { type: string, example: "4.0.1" }
 */
router.get('/metadata', ctrl.getCapabilityStatement);

// ─── Patient ──────────────────────────────────────────────────────────────────
const PATIENT_READERS = roleMiddleware(
  'super_admin', 'hospital_admin', 'doctor', 'nurse', 'receptionist'
);
const PATIENT_WRITERS = roleMiddleware(
  'super_admin', 'hospital_admin', 'receptionist'
);

/**
 * @swagger
 * /api/fhir/Patient/{id}:
 *   get:
 *     tags: [FHIR R4]
 *     summary: Get FHIR Patient by ID
 *     description: |
 *       Returns a FHIR R4 Patient resource.
 *       ID format: <hospitalId>-<patientId> (e.g. "2-17")
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, example: "2-17" }
 *         description: FHIR Patient ID (<hospitalId>-<patientId>)
 *     responses:
 *       200:
 *         description: FHIR R4 Patient resource
 *         content:
 *           application/fhir+json:
 *             schema:
 *               type: object
 *               properties:
 *                 resourceType: { type: string, example: Patient }
 *                 id:           { type: string, example: "2-17" }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden (cross-tenant or insufficient role) }
 *       404: { description: Patient not found }
 */
router.get(
  '/Patient/:id',
  authMiddleware,
  PATIENT_READERS,
  fhirTenantGuard,
  ctrl.getPatient
);

/**
 * @swagger
 * /api/fhir/Patient:
 *   post:
 *     tags: [FHIR R4]
 *     summary: Create FHIR Patient
 *     description: |
 *       Creates a new patient from a FHIR R4 Patient resource.
 *       Writes to the MediConnect patients table.
 *       Required: name[0], telecom (email), gender, birthDate
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/fhir+json:
 *           schema:
 *             type: object
 *             required: [resourceType, name, telecom]
 *             properties:
 *               resourceType: { type: string, enum: [Patient] }
 *               name:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     text:   { type: string, example: "John Doe" }
 *                     family: { type: string, example: "Doe" }
 *                     given:  { type: array, items: { type: string }, example: ["John"] }
 *               telecom:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     system: { type: string, enum: [phone, email] }
 *                     value:  { type: string }
 *               gender:    { type: string, enum: [male, female, other, unknown] }
 *               birthDate: { type: string, example: "1990-01-15" }
 *     responses:
 *       201:
 *         description: Patient created
 *         headers:
 *           Location: { schema: { type: string }, description: "FHIR Patient URL" }
 *         content:
 *           application/fhir+json:
 *             schema:
 *               type: object
 *       422: { description: Validation error (OperationOutcome) }
 */
router.post(
  '/Patient',
  authMiddleware,
  PATIENT_WRITERS,
  fhirTenantGuard,
  ctrl.createPatient
);

// ─── Practitioner ─────────────────────────────────────────────────────────────
const PRACTITIONER_READERS = roleMiddleware(
  'super_admin', 'hospital_admin', 'doctor', 'nurse', 'receptionist'
);
const PRACTITIONER_WRITERS = roleMiddleware(
  'super_admin', 'hospital_admin'
);

/**
 * @swagger
 * /api/fhir/Practitioner/{id}:
 *   get:
 *     tags: [FHIR R4]
 *     summary: Get FHIR Practitioner by ID
 *     description: Returns a FHIR R4 Practitioner resource (mapped from doctor profile).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, example: "2-1" }
 *     responses:
 *       200:
 *         description: FHIR R4 Practitioner resource
 *         content:
 *           application/fhir+json:
 *             schema:
 *               type: object
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Practitioner not found }
 */
router.get(
  '/Practitioner/:id',
  authMiddleware,
  PRACTITIONER_READERS,
  fhirTenantGuard,
  ctrl.getPractitioner
);

/**
 * @swagger
 * /api/fhir/Practitioner:
 *   post:
 *     tags: [FHIR R4]
 *     summary: Create FHIR Practitioner
 *     description: |
 *       Creates a new doctor from a FHIR R4 Practitioner resource.
 *       Required: name[0], telecom (email), qualification (specialization)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/fhir+json:
 *           schema:
 *             type: object
 *             required: [resourceType, name, telecom, qualification]
 *             properties:
 *               resourceType:  { type: string, enum: [Practitioner] }
 *               name:          { type: array }
 *               telecom:       { type: array }
 *               qualification: { type: array }
 *     responses:
 *       201:
 *         description: Practitioner created
 *         headers:
 *           Location: { schema: { type: string } }
 *       422: { description: Validation error }
 */
router.post(
  '/Practitioner',
  authMiddleware,
  PRACTITIONER_WRITERS,
  fhirTenantGuard,
  ctrl.createPractitioner
);

// ─── Appointment ──────────────────────────────────────────────────────────────
const APPOINTMENT_READERS = roleMiddleware(
  'super_admin', 'hospital_admin', 'doctor', 'nurse', 'receptionist', 'patient'
);
const APPOINTMENT_WRITERS = roleMiddleware(
  'super_admin', 'hospital_admin', 'doctor', 'receptionist'
);

/**
 * @swagger
 * /api/fhir/Appointment/{id}:
 *   get:
 *     tags: [FHIR R4]
 *     summary: Get FHIR Appointment by ID
 *     description: Returns a FHIR R4 Appointment resource.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, example: "2-5" }
 *     responses:
 *       200:
 *         description: FHIR R4 Appointment resource
 *         content:
 *           application/fhir+json:
 *             schema:
 *               type: object
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Appointment not found }
 */
router.get(
  '/Appointment/:id',
  authMiddleware,
  APPOINTMENT_READERS,
  fhirTenantGuard,
  ctrl.getAppointment
);

/**
 * @swagger
 * /api/fhir/Appointment:
 *   post:
 *     tags: [FHIR R4]
 *     summary: Create FHIR Appointment
 *     description: |
 *       Creates an appointment from a FHIR R4 Appointment resource.
 *       Required: status, start, participant (Patient + Practitioner references)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/fhir+json:
 *           schema:
 *             type: object
 *             required: [resourceType, status, start, participant]
 *             properties:
 *               resourceType: { type: string, enum: [Appointment] }
 *               status:       { type: string, enum: [proposed, pending, booked, arrived, fulfilled, cancelled, noshow, waitlist] }
 *               start:        { type: string, format: date-time }
 *               end:          { type: string, format: date-time }
 *               participant:
 *                 type: array
 *                 description: Must include Patient/<id> and Practitioner/<id>
 *     responses:
 *       201:
 *         description: Appointment created
 *         headers:
 *           Location: { schema: { type: string } }
 *       422: { description: Validation error }
 */
router.post(
  '/Appointment',
  authMiddleware,
  APPOINTMENT_WRITERS,
  fhirTenantGuard,
  ctrl.createAppointment
);

// ─── Encounter ────────────────────────────────────────────────────────────────
const ENCOUNTER_READERS = roleMiddleware(
  'super_admin', 'hospital_admin', 'doctor', 'nurse'
);
const ENCOUNTER_WRITERS = roleMiddleware(
  'super_admin', 'doctor'
);

/**
 * @swagger
 * /api/fhir/Encounter/{id}:
 *   get:
 *     tags: [FHIR R4]
 *     summary: Get FHIR Encounter by ID
 *     description: Returns a FHIR R4 Encounter resource (mapped from medical record).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, example: "2-3" }
 *     responses:
 *       200:
 *         description: FHIR R4 Encounter resource
 *         content:
 *           application/fhir+json:
 *             schema:
 *               type: object
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Encounter not found }
 */
router.get(
  '/Encounter/:id',
  authMiddleware,
  ENCOUNTER_READERS,
  fhirTenantGuard,
  ctrl.getEncounter
);

/**
 * @swagger
 * /api/fhir/Encounter:
 *   post:
 *     tags: [FHIR R4]
 *     summary: Create FHIR Encounter
 *     description: |
 *       Creates a clinical encounter (medical record) from a FHIR R4 Encounter resource.
 *       Required: status, class, subject (Patient), participant (Practitioner)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/fhir+json:
 *           schema:
 *             type: object
 *             required: [resourceType, status, class, subject, participant]
 *             properties:
 *               resourceType: { type: string, enum: [Encounter] }
 *               status:       { type: string, enum: [planned, arrived, in-progress, finished, cancelled] }
 *               class:        { type: object }
 *               subject:      { type: object, description: "Patient/<fhirId>" }
 *               participant:
 *                 type: array
 *                 description: "Must include Practitioner/<fhirId>"
 *     responses:
 *       201:
 *         description: Encounter created
 *         headers:
 *           Location: { schema: { type: string } }
 *       422: { description: Validation error }
 */
router.post(
  '/Encounter',
  authMiddleware,
  ENCOUNTER_WRITERS,
  fhirTenantGuard,
  ctrl.createEncounter
);

module.exports = router;

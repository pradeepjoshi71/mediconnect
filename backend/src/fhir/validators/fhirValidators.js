/**
 * fhirValidators.js
 *
 * Zod validation schemas for FHIR R4 POST request bodies.
 * These schemas enforce the minimum required fields for each resource type
 * while allowing additional FHIR fields to pass through.
 *
 * Uses Zod's .passthrough() so that valid extra FHIR fields are not stripped.
 */
'use strict';

const { z } = require('zod');

// ── Shared primitives ─────────────────────────────────────────────────────────

const FhirCoding = z.object({
  system:  z.string().optional(),
  code:    z.string().optional(),
  display: z.string().optional(),
}).passthrough();

const FhirCodeableConcept = z.object({
  coding: z.array(FhirCoding).optional(),
  text:   z.string().optional(),
}).passthrough();

const FhirHumanName = z.object({
  use:    z.enum(['usual', 'official', 'temp', 'nickname', 'anonymous', 'old', 'maiden']).optional(),
  text:   z.string().optional(),
  family: z.string().optional(),
  given:  z.array(z.string()).optional(),
  prefix: z.array(z.string()).optional(),
  suffix: z.array(z.string()).optional(),
}).passthrough().refine(
  n => n.text || n.family || (n.given && n.given.length),
  { message: 'HumanName must have at least one of: text, family, or given' }
);

const FhirContactPoint = z.object({
  system: z.enum(['phone', 'fax', 'email', 'pager', 'url', 'sms', 'other']).optional(),
  value:  z.string(),
  use:    z.enum(['home', 'work', 'temp', 'old', 'mobile']).optional(),
}).passthrough();

const FhirAddress = z.object({
  use:  z.enum(['home', 'work', 'temp', 'old', 'billing']).optional(),
  text: z.string().optional(),
  line: z.array(z.string()).optional(),
  city: z.string().optional(),
}).passthrough();

const FhirReference = z.object({
  reference: z.string(),
  display:   z.string().optional(),
}).passthrough();

const FhirExtension = z.object({
  url: z.string(),
}).passthrough();

// ── Patient ───────────────────────────────────────────────────────────────────

const FhirPatientSchema = z.object({
  resourceType: z.literal('Patient'),
  name: z.array(FhirHumanName).min(1, 'At least one name is required'),
  telecom: z.array(FhirContactPoint)
    .min(1, 'At least one telecom entry (email) is required')
    .refine(t => t.some(e => e.system === 'email'), {
      message: 'telecom must include at least one entry with system="email"',
    }),
  gender:    z.enum(['male', 'female', 'other', 'unknown']).optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'birthDate must be YYYY-MM-DD').optional(),
  address:   z.array(FhirAddress).optional(),
  contact:   z.array(z.object({
    name:   z.object({ text: z.string() }).passthrough().optional(),
    telecom: z.array(FhirContactPoint).optional(),
  }).passthrough()).optional(),
  extension: z.array(FhirExtension).optional(),
}).passthrough();

// ── Practitioner ──────────────────────────────────────────────────────────────

const FhirQualification = z.object({
  code: FhirCodeableConcept.optional(),
  identifier: z.array(z.object({
    system: z.string().optional(),
    value:  z.string().optional(),
  }).passthrough()).optional(),
}).passthrough();

const FhirPractitionerSchema = z.object({
  resourceType: z.literal('Practitioner'),
  name: z.array(FhirHumanName).min(1, 'At least one name is required'),
  telecom: z.array(FhirContactPoint)
    .min(1, 'At least one telecom entry (email) is required')
    .refine(t => t.some(e => e.system === 'email'), {
      message: 'telecom must include at least one entry with system="email"',
    }),
  qualification: z.array(FhirQualification)
    .min(1, 'At least one qualification entry (specialization) is required')
    .refine(
      qs => qs.some(q => q.code?.coding?.some(c => c.system?.includes('specialization')) || q.code?.text),
      { message: 'qualification must include a specialization entry' }
    ),
  extension: z.array(FhirExtension).optional(),
}).passthrough();

// ── Appointment ───────────────────────────────────────────────────────────────

const FhirAppointmentParticipant = z.object({
  actor:    FhirReference,
  required: z.enum(['required', 'optional', 'information-only']).optional(),
  status:   z.enum(['accepted', 'declined', 'tentative', 'needs-action']).optional(),
}).passthrough();

const FhirAppointmentSchema = z.object({
  resourceType: z.literal('Appointment'),
  status: z.enum([
    'proposed', 'pending', 'booked', 'arrived', 'fulfilled',
    'cancelled', 'noshow', 'entered-in-error', 'checked-in', 'waitlist',
  ]),
  start: z.string().datetime({ message: 'start must be an ISO 8601 datetime string' }),
  end:   z.string().datetime({ message: 'end must be an ISO 8601 datetime string' }).optional(),
  participant: z.array(FhirAppointmentParticipant)
    .min(2, 'Appointment must have at least 2 participants (Patient + Practitioner)')
    .refine(ps => ps.some(p => p.actor?.reference?.startsWith('Patient/')), {
      message: 'participant must include a Patient reference',
    })
    .refine(ps => ps.some(p => p.actor?.reference?.startsWith('Practitioner/')), {
      message: 'participant must include a Practitioner reference',
    }),
  serviceType: z.array(FhirCodeableConcept).optional(),
  description: z.string().optional(),
  priority:    z.number().int().min(0).optional(),
  extension:   z.array(FhirExtension).optional(),
}).passthrough();

// ── Encounter ─────────────────────────────────────────────────────────────────

const FhirEncounterParticipant = z.object({
  individual: FhirReference,
  type:       z.array(FhirCodeableConcept).optional(),
}).passthrough();

const FhirEncounterSchema = z.object({
  resourceType: z.literal('Encounter'),
  status: z.enum([
    'planned', 'arrived', 'triaged', 'in-progress', 'onleave',
    'finished', 'cancelled', 'entered-in-error', 'unknown',
  ]),
  class: FhirCoding,
  subject: FhirReference.refine(r => r.reference?.startsWith('Patient/'), {
    message: 'subject.reference must be a Patient reference (Patient/<fhirId>)',
  }),
  participant: z.array(FhirEncounterParticipant)
    .min(1, 'Encounter must have at least one participant (Practitioner)')
    .refine(ps => ps.some(p => p.individual?.reference?.startsWith('Practitioner/')), {
      message: 'participant must include a Practitioner reference',
    }),
  reasonCode:  z.array(FhirCodeableConcept).optional(),
  type:        z.array(FhirCodeableConcept).optional(),
  period:      z.object({ start: z.string().optional(), end: z.string().optional() }).optional(),
  extension:   z.array(FhirExtension).optional(),
}).passthrough();

// ── Validation helpers ────────────────────────────────────────────────────────

/**
 * Validate a POST body against the given Zod schema.
 * Returns { data } on success, { error } on failure.
 */
function validateFhir(schema, body) {
  const result = schema.safeParse(body);
  if (result.success) return { data: result.data };

  const issues = result.error.issues.map(i => `${i.path.join('.')||'root'}: ${i.message}`);
  const err    = Object.assign(
    new Error(`FHIR validation failed:\n  ${issues.join('\n  ')}`),
    { statusCode: 422, issues }
  );
  return { error: err };
}

module.exports = {
  FhirPatientSchema,
  FhirPractitionerSchema,
  FhirAppointmentSchema,
  FhirEncounterSchema,
  validateFhir,
};

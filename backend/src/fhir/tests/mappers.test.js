/**
 * mappers.test.js — Unit tests for FHIR R4 mapper functions.
 *
 * Run: node --test backend/src/fhir/tests/mappers.test.js
 */
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { toFhirPatient, fromFhirPatient }       = require('../mappers/patientMapper');
const { toFhirPractitioner, fromFhirPractitioner } = require('../mappers/practitionerMapper');
const { toFhirAppointment, fromFhirAppointment }   = require('../mappers/appointmentMapper');
const { toFhirEncounter, fromFhirEncounter }       = require('../mappers/encounterMapper');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const patientRow = {
  id:                    17,
  hospitalId:            2,
  userId:                42,
  fullName:              'John Doe',
  email:                 'john.doe@example.com',
  phone:                 '+91-9000000017',
  status:                'active',
  medicalRecordNumber:   'MRN-P-123456',
  dateOfBirth:           '1990-01-15',
  gender:                'male',
  bloodGroup:            'O+',
  address:               'Flat 12, MG Road, Bangalore',
  emergencyContactName:  'Jane Doe',
  emergencyContactPhone: '+91-9000000099',
  insuranceProvider:     'Star Health',
  insuranceMemberId:     'SH-001',
  insurancePolicyNumber: 'POL-987654',
  allergies:             ['Penicillin', 'Sulfa'],
  chronicConditions:     ['Hypertension'],
  created_at:            new Date('2024-01-01T00:00:00Z'),
};

const doctorRow = {
  id:             1,
  hospitalId:     2,
  userId:         10,
  fullName:       'Dr. Rohan Mehta',
  email:          'doctor@example.com',
  phone:          '+91-9000000002',
  specialization: 'Cardiology',
  qualification:  'MD',
  department:     'Cardiac Sciences',
  employeeCode:   'DOC-BLR-1001',
  licenseNumber:  'MCI-123456',
  experienceYears: 12,
  rating:         '4.8',
  biography:      'Senior cardiologist.',
  status:         'active',
  created_at:     new Date('2024-01-01T00:00:00Z'),
};

const appointmentRow = {
  id:              5,
  hospitalId:      2,
  patientId:       17,
  doctorId:        1,
  patientName:     'John Doe',
  doctorName:      'Dr. Rohan Mehta',
  scheduledStart:  new Date('2024-06-10T09:00:00Z'),
  scheduledEnd:    new Date('2024-06-10T09:30:00Z'),
  appointmentType: 'outpatient',
  consultationMode:'in-person',
  reason:          'Chest pain',
  status:          'scheduled',
  priority:        'routine',
  queueNumber:     3,
  createdAt:       new Date('2024-01-01T00:00:00Z'),
  updatedAt:       new Date('2024-01-01T00:00:00Z'),
  specialization:  'Cardiology',
};

const encounterRow = {
  id:            3,
  hospitalId:    2,
  patientId:     17,
  doctorId:      1,
  appointmentId: 5,
  patientName:   'John Doe',
  doctorName:    'Dr. Rohan Mehta',
  encounterType: 'outpatient',
  chiefComplaint:'Chest pain',
  diagnosis:     'Stable angina',
  clinicalNotes: 'Patient presented with intermittent chest pain.',
  vitals:        { bp: '120/80', hr: 72 },
  followUpInDays: 14,
  createdAt:     new Date('2024-06-10T09:00:00Z'),
  updatedAt:     new Date('2024-06-10T09:30:00Z'),
  specialization:'Cardiology',
};

// ── Patient Mapper ────────────────────────────────────────────────────────────

describe('toFhirPatient', () => {
  test('returns null for null input', () => {
    assert.equal(toFhirPatient(null), null);
  });

  test('sets resourceType to Patient', () => {
    const r = toFhirPatient(patientRow);
    assert.equal(r.resourceType, 'Patient');
  });

  test('builds FHIR ID as <hospitalId>-<id>', () => {
    const r = toFhirPatient(patientRow);
    assert.equal(r.id, '2-17');
  });

  test('maps gender correctly', () => {
    const r = toFhirPatient(patientRow);
    assert.equal(r.gender, 'male');
  });

  test('maps unknown gender to "unknown"', () => {
    const r = toFhirPatient({ ...patientRow, gender: 'xyz' });
    assert.equal(r.gender, 'unknown');
  });

  test('maps female gender variants', () => {
    assert.equal(toFhirPatient({ ...patientRow, gender: 'F' }).gender, 'female');
    assert.equal(toFhirPatient({ ...patientRow, gender: 'female' }).gender, 'female');
    assert.equal(toFhirPatient({ ...patientRow, gender: 'f' }).gender, 'female');
  });

  test('includes MRN identifier', () => {
    const r = toFhirPatient(patientRow);
    const mrn = r.identifier.find(i => i.use === 'official');
    assert.ok(mrn);
    assert.equal(mrn.value, 'MRN-P-123456');
  });

  test('includes name with family and given', () => {
    const r = toFhirPatient(patientRow);
    assert.equal(r.name[0].family, 'Doe');
    assert.deepEqual(r.name[0].given, ['John']);
  });

  test('includes email and phone telecom', () => {
    const r = toFhirPatient(patientRow);
    const email = r.telecom.find(t => t.system === 'email');
    const phone = r.telecom.find(t => t.system === 'phone');
    assert.equal(email.value, 'john.doe@example.com');
    assert.equal(phone.value, '+91-9000000017');
  });

  test('formats birthDate as YYYY-MM-DD', () => {
    const r = toFhirPatient(patientRow);
    assert.match(r.birthDate, /^\d{4}-\d{2}-\d{2}$/);
  });

  test('includes blood group extension', () => {
    const r = toFhirPatient(patientRow);
    const bloodExt = r.extension?.find(e => e.url.includes('blood-group'));
    assert.equal(bloodExt?.valueString, 'O+');
  });

  test('includes insurance extension', () => {
    const r = toFhirPatient(patientRow);
    const insExt = r.extension?.find(e => e.url.includes('insurance'));
    assert.ok(insExt);
    const provider = insExt.extension.find(e => e.url === 'provider');
    assert.equal(provider.valueString, 'Star Health');
  });

  test('includes emergency contact', () => {
    const r = toFhirPatient(patientRow);
    assert.ok(r.contact);
    assert.equal(r.contact[0].name.text, 'Jane Doe');
  });

  test('includes tenant meta tag', () => {
    const r = toFhirPatient(patientRow);
    assert.equal(r.meta.tag[0].code, '2');
  });

  test('does not include undefined keys in output', () => {
    const r = toFhirPatient({ ...patientRow, phone: null, address: null });
    const serialized = JSON.stringify(r);
    assert.ok(!serialized.includes('"undefined"'));
  });

  test('active field reflects user status', () => {
    assert.equal(toFhirPatient({ ...patientRow, status: 'active' }).active, true);
    assert.equal(toFhirPatient({ ...patientRow, status: 'inactive' }).active, false);
  });
});

describe('fromFhirPatient', () => {
  const body = {
    resourceType: 'Patient',
    name:    [{ family: 'Doe', given: ['John'], text: 'John Doe' }],
    telecom: [
      { system: 'email', value: 'john@example.com' },
      { system: 'phone', value: '+91-9000000017' },
    ],
    gender:    'male',
    birthDate: '1990-01-15',
  };

  test('extracts email and phone', () => {
    const d = fromFhirPatient(body, 2);
    assert.equal(d.email, 'john@example.com');
    assert.equal(d.phone, '+91-9000000017');
  });

  test('throws 422 when email missing', () => {
    const bad = { ...body, telecom: [{ system: 'phone', value: '123' }] };
    assert.throws(() => fromFhirPatient(bad, 2), { statusCode: 422 });
  });

  test('throws 422 when name missing', () => {
    const bad = { ...body, name: [] };
    assert.throws(() => fromFhirPatient(bad, 2), err => {
      assert.equal(err.statusCode, 422);
      return true;
    });
  });
});

// ── Practitioner Mapper ───────────────────────────────────────────────────────

describe('toFhirPractitioner', () => {
  test('returns null for null input', () => {
    assert.equal(toFhirPractitioner(null), null);
  });

  test('sets resourceType to Practitioner', () => {
    assert.equal(toFhirPractitioner(doctorRow).resourceType, 'Practitioner');
  });

  test('builds FHIR ID correctly', () => {
    assert.equal(toFhirPractitioner(doctorRow).id, '2-1');
  });

  test('includes qualification with specialization', () => {
    const r = toFhirPractitioner(doctorRow);
    const specQual = r.qualification?.find(q =>
      q.code?.coding?.[0]?.system?.includes('specialization')
    );
    assert.equal(specQual?.code?.text, 'Cardiology');
  });

  test('includes employee code identifier', () => {
    const r = toFhirPractitioner(doctorRow);
    const empId = r.identifier?.find(i => i.system?.includes('employee'));
    assert.equal(empId?.value, 'DOC-BLR-1001');
  });

  test('adds Dr. prefix to name', () => {
    const r = toFhirPractitioner(doctorRow);
    assert.deepEqual(r.name[0].prefix, ['Dr.']);
  });

  test('includes experience extension', () => {
    const r = toFhirPractitioner(doctorRow);
    const exp = r.extension?.find(e => e.url.includes('experience-years'));
    assert.equal(exp?.valueInteger, 12);
  });
});

// ── Appointment Mapper ────────────────────────────────────────────────────────

describe('toFhirAppointment', () => {
  test('sets resourceType to Appointment', () => {
    assert.equal(toFhirAppointment(appointmentRow).resourceType, 'Appointment');
  });

  test('builds FHIR ID correctly', () => {
    assert.equal(toFhirAppointment(appointmentRow).id, '2-5');
  });

  test('maps scheduled → booked', () => {
    assert.equal(toFhirAppointment(appointmentRow).status, 'booked');
  });

  test('maps completed → fulfilled', () => {
    assert.equal(toFhirAppointment({ ...appointmentRow, status: 'completed' }).status, 'fulfilled');
  });

  test('maps cancelled → cancelled', () => {
    assert.equal(toFhirAppointment({ ...appointmentRow, status: 'cancelled' }).status, 'cancelled');
  });

  test('maps no_show → noshow', () => {
    assert.equal(toFhirAppointment({ ...appointmentRow, status: 'no_show' }).status, 'noshow');
  });

  test('includes Patient and Practitioner participants', () => {
    const r = toFhirAppointment(appointmentRow);
    const patRef  = r.participant.find(p => p.actor.reference.startsWith('Patient/'));
    const docRef  = r.participant.find(p => p.actor.reference.startsWith('Practitioner/'));
    assert.equal(patRef.actor.reference, 'Patient/2-17');
    assert.equal(docRef.actor.reference, 'Practitioner/2-1');
  });

  test('formats start/end as ISO 8601', () => {
    const r = toFhirAppointment(appointmentRow);
    assert.match(r.start, /^\d{4}-\d{2}-\d{2}T/);
    assert.match(r.end,   /^\d{4}-\d{2}-\d{2}T/);
  });

  test('includes queue number extension', () => {
    const r = toFhirAppointment(appointmentRow);
    const qExt = r.extension?.find(e => e.url.includes('queue-number'));
    assert.equal(qExt?.valueInteger, 3);
  });
});

// ── Encounter Mapper ──────────────────────────────────────────────────────────

describe('toFhirEncounter', () => {
  test('sets resourceType to Encounter', () => {
    assert.equal(toFhirEncounter(encounterRow).resourceType, 'Encounter');
  });

  test('builds FHIR ID correctly', () => {
    assert.equal(toFhirEncounter(encounterRow).id, '2-3');
  });

  test('always sets status to finished', () => {
    assert.equal(toFhirEncounter(encounterRow).status, 'finished');
  });

  test('maps outpatient encounter to AMB class', () => {
    const r = toFhirEncounter(encounterRow);
    assert.equal(r.class.code, 'AMB');
  });

  test('maps emergency encounter to EMER class', () => {
    const r = toFhirEncounter({ ...encounterRow, encounterType: 'emergency' });
    assert.equal(r.class.code, 'EMER');
  });

  test('maps telemedicine to VR class', () => {
    const r = toFhirEncounter({ ...encounterRow, encounterType: 'telemedicine' });
    assert.equal(r.class.code, 'VR');
  });

  test('includes subject Patient reference', () => {
    const r = toFhirEncounter(encounterRow);
    assert.equal(r.subject.reference, 'Patient/2-17');
  });

  test('includes Practitioner participant', () => {
    const r = toFhirEncounter(encounterRow);
    assert.equal(r.participant[0].individual.reference, 'Practitioner/2-1');
  });

  test('includes appointment reference', () => {
    const r = toFhirEncounter(encounterRow);
    assert.equal(r.appointment[0].reference, 'Appointment/2-5');
  });

  test('includes chief complaint in reasonCode', () => {
    const r = toFhirEncounter(encounterRow);
    assert.equal(r.reasonCode[0].text, 'Chest pain');
  });

  test('includes clinical notes extension', () => {
    const r = toFhirEncounter(encounterRow);
    const notesExt = r.extension?.find(e => e.url.includes('clinical-notes'));
    assert.ok(notesExt?.valueString?.includes('intermittent chest pain'));
  });

  test('includes vitals extension as JSON string', () => {
    const r = toFhirEncounter(encounterRow);
    const vitalsExt = r.extension?.find(e => e.url.includes('vitals'));
    const vitals = JSON.parse(vitalsExt.valueString);
    assert.equal(vitals.bp, '120/80');
    assert.equal(vitals.hr, 72);
  });

  test('includes follow-up extension', () => {
    const r = toFhirEncounter(encounterRow);
    const followExt = r.extension?.find(e => e.url.includes('follow-up-days'));
    assert.equal(followExt?.valueInteger, 14);
  });
});

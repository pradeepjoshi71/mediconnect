/**
 * telemedicine.integration.test.js — Integration tests for Telemedicine Module.
 *
 * Tests run against the live dev server (http://localhost:5000).
 * The server must be running and seeded before executing these tests.
 *
 * Run: node --test backend/src/insurance/tests/telemedicine.integration.test.js
 */
'use strict';

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');

const BASE = process.env.TEST_BASE_URL || 'http://localhost:5000';
const V1 = `${BASE}/api/v1`;

const TEST_EMAIL = process.env.TEST_EMAIL || 'superadmin@mediconnect.local';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'Password@123';
const TEST_HOSPITAL = process.env.TEST_HOSPITAL || 'MCH-BLR';

let accessToken = '';
let hospitalId = 0;
let patientId = 0;
let doctorId = 0;
let appointmentId = 0;

// --- Helper for API calls ---
async function api(method, endpoint, body, token) {
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const opts = {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {})
  };

  const res = await fetch(`${V1}${endpoint}`, opts);
  let json;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, headers: res.headers, body: json };
}

// --- Tests ---
describe('Telemedicine Module REST API Tests', () => {
  // --- Setup ---
  before(async () => {
    // Login
    const { status, body } = await api('POST', '/auth/login', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      hospitalCode: TEST_HOSPITAL
    });

    if (status !== 200) {
      throw new Error(`Authentication failed during integration test setup: ${JSON.stringify(body)}`);
    }

    accessToken = body.accessToken;
    hospitalId = body.user?.hospitalId || body.hospitalId;

    // Retrieve patient
    const patientsRes = await api('GET', '/patients', null, accessToken);
    assert.equal(patientsRes.status, 200);
    const patientsList = patientsRes.body.patients || patientsRes.body;
    if (patientsList && patientsList.length > 0) {
      patientId = patientsList[0].patient_id || patientsList[0].id;
    }

    // Retrieve doctor
    const doctorsRes = await api('GET', '/doctors', null, accessToken);
    assert.equal(doctorsRes.status, 200);
    const doctorsList = doctorsRes.body.doctors || doctorsRes.body;
    if (doctorsList && doctorsList.length > 0) {
      doctorId = doctorsList[0].doctor_id || doctorsList[0].id;
    }

    // Create an appointment or find existing
    const startsAt = new Date(Date.now() + 86400000).toISOString(); // tomorrow
    const apptRes = await api('POST', '/appointments', {
      patientId,
      doctorId,
      startsAt,
      reason: 'Telemedicine Test Appointment',
      consultationMode: 'telemedicine'
    }, accessToken);

    if (apptRes.status === 201) {
      appointmentId = apptRes.body.id || apptRes.body.appointmentId;
    } else {
      // Fallback: list appointments and grab first
      const apptsRes = await api('GET', '/appointments', null, accessToken);
      if (apptsRes.status === 200) {
        const list = apptsRes.body.appointments || apptsRes.body;
        if (list && list.length > 0) {
          appointmentId = list[0].id;
        }
      }
    }

    if (!appointmentId) {
      throw new Error('Could not find or create a valid appointment for telemedicine integration test.');
    }
  });

  test('GET /appointments/:appointmentId/session gets or creates telemedicine session', async () => {
    const { status, body } = await api('GET', `/telemedicine/appointments/${appointmentId}/session`, null, accessToken);
    assert.equal(status, 200, JSON.stringify(body));
    assert.ok(body.session);
    assert.ok(body.session.roomCode);
    assert.equal(body.session.appointmentId, appointmentId);
  });

  test('PUT /appointments/:appointmentId/notes updates consultation notes', async () => {
    const payload = { notes: 'Updated telemedicine notes.' };
    const { status, body } = await api('PUT', `/telemedicine/appointments/${appointmentId}/notes`, payload, accessToken);
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.consultationNotes, 'Updated telemedicine notes.');
  });

  test('PUT /appointments/:appointmentId/recording updates recording metadata', async () => {
    const payload = {
      recordingMetadata: {
        duration: 120,
        url: 'http://test-recording-file.mp4',
        provider: 'self-hosted'
      }
    };
    const { status, body } = await api('PUT', `/telemedicine/appointments/${appointmentId}/recording`, payload, accessToken);
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.recordingMetadata?.url, 'http://test-recording-file.mp4');
  });

  test('POST /appointments/:appointmentId/messages sends chat messages', async () => {
    const payload = { body: 'Hello this is a real-time message relay.' };
    const { status, body } = await api('POST', `/telemedicine/appointments/${appointmentId}/messages`, payload, accessToken);
    assert.equal(status, 201, JSON.stringify(body));
    assert.equal(body.body, 'Hello this is a real-time message relay.');
  });

  test('GET /appointments/:appointmentId/messages lists session messages', async () => {
    const { status, body } = await api('GET', `/telemedicine/appointments/${appointmentId}/messages`, null, accessToken);
    assert.equal(status, 200);
    assert.ok(Array.isArray(body));
    assert.ok(body.length > 0);
  });

  test('GET /history lists telemedicine session history', async () => {
    const { status, body } = await api('GET', '/telemedicine/history', null, accessToken);
    assert.equal(status, 200);
    assert.ok(Array.isArray(body));
    const found = body.find(s => s.appointmentId === appointmentId);
    assert.ok(found);
  });

  test('POST /appointments/:appointmentId/session/end terminates the session', async () => {
    const { status, body } = await api('POST', `/telemedicine/appointments/${appointmentId}/session/end`, null, accessToken);
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.status, 'ended');
    assert.ok(body.endedAt);
  });
});

// --- Socket.IO Handlers Unit Verification ---
describe('Telemedicine Socket.IO Handlers Unit Tests', () => {
  const { attachSocketHandlers } = require('../../realtime/io');

  test('attachSocketHandlers registers signaling events on the mock socket', () => {
    const socket = {
      on(event, handler) { this.handlers[event] = handler; },
      handlers: {}
    };

    attachSocketHandlers(socket);

    assert.ok(socket.handlers['telemedicine:join-room']);
    assert.ok(socket.handlers['telemedicine:signal']);
    assert.ok(socket.handlers['telemedicine:leave-room']);
    assert.ok(socket.handlers['disconnect']);
  });

  test('telemedicine:signal relays the signaling offer to other room peers', () => {
    const socket = {
      userId: 1,
      appointmentId: appointmentId,
      on(event, handler) { this.handlers[event] = handler; },
      to(room) {
        this.relayRoom = room;
        return {
          emit: (event, payload) => {
            this.relayedEvent = event;
            this.relayedPayload = payload;
          }
        };
      },
      handlers: {}
    };

    attachSocketHandlers(socket);

    const signalHandler = socket.handlers['telemedicine:signal'];
    signalHandler({ appointmentId, signalData: { sdp: 'mock-sdp' } });

    assert.equal(socket.relayRoom, `telemedicine:${appointmentId}`);
    assert.equal(socket.relayedEvent, 'telemedicine:signal');
    assert.equal(socket.relayedPayload?.senderUserId, 1);
    assert.equal(socket.relayedPayload?.signalData?.sdp, 'mock-sdp');
  });
});

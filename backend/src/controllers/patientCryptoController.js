'use strict';

/**
 * patientCryptoController.js
 *
 * Demonstrates how to use the encrypted patient repository layer.
 * Encryption / decryption is fully transparent — the controller and the
 * React frontend always deal with plain-text values; the repository layer
 * handles everything automatically.
 *
 * Drop-in compatible with the existing patientRepository API contract.
 */

const patientRepository = require('../repositories/patientRepository');
const { AppError } = require('../utils/http');

// ─── GET /api/patients/:id ────────────────────────────────────────────────────
async function getPatient(req, res, next) {
  try {
    const { id } = req.params;
    const { hospitalId } = req.user;

    // Returns a fully decrypted patient object — phone, address, etc. are plain-text.
    // The repository layer decrypts transparently; no extra work needed here.
    const patient = await patientRepository.findPatientById(id, hospitalId);
    if (!patient) throw new AppError(404, 'Patient not found');

    // Frontend receives exactly what it always expected — plain-text fields.
    return res.json({ success: true, data: patient });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/patients ────────────────────────────────────────────────────────
async function listPatients(req, res, next) {
  try {
    const { search = '' } = req.query;
    const { hospitalId } = req.user;

    // All rows are decrypted in bulk by the repository — zero overhead here.
    const patients = await patientRepository.listPatients(hospitalId, search);

    return res.json({ success: true, data: patients });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/patients ───────────────────────────────────────────────────────
async function createPatient(req, res, next) {
  try {
    const { hospitalId } = req.user;
    const data = req.body; // Plain-text from frontend

    // Repository encrypts phone, address, emergency_contact_phone, insurance fields
    // before INSERT. No changes needed here; pass data through as-is.
    const patientId = await patientRepository.createPatient(hospitalId, data);

    // Re-fetch so the response includes the DB-generated MRN and is decrypted.
    const patient = await patientRepository.findPatientById(patientId, hospitalId);

    return res.status(201).json({ success: true, data: patient });
  } catch (err) {
    next(err);
  }
}

// ─── PUT /api/patients/:id ────────────────────────────────────────────────────
async function updatePatient(req, res, next) {
  try {
    const { id } = req.params;
    const { hospitalId } = req.user;
    const data = req.body; // Plain-text from frontend

    // Repository re-encrypts the incoming values before UPDATE.
    const updated = await patientRepository.updatePatient(hospitalId, id, data);
    if (!updated) throw new AppError(404, 'Patient not found');

    const patient = await patientRepository.findPatientById(id, hospitalId);
    return res.json({ success: true, data: patient });
  } catch (err) {
    next(err);
  }
}

module.exports = { getPatient, listPatients, createPatient, updatePatient };

const db = require("../config/db");

async function listMedicalRecordsByPatient(hospitalId, patientId) {
  const result = await db.query(
    `
      SELECT
        mr.id,
        mr.hospital_id AS "hospitalId",
        mr.patient_id AS "patientId",
        mr.appointment_id AS "appointmentId",
        mr.doctor_id AS "doctorId",
        mr.encounter_type AS "encounterType",
        mr.chief_complaint AS "chiefComplaint",
        mr.diagnosis,
        mr.clinical_notes AS "clinicalNotes",
        mr.doctor_notes AS "doctorNotes",
        mr.vitals,
        mr.lab_summary AS "labSummary",
        mr.follow_up_in_days AS "followUpInDays",
        mr.created_at AS "createdAt",
        mr.updated_at AS "updatedAt",
        u.full_name AS "doctorName",
        d.specialization
      FROM medical_records mr
      JOIN doctors d ON d.id = mr.doctor_id
      JOIN users u ON u.id = d.user_id
      WHERE mr.hospital_id = $1
        AND mr.patient_id = $2
      ORDER BY mr.created_at DESC
    `,
    [hospitalId, patientId]
  );
  return result.rows;
}

async function listPrescriptionsByRecordIds(hospitalId, recordIds) {
  if (!recordIds.length) return [];
  const result = await db.query(
    `
      SELECT
        id,
        hospital_id AS "hospitalId",
        medical_record_id AS "medicalRecordId",
        appointment_id AS "appointmentId",
        patient_id AS "patientId",
        doctor_id AS "doctorId",
        medication_name AS "medicationName",
        dosage,
        frequency,
        duration_days AS "durationDays",
        instructions,
        status,
        created_at AS "createdAt"
      FROM prescriptions
      WHERE hospital_id = $1
        AND medical_record_id = ANY($2::int[])
      ORDER BY created_at ASC
    `,
    [hospitalId, recordIds]
  );
  return result.rows;
}

async function getPatientOverview(hospitalId, patientId) {
  const result = await db.query(
    `
      SELECT
        p.id,
        p.hospital_id AS "hospitalId",
        p.user_id AS "userId",
        u.full_name AS "fullName",
        u.email,
        u.phone,
        p.medical_record_number AS "medicalRecordNumber",
        p.date_of_birth AS "dateOfBirth",
        p.gender,
        p.blood_group AS "bloodGroup",
        p.address,
        p.emergency_contact_name AS "emergencyContactName",
        p.emergency_contact_phone AS "emergencyContactPhone",
        p.insurance_provider AS "insuranceProvider",
        p.insurance_member_id AS "insuranceMemberId",
        p.allergies,
        p.chronic_conditions AS "chronicConditions",
        (
          SELECT COUNT(*)
          FROM appointments a
          WHERE a.hospital_id = p.hospital_id
            AND a.patient_id = p.id
        )::int AS "appointmentCount",
        (
          SELECT COUNT(*)
          FROM medical_records mr
          WHERE mr.hospital_id = p.hospital_id
            AND mr.patient_id = p.id
        )::int AS "recordCount"
      FROM patients p
      JOIN users u ON u.id = p.user_id
      WHERE p.id = $1
        AND p.hospital_id = $2
      LIMIT 1
    `,
    [patientId, hospitalId]
  );
  return result.rows[0] || null;
}

async function listPatientTimeline(hospitalId, patientId) {
  const result = await db.query(
    `
      SELECT *
      FROM (
        SELECT
          'appointment' AS type,
          a.id AS "entityId",
          a.scheduled_start AS "occurredAt",
          a.status,
          a.reason AS summary,
          du.full_name AS actor
        FROM appointments a
        JOIN doctors d ON d.id = a.doctor_id
        JOIN users du ON du.id = d.user_id
        WHERE a.hospital_id = $1
          AND a.patient_id = $2

        UNION ALL

        SELECT
          'medical_record' AS type,
          mr.id AS "entityId",
          mr.created_at AS "occurredAt",
          mr.diagnosis AS status,
          mr.chief_complaint AS summary,
          du.full_name AS actor
        FROM medical_records mr
        JOIN doctors d ON d.id = mr.doctor_id
        JOIN users du ON du.id = d.user_id
        WHERE mr.hospital_id = $1
          AND mr.patient_id = $2

        UNION ALL

        SELECT
          'file' AS type,
          f.id AS "entityId",
          f.created_at AS "occurredAt",
          f.file_category AS status,
          f.original_name AS summary,
          uploader.full_name AS actor
        FROM files f
        JOIN users uploader ON uploader.id = f.uploaded_by_user_id
        WHERE f.hospital_id = $1
          AND f.patient_id = $2
      ) timeline
      ORDER BY "occurredAt" DESC
      LIMIT 50
    `,
    [hospitalId, patientId]
  );
  return result.rows;
}

async function createMedicalRecordWithPrescriptions({
  hospitalId,
  patientId,
  appointmentId,
  doctorId,
  encounterType,
  chiefComplaint,
  diagnosis,
  clinicalNotes,
  doctorNotes,
  vitals,
  labSummary,
  followUpInDays,
  prescriptions,
}) {
  return db.withTransaction(async (client) => {
    const recordResult = await client.query(
      `
        INSERT INTO medical_records (
          hospital_id,
          patient_id,
          appointment_id,
          doctor_id,
          encounter_type,
          chief_complaint,
          diagnosis,
          clinical_notes,
          doctor_notes,
          vitals,
          lab_summary,
          follow_up_in_days
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `,
      [
        hospitalId,
        patientId,
        appointmentId || null,
        doctorId,
        encounterType,
        chiefComplaint || null,
        diagnosis,
        clinicalNotes || null,
        doctorNotes || null,
        vitals || {},
        labSummary || null,
        followUpInDays || null,
      ]
    );

    for (const item of prescriptions) {
      await client.query(
        `
          INSERT INTO prescriptions (
            hospital_id,
            medical_record_id,
            appointment_id,
            patient_id,
            doctor_id,
            medication_name,
            dosage,
            frequency,
            duration_days,
            instructions
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        [
          hospitalId,
          recordResult.rows[0].id,
          appointmentId || null,
          patientId,
          doctorId,
          item.medicationName,
          item.dosage,
          item.frequency,
          item.durationDays,
          item.instructions || null,
        ]
      );
    }

    return recordResult.rows[0].id;
  });
}

async function findMedicalRecordById(id, hospitalId) {
  const result = await db.query(
    `
      SELECT
        mr.id,
        mr.hospital_id AS "hospitalId",
        mr.patient_id AS "patientId",
        mr.appointment_id AS "appointmentId",
        mr.doctor_id AS "doctorId",
        mr.encounter_type AS "encounterType",
        mr.chief_complaint AS "chiefComplaint",
        mr.diagnosis,
        mr.clinical_notes AS "clinicalNotes",
        mr.doctor_notes AS "doctorNotes",
        mr.vitals,
        mr.lab_summary AS "labSummary",
        mr.follow_up_in_days AS "followUpInDays",
        mr.created_at AS "createdAt",
        pu.full_name AS "patientName",
        p.medical_record_number AS "medicalRecordNumber",
        du.full_name AS "doctorName",
        d.specialization
      FROM medical_records mr
      JOIN patients p ON p.id = mr.patient_id
      JOIN users pu ON pu.id = p.user_id
      JOIN doctors d ON d.id = mr.doctor_id
      JOIN users du ON du.id = d.user_id
      WHERE mr.id = $1
        AND mr.hospital_id = $2
      LIMIT 1
    `,
    [id, hospitalId]
  );
  return result.rows[0] || null;
}

module.exports = {
  listMedicalRecordsByPatient,
  listPrescriptionsByRecordIds,
  getPatientOverview,
  listPatientTimeline,
  createMedicalRecordWithPrescriptions,
  findMedicalRecordById,
  // diagnoses
  listDiagnosesByPatient,
  createDiagnosis,
  updateDiagnosis,
  deleteDiagnosis,
  // allergies
  listAllergiesByPatient,
  createAllergy,
  updateAllergy,
  deleteAllergy,
};

// ─── Diagnoses ────────────────────────────────────────────────────────────────

async function listDiagnosesByPatient(hospitalId, patientId) {
  const result = await db.query(
    `SELECT
       d.id,
       d.hospital_id      AS "hospitalId",
       d.medical_record_id AS "medicalRecordId",
       d.patient_id       AS "patientId",
       d.doctor_id        AS "doctorId",
       d.icd_code         AS "icdCode",
       d.description,
       d.severity,
       d.status,
       d.notes,
       d.onset_date       AS "onsetDate",
       d.resolved_date    AS "resolvedDate",
       d.created_at       AS "createdAt",
       d.updated_at       AS "updatedAt",
       u.full_name        AS "doctorName"
     FROM diagnoses d
     JOIN doctors dr ON dr.id = d.doctor_id
     JOIN users u   ON u.id  = dr.user_id
     WHERE d.hospital_id = $1
       AND d.patient_id  = $2
     ORDER BY d.created_at DESC`,
    [hospitalId, patientId]
  );
  return result.rows;
}

async function createDiagnosis({
  hospitalId, medicalRecordId, patientId, doctorId,
  icdCode, description, severity, status, notes, onsetDate,
}) {
  const result = await db.query(
    `INSERT INTO diagnoses
       (hospital_id, medical_record_id, patient_id, doctor_id,
        icd_code, description, severity, status, notes, onset_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id`,
    [hospitalId, medicalRecordId, patientId, doctorId,
     icdCode || null, description, severity || "moderate",
     status || "active", notes || null, onsetDate || null]
  );
  return result.rows[0].id;
}

async function updateDiagnosis(id, hospitalId, fields) {
  const result = await db.query(
    `UPDATE diagnoses
     SET  description  = COALESCE($3, description),
          icd_code     = COALESCE($4, icd_code),
          severity     = COALESCE($5, severity),
          status       = COALESCE($6, status),
          notes        = COALESCE($7, notes),
          onset_date   = COALESCE($8, onset_date),
          resolved_date= COALESCE($9, resolved_date),
          updated_at   = now()
     WHERE id = $1 AND hospital_id = $2
     RETURNING id`,
    [id, hospitalId,
     fields.description   || null,
     fields.icdCode       || null,
     fields.severity      || null,
     fields.status        || null,
     fields.notes         || null,
     fields.onsetDate     || null,
     fields.resolvedDate  || null]
  );
  return result.rows[0] || null;
}

async function deleteDiagnosis(id, hospitalId) {
  await db.query(
    `DELETE FROM diagnoses WHERE id = $1 AND hospital_id = $2`,
    [id, hospitalId]
  );
}

// ─── Allergies ────────────────────────────────────────────────────────────────

async function listAllergiesByPatient(hospitalId, patientId) {
  const result = await db.query(
    `SELECT
       id,
       hospital_id        AS "hospitalId",
       patient_id         AS "patientId",
       allergen,
       allergy_type       AS "allergyType",
       reaction,
       severity,
       status,
       onset_date         AS "onsetDate",
       notes,
       created_by_user_id AS "createdByUserId",
       created_at         AS "createdAt",
       updated_at         AS "updatedAt"
     FROM allergies
     WHERE hospital_id = $1 AND patient_id = $2
     ORDER BY created_at DESC`,
    [hospitalId, patientId]
  );
  return result.rows;
}

async function createAllergy({
  hospitalId, patientId, allergen, allergyType,
  reaction, severity, status, onsetDate, notes, createdByUserId,
}) {
  const result = await db.query(
    `INSERT INTO allergies
       (hospital_id, patient_id, allergen, allergy_type,
        reaction, severity, status, onset_date, notes, created_by_user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id`,
    [hospitalId, patientId, allergen, allergyType || "drug",
     reaction || null, severity || "moderate", status || "active",
     onsetDate || null, notes || null, createdByUserId || null]
  );
  return result.rows[0].id;
}

async function updateAllergy(id, hospitalId, fields) {
  const result = await db.query(
    `UPDATE allergies
     SET  allergen     = COALESCE($3, allergen),
          allergy_type = COALESCE($4, allergy_type),
          reaction     = COALESCE($5, reaction),
          severity     = COALESCE($6, severity),
          status       = COALESCE($7, status),
          onset_date   = COALESCE($8, onset_date),
          notes        = COALESCE($9, notes),
          updated_at   = now()
     WHERE id = $1 AND hospital_id = $2
     RETURNING id`,
    [id, hospitalId,
     fields.allergen     || null,
     fields.allergyType  || null,
     fields.reaction     || null,
     fields.severity     || null,
     fields.status       || null,
     fields.onsetDate    || null,
     fields.notes        || null]
  );
  return result.rows[0] || null;
}

async function deleteAllergy(id, hospitalId) {
  await db.query(
    `DELETE FROM allergies WHERE id = $1 AND hospital_id = $2`,
    [id, hospitalId]
  );
}


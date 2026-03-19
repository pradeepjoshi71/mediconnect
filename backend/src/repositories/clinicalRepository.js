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
};

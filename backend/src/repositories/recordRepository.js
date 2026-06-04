const db = require("../config/db");

async function listMedicalRecords(hospitalId, patientId) {
  const result = await db.query(
    `SELECT
       mr.id,
       mr.patient_id,
       mr.doctor_id,
       mr.appointment_id,
       mr.chief_complaint AS chief_complaint,
       mr.clinical_notes AS clinical_notes,
       mr.symptoms,
       mr.diagnosis,
       mr.treatment_plan,
       mr.prescription,
       mr.doctor_notes,
       mr.notes,
       mr.follow_up_date,
       mr.created_at,
       u_doc.full_name AS doctor_name,
       d.specialization AS doctor_specialization
     FROM medical_records mr
     JOIN doctors d ON d.id = mr.doctor_id
     JOIN users u_doc ON u_doc.id = d.user_id
     WHERE mr.hospital_id = $1 AND mr.patient_id = $2
     ORDER BY mr.created_at DESC`,
    [hospitalId, patientId]
  );
  return result.rows;
}

async function findMedicalRecordById(hospitalId, id) {
  const result = await db.query(
    `SELECT
       mr.*,
       mr.doctor_notes AS doctor_notes,
       mr.notes AS notes,
       u_doc.full_name AS doctor_name,
       d.specialization AS doctor_specialization
     FROM medical_records mr
     JOIN doctors d ON d.id = mr.doctor_id
     JOIN users u_doc ON u_doc.id = d.user_id
     WHERE mr.id = $1 AND mr.hospital_id = $2
     LIMIT 1`,
    [id, hospitalId]
  );
  return result.rows[0] || null;
}

async function createMedicalRecord(hospitalId, data) {
  const result = await db.query(
    `INSERT INTO medical_records (
       hospital_id, patient_id, doctor_id, appointment_id,
       symptoms, chief_complaint, diagnosis, treatment_plan, clinical_notes,
       prescription, doctor_notes, notes, follow_up_date
     )
     VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $7, $8, $9, $9, $10)
     RETURNING id`,
    [
      hospitalId,
      data.patient_id || data.patientId,
      data.doctor_id || data.doctorId,
      data.appointment_id || data.appointmentId || null,
      data.symptoms || "",
      data.diagnosis || "",
      data.treatment_plan || "",
      data.prescription || "",
      data.notes || data.doctor_notes || "",
      data.follow_up_date || data.followUpDate || null
    ]
  );
  return result.rows[0].id;
}

async function updateMedicalRecord(hospitalId, id, data) {
  const result = await db.query(
    `UPDATE medical_records
     SET symptoms = $1, chief_complaint = $1,
         diagnosis = $2,
         treatment_plan = $3, clinical_notes = $3,
         prescription = $4,
         doctor_notes = $5, notes = $5,
         follow_up_date = $6,
         updated_at = now()
     WHERE id = $7 AND hospital_id = $8
     RETURNING id`,
    [
      data.symptoms,
      data.diagnosis,
      data.treatment_plan,
      data.prescription || "",
      data.notes || data.doctor_notes || "",
      data.follow_up_date || data.followUpDate || null,
      id,
      hospitalId
    ]
  );
  return result.rows[0] || null;
}

async function listAllergies(patientId) {
  const result = await db.query(
    `SELECT * FROM patient_allergies WHERE patient_id = $1 ORDER BY id DESC`,
    [patientId]
  );
  return result.rows;
}

async function createAllergy(data) {
  const result = await db.query(
    `INSERT INTO patient_allergies (patient_id, allergy_name, severity, notes)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [data.patient_id || data.patientId, data.allergy_name || data.allergyName, data.severity, data.notes || null]
  );
  return result.rows[0];
}

async function listMedications(patientId) {
  const result = await db.query(
    `SELECT * FROM patient_medications WHERE patient_id = $1 ORDER BY id DESC`,
    [patientId]
  );
  return result.rows;
}

async function createMedication(data) {
  const result = await db.query(
    `INSERT INTO patient_medications (patient_id, medication_name, dosage, frequency, start_date, end_date)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      data.patient_id || data.patientId,
      data.medication_name || data.medicationName,
      data.dosage,
      data.frequency,
      data.start_date || data.startDate || null,
      data.end_date || data.endDate || null
    ]
  );
  return result.rows[0];
}

module.exports = {
  listMedicalRecords,
  findMedicalRecordById,
  createMedicalRecord,
  updateMedicalRecord,
  listAllergies,
  createAllergy,
  listMedications,
  createMedication,
};

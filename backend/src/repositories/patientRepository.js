const db = require("../config/db");
const {
  encryptFields,
  decryptFields,
  decryptRows,
  PATIENT_PII_FIELDS,
  PATIENT_PII_FIELDS_CAMEL,
} = require('../security/fieldCrypto');

function mapPatientRow(row) {
  if (!row) return null;
  const nameParts = (row.fullName || "").trim().split(/\s+/);
  const first_name = nameParts[0] || "";
  const last_name = nameParts.slice(1).join(" ") || "";
  return {
    ...row,
    patient_id: row.id,
    first_name,
    last_name,
  };
}

async function findPatientById(id, hospitalId) {
  const result = await db.query(
    `
      SELECT
        p.id,
        p.hospital_id AS "hospitalId",
        p.user_id AS "userId",
        u.full_name AS "fullName",
        u.email,
        u.phone,
        u.status AS "status",
        p.medical_record_number AS "medicalRecordNumber",
        p.date_of_birth AS "dateOfBirth",
        p.gender,
        p.blood_group AS "bloodGroup",
        p.emergency_contact_name AS "emergencyContactName",
        p.emergency_contact_phone AS "emergencyContactPhone",
        p.address,
        p.insurance_provider AS "insuranceProvider",
        p.insurance_member_id AS "insuranceMemberId",
        p.insurance_policy_number AS "insurancePolicyNumber",
        p.allergies,
        p.chronic_conditions AS "chronicConditions",
        p.created_at
      FROM patients p
      JOIN users u ON u.id = p.user_id
      WHERE p.id = $1
        AND p.hospital_id = $2
      LIMIT 1
    `,
    [id, hospitalId]
  );
  return mapPatientRow(decryptFields(result.rows[0], PATIENT_PII_FIELDS_CAMEL));
}

async function findPatientByUserId(userId, hospitalId) {
  const result = await db.query(
    `
      SELECT
        p.id,
        p.hospital_id AS "hospitalId",
        p.user_id AS "userId",
        u.full_name AS "fullName",
        u.email,
        u.phone,
        u.status AS "status",
        p.medical_record_number AS "medicalRecordNumber",
        p.date_of_birth AS "dateOfBirth",
        p.gender,
        p.blood_group AS "bloodGroup",
        p.emergency_contact_name AS "emergencyContactName",
        p.emergency_contact_phone AS "emergencyContactPhone",
        p.address,
        p.insurance_provider AS "insuranceProvider",
        p.insurance_member_id AS "insuranceMemberId",
        p.insurance_policy_number AS "insurancePolicyNumber",
        p.allergies,
        p.chronic_conditions AS "chronicConditions",
        p.created_at
      FROM patients p
      JOIN users u ON u.id = p.user_id
      WHERE p.user_id = $1
        AND p.hospital_id = $2
      LIMIT 1
    `,
    [userId, hospitalId]
  );
  return mapPatientRow(decryptFields(result.rows[0], PATIENT_PII_FIELDS_CAMEL));
}

async function listPatients(hospitalId, search = "") {
  // hospitalId is null when caller is super_admin (cross-tenant listing)
  const params = hospitalId ? [hospitalId] : [];
  const where = hospitalId ? [`p.hospital_id = $1`] : [];

  if (search) {
    params.push(`%${search}%`);
    where.push(
      `(u.full_name ILIKE $${params.length} OR p.medical_record_number ILIKE $${params.length} OR u.email ILIKE $${params.length})`
    );
  }

  const result = await db.query(
    `
      SELECT
        p.id,
        p.hospital_id AS "hospitalId",
        p.user_id AS "userId",
        u.full_name AS "fullName",
        u.email,
        u.phone,
        u.status AS "status",
        p.medical_record_number AS "medicalRecordNumber",
        p.date_of_birth AS "dateOfBirth",
        p.gender,
        p.blood_group AS "bloodGroup",
        p.insurance_provider AS "insuranceProvider",
        p.insurance_policy_number AS "insurancePolicyNumber",
        p.allergies,
        p.chronic_conditions AS "chronicConditions",
        p.created_at
      FROM patients p
      JOIN users u ON u.id = p.user_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY u.full_name ASC
      LIMIT 100
    `,
    params
  );
  return decryptRows(result.rows, PATIENT_PII_FIELDS_CAMEL).map(mapPatientRow);
}

async function createPatient(hospitalId, data) {
  return db.withTransaction(async (client) => {
    // Get role id for patient
    const roleResult = await client.query(`SELECT id FROM roles WHERE code = 'patient' LIMIT 1`);
    const roleId = roleResult.rows[0]?.id;
    if (!roleId) throw new Error("Patient role not found");

    // Split first_name and last_name or merge them into full_name
    const fullName = `${data.first_name || data.firstName || ""} ${data.last_name || data.lastName || ""}`.trim();
    
    // Hash password
    const bcrypt = require("bcrypt");
    const password = data.password || "Password@123";
    const passwordHash = await bcrypt.hash(password, 12);

    // Encrypt PII before INSERT
    const encryptedPhone = data.phone ? encryptFields({ phone: data.phone }, PATIENT_PII_FIELDS).phone : null;

    // Insert user
    const userResult = await client.query(
      `INSERT INTO users (hospital_id, role_id, full_name, email, password_hash, phone, status)
       VALUES ($1, $2, $3, lower($4), $5, $6, 'active')
       RETURNING id`,
      [
        hospitalId,
        roleId,
        fullName,
        data.email,
        passwordHash,
        encryptedPhone
      ]
    );
    const userId = userResult.rows[0].id;

    // Create user_role association
    await client.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, roleId]
    );

    // Generate MRN
    const mrn = `MRN-P-${Math.floor(100000 + Math.random() * 900000)}`;

    // Encrypt PII fields before patient INSERT
    const enc = encryptFields({
      emergency_contact_phone: data.emergency_contact_phone || data.emergencyContactPhone || null,
      address:                 data.address || null,
      insurance_policy_number: data.insurance_policy_number || data.insurancePolicyNumber || null,
    }, PATIENT_PII_FIELDS);

    // Insert patient profile
    const patientResult = await client.query(
      `INSERT INTO patients (
         hospital_id, user_id, medical_record_number, date_of_birth, gender,
         blood_group, emergency_contact_name, emergency_contact_phone, address,
         insurance_provider, insurance_policy_number
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        hospitalId,
        userId,
        mrn,
        data.date_of_birth || data.dateOfBirth || null,
        data.gender || null,
        data.blood_group || data.bloodGroup || null,
        data.emergency_contact_name || data.emergencyContactName || null,
        enc.emergency_contact_phone,
        enc.address,
        data.insurance_provider || data.insuranceProvider || null,
        enc.insurance_policy_number
      ]
    );

    return patientResult.rows[0].id;
  });
}

async function updatePatient(hospitalId, id, data) {
  return db.withTransaction(async (client) => {
    // Find patient user id and status
    const patResult = await client.query(
      `SELECT p.user_id, u.status FROM patients p JOIN users u ON u.id = p.user_id WHERE p.id = $1 AND p.hospital_id = $2`,
      [id, hospitalId]
    );
    const patient = patResult.rows[0];
    if (!patient) return false;

    const userId = patient.user_id;
    const currentStatus = patient.status;
    const fullName = `${data.first_name || data.firstName || ""} ${data.last_name || data.lastName || ""}`.trim();

    // Encrypt PII before UPDATE
    const encU = encryptFields({
      phone:                   data.phone || null,
      emergency_contact_phone: data.emergency_contact_phone || data.emergencyContactPhone || null,
      address:                 data.address || null,
      insurance_policy_number: data.insurance_policy_number || data.insurancePolicyNumber || null,
    }, PATIENT_PII_FIELDS);

    // Update user
    await client.query(
      `UPDATE users
       SET full_name = $1, email = lower($2), phone = $3, status = $4, updated_at = now()
       WHERE id = $5`,
      [
        fullName,
        data.email,
        encU.phone,
        data.status || currentStatus,
        userId
      ]
    );

    // Update patient profile
    await client.query(
      `UPDATE patients
       SET date_of_birth = $1, gender = $2, blood_group = $3, emergency_contact_name = $4,
           emergency_contact_phone = $5, address = $6, insurance_provider = $7, insurance_policy_number = $8, updated_at = now()
       WHERE id = $9`,
      [
        data.date_of_birth || data.dateOfBirth || null,
        data.gender || null,
        data.blood_group || data.bloodGroup || null,
        data.emergency_contact_name || data.emergencyContactName || null,
        encU.emergency_contact_phone,
        encU.address,
        data.insurance_provider || data.insuranceProvider || null,
        encU.insurance_policy_number,
        id
      ]
    );

    return true;
  });
}

module.exports = {
  findPatientById,
  findPatientByUserId,
  listPatients,
  createPatient,
  updatePatient,
};

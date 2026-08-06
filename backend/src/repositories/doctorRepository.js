const db = require("../config/db");

async function listDoctors({
  hospitalId,
  search = "",
  specialization = "",
  minExperience = 0,
  minRating = 0,
  sort = "rating",
  includeInactive = false,
  page,
  limit,
}) {
  // hospitalId is null when the caller is super_admin (cross-tenant listing)
  const where = hospitalId ? [`d.hospital_id = $1`] : [];
  const params = hospitalId ? [hospitalId] : [];

  if (!includeInactive) {
    where.push(`u.status = 'active'`);
  }

  if (search) {
    params.push(`%${search}%`);
    where.push(
      `(u.full_name ILIKE $${params.length} OR d.specialization ILIKE $${params.length} OR d.department ILIKE $${params.length} OR d.employee_code ILIKE $${params.length})`
    );
  }
  if (specialization) {
    params.push(specialization);
    where.push(`d.specialization = $${params.length}`);
  }
  if (minExperience) {
    params.push(minExperience);
    where.push(`d.experience_years >= $${params.length}`);
  }
  if (minRating) {
    params.push(minRating);
    where.push(`d.rating >= $${params.length}`);
  }

  const orderBy =
    sort === "experience"
      ? `d.experience_years DESC, d.rating DESC, u.full_name ASC`
      : sort === "fee"
        ? `d.consultation_fee_cents ASC, d.rating DESC, u.full_name ASC`
        : `d.rating DESC, d.experience_years DESC, u.full_name ASC`;

  // Get total count first
  const countResult = await db.query(
    `SELECT COUNT(*)::int
     FROM doctors d
     JOIN users u ON u.id = d.user_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`,
    params
  );
  const total = countResult.rows[0].count;

  let queryText = `
    SELECT
      d.id,
      u.id AS "userId",
      u.full_name AS "fullName",
      u.full_name AS "full_name",
      u.email,
      u.phone,
      d.specialization,
      d.qualification,
      d.department,
      d.experience_years AS "experienceYears",
      d.experience_years AS "years_experience",
      d.rating,
      d.consultation_fee_cents AS "consultationFeeCents",
      d.consultation_fee_cents AS "consultation_fee_cents",
      (d.consultation_fee_cents::numeric / 100.0) AS "consultation_fee",
      d.biography,
      d.employee_code AS "employee_id",
      d.employee_code AS "employee_code",
      u.status,
      CASE WHEN u.status = 'active' THEN 'AVAILABLE' ELSE 'UNAVAILABLE' END AS "availability_status",
      d.created_at
    FROM doctors d
    JOIN users u ON u.id = d.user_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY ${orderBy}
  `;

  const limitValue = limit ? Number(limit) : null;
  const pageValue = page ? Number(page) : 1;

  if (limitValue !== null) {
    const offsetValue = (pageValue - 1) * limitValue;
    params.push(limitValue);
    queryText += ` LIMIT $${params.length}`;
    params.push(offsetValue);
    queryText += ` OFFSET $${params.length}`;
  }

  const result = await db.query(queryText, params);

  if (limitValue !== null) {
    const pages = Math.ceil(total / limitValue);
    return {
      rows: result.rows,
      metadata: {
        total,
        page: pageValue,
        limit: limitValue,
        pages,
      },
    };
  }

  return result.rows;
}

async function findDoctorById(id) {
  const result = await db.query(
    `
      SELECT
        d.id,
        d.hospital_id AS "hospitalId",
        d.user_id AS "userId",
        u.full_name AS "fullName",
        u.full_name AS "full_name",
        u.email,
        u.phone,
        d.specialization,
        d.qualification,
        d.department,
        d.employee_code AS "employeeCode",
        d.employee_code AS "employee_id",
        d.employee_code AS "employee_code",
        d.license_number AS "licenseNumber",
        d.experience_years AS "experienceYears",
        d.experience_years AS "years_experience",
        d.rating,
        d.consultation_fee_cents AS "consultationFeeCents",
        d.consultation_fee_cents AS "consultation_fee_cents",
        (d.consultation_fee_cents::numeric / 100.0) AS "consultation_fee",
        d.biography,
        u.status,
        CASE WHEN u.status = 'active' THEN 'AVAILABLE' ELSE 'UNAVAILABLE' END AS "availability_status",
        d.created_at
      FROM doctors d
      JOIN users u ON u.id = d.user_id
      WHERE d.id = $1
      LIMIT 1
    `,
    [id]
  );
  return result.rows[0] || null;
}

async function findDoctorByIdWithinHospital(id, hospitalId) {
  const result = await db.query(
    `
      SELECT
        d.id,
        d.hospital_id AS "hospitalId",
        d.user_id AS "userId",
        u.full_name AS "fullName",
        u.full_name AS "full_name",
        u.email,
        u.phone,
        d.specialization,
        d.qualification,
        d.department,
        d.employee_code AS "employeeCode",
        d.employee_code AS "employee_id",
        d.employee_code AS "employee_code",
        d.license_number AS "licenseNumber",
        d.experience_years AS "experienceYears",
        d.experience_years AS "years_experience",
        d.rating,
        d.consultation_fee_cents AS "consultationFeeCents",
        d.consultation_fee_cents AS "consultation_fee_cents",
        (d.consultation_fee_cents::numeric / 100.0) AS "consultation_fee",
        d.biography,
        u.status,
        CASE WHEN u.status = 'active' THEN 'AVAILABLE' ELSE 'UNAVAILABLE' END AS "availability_status",
        d.created_at
      FROM doctors d
      JOIN users u ON u.id = d.user_id
      WHERE d.id = $1
        AND d.hospital_id = $2
      LIMIT 1
    `,
    [id, hospitalId]
  );
  return result.rows[0] || null;
}

async function findDoctorByUserId(userId, hospitalId) {
  const result = await db.query(
    `
      SELECT
        d.id,
        d.hospital_id AS "hospitalId",
        d.user_id AS "userId",
        u.full_name AS "fullName",
        u.full_name AS "full_name",
        u.email,
        d.specialization,
        d.qualification,
        d.department,
        d.consultation_fee_cents AS "consultationFeeCents",
        d.consultation_fee_cents AS "consultation_fee_cents",
        (d.consultation_fee_cents::numeric / 100.0) AS "consultation_fee",
        u.status,
        CASE WHEN u.status = 'active' THEN 'AVAILABLE' ELSE 'UNAVAILABLE' END AS "availability_status",
        d.created_at
      FROM doctors d
      JOIN users u ON u.id = d.user_id
      WHERE d.user_id = $1
        AND d.hospital_id = $2
      LIMIT 1
    `,
    [userId, hospitalId]
  );
  return result.rows[0] || null;
}

async function createDoctor(hospitalId, data) {
  return db.withTransaction(async (client) => {
    // Get role id for doctor
    const roleResult = await client.query(`SELECT id FROM roles WHERE code = 'doctor' LIMIT 1`);
    const roleId = roleResult.rows[0]?.id;
    if (!roleId) throw new Error("Doctor role not found");

    // Insert user
    const userResult = await client.query(
      `INSERT INTO users (hospital_id, role_id, full_name, email, password_hash, phone, status)
       VALUES ($1, $2, $3, lower($4), $5, $6, $7)
       RETURNING id`,
      [
        hospitalId,
        roleId,
        data.fullName || data.full_name,
        data.email,
        data.passwordHash,
        data.phone || null,
        data.status || 'active'
      ]
    );
    const userId = userResult.rows[0].id;

    // Create user_role association
    await client.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, roleId]
    );

    // Insert doctor profile
    const doctorResult = await client.query(
      `INSERT INTO doctors (
         hospital_id, user_id, employee_code, specialization, department,
         license_number, experience_years, consultation_fee_cents, biography, qualification
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        hospitalId,
        userId,
        data.employee_id || data.employee_code,
        data.specialization,
        data.department || 'General',
        data.license_number || 'LIC-' + (data.employee_id || data.employee_code),
        data.years_experience || data.experience_years || 0,
        data.consultation_fee_cents !== undefined && data.consultation_fee_cents !== null ? data.consultation_fee_cents : (data.consultation_fee !== undefined && data.consultation_fee !== null ? data.consultation_fee * 100 : 5000),
        data.biography || null,
        data.qualification || 'MD'
      ]
    );

    return doctorResult.rows[0].id;
  });
}

async function updateDoctor(hospitalId, id, data) {
  return db.withTransaction(async (client) => {
    // Fetch doctor record to get userId and existing license_number
    const docResult = await client.query(
      `SELECT user_id, license_number FROM doctors WHERE id = $1 AND hospital_id = $2`,
      [id, hospitalId]
    );
    const doctor = docResult.rows[0];
    if (!doctor) return false;

    const userId = doctor.user_id;

    // Update user
    await client.query(
      `UPDATE users
       SET full_name = $1, email = lower($2), phone = $3, status = $4, updated_at = now()
       WHERE id = $5`,
      [
        data.fullName || data.full_name,
        data.email,
        data.phone || null,
        data.status || 'active',
        userId
      ]
    );

    // Update doctor
    await client.query(
      `UPDATE doctors
       SET employee_code = $1, specialization = $2, department = $3, license_number = $4,
           experience_years = $5, consultation_fee_cents = $6, biography = $7, qualification = $8, updated_at = now()
       WHERE id = $9`,
      [
        data.employee_id || data.employee_code,
        data.specialization,
        data.department || 'General',
        data.license_number !== undefined && data.license_number !== null && data.license_number !== "" ? data.license_number : (doctor.license_number || 'LIC-' + (data.employee_id || data.employee_code)),
        data.years_experience || data.experience_years || 0,
        data.consultation_fee_cents !== undefined && data.consultation_fee_cents !== null ? data.consultation_fee_cents : (data.consultation_fee !== undefined && data.consultation_fee !== null ? data.consultation_fee * 100 : 5000),
        data.biography || null,
        data.qualification || 'MD',
        id
      ]
    );

    return true;
  });
}

async function updateDoctorStatus(hospitalId, id, status) {
  const docResult = await db.query(
    `SELECT user_id FROM doctors WHERE id = $1 AND hospital_id = $2`,
    [id, hospitalId]
  );
  const doctor = docResult.rows[0];
  if (!doctor) return false;

  await db.query(
    `UPDATE users SET status = $1, updated_at = now() WHERE id = $2`,
    [status, doctor.user_id]
  );
  return true;
}

async function listAvailabilityRules(hospitalId, doctorId) {
  const result = await db.query(
    `
      SELECT
        id,
        weekday,
        start_time AS "startTime",
        end_time AS "endTime",
        slot_minutes AS "slotMinutes"
      FROM doctor_availability_rules
      WHERE hospital_id = $1
        AND doctor_id = $2
      ORDER BY weekday ASC, start_time ASC
    `,
    [hospitalId, doctorId]
  );
  return result.rows;
}

async function replaceAvailabilityRules(hospitalId, doctorId, rules) {
  return db.withTransaction(async (client) => {
    await client.query(
      `DELETE FROM doctor_availability_rules WHERE hospital_id = $1 AND doctor_id = $2`,
      [hospitalId, doctorId]
    );

    for (const rule of rules) {
      await client.query(
        `
          INSERT INTO doctor_availability_rules (
            hospital_id,
            doctor_id,
            weekday,
            start_time,
            end_time,
            slot_minutes
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          hospitalId,
          doctorId,
          rule.weekday,
          rule.startTime,
          rule.endTime,
          rule.slotMinutes,
        ]
      );
    }
  });
}

async function listTimeOff(hospitalId, doctorId) {
  const result = await db.query(
    `
      SELECT
        id,
        starts_at AS "startsAt",
        ends_at AS "endsAt",
        reason
      FROM doctor_time_off
      WHERE hospital_id = $1
        AND doctor_id = $2
      ORDER BY starts_at DESC
      LIMIT 100
    `,
    [hospitalId, doctorId]
  );
  return result.rows;
}

async function createTimeOff(hospitalId, doctorId, { startsAt, endsAt, reason }) {
  const result = await db.query(
    `
      INSERT INTO doctor_time_off (hospital_id, doctor_id, starts_at, ends_at, reason)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        starts_at AS "startsAt",
        ends_at AS "endsAt",
        reason
    `,
    [hospitalId, doctorId, startsAt, endsAt, reason || null]
  );
  return result.rows[0];
}

async function listTimeOffInRange(hospitalId, doctorId, startsAt, endsAt) {
  const result = await db.query(
    `
      SELECT
        starts_at AS "startsAt",
        ends_at AS "endsAt"
      FROM doctor_time_off
      WHERE hospital_id = $1
        AND doctor_id = $2
        AND starts_at < $4
        AND ends_at > $3
    `,
    [hospitalId, doctorId, startsAt, endsAt]
  );
  return result.rows;
}

module.exports = {
  listDoctors,
  findDoctorById,
  findDoctorByIdWithinHospital,
  findDoctorByUserId,
  listAvailabilityRules,
  replaceAvailabilityRules,
  listTimeOff,
  createTimeOff,
  listTimeOffInRange,
  createDoctor,
  updateDoctor,
  updateDoctorStatus,
};

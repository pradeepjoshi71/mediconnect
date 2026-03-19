const db = require("../config/db");

async function listDoctors({
  hospitalId,
  search = "",
  specialization = "",
  minExperience = 0,
  minRating = 0,
  sort = "rating",
}) {
  const where = [`u.status = 'active'`, `d.hospital_id = $1`];
  const params = [hospitalId];

  if (search) {
    params.push(`%${search}%`);
    where.push(
      `(u.full_name ILIKE $${params.length} OR d.specialization ILIKE $${params.length} OR d.department ILIKE $${params.length})`
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

  const result = await db.query(
    `
      SELECT
        d.id,
        u.id AS "userId",
        u.full_name AS "fullName",
        u.email,
        u.phone,
        d.specialization,
        d.department,
        d.experience_years AS "experienceYears",
        d.rating,
        d.consultation_fee_cents AS "consultationFeeCents",
        d.biography
      FROM doctors d
      JOIN users u ON u.id = d.user_id
      WHERE ${where.join(" AND ")}
      ORDER BY ${orderBy}
    `,
    params
  );

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
        u.email,
        u.phone,
        d.specialization,
        d.department,
        d.employee_code AS "employeeCode",
        d.license_number AS "licenseNumber",
        d.experience_years AS "experienceYears",
        d.rating,
        d.consultation_fee_cents AS "consultationFeeCents",
        d.biography
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
        u.email,
        u.phone,
        d.specialization,
        d.department,
        d.employee_code AS "employeeCode",
        d.license_number AS "licenseNumber",
        d.experience_years AS "experienceYears",
        d.rating,
        d.consultation_fee_cents AS "consultationFeeCents",
        d.biography
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
        u.email,
        d.specialization,
        d.department,
        d.consultation_fee_cents AS "consultationFeeCents"
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
};

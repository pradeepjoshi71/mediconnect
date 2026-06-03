const db = require("../config/db");
const { asyncHandler } = require("../middlewares/asyncHandler");

const getAdminDashboard = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospitalId;

  // 1. Fetch Stats
  const totalDoctorsResult = await db.query(
    "SELECT COUNT(*)::int FROM doctors WHERE hospital_id = $1",
    [hospitalId]
  );
  
  const totalPatientsResult = await db.query(
    "SELECT COUNT(*)::int FROM patients WHERE hospital_id = $1",
    [hospitalId]
  );

  const appointmentsTodayResult = await db.query(
    `SELECT COUNT(*)::int
     FROM appointments
     WHERE hospital_id = $1
       AND scheduled_start >= date_trunc('day', now())
       AND scheduled_start < date_trunc('day', now()) + interval '1 day'`,
    [hospitalId]
  );

  const activeDoctorsResult = await db.query(
    `SELECT COUNT(d.id)::int
     FROM doctors d
     JOIN users u ON u.id = d.user_id
     WHERE d.hospital_id = $1 AND u.status = 'active'`,
    [hospitalId]
  );

  // 2. Fetch Recent Appointments Widget
  const recentAppointmentsResult = await db.query(
    `SELECT
       a.id,
       u_pat.full_name AS "patient_name",
       u_doc.full_name AS "doctor_name",
       a.scheduled_start AS "starts_at",
       a.scheduled_end AS "ends_at",
       a.status,
       a.appointment_type,
       a.priority
     FROM appointments a
     JOIN patients p ON p.id = a.patient_id
     JOIN users u_pat ON u_pat.id = p.user_id
     JOIN doctors d ON d.id = a.doctor_id
     JOIN users u_doc ON u_doc.id = d.user_id
     WHERE a.hospital_id = $1
     ORDER BY a.created_at DESC, a.scheduled_start DESC
     LIMIT 5`,
    [hospitalId]
  );

  // 3. Fetch New Patients Widget
  const newPatientsResult = await db.query(
    `SELECT
       p.id,
       u.full_name,
       u.email,
       u.phone,
       p.medical_record_number,
       p.created_at
     FROM patients p
     JOIN users u ON u.id = p.user_id
     WHERE p.hospital_id = $1
     ORDER BY p.created_at DESC
     LIMIT 5`,
    [hospitalId]
  );

  // 4. Fetch Doctor Availability Widget
  const doctorAvailabilityResult = await db.query(
    `SELECT
       d.id,
       u.full_name,
       d.specialization,
       u.status,
       (SELECT COUNT(*) FROM doctor_availability_rules WHERE doctor_id = d.id)::int AS "rules_count"
     FROM doctors d
     JOIN users u ON u.id = d.user_id
     WHERE d.hospital_id = $1
     ORDER BY u.status DESC, u.full_name ASC`,
    [hospitalId]
  );

  res.json({
    statistics: {
      totalDoctors: totalDoctorsResult.rows[0].count,
      totalPatients: totalPatientsResult.rows[0].count,
      appointmentsToday: appointmentsTodayResult.rows[0].count,
      activeDoctors: activeDoctorsResult.rows[0].count,
    },
    widgets: {
      recentAppointments: recentAppointmentsResult.rows,
      newPatients: newPatientsResult.rows,
      doctorAvailability: doctorAvailabilityResult.rows,
    }
  });
});

module.exports = { getAdminDashboard };

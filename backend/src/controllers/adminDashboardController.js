const db = require("../config/db");
const { asyncHandler } = require("../middlewares/asyncHandler");

const getAdminDashboard = asyncHandler(async (req, res) => {
  const { hospitalId, role } = req.user;
  const isSuperAdmin = role === 'super_admin';

  // 1. Fetch Stats
  let totalDoctorsQuery, totalPatientsQuery, appointmentsTodayQuery, activeDoctorsQuery;
  let params = [];

  if (isSuperAdmin) {
    totalDoctorsQuery = "SELECT COUNT(*)::int FROM doctors";
    totalPatientsQuery = "SELECT COUNT(*)::int FROM patients";
    appointmentsTodayQuery = `SELECT COUNT(*)::int FROM appointments WHERE scheduled_start >= date_trunc('day', now()) AND scheduled_start < date_trunc('day', now()) + interval '1 day'`;
    activeDoctorsQuery = `SELECT COUNT(d.id)::int FROM doctors d JOIN users u ON u.id = d.user_id WHERE u.status = 'active'`;
  } else {
    totalDoctorsQuery = "SELECT COUNT(*)::int FROM doctors WHERE hospital_id = $1";
    totalPatientsQuery = "SELECT COUNT(*)::int FROM patients WHERE hospital_id = $1";
    appointmentsTodayQuery = `SELECT COUNT(*)::int FROM appointments WHERE hospital_id = $1 AND scheduled_start >= date_trunc('day', now()) AND scheduled_start < date_trunc('day', now()) + interval '1 day'`;
    activeDoctorsQuery = `SELECT COUNT(d.id)::int FROM doctors d JOIN users u ON u.id = d.user_id WHERE d.hospital_id = $1 AND u.status = 'active'`;
    params = [hospitalId];
  }

  const [totalDoctorsResult, totalPatientsResult, appointmentsTodayResult, activeDoctorsResult] = await Promise.all([
    db.query(totalDoctorsQuery, params),
    db.query(totalPatientsQuery, params),
    db.query(appointmentsTodayQuery, params),
    db.query(activeDoctorsQuery, params)
  ]);

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
     ${!isSuperAdmin ? "WHERE a.hospital_id = $1" : ""}
     ORDER BY a.created_at DESC, a.scheduled_start DESC
     LIMIT 5`,
    isSuperAdmin ? [] : [hospitalId]
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
     ${!isSuperAdmin ? "WHERE p.hospital_id = $1" : ""}
     ORDER BY p.created_at DESC
     LIMIT 5`,
    isSuperAdmin ? [] : [hospitalId]
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
     ${!isSuperAdmin ? "WHERE d.hospital_id = $1" : ""}
     ORDER BY u.status DESC, u.full_name ASC`,
    isSuperAdmin ? [] : [hospitalId]
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

const analyticsRepository = require("../repositories/analyticsRepository");
const appointmentRepository = require("../repositories/appointmentRepository");
const clinicalRepository = require("../repositories/clinicalRepository");
const paymentRepository = require("../repositories/paymentRepository");
const patientRepository = require("../repositories/patientRepository");
const hospitalService = require("./hospitalService");
const intelligenceService = require("./intelligenceService");
const auditService = require("./auditService");
const appointmentService = require("./appointmentService");
const { getRedisStatus } = require("../config/redis");
const { AppError } = require("../utils/http");

async function getDashboard(user) {
  const hospital = await hospitalService.getHospitalSummary(user);

  if (user.role === "patient") {
    const patient = await patientRepository.findPatientByUserId(user.id, user.hospitalId);
    if (!patient) {
      throw new AppError(404, "Patient profile not found");
    }
    const [appointments, records, payments, timeline, followUps] = await Promise.all([
      appointmentRepository.listAppointmentsForScope({
        hospitalId: user.hospitalId,
        role: "patient",
        patientId: patient.id,
      }),
      clinicalRepository.listMedicalRecordsByPatient(user.hospitalId, patient.id),
      paymentRepository.listPayments({
        hospitalId: user.hospitalId,
        role: "patient",
        patientId: patient.id,
      }),
      clinicalRepository.listPatientTimeline(user.hospitalId, patient.id),
      intelligenceService.getFollowUpReminders(user),
    ]);

    return {
      role: user.role,
      hospital,
      stats: {
        upcomingAppointments: appointments.filter((item) =>
          ["scheduled", "confirmed"].includes(item.status)
        ).length,
        medicalRecords: records.length,
        outstandingInvoices: payments.filter((item) =>
          ["pending", "processing"].includes(item.status)
        ).length,
      },
      appointments: appointments.slice(0, 8),
      records: records.slice(0, 5),
      payments: payments.slice(0, 5),
      timeline: timeline.slice(0, 8),
      followUps,
    };
  }

  if (user.role === "doctor") {
    const [queue, appointments] = await Promise.all([
      appointmentService.listQueue(user, { date: new Date().toISOString().slice(0, 10) }),
      appointmentRepository.listAppointmentsForScope({
        hospitalId: user.hospitalId,
        role: "doctor",
        doctorId: user.doctorProfileId,
      }),
    ]);

    return {
      role: user.role,
      hospital,
      stats: {
        todayQueue: queue.length,
        totalAppointments: appointments.length,
        completedVisits: appointments.filter((item) => item.status === "completed").length,
      },
      queue,
      appointments: appointments.slice(0, 10),
    };
  }

  const [headline, appointments, waitlist, predictiveInsights, recentAuditLogs] = await Promise.all([
    analyticsRepository.getHeadlineStats(user.hospitalId),
    appointmentRepository.listAppointmentsForScope({
      hospitalId: user.hospitalId,
      role: "admin",
    }),
    appointmentRepository.listWaitlist({ hospitalId: user.hospitalId }),
    intelligenceService.getPredictiveInsights(user),
    user.role === "admin"
      ? auditService.listAuditLogs(user, { limit: 12 })
      : Promise.resolve([]),
  ]);

  return {
    role: user.role,
    hospital,
    stats: headline,
    appointments: appointments.slice(0, 10),
    waitlist: waitlist.slice(0, 10),
    predictiveInsights,
    recentAuditLogs,
    monitoring: {
      websocket: "ready",
      redis: getRedisStatus(),
      apiVersion: "v1",
      statelessMode: true,
    },
  };
}

module.exports = { getDashboard };

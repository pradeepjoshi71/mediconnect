const analyticsRepository = require("../repositories/analyticsRepository");
const appointmentRepository = require("../repositories/appointmentRepository");
const clinicalRepository = require("../repositories/clinicalRepository");
const paymentRepository = require("../repositories/paymentRepository");
const patientRepository = require("../repositories/patientRepository");
const appointmentService = require("./appointmentService");

async function getDashboard(user) {
  if (user.role === "patient") {
    const patient = await patientRepository.findPatientByUserId(user.id);
    const [appointments, records, payments, timeline] = await Promise.all([
      appointmentRepository.listAppointmentsForScope({
        role: "patient",
        patientId: patient.id,
      }),
      clinicalRepository.listMedicalRecordsByPatient(patient.id),
      paymentRepository.listPayments({ role: "patient", patientId: patient.id }),
      clinicalRepository.listPatientTimeline(patient.id),
    ]);

    return {
      role: user.role,
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
    };
  }

  if (user.role === "doctor") {
    const [queue, appointments] = await Promise.all([
      appointmentService.listQueue(user, { date: new Date().toISOString().slice(0, 10) }),
      appointmentRepository.listAppointmentsForScope({
        role: "doctor",
        doctorId: user.doctorProfileId,
      }),
    ]);

    return {
      role: user.role,
      stats: {
        todayQueue: queue.length,
        totalAppointments: appointments.length,
        completedVisits: appointments.filter((item) => item.status === "completed").length,
      },
      queue,
      appointments: appointments.slice(0, 10),
    };
  }

  const headline = await analyticsRepository.getHeadlineStats();
  const appointments = await appointmentRepository.listAppointmentsForScope({ role: "admin" });
  const waitlist = await appointmentRepository.listWaitlist();

  return {
    role: user.role,
    stats: headline,
    appointments: appointments.slice(0, 10),
    waitlist: waitlist.slice(0, 10),
  };
}

module.exports = { getDashboard };

const crypto = require("crypto");
const telemedicineRepository = require("../repositories/telemedicineRepository");
const appointmentRepository = require("../repositories/appointmentRepository");
const { safeEmitToUser } = require("../realtime/io");
const { AppError } = require("../utils/http");

async function ensureAppointmentAccess(user, appointmentId) {
  const appointment = await appointmentRepository.findAppointmentById(appointmentId);
  if (!appointment) {
    throw new AppError(404, "Appointment not found");
  }

  const canAccess =
    ["admin", "receptionist"].includes(user.role) ||
    Number(user.patientProfileId) === Number(appointment.patientId) ||
    Number(user.doctorProfileId) === Number(appointment.doctorId);

  if (!canAccess) {
    throw new AppError(403, "Forbidden");
  }

  return appointment;
}

async function getOrCreateSession(user, appointmentId) {
  const appointment = await ensureAppointmentAccess(user, appointmentId);
  let session = await telemedicineRepository.findSessionByAppointmentId(appointmentId);

  if (!session) {
    const roomCode = crypto.randomUUID();
    session = await telemedicineRepository.createSession({
      appointmentId,
      roomCode,
      joinUrl: `https://telemedicine.mediconnect.local/room/${roomCode}`,
    });
  }

  return {
    appointment,
    session,
  };
}

async function listMessages(user, appointmentId) {
  await ensureAppointmentAccess(user, appointmentId);
  return telemedicineRepository.listMessages(appointmentId);
}

async function sendMessage(user, appointmentId, body) {
  const appointment = await ensureAppointmentAccess(user, appointmentId);
  const message = await telemedicineRepository.createMessage({
    appointmentId,
    senderUserId: user.id,
    body,
  });

  safeEmitToUser(appointment.patientUserId, "telemedicine:message", message);
  safeEmitToUser(appointment.doctorUserId, "telemedicine:message", message);

  return message;
}

module.exports = {
  getOrCreateSession,
  listMessages,
  sendMessage,
};

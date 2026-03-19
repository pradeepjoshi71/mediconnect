const crypto = require("crypto");
const telemedicineRepository = require("../repositories/telemedicineRepository");
const appointmentRepository = require("../repositories/appointmentRepository");
const auditService = require("./auditService");
const { safeEmitToUser } = require("../realtime/io");
const { AppError } = require("../utils/http");

async function ensureAppointmentAccess(user, appointmentId) {
  const appointment = await appointmentRepository.findAppointmentById(
    appointmentId,
    user.hospitalId
  );
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

async function getOrCreateSession(user, appointmentId, context) {
  const appointment = await ensureAppointmentAccess(user, appointmentId);
  let session = await telemedicineRepository.findSessionByAppointmentId(
    user.hospitalId,
    appointmentId
  );

  if (!session) {
    const roomCode = crypto.randomUUID();
    session = await telemedicineRepository.createSession({
      hospitalId: user.hospitalId,
      appointmentId,
      roomCode,
      joinUrl: `https://telemedicine.mediconnect.local/room/${roomCode}`,
    });
  }

  await auditService.recordAuditEvent({
    user,
    action: "telemedicine.session.open",
    entityType: "appointment",
    entityId: appointmentId,
    metadata: { roomCode: session.roomCode },
    context,
  });

  return {
    appointment,
    session,
  };
}

async function listMessages(user, appointmentId, context) {
  await ensureAppointmentAccess(user, appointmentId);

  await auditService.recordAuditEvent({
    user,
    action: "telemedicine.messages.list",
    entityType: "appointment",
    entityId: appointmentId,
    metadata: {},
    context,
  });

  return telemedicineRepository.listMessages(user.hospitalId, appointmentId);
}

async function sendMessage(user, appointmentId, body, context) {
  const appointment = await ensureAppointmentAccess(user, appointmentId);
  const message = await telemedicineRepository.createMessage({
    hospitalId: user.hospitalId,
    appointmentId,
    senderUserId: user.id,
    body,
  });

  safeEmitToUser(appointment.patientUserId, "telemedicine:message", message);
  safeEmitToUser(appointment.doctorUserId, "telemedicine:message", message);

  await auditService.recordAuditEvent({
    user,
    action: "telemedicine.message.send",
    entityType: "appointment",
    entityId: appointmentId,
    metadata: { messageId: message.id },
    context,
  });

  return message;
}

module.exports = {
  getOrCreateSession,
  listMessages,
  sendMessage,
};

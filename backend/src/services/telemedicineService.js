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
    ["admin", "super_admin", "hospital_admin", "receptionist"].includes(user.role) ||
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

async function endSession(user, appointmentId, context) {
  await ensureAppointmentAccess(user, appointmentId);

  const session = await telemedicineRepository.updateSessionStatus(
    appointmentId,
    user.hospitalId,
    "ended"
  );

  if (!session) {
    throw new AppError(404, "Telemedicine session not found");
  }

  await auditService.recordAuditEvent({
    user,
    action: "telemedicine.session.end",
    entityType: "appointment",
    entityId: appointmentId,
    metadata: { endedAt: session.endedAt },
    context,
  });

  return session;
}

async function updateNotes(user, appointmentId, notes, context) {
  const appointment = await ensureAppointmentAccess(user, appointmentId);

  // Only the assigned doctor or an admin can update consultation notes
  const hasAccess = ["admin", "super_admin", "hospital_admin"].includes(user.role) ||
                    Number(user.doctorProfileId) === Number(appointment.doctorId);
  if (!hasAccess) {
    throw new AppError(403, "Forbidden: Only doctors or admins can write consultation notes");
  }

  const session = await telemedicineRepository.updateSessionNotes(
    appointmentId,
    user.hospitalId,
    notes
  );

  if (!session) {
    throw new AppError(404, "Telemedicine session not found");
  }

  await auditService.recordAuditEvent({
    user,
    action: "telemedicine.session.notes_update",
    entityType: "appointment",
    entityId: appointmentId,
    metadata: {},
    context,
  });

  return session;
}

async function updateRecordingMetadata(user, appointmentId, recordingMetadata, context) {
  const appointment = await ensureAppointmentAccess(user, appointmentId);

  const hasAccess = ["admin", "super_admin", "hospital_admin"].includes(user.role) ||
                    Number(user.doctorProfileId) === Number(appointment.doctorId);
  if (!hasAccess) {
    throw new AppError(403, "Forbidden: Only doctors or admins can edit recording metadata");
  }

  const session = await telemedicineRepository.updateSessionRecording(
    appointmentId,
    user.hospitalId,
    recordingMetadata
  );

  if (!session) {
    throw new AppError(404, "Telemedicine session not found");
  }

  await auditService.recordAuditEvent({
    user,
    action: "telemedicine.session.recording_update",
    entityType: "appointment",
    entityId: appointmentId,
    metadata: { recordingMetadata },
    context,
  });

  return session;
}

async function listSessionHistory(user, context) {
  const filters = {};
  if (user.role === "patient") {
    filters.patientId = user.patientProfileId;
  } else if (user.role === "doctor") {
    filters.doctorId = user.doctorProfileId;
  }

  const history = await telemedicineRepository.listSessionHistory(user.hospitalId, filters);

  await auditService.recordAuditEvent({
    user,
    action: "telemedicine.history.list",
    entityType: "appointment",
    entityId: "collection",
    metadata: { count: history.length },
    context,
  });

  return history;
}

module.exports = {
  getOrCreateSession,
  listMessages,
  sendMessage,
  endSession,
  updateNotes,
  updateRecordingMetadata,
  listSessionHistory,
};

const appointmentRepository = require("../repositories/appointmentRepository");
const doctorRepository = require("../repositories/doctorRepository");
const patientRepository = require("../repositories/patientRepository");
const paymentService = require("./paymentService");
const { notifyUser } = require("./notificationService");
const { AppError } = require("../utils/http");
const { safeEmitToUser } = require("../realtime/io");

function parseTimeTextToDate(date, timeText) {
  const [hours, minutes] = String(timeText).split(":").map(Number);
  const value = new Date(date);
  value.setUTCHours(hours, minutes, 0, 0);
  return value;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function dayBounds(date) {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  end.setUTCMilliseconds(-1);
  return { start, end };
}

function overlapsTimeOff(slotStart, slotEnd, periods) {
  return periods.some((period) => {
    const start = new Date(period.startsAt);
    const end = new Date(period.endsAt);
    return slotStart < end && slotEnd > start;
  });
}

function weekday(date) {
  return new Date(date).getUTCDay();
}

async function resolvePatientForActor(user, requestedPatientId) {
  if (user.role === "patient") {
    const patient = await patientRepository.findPatientByUserId(user.id);
    if (!patient) {
      throw new AppError(404, "Patient profile not found");
    }
    return patient;
  }

  if (!requestedPatientId) {
    throw new AppError(400, "patientId is required for staff bookings");
  }

  const patient = await patientRepository.findPatientById(requestedPatientId);
  if (!patient) {
    throw new AppError(404, "Patient not found");
  }
  return patient;
}

async function resolveSlot(doctorId, startsAt, priority) {
  if (startsAt) {
    const slotStart = new Date(startsAt);
    const rules = (await doctorRepository.listAvailabilityRules(doctorId)).filter(
      (item) => Number(item.weekday) === weekday(slotStart)
    );

    if (!rules.length) {
      throw new AppError(409, "Doctor has no availability for that day");
    }

    for (const rule of rules) {
      const ruleStart = parseTimeTextToDate(slotStart, rule.startTime);
      const ruleEnd = parseTimeTextToDate(slotStart, rule.endTime);
      const slotEnd = addMinutes(slotStart, Number(rule.slotMinutes));

      if (slotStart >= ruleStart && slotEnd <= ruleEnd) {
        return { slotStart, slotEnd };
      }
    }

    throw new AppError(409, "Selected slot is outside the doctor's schedule");
  }

  if (priority !== "emergency") {
    throw new AppError(400, "startsAt is required unless this is an emergency booking");
  }

  const rules = await doctorRepository.listAvailabilityRules(doctorId);
  const now = new Date();

  for (let dayOffset = 0; dayOffset < 5; dayOffset += 1) {
    const targetDate = new Date(now);
    targetDate.setUTCDate(targetDate.getUTCDate() + dayOffset);
    targetDate.setUTCHours(0, 0, 0, 0);

    const { start, end } = dayBounds(targetDate);
    const [appointments, timeOff] = await Promise.all([
      appointmentRepository.listDoctorAppointmentsBetween(
        doctorId,
        start.toISOString(),
        end.toISOString()
      ),
      doctorRepository.listTimeOffInRange(
        doctorId,
        start.toISOString(),
        end.toISOString()
      ),
    ]);

    const booked = new Set(
      appointments
        .filter((item) =>
          ["scheduled", "confirmed", "checked_in", "in_consultation"].includes(item.status)
        )
        .map((item) => new Date(item.scheduledStart).toISOString())
    );

    const dayRules = rules.filter((item) => Number(item.weekday) === weekday(targetDate));
    for (const rule of dayRules) {
      let cursor = parseTimeTextToDate(targetDate, rule.startTime);
      const blockEnd = parseTimeTextToDate(targetDate, rule.endTime);

      while (cursor < blockEnd) {
        const slotEnd = addMinutes(cursor, Number(rule.slotMinutes));
        if (slotEnd > blockEnd) break;
        const slotIso = cursor.toISOString();

        if (
          cursor > now &&
          !booked.has(slotIso) &&
          !overlapsTimeOff(cursor, slotEnd, timeOff)
        ) {
          return { slotStart: cursor, slotEnd };
        }

        cursor = slotEnd;
      }
    }
  }

  throw new AppError(409, "No emergency slots are currently available");
}

async function ensureSlotAvailable(doctorId, slotStart, slotEnd, excludeAppointmentId = null) {
  const [conflict, timeOff] = await Promise.all([
    appointmentRepository.findActiveAppointmentConflict(
      doctorId,
      slotStart.toISOString(),
      excludeAppointmentId
    ),
    doctorRepository.listTimeOffInRange(
      doctorId,
      slotStart.toISOString(),
      slotEnd.toISOString()
    ),
  ]);

  if (conflict) {
    throw new AppError(409, "That time slot is already booked");
  }

  if (overlapsTimeOff(slotStart, slotEnd, timeOff)) {
    throw new AppError(409, "Doctor is unavailable during the selected time");
  }
}

async function maybeOfferWaitlist(appointment) {
  const preferredDate = new Date(appointment.scheduledStart).toISOString().slice(0, 10);
  const entry = await appointmentRepository.findPromotableWaitlistEntry(
    appointment.doctorId,
    preferredDate
  );

  if (!entry) return;

  await appointmentRepository.updateWaitlistStatus(entry.id, "offered");
  await notifyUser({
    userId: entry.patientUserId,
    title: "Waitlist slot available",
    body: `A slot is available with ${appointment.doctorName} on ${preferredDate}.`,
    eventType: "waitlist.offered",
    data: {
      doctorId: appointment.doctorId,
      preferredDate,
    },
    channels: ["in_app", "email"],
  });
}

async function bookAppointment(user, payload) {
  const doctor = await doctorRepository.findDoctorById(payload.doctorId);
  if (!doctor) {
    throw new AppError(404, "Doctor not found");
  }

  const patient = await resolvePatientForActor(user, payload.patientId);
  const { slotStart, slotEnd } = await resolveSlot(
    doctor.id,
    payload.startsAt,
    payload.priority
  );

  try {
    await ensureSlotAvailable(doctor.id, slotStart, slotEnd);
  } catch (error) {
    if (payload.waitingListRequested) {
      const waitlist = await appointmentRepository.createWaitlistEntry({
        patientId: patient.id,
        doctorId: doctor.id,
        preferredDate: slotStart.toISOString().slice(0, 10),
        preferredWindow: slotStart.toISOString().slice(11, 16),
        priority: payload.priority,
        reason: payload.reason,
      });

      return {
        waitlist,
        appointment: null,
      };
    }
    throw error;
  }

  const { start, end } = dayBounds(slotStart);
  const queueNumber = await appointmentRepository.getNextQueueNumber(
    doctor.id,
    start.toISOString(),
    end.toISOString()
  );

  const appointment = await appointmentRepository.createAppointment({
    patientId: patient.id,
    doctorId: doctor.id,
    bookedByUserId: user.id,
    scheduledStart: slotStart.toISOString(),
    scheduledEnd: slotEnd.toISOString(),
    appointmentType: payload.appointmentType,
    consultationMode: payload.consultationMode,
    reason: payload.reason,
    status: payload.priority === "emergency" ? "confirmed" : "scheduled",
    priority: payload.priority,
    queueNumber,
    waitingListRequested: payload.waitingListRequested,
  });

  const payment = await paymentService.createInvoiceForAppointment({
    appointment,
    initiatedByUserId: user.id,
  });

  await Promise.all([
    notifyUser({
      userId: patient.userId,
      title: "Appointment booked",
      body: `Your ${doctor.specialization} visit with ${doctor.fullName} is scheduled for ${slotStart.toLocaleString()}.`,
      eventType: "appointment.booked",
      data: { appointmentId: appointment.id },
      channels: ["in_app", "email"],
    }),
    notifyUser({
      userId: doctor.userId,
      title: "New appointment booked",
      body: `${patient.fullName} has been scheduled for ${slotStart.toLocaleString()}.`,
      eventType: "appointment.new",
      data: { appointmentId: appointment.id },
      channels: ["in_app", "email"],
    }),
  ]);

  return { appointment, payment };
}

async function listAppointments(user, filters) {
  return appointmentRepository.listAppointmentsForScope({
    role: user.role,
    patientId: user.patientProfileId,
    doctorId: user.doctorProfileId,
    date: filters.date,
    status: filters.status,
  });
}

async function listQueue(user, { date }) {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const appointments = await appointmentRepository.listAppointmentsForScope({
    role: user.role === "doctor" ? "doctor" : "admin",
    patientId: user.patientProfileId,
    doctorId: user.doctorProfileId,
    date: targetDate,
    status: null,
  });

  return appointments
    .filter((item) =>
      ["scheduled", "confirmed", "checked_in", "in_consultation"].includes(item.status)
    )
    .sort((a, b) => a.queueNumber - b.queueNumber);
}

async function rescheduleAppointment(user, appointmentId, startsAt) {
  const appointment = await appointmentRepository.findAppointmentById(appointmentId);
  if (!appointment) {
    throw new AppError(404, "Appointment not found");
  }

  const isPatientOwner =
    user.role === "patient" && Number(user.patientProfileId) === Number(appointment.patientId);
  const isDoctorOwner =
    user.role === "doctor" && Number(user.doctorProfileId) === Number(appointment.doctorId);
  const isStaff = ["admin", "receptionist"].includes(user.role);

  if (!isPatientOwner && !isDoctorOwner && !isStaff) {
    throw new AppError(403, "Forbidden");
  }

  const { slotStart, slotEnd } = await resolveSlot(
    appointment.doctorId,
    startsAt,
    appointment.priority
  );
  await ensureSlotAvailable(appointment.doctorId, slotStart, slotEnd, appointment.id);

  const updated = await appointmentRepository.updateAppointmentSchedule(appointmentId, {
    scheduledStart: slotStart.toISOString(),
    scheduledEnd: slotEnd.toISOString(),
    status: "scheduled",
  });

  await Promise.all([
    notifyUser({
      userId: appointment.patientUserId,
      title: "Appointment rescheduled",
      body: `Your appointment has been moved to ${slotStart.toLocaleString()}.`,
      eventType: "appointment.rescheduled",
      data: { appointmentId },
    }),
    notifyUser({
      userId: appointment.doctorUserId,
      title: "Appointment rescheduled",
      body: `A patient booking has been moved to ${slotStart.toLocaleString()}.`,
      eventType: "appointment.rescheduled",
      data: { appointmentId },
    }),
  ]);

  return updated;
}

async function updateAppointmentStatus(user, appointmentId, { status, cancellationReason }) {
  const appointment = await appointmentRepository.findAppointmentById(appointmentId);
  if (!appointment) {
    throw new AppError(404, "Appointment not found");
  }

  const isPatientOwner =
    user.role === "patient" && Number(user.patientProfileId) === Number(appointment.patientId);
  const isDoctorOwner =
    user.role === "doctor" && Number(user.doctorProfileId) === Number(appointment.doctorId);
  const isStaff = ["admin", "receptionist"].includes(user.role);

  if (status === "cancelled" && !isPatientOwner && !isDoctorOwner && !isStaff) {
    throw new AppError(403, "Forbidden");
  }

  if (!["cancelled"].includes(status) && !isDoctorOwner && !isStaff) {
    throw new AppError(403, "Only clinicians and staff can update to that status");
  }

  const updated = await appointmentRepository.updateAppointmentStatus(appointmentId, {
    status,
    cancellationReason,
    completedAt: status === "completed" ? new Date().toISOString() : null,
  });

  await Promise.all([
    notifyUser({
      userId: appointment.patientUserId,
      title: "Appointment status updated",
      body: `Your appointment is now ${status.replaceAll("_", " ")}.`,
      eventType: "appointment.status",
      data: { appointmentId },
    }),
    notifyUser({
      userId: appointment.doctorUserId,
      title: "Appointment status updated",
      body: `${appointment.patientName}'s appointment is now ${status.replaceAll("_", " ")}.`,
      eventType: "appointment.status",
      data: { appointmentId },
    }),
  ]);

  if (status === "cancelled") {
    await maybeOfferWaitlist(updated);
  }

  safeEmitToUser(appointment.patientUserId, "appointment:updated", updated);
  safeEmitToUser(appointment.doctorUserId, "appointment:updated", updated);

  return updated;
}

async function createWaitlist(user, payload) {
  const patient = await resolvePatientForActor(user, payload.patientId);
  const doctor = await doctorRepository.findDoctorById(payload.doctorId);

  if (!doctor) {
    throw new AppError(404, "Doctor not found");
  }

  const entry = await appointmentRepository.createWaitlistEntry({
    patientId: patient.id,
    doctorId: doctor.id,
    preferredDate: payload.preferredDate,
    preferredWindow: payload.preferredWindow,
    priority: payload.priority,
    reason: payload.reason,
  });

  await notifyUser({
    userId: patient.userId,
    title: "Added to waitlist",
    body: `You have been added to the waitlist for ${doctor.fullName}.`,
    eventType: "waitlist.created",
    data: { waitlistId: entry.id },
  });

  return entry;
}

async function listWaitlist(user) {
  if (user.role === "doctor") {
    return appointmentRepository.listWaitlist({ doctorId: user.doctorProfileId });
  }
  if (!["admin", "receptionist"].includes(user.role)) {
    throw new AppError(403, "Forbidden");
  }
  return appointmentRepository.listWaitlist();
}

module.exports = {
  bookAppointment,
  listAppointments,
  listQueue,
  rescheduleAppointment,
  updateAppointmentStatus,
  createWaitlist,
  listWaitlist,
};

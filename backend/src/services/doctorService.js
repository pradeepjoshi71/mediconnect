const doctorRepository = require("../repositories/doctorRepository");
const appointmentRepository = require("../repositories/appointmentRepository");
const { getJson, setJson } = require("../config/redis");
const auditService = require("./auditService");
const { AppError } = require("../utils/http");

function parseTimeIntoDate(date, timeText) {
  const [hours, minutes] = String(timeText).split(":").map(Number);
  const value = new Date(date);
  value.setUTCHours(hours, minutes, 0, 0);
  return value;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function dayBounds(date) {
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(`${date}T23:59:59.999Z`);
  return { start, end };
}

function isInsideTimeOff(slotStart, slotEnd, periods) {
  return periods.some((period) => {
    const startsAt = new Date(period.startsAt);
    const endsAt = new Date(period.endsAt);
    return slotStart < endsAt && slotEnd > startsAt;
  });
}

async function listDoctors(user, filters) {
  return doctorRepository.listDoctors({
    hospitalId: user.hospitalId,
    ...filters,
  });
}

async function getAvailabilityForDate(user, doctorId, date) {
  const cacheKey = `availability:${user.hospitalId}:${doctorId}:${date}`;
  const cached = await getJson(cacheKey);
  if (cached) {
    return cached;
  }

  const doctor = await doctorRepository.findDoctorByIdWithinHospital(doctorId, user.hospitalId);
  if (!doctor) {
    throw new AppError(404, "Doctor not found");
  }

  const targetDate = new Date(`${date}T00:00:00.000Z`);
  const weekday = targetDate.getUTCDay();
  const rules = (await doctorRepository.listAvailabilityRules(user.hospitalId, doctorId)).filter(
    (rule) => Number(rule.weekday) === weekday
  );

  if (!rules.length) {
    const emptyResult = { doctor, slots: [] };
    await setJson(cacheKey, emptyResult, 60);
    return emptyResult;
  }

  const { start, end } = dayBounds(date);
  const [appointments, timeOff] = await Promise.all([
    appointmentRepository.listDoctorAppointmentsBetween(
      user.hospitalId,
      doctorId,
      start.toISOString(),
      end.toISOString()
    ),
    doctorRepository.listTimeOffInRange(
      user.hospitalId,
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

  const slots = [];
  for (const rule of rules) {
    let cursor = parseTimeIntoDate(targetDate, rule.startTime);
    const blockEnd = parseTimeIntoDate(targetDate, rule.endTime);

    while (cursor < blockEnd) {
      const slotEnd = addMinutes(cursor, Number(rule.slotMinutes));
      if (slotEnd > blockEnd) break;
      const slotIso = cursor.toISOString();

      if (!booked.has(slotIso) && !isInsideTimeOff(cursor, slotEnd, timeOff)) {
        slots.push({
          startsAt: slotIso,
          endsAt: slotEnd.toISOString(),
          slotMinutes: Number(rule.slotMinutes),
        });
      }

      cursor = slotEnd;
    }
  }

  const result = { doctor, slots };
  await setJson(cacheKey, result, 60);
  return result;
}

async function updateMyAvailability(user, rules, context) {
  if (!user.doctorProfileId) {
    throw new AppError(403, "Doctor profile is required");
  }
  await doctorRepository.replaceAvailabilityRules(user.hospitalId, user.doctorProfileId, rules);
  await auditService.recordAuditEvent({
    user,
    action: "doctor.availability.update",
    entityType: "doctor",
    entityId: user.doctorProfileId,
    metadata: { ruleCount: rules.length },
    context,
  });
}

async function listMyAvailability(user) {
  if (!user.doctorProfileId) {
    throw new AppError(403, "Doctor profile is required");
  }
  return doctorRepository.listAvailabilityRules(user.hospitalId, user.doctorProfileId);
}

async function addTimeOff(user, payload, context) {
  if (!user.doctorProfileId) {
    throw new AppError(403, "Doctor profile is required");
  }
  const entry = await doctorRepository.createTimeOff(user.hospitalId, user.doctorProfileId, payload);
  await auditService.recordAuditEvent({
    user,
    action: "doctor.time_off.create",
    entityType: "doctor_time_off",
    entityId: entry.id,
    metadata: {
      startsAt: payload.startsAt,
      endsAt: payload.endsAt,
    },
    context,
  });
  return entry;
}

async function listMyTimeOff(user) {
  if (!user.doctorProfileId) {
    throw new AppError(403, "Doctor profile is required");
  }
  return doctorRepository.listTimeOff(user.hospitalId, user.doctorProfileId);
}

const bcrypt = require("bcrypt");

async function getDoctorById(user, doctorId) {
  const doctor = await doctorRepository.findDoctorByIdWithinHospital(doctorId, user.hospitalId);
  if (!doctor) {
    throw new AppError(404, "Doctor not found");
  }
  return doctor;
}

async function createDoctor(user, data, context) {
  const password = data.password || "Password@123";
  const passwordHash = await bcrypt.hash(password, 12);
  
  const doctorId = await doctorRepository.createDoctor(user.hospitalId, {
    ...data,
    passwordHash
  });

  const createdDoctor = await doctorRepository.findDoctorByIdWithinHospital(doctorId, user.hospitalId);

  await auditService.recordAuditEvent({
    user,
    action: "admin.doctor.create",
    entityType: "doctor",
    entityId: doctorId,
    newValue: { employee_id: data.employee_id, email: data.email, specialization: data.specialization },
    metadata: { employee_id: data.employee_id, email: data.email },
    context,
  });

  return createdDoctor;
}

async function updateDoctor(user, doctorId, data, context) {
  // Capture before state for audit trail
  const before = await doctorRepository.findDoctorByIdWithinHospital(doctorId, user.hospitalId);

  const updated = await doctorRepository.updateDoctor(user.hospitalId, doctorId, data);
  if (!updated) {
    throw new AppError(404, "Doctor not found");
  }

  const updatedDoctor = await doctorRepository.findDoctorByIdWithinHospital(doctorId, user.hospitalId);

  await auditService.recordAuditEvent({
    user,
    action: "admin.doctor.update",
    entityType: "doctor",
    entityId: doctorId,
    oldValue: before ? { specialization: before.specialization, status: before.status, department: before.department } : null,
    newValue: { specialization: data.specialization, status: data.status, department: data.department },
    metadata: { employee_id: data.employee_id },
    context,
  });

  return updatedDoctor;
}

async function updateDoctorStatus(user, doctorId, status, context) {
  // Capture before state
  const before = await doctorRepository.findDoctorByIdWithinHospital(doctorId, user.hospitalId);

  const updated = await doctorRepository.updateDoctorStatus(user.hospitalId, doctorId, status);
  if (!updated) {
    throw new AppError(404, "Doctor not found");
  }

  await auditService.recordAuditEvent({
    user,
    action: "admin.doctor.status_update",
    entityType: "doctor",
    entityId: doctorId,
    oldValue: before ? { status: before.status } : null,
    newValue: { status },
    metadata: { status },
    context,
  });

  return { id: doctorId, status };
}

module.exports = {
  listDoctors,
  getAvailabilityForDate,
  updateMyAvailability,
  listMyAvailability,
  addTimeOff,
  listMyTimeOff,
  getDoctorById,
  createDoctor,
  updateDoctor,
  updateDoctorStatus,
};

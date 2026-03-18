const doctorRepository = require("../repositories/doctorRepository");
const appointmentRepository = require("../repositories/appointmentRepository");
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

async function listDoctors(filters) {
  return doctorRepository.listDoctors(filters);
}

async function getAvailabilityForDate(doctorId, date) {
  const doctor = await doctorRepository.findDoctorById(doctorId);
  if (!doctor) {
    throw new AppError(404, "Doctor not found");
  }

  const targetDate = new Date(`${date}T00:00:00.000Z`);
  const weekday = targetDate.getUTCDay();
  const rules = (await doctorRepository.listAvailabilityRules(doctorId)).filter(
    (rule) => Number(rule.weekday) === weekday
  );

  if (!rules.length) {
    return { doctor, slots: [] };
  }

  const { start, end } = dayBounds(date);
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

  return { doctor, slots };
}

async function updateMyAvailability(user, rules) {
  if (!user.doctorProfileId) {
    throw new AppError(403, "Doctor profile is required");
  }
  await doctorRepository.replaceAvailabilityRules(user.doctorProfileId, rules);
}

async function listMyAvailability(user) {
  if (!user.doctorProfileId) {
    throw new AppError(403, "Doctor profile is required");
  }
  return doctorRepository.listAvailabilityRules(user.doctorProfileId);
}

async function addTimeOff(user, payload) {
  if (!user.doctorProfileId) {
    throw new AppError(403, "Doctor profile is required");
  }
  return doctorRepository.createTimeOff(user.doctorProfileId, payload);
}

async function listMyTimeOff(user) {
  if (!user.doctorProfileId) {
    throw new AppError(403, "Doctor profile is required");
  }
  return doctorRepository.listTimeOff(user.doctorProfileId);
}

module.exports = {
  listDoctors,
  getAvailabilityForDate,
  updateMyAvailability,
  listMyAvailability,
  addTimeOff,
  listMyTimeOff,
};

import api from "./apiClient";

export async function getDoctorSlots(doctorId, date) {
  const res = await api.get(`/availability/doctors/${doctorId}/slots`, {
    params: { date },
  });
  return res.data.slots || [];
}

export async function getMyAvailabilityRules() {
  const res = await api.get("/availability/me/rules");
  return res.data;
}

export async function setMyAvailabilityRules(rules) {
  await api.put("/availability/me/rules", { rules });
}

export async function listMyTimeOff() {
  const res = await api.get("/availability/me/time-off");
  return res.data;
}

export async function addMyTimeOff(payload) {
  const res = await api.post("/availability/me/time-off", payload);
  return res.data;
}


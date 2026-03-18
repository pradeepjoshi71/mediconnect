import api from "./apiClient";

export async function listDoctors({ search, specialization } = {}) {
  const res = await api.get("/doctors", { params: { search, specialization } });
  return res.data;
}

const API = "http://localhost:5000";

export async function getDoctors(){

  const res = await fetch(`${API}/doctors`);

  return res.json();

}

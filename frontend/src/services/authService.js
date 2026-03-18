import api from "./apiClient";
import { setAccessToken, setUser, clearSession } from "./session";

export async function login({ email, password, rememberMe }) {
  const res = await api.post("/auth/login", { email, password, rememberMe });
  setAccessToken(res.data.accessToken);
  setUser(res.data.user);
  return res.data;
}

export async function register({ fullName, email, password }) {
  const res = await api.post("/auth/register", { fullName, email, password });
  return res.data;
}

export async function logout() {
  try {
    await api.post("/auth/logout");
  } finally {
    clearSession();
  }
}

export async function refresh() {
  const res = await api.post("/auth/refresh");
  setAccessToken(res.data.accessToken);
  setUser(res.data.user);
  return res.data;
}

const API = "http://localhost:5000";

export async function register(fullName, email, password) {
  const response = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fullName, email, password }),
  });

  return response.json();
}

export async function login(email, password) {
  const response = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  return response.json();
}
export async function getAppointments() {

  const token = localStorage.getItem("token");

  const response = await fetch("http://localhost:5000/appointments", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.json();
}

import api from "./apiClient";
import { clearSession, setAccessToken, setUser } from "./session";

export async function login(payload) {
  const response = await api.post("/auth/login", payload);
  setAccessToken(response.data.accessToken);
  setUser(response.data.user);
  return response.data;
}

export async function register(payload) {
  const response = await api.post("/auth/register", payload);
  return response.data;
}

export async function refreshSession() {
  const response = await api.post("/auth/refresh");
  setAccessToken(response.data.accessToken);
  setUser(response.data.user);
  return response.data;
}

export async function fetchMe() {
  const response = await api.get("/auth/me");
  setUser(response.data.user);
  return response.data.user;
}

export async function logout() {
  try {
    await api.post("/auth/logout");
  } finally {
    clearSession();
  }
}

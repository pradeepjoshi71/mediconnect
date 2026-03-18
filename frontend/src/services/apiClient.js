import axios from "axios";
import { clearSession, getAccessToken, setAccessToken, setUser } from "./session";

const api = axios.create({
  baseURL: "/api/v1",
  withCredentials: true,
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    if (!originalRequest || originalRequest._retry || status !== 401) {
      throw error;
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = api.post("/auth/refresh").then((response) => {
          setAccessToken(response.data.accessToken);
          setUser(response.data.user);
          return response.data.accessToken;
        });
      }

      await refreshPromise;
      refreshPromise = null;
      return api(originalRequest);
    } catch (refreshError) {
      refreshPromise = null;
      clearSession();
      throw refreshError;
    }
  }
);

export default api;

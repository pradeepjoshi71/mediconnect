import axios from "axios";
import { getAccessToken, setAccessToken, clearSession } from "./session";

const api = axios.create({
  baseURL: "/api/v1",
  withCredentials: true,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing = null;
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    if (!original || original._retry) throw error;

    if (status === 401) {
      original._retry = true;
      try {
        if (!refreshing) {
          refreshing = api.post("/auth/refresh").then((res) => {
            setAccessToken(res.data.accessToken);
            return res.data.accessToken;
          });
        }
        await refreshing;
        refreshing = null;
        return api(original);
      } catch (e) {
        refreshing = null;
        clearSession();
        throw e;
      }
    }

    throw error;
  }
);

export default api;


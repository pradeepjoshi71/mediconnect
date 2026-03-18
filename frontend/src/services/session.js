const ACCESS_KEY = "mc_access";
const USER_KEY = "mc_user";

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function setAccessToken(token) {
  if (!token) return;
  localStorage.setItem(ACCESS_KEY, token);
}

export function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setUser(user) {
  if (!user) return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(USER_KEY);
}


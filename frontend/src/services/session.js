let inMemoryAccessToken = null;
const USER_KEY = "mc_user";

export function getAccessToken() {
  return inMemoryAccessToken;
}

export function setAccessToken(token) {
  inMemoryAccessToken = token || null;
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
  if (!user) {
    localStorage.removeItem(USER_KEY);
    return;
  }
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  inMemoryAccessToken = null;
  localStorage.removeItem(USER_KEY);
}

export function hasSession() {
  return Boolean(getAccessToken() && getUser());
}

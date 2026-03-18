const STORAGE_KEY = "mc_theme";

export function getTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  localStorage.setItem(STORAGE_KEY, theme);
}

export function toggleTheme() {
  const next = getTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}

